/**
 * Hospitality service-volume service: list (with per-row company contribution),
 * create, delete, and CSV import. Reuses the shared CSV parser.
 */

import { parseCSV } from '@/lib/distributor/parsers/csv-parser'
import type { HospitalityProductOption, ServiceVolumeRow, VolumeImportSummary } from './volume-types'

type Db = any

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error })

const HOSPITALITY_KINDS = ['hospitality_meal', 'hospitality_drink', 'hospitality_room_night']

/** All hospitality products for the org (the things a volume row can point at). */
export async function listHospitalityProducts(db: Db, organizationId: string): Promise<HospitalityProductOption[]> {
  const { data } = await db
    .from('products')
    .select('id, name, product_kind')
    .eq('organization_id', organizationId)
    .in('product_kind', HOSPITALITY_KINDS)
    .order('name', { ascending: true })
  return (data ?? []) as HospitalityProductOption[]
}

/** Map product_id → { scope3, covers } for per-serving contribution maths. */
async function perServingFactors(db: Db, productIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  if (productIds.length === 0) return map
  const { data: metas } = await db
    .from('hospitality_meal_meta')
    .select('product_id, covers')
    .in('product_id', productIds)
  const covers = new Map<number, number>((metas ?? []).map((m: any) => [m.product_id, Number(m.covers) || 1]))
  const { data: pcfs } = await db
    .from('product_carbon_footprints')
    .select('product_id, aggregated_impacts, created_at')
    .in('product_id', productIds)
    .order('created_at', { ascending: false })
  const seen = new Set<number>()
  for (const pcf of pcfs ?? []) {
    if (seen.has(pcf.product_id) || !pcf.aggregated_impacts) continue
    seen.add(pcf.product_id)
    const a = pcf.aggregated_impacts
    const s3 = typeof a?.breakdown?.by_scope?.scope3 === 'number' ? a.breakdown.by_scope.scope3 : Number(a?.climate_change_gwp100 ?? 0)
    map.set(pcf.product_id, s3 / (covers.get(pcf.product_id) ?? 1))
  }
  return map
}

export async function listVolumes(
  db: Db,
  organizationId: string,
): Promise<ServiceResult<{ volumes: ServiceVolumeRow[]; products: HospitalityProductOption[] }>> {
  const products = await listHospitalityProducts(db, organizationId)
  const productName = new Map<number, { name: string; kind: string }>(
    products.map((p) => [p.id, { name: p.name, kind: p.product_kind }]),
  )

  const { data: rows, error } = await db
    .from('hospitality_service_volumes')
    .select('id, product_id, venue_id, period_start, period_end, units_sold')
    .eq('organization_id', organizationId)
    .order('period_start', { ascending: false })
  if (error) return fail(500, error.message)

  const perServing = await perServingFactors(db, (rows ?? []).map((r: any) => r.product_id))

  const volumes: ServiceVolumeRow[] = (rows ?? []).map((r: any) => {
    const ps = perServing.get(r.product_id)
    const meta = productName.get(r.product_id)
    return {
      id: r.id,
      product_id: r.product_id,
      product_name: meta?.name ?? `Product ${r.product_id}`,
      product_kind: meta?.kind ?? 'unknown',
      venue_id: r.venue_id ?? null,
      period_start: r.period_start,
      period_end: r.period_end,
      units_sold: Number(r.units_sold),
      contribution_co2e: ps != null ? ps * Number(r.units_sold) : null,
    }
  })
  return ok({ volumes, products })
}

function validPeriod(start: string, end: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start
}

export async function createVolume(db: Db, organizationId: string, body: any): Promise<ServiceResult<{ id: string }>> {
  const product_id = Number(body?.product_id)
  if (!Number.isFinite(product_id)) return fail(400, 'product_id required')
  const period_start = String(body?.period_start ?? '')
  const period_end = String(body?.period_end ?? '')
  if (!validPeriod(period_start, period_end)) return fail(400, 'period_start/period_end must be YYYY-MM-DD with end >= start')
  const units_sold = Number(body?.units_sold)
  if (!Number.isFinite(units_sold) || units_sold < 0) return fail(400, 'units_sold must be 0 or more')

  // Product must be a hospitality product belonging to the org.
  const { data: product } = await db
    .from('products')
    .select('id, product_kind')
    .eq('id', product_id)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!product || !HOSPITALITY_KINDS.includes(product.product_kind)) {
    return fail(400, 'product must be a hospitality meal, drink or room')
  }

  const { data, error } = await db
    .from('hospitality_service_volumes')
    .insert({
      organization_id: organizationId,
      product_id,
      venue_id: body?.venue_id ? String(body.venue_id) : null,
      period_start,
      period_end,
      units_sold,
      note: body?.note ? String(body.note) : null,
    })
    .select('id')
    .single()
  if (error) return fail(500, error.message)
  return ok({ id: data.id })
}

export async function deleteVolume(db: Db, organizationId: string, id: string): Promise<ServiceResult<{ ok: true }>> {
  const { error } = await db
    .from('hospitality_service_volumes')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)
  if (error) return fail(500, error.message)
  return ok({ ok: true })
}

/**
 * Import a CSV of service volumes. Expected columns (case-insensitive):
 *   product, units (or units_sold), period_start, period_end.
 * Rows whose `product` doesn't match a hospitality product by name are reported
 * back as unmatched, not inserted.
 */
export async function importVolumesCsv(db: Db, organizationId: string, csv: string): Promise<ServiceResult<VolumeImportSummary>> {
  const parsed = parseCSV(csv)
  if (parsed.error) return fail(400, parsed.error)
  if (parsed.rows.length === 0) return fail(400, 'CSV has no data rows')

  const products = await listHospitalityProducts(db, organizationId)
  const byName = new Map<string, number>(products.map((p) => [p.name.trim().toLowerCase(), p.id]))

  const header = (k: string, r: Record<string, string>): string => {
    const key = Object.keys(r).find((h) => h.trim().toLowerCase() === k)
    return key ? r[key] : ''
  }

  const toInsert: any[] = []
  const unmatched: VolumeImportSummary['unmatched'] = []
  const errors: string[] = []

  parsed.rows.forEach((r, i) => {
    const productName = header('product', r).trim()
    if (!productName) return
    const productId = byName.get(productName.toLowerCase())
    if (!productId) {
      unmatched.push({ row: i + 2, product: productName }) // +2: header + 1-based
      return
    }
    const units = Number(header('units_sold', r) || header('units', r))
    const start = header('period_start', r).trim()
    const end = header('period_end', r).trim()
    if (!Number.isFinite(units) || units < 0) {
      errors.push(`Row ${i + 2}: invalid units`)
      return
    }
    if (!validPeriod(start, end)) {
      errors.push(`Row ${i + 2}: invalid period (need YYYY-MM-DD, end >= start)`)
      return
    }
    toInsert.push({
      organization_id: organizationId,
      product_id: productId,
      period_start: start,
      period_end: end,
      units_sold: units,
    })
  })

  if (toInsert.length > 0) {
    const { error } = await db.from('hospitality_service_volumes').insert(toInsert)
    if (error) return fail(500, error.message)
  }

  return ok({ inserted: toInsert.length, unmatched, errors })
}
