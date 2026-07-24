/**
 * The products list, in one round trip.
 *
 * GET /api/cellar/products — the rows the cellar's products list needs,
 * assembled server-side. The page used to run four sequential browser
 * queries (products, then a boundary pass, then a status pass, then a
 * completed-PCF pass for dqi/per-unit/volume) and stitch three Maps
 * together in the client; on an org with two hundred products that is four
 * round trips before anything renders.
 *
 * Here it is two queries: the products, and one PCF select covering every
 * field the list wants. JSON-path selects keep the payload slim (no full
 * aggregated_impacts blob crosses the wire).
 *
 * Sibling of /api/cellar/counts: same auth, same shape of response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { sumFacilityVolume } from '@/lib/products/portfolio'

export const runtime = 'nodejs'

/** One row per product, everything the card and the portfolio matrix need. */
export interface CellarProductRow {
  id: string
  name: string
  product_description: string | null
  product_image_url: string | null
  functional_unit: string | null
  unit_size_value: number | null
  unit_size_unit: string | null
  system_boundary: string
  archived_at: string | null
  created_at: string
  /** The latest PCF's boundary, which beats the products-table default. */
  pcf_boundary: string | null
  /** The latest PCF's status of ANY kind, for the provenance chip. */
  latest_pcf_status: string | null
  /** Impact-weighted data quality score (0-100) from the latest completed PCF. */
  dqi_score: number | null
  /** Per-unit climate footprint (kg CO2e). Estimates count: a product is born
   *  with a footprint, so the list shows the number whatever its provenance. */
  footprint_per_unit: number | null
  /** Annual volume summed from the PCF's facility detail, for the matrix. */
  annual_volume: number | null
}

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const organizationId = await resolveAccessibleOrg(
    client as any,
    user,
    url.searchParams.get('organization_id'),
  )
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 })
  }

  const includeArchived = url.searchParams.get('archived') === '1'
  const db = client as any

  let productQuery = db
    .from('products')
    // NB: functional_unit_type / _volume / _measure are NOT columns on
    // products (they live on product_carbon_footprints). The old client query
    // used select('*') and quietly got undefined for all three, so the list's
    // "legacy functional unit" fallback had never once run.
    .select(
      'id, name, product_description, product_image_url, functional_unit, unit_size_value, unit_size_unit, system_boundary, archived_at, created_at',
    )
    // Only true products belong in this list. Hospitality meals, drinks and
    // room nights reuse the products table but are surfaced under Hospitality.
    .eq('product_kind', 'product')
    .eq('organization_id', organizationId)
  if (!includeArchived) productQuery = productQuery.is('archived_at', null)

  const { data: products, error: productError } = await productQuery
    .order('created_at', { ascending: false })
    .limit(200)

  if (productError) {
    return NextResponse.json({ error: productError.message }, { status: 500 })
  }

  const rows: any[] = products ?? []
  const productIds = rows.map((p) => p.id)

  // One PCF pass for everything: newest first, so the first row seen per
  // product is the latest. Boundary and status come from that latest row of
  // any status; the footprint figures come from the latest row that actually
  // carries them (a draft with no aggregated_impacts must not blank a number
  // an earlier completed run produced).
  const { data: pcfs } = productIds.length
    ? await db
        .from('product_carbon_footprints')
        .select(
          'product_id, status, system_boundary, dqi_score, perUnit:aggregated_impacts->climate_change_gwp100, facilityDetail:aggregated_impacts->facility_detail',
        )
        .in('product_id', productIds)
        .order('created_at', { ascending: false })
    : { data: [] as any[] }

  const latest = new Map<string, { status: string | null; boundary: string | null }>()
  const figures = new Map<
    string,
    { dqi: number | null; perUnit: number | null; volume: number | null }
  >()

  for (const pcf of pcfs ?? []) {
    if (pcf.product_id == null) continue
    const pid = String(pcf.product_id)

    if (!latest.has(pid)) {
      latest.set(pid, { status: pcf.status ?? null, boundary: pcf.system_boundary ?? null })
    } else if (pcf.system_boundary && latest.get(pid)!.boundary == null) {
      // The newest PCF may predate the boundary column being set; fall back to
      // the most recent row that does carry one, as the old client pass did.
      latest.get(pid)!.boundary = pcf.system_boundary
    }

    if (!figures.has(pid) && pcf.perUnit != null) {
      figures.set(pid, {
        dqi: pcf.dqi_score != null ? Number(pcf.dqi_score) : null,
        perUnit: Number(pcf.perUnit),
        volume: sumFacilityVolume(pcf.facilityDetail as any),
      })
    }
  }

  const assembled: CellarProductRow[] = rows.map((p) => {
    const pid = String(p.id)
    const meta = latest.get(pid)
    const figure = figures.get(pid)
    return {
      ...p,
      id: pid,
      pcf_boundary: meta?.boundary ?? null,
      latest_pcf_status: meta?.status ?? null,
      dqi_score: figure?.dqi ?? null,
      footprint_per_unit: figure?.perUnit ?? null,
      annual_volume: figure?.volume ?? null,
    }
  })

  return NextResponse.json({ products: assembled })
}
