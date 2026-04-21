import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// Import Breww monthly volumes into facility_production_volumes.
//
// Source = 'brewing'   → aggregate brewery_production_runs (hL brewed)
// Source = 'packaging' → aggregate breww_packaging_runs (litres packaged)
//
// Scope is narrowed to the rows linked to the target facility via
// breww_facility_links (brewing site for 'brewing', packaging site for
// 'packaging'). Skips any reporting period where a Primary row already
// exists on the facility so we never silently overwrite manual entry.

type ImportSource = 'brewing' | 'packaging'

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const organizationId = searchParams.get('organizationId')
    const facilityId = searchParams.get('facilityId')
    if (!organizationId || !facilityId) {
      return NextResponse.json(
        { error: 'organizationId and facilityId required' },
        { status: 400 },
      )
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: membership } = await service
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const { data: connection } = await service
      .from('integration_connections')
      .select('status')
      .eq('organization_id', organizationId)
      .eq('provider_slug', 'breww')
      .maybeSingle()
    const connected = connection?.status === 'active'

    if (!connected) {
      return NextResponse.json({
        connected: false,
        hasLink: false,
        linkedSiteIds: [],
        brewingRows: [],
        packagingRows: [],
      })
    }

    // Find which Breww sites are linked to this facility.
    const { data: links } = await service
      .from('breww_facility_links')
      .select('breww_site_external_id')
      .eq('organization_id', organizationId)
      .eq('alkatera_facility_id', facilityId)
    const linkedSiteIds = (links ?? []).map((l) => l.breww_site_external_id)

    // Existing manual rows (skip list).
    const { data: existing } = await service
      .from('facility_production_volumes')
      .select('reporting_period_start, data_source_type')
      .eq('facility_id', facilityId)
      .eq('organization_id', organizationId)
    const takenPeriods = new Set(
      (existing ?? [])
        .filter((r) => r.data_source_type === 'Primary')
        .map((r) => String(r.reporting_period_start)),
    )

    const preview = await buildPreview(service, organizationId, linkedSiteIds, takenPeriods)

    return NextResponse.json({
      connected: true,
      linkedSiteIds,
      hasLink: linkedSiteIds.length > 0,
      ...preview,
    })
  } catch (err: any) {
    console.error('[breww/import-facility-volumes GET]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { organizationId, facilityId, source, months } = body as {
      organizationId: string
      facilityId: string
      source: ImportSource
      months: string[]
    }
    if (!organizationId || !facilityId || !source || !Array.isArray(months) || months.length === 0) {
      return NextResponse.json(
        { error: 'organizationId, facilityId, source, months[] required' },
        { status: 400 },
      )
    }
    if (source !== 'brewing' && source !== 'packaging') {
      return NextResponse.json({ error: 'source must be brewing | packaging' }, { status: 400 })
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: membership } = await service
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const { data: links } = await service
      .from('breww_facility_links')
      .select('breww_site_external_id')
      .eq('organization_id', organizationId)
      .eq('alkatera_facility_id', facilityId)
    const linkedSiteIds = (links ?? []).map((l) => l.breww_site_external_id)

    const { data: existing } = await service
      .from('facility_production_volumes')
      .select('reporting_period_start, data_source_type')
      .eq('facility_id', facilityId)
      .eq('organization_id', organizationId)
    const takenPeriods = new Set(
      (existing ?? [])
        .filter((r) => r.data_source_type === 'Primary')
        .map((r) => String(r.reporting_period_start)),
    )

    const preview = await buildPreview(service, organizationId, linkedSiteIds, takenPeriods)
    const rows = source === 'brewing' ? preview.brewingRows : preview.packagingRows

    const toImport = rows.filter((r) => months.includes(r.month) && !r.skipped)
    let inserted = 0
    const errors: string[] = []
    for (const row of toImport) {
      const bounds = monthBounds(row.month)
      const notes = source === 'brewing'
        ? `Imported from Breww brewing runs (${row.siteLabel})`
        : `Imported from Breww packaged units (${row.siteLabel})`
      const { error } = await service
        .from('facility_production_volumes')
        .upsert(
          {
            facility_id: facilityId,
            organization_id: organizationId,
            reporting_period_start: bounds.start,
            reporting_period_end: bounds.end,
            production_volume: row.volume,
            volume_unit: row.unit,
            data_source_type: 'Primary',
            notes,
            created_by: user.id,
          },
          { onConflict: 'facility_id,reporting_period_start,reporting_period_end' },
        )
      if (error) errors.push(`${row.month}: ${error.message}`)
      else inserted += 1
    }

    return NextResponse.json({ success: true, inserted, errors })
  } catch (err: any) {
    console.error('[breww/import-facility-volumes POST]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface MonthRow {
  month: string
  volume: number
  unit: string
  siteLabel: string
  skipped: boolean
  skippedReason?: string
}

async function buildPreview(
  service: ReturnType<typeof createClient>,
  organizationId: string,
  linkedSiteIds: string[],
  takenPeriods: Set<string>,
): Promise<{ brewingRows: MonthRow[]; packagingRows: MonthRow[] }> {
  // Brewing rows from brewery_production_runs.
  let brewingQuery = service
    .from('brewery_production_runs')
    .select('period_start, volume_hl, site_external_id, site_name')
    .eq('organization_id', organizationId)
  if (linkedSiteIds.length > 0) {
    brewingQuery = brewingQuery.in('site_external_id', linkedSiteIds)
  }
  const { data: brewingRaw } = await brewingQuery

  const brewByMonth = new Map<string, { hl: number; sites: Set<string> }>()
  for (const row of brewingRaw ?? []) {
    const month = String(row.period_start).slice(0, 7)
    const cur = brewByMonth.get(month) ?? { hl: 0, sites: new Set<string>() }
    cur.hl += Number(row.volume_hl || 0)
    if (row.site_name) cur.sites.add(row.site_name)
    brewByMonth.set(month, cur)
  }
  const brewingRows: MonthRow[] = Array.from(brewByMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, v]) => {
      const bounds = monthBounds(month)
      const skipped = takenPeriods.has(bounds.start)
      return {
        month,
        volume: Number(v.hl.toFixed(3)),
        unit: 'Hectolitres',
        siteLabel: Array.from(v.sites).join(' + ') || 'unassigned sites',
        skipped,
        skippedReason: skipped ? 'Manual Primary entry already exists' : undefined,
      }
    })

  // Packaging rows from breww_packaging_runs.
  let pkgQuery = service
    .from('breww_packaging_runs')
    .select('packaged_at, quantity_packaged, volume_ml, site_external_id, site_name')
    .eq('organization_id', organizationId)
  if (linkedSiteIds.length > 0) {
    pkgQuery = pkgQuery.in('site_external_id', linkedSiteIds)
  }
  const { data: pkgRaw } = await pkgQuery

  const pkgByMonth = new Map<string, { litres: number; sites: Set<string> }>()
  const today = new Date().toISOString().slice(0, 10)
  for (const row of pkgRaw ?? []) {
    const qty = Number(row.quantity_packaged || 0)
    if (qty <= 0 || !row.packaged_at) continue
    if (String(row.packaged_at) > today) continue
    const month = String(row.packaged_at).slice(0, 7)
    const litres = Number(row.volume_ml || 0) / 1000
    const cur = pkgByMonth.get(month) ?? { litres: 0, sites: new Set<string>() }
    cur.litres += litres
    if (row.site_name) cur.sites.add(row.site_name)
    pkgByMonth.set(month, cur)
  }
  const packagingRows: MonthRow[] = Array.from(pkgByMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, v]) => {
      const bounds = monthBounds(month)
      const skipped = takenPeriods.has(bounds.start)
      return {
        month,
        volume: Number(v.litres.toFixed(2)),
        unit: 'Litres',
        siteLabel: Array.from(v.sites).join(' + ') || 'unassigned sites',
        skipped,
        skippedReason: skipped ? 'Manual Primary entry already exists' : undefined,
      }
    })

  return { brewingRows, packagingRows }
}

function monthBounds(monthIso: string): { start: string; end: string } {
  const [y, m] = monthIso.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { start, end }
}
