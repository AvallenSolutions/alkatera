/**
 * Hospitality service-volume service: list (with per-row company contribution),
 * create, delete, and CSV import. Reuses the shared CSV parser.
 */

import { parseCSV } from '@/lib/distributor/parsers/csv-parser'
import { HOSPITALITY_KINDS, isHospitalityKind } from './constants'
import type {
  HospitalityProductOption,
  PosSalesPreview,
  PosMatchedItem,
  PosUnmatchedItem,
  ServiceVolumeRow,
  VolumeImportSummary,
  VolumeMatchSuggestion,
} from './volume-types'

type Db = any

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error })

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

// ── Fuzzy product-name matching (CSV import) ──────────────────────────────────
// Tolerates the small differences between a POS export and the product name in
// alkatera ("Beef Ragu" vs "Beef ragù", "House G&T" vs "House G and T") so a
// near-miss becomes a one-click confirmation instead of a dead-end "skipped".

function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(s: string): string[] {
  return normaliseName(s).split(' ').filter(Boolean)
}

/** 0..1 similarity from token overlap (Jaccard) plus a substring bonus. */
function similarity(a: string, b: string): number {
  const na = normaliseName(a)
  const nb = normaliseName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const ta = new Set(tokens(a))
  const tb = new Set(tokens(b))
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of Array.from(ta)) if (tb.has(t)) shared++
  const jaccard = shared / (ta.size + tb.size - shared)
  const substring = na.includes(nb) || nb.includes(na) ? 0.3 : 0
  return Math.min(1, jaccard + substring)
}

const AUTO_MATCH_THRESHOLD = 0.9 // safe to insert without asking
const SUGGEST_THRESHOLD = 0.34 // worth offering as a pick

function rankSuggestions(name: string, products: HospitalityProductOption[]): VolumeMatchSuggestion[] {
  return products
    .map((p) => ({ id: p.id, name: p.name, product_kind: p.product_kind, score: Number(similarity(name, p.name).toFixed(3)) }))
    .filter((s) => s.score >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
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
  if (!product || !isHospitalityKind(product.product_kind)) {
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
  const byName = new Map<string, number>(products.map((p) => [normaliseName(p.name), p.id]))

  const header = (k: string, r: Record<string, string>): string => {
    const key = Object.keys(r).find((h) => h.trim().toLowerCase() === k)
    return key ? r[key] : ''
  }

  const toInsert: any[] = []
  const unmatched: VolumeImportSummary['unmatched'] = []
  const errors: string[] = []
  let autoMatched = 0

  parsed.rows.forEach((r, i) => {
    const productName = header('product', r).trim()
    if (!productName) return
    const unitsRaw = header('units_sold', r) || header('units', r)
    const units = Number(unitsRaw)
    const start = header('period_start', r).trim()
    const end = header('period_end', r).trim()

    // Resolve the product: exact (normalised) first, then a single high-confidence
    // fuzzy match; otherwise hand back ranked suggestions to resolve in-app.
    let productId = byName.get(normaliseName(productName))
    let wasFuzzy = false
    if (!productId) {
      const ranked = rankSuggestions(productName, products)
      if (ranked.length > 0 && ranked[0].score >= AUTO_MATCH_THRESHOLD) {
        productId = ranked[0].id
        wasFuzzy = true
      } else {
        unmatched.push({
          row: i + 2, // +2: header + 1-based
          product: productName,
          units_sold: Number.isFinite(units) && units >= 0 ? units : null,
          period_start: start,
          period_end: end,
          suggestions: ranked,
        })
        return
      }
    }

    if (!Number.isFinite(units) || units < 0) {
      errors.push(`Row ${i + 2}: invalid units`)
      return
    }
    if (!validPeriod(start, end)) {
      errors.push(`Row ${i + 2}: invalid period (need YYYY-MM-DD, end >= start)`)
      return
    }
    if (wasFuzzy) autoMatched++
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

  return ok({ inserted: toInsert.length, auto_matched: autoMatched, unmatched, errors })
}

// ── POS sales export preview ──────────────────────────────────────────────────

const POS_NAME_KEYS = ['item', 'item name', 'product', 'name', 'menu item', 'description', 'sku']
const POS_QTY_KEYS = ['quantity', 'qty', 'units', 'units sold', 'items sold', 'count', 'sold', 'number sold', 'qty sold']

function pickColumn(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.trim().toLowerCase())
  for (const c of candidates) {
    const idx = lower.indexOf(c)
    if (idx >= 0) return headers[idx]
  }
  for (let i = 0; i < lower.length; i++) {
    if (candidates.some((c) => lower[i].includes(c))) return headers[i]
  }
  return null
}

function parseQuantity(raw: string): number {
  // Tolerate thousands separators ("1,240") and stray text.
  const cleaned = String(raw ?? '').replace(/[^0-9.\-]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Parse a POS item-sales export, aggregate quantities per item, and match each
 * item to a hospitality product. Returns a preview (nothing is written) so the
 * user can confirm matches and resolve the rest before creating volume rows.
 */
export async function previewPosSales(db: Db, organizationId: string, csv: string): Promise<ServiceResult<PosSalesPreview>> {
  const parsed = parseCSV(csv)
  if (parsed.error) return fail(400, parsed.error)
  if (parsed.rows.length === 0) return fail(400, 'CSV has no data rows')

  const headers = Object.keys(parsed.rows[0])
  const nameCol = pickColumn(headers, POS_NAME_KEYS)
  const qtyCol = pickColumn(headers, POS_QTY_KEYS)
  if (!nameCol) return fail(400, 'Could not find an item-name column (expected e.g. "Item", "Product").')
  if (!qtyCol) return fail(400, 'Could not find a quantity column (expected e.g. "Quantity", "Items sold").')

  // Aggregate units per item name (a POS export often has one row per item per day).
  const agg = new Map<string, { display: string; units: number }>()
  let skippedNoQty = 0
  let rowsParsed = 0
  for (const r of parsed.rows) {
    const name = String(r[nameCol] ?? '').trim()
    if (!name) continue
    rowsParsed++
    const qty = parseQuantity(String(r[qtyCol] ?? ''))
    if (!Number.isFinite(qty) || qty <= 0) {
      skippedNoQty++
      continue
    }
    const key = normaliseName(name)
    const existing = agg.get(key)
    if (existing) existing.units += qty
    else agg.set(key, { display: name, units: qty })
  }

  const products = await listHospitalityProducts(db, organizationId)
  const byName = new Map<string, HospitalityProductOption>(products.map((p) => [normaliseName(p.name), p]))

  // Roll matched items up per product (two POS names can map to one product).
  const matchedByProduct = new Map<number, PosMatchedItem>()
  const unmatched: PosUnmatchedItem[] = []

  for (const { display, units } of Array.from(agg.values())) {
    let product = byName.get(normaliseName(display))
    if (!product) {
      const ranked = rankSuggestions(display, products)
      if (ranked.length > 0 && ranked[0].score >= AUTO_MATCH_THRESHOLD) {
        product = products.find((p) => p.id === ranked[0].id)
      }
      if (!product) {
        unmatched.push({ name: display, units: Math.round(units * 100) / 100, suggestions: ranked })
        continue
      }
    }
    const existing = matchedByProduct.get(product.id)
    if (existing) {
      existing.units += units
      existing.matched_from.push(display)
    } else {
      matchedByProduct.set(product.id, {
        product_id: product.id,
        product_name: product.name,
        product_kind: product.product_kind,
        units,
        matched_from: [display],
      })
    }
  }

  const matched = Array.from(matchedByProduct.values())
    .map((m) => ({ ...m, units: Math.round(m.units * 100) / 100 }))
    .sort((a, b) => a.product_name.localeCompare(b.product_name))

  return ok({ rows_parsed: rowsParsed, skipped_no_quantity: skippedNoQty, matched, unmatched })
}
