/**
 * Hospitality dashboard aggregations.
 *
 * One read model behind the rebuilt hospitality overview. Mirrors the company
 * contribution maths in lib/calculations/hospitality-emissions.ts (per-serving
 * Scope 3 = PCF scope3 ÷ covers, × units sold) so the dashboard totals match the
 * Sales page and the company footprint, then adds the breakdowns a Pulse-quality
 * overview needs: by kind, by venue, top products, a monthly trend, year-on-year,
 * and data-coverage counts.
 */

import { listMenus } from './menu-service'

type Db = any

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }
const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })
const fail = (status: number, error: string): ServiceResult<never> => ({ ok: false, status, error })

const HOSPITALITY_KINDS = ['hospitality_meal', 'hospitality_drink', 'hospitality_room_night'] as const
type Kind = (typeof HOSPITALITY_KINDS)[number]

export interface KindBreakdown {
  kind: Kind
  contribution: number
  units: number
  /** Total recipes of this kind. */
  product_count: number
  /** Recipes of this kind with a calculated footprint. */
  costed_count: number
  /** Mean per-cover climate impact across costed recipes (kg CO2e). */
  avg_per_cover: number | null
}

export interface RankRow {
  id: string
  name: string
  sub?: string | null
  contribution: number
  units: number
}

export interface HospitalityDashboard {
  year: number
  total: number
  food: number
  supplies: number
  volume_rows: number
  prev_total: number
  /** 12 monthly contribution totals (Jan..Dec) for the year. */
  monthly: number[]
  by_kind: KindBreakdown[]
  by_venue: RankRow[]
  top_products: Array<RankRow & { kind: Kind }>
  coverage: {
    recipes_total: number
    recipes_costed: number
    menus: number
    menus_avg_co2e: number | null
    venues: number
    has_sales: boolean
  }
}

function scope3Of(aggregated: any): number {
  const s3 = aggregated?.breakdown?.by_scope?.scope3
  if (typeof s3 === 'number') return s3
  return Number(aggregated?.climate_change_gwp100 ?? 0)
}

function climateOf(aggregated: any): number {
  return Number(aggregated?.climate_change_gwp100 ?? aggregated?.breakdown?.by_scope?.scope3 ?? 0)
}

export async function getHospitalityDashboard(
  db: Db,
  organizationId: string,
  year: number,
): Promise<ServiceResult<HospitalityDashboard>> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const prevStart = `${year - 1}-01-01`
  const prevEnd = `${year - 1}-12-31`

  // All hospitality products (for coverage + per-product naming/kind).
  const { data: products, error: prodErr } = await db
    .from('products')
    .select('id, name, product_kind')
    .eq('organization_id', organizationId)
    .in('product_kind', HOSPITALITY_KINDS as unknown as string[])
  if (prodErr) return fail(500, prodErr.message)
  const productList = (products ?? []) as Array<{ id: number; name: string; product_kind: Kind }>
  const productById = new Map<number, { name: string; kind: Kind }>(
    productList.map((p) => [p.id, { name: p.name, kind: p.product_kind }]),
  )
  const ids = productList.map((p) => p.id)

  // covers + latest PCF per product → per-serving scope3 and per-cover climate.
  const coversById = new Map<number, number>()
  const scope3ById = new Map<number, number>()
  const perCoverClimateById = new Map<number, number>()
  if (ids.length > 0) {
    const { data: metas } = await db.from('hospitality_meal_meta').select('product_id, covers').in('product_id', ids)
    for (const m of metas ?? []) coversById.set(m.product_id, Number(m.covers) || 1)

    const { data: pcfs } = await db
      .from('product_carbon_footprints')
      .select('product_id, aggregated_impacts, created_at')
      .in('product_id', ids)
      .order('created_at', { ascending: false })
    for (const pcf of pcfs ?? []) {
      if (!scope3ById.has(pcf.product_id) && pcf.aggregated_impacts) {
        const covers = coversById.get(pcf.product_id) ?? 1
        scope3ById.set(pcf.product_id, scope3Of(pcf.aggregated_impacts))
        perCoverClimateById.set(pcf.product_id, climateOf(pcf.aggregated_impacts) / covers)
      }
    }
  }

  const perServing = (productId: number): number => {
    const s3 = scope3ById.get(productId)
    if (s3 == null) return 0
    return s3 / (coversById.get(productId) ?? 1)
  }

  // Volumes for the year (same overlap filter as calculateHospitality).
  const { data: vols, error: volErr } = await db
    .from('hospitality_service_volumes')
    .select('product_id, venue_id, period_start, period_end, units_sold')
    .eq('organization_id', organizationId)
    .lte('period_start', yearEnd)
    .gte('period_end', yearStart)
  if (volErr) return fail(500, volErr.message)

  // Aggregate.
  const kindAgg = new Map<Kind, { contribution: number; units: number }>()
  const venueAgg = new Map<string, { contribution: number; units: number }>()
  const productAgg = new Map<number, { contribution: number; units: number }>()
  const monthly = new Array(12).fill(0) as number[]
  let food = 0
  let supplies = 0
  let countedRows = 0
  const venueIds = new Set<string>()

  for (const v of vols ?? []) {
    const meta = productById.get(v.product_id)
    if (!meta) continue
    const contribution = perServing(v.product_id) * (Number(v.units_sold) || 0)
    const units = Number(v.units_sold) || 0
    countedRows += 1

    if (meta.kind === 'hospitality_room_night') supplies += contribution
    else food += contribution

    const ka = kindAgg.get(meta.kind) ?? { contribution: 0, units: 0 }
    ka.contribution += contribution
    ka.units += units
    kindAgg.set(meta.kind, ka)

    const vKey = v.venue_id ? String(v.venue_id) : '__none__'
    if (v.venue_id) venueIds.add(String(v.venue_id))
    const va = venueAgg.get(vKey) ?? { contribution: 0, units: 0 }
    va.contribution += contribution
    va.units += units
    venueAgg.set(vKey, va)

    const pa = productAgg.get(v.product_id) ?? { contribution: 0, units: 0 }
    pa.contribution += contribution
    pa.units += units
    productAgg.set(v.product_id, pa)

    const month = Number(String(v.period_start).slice(5, 7)) - 1
    if (month >= 0 && month < 12) monthly[month] += contribution
  }

  // Prior-year total (reuse the same per-serving maps).
  const { data: prevVols } = await db
    .from('hospitality_service_volumes')
    .select('product_id, units_sold')
    .eq('organization_id', organizationId)
    .lte('period_start', prevEnd)
    .gte('period_end', prevStart)
  let prevTotal = 0
  for (const v of prevVols ?? []) {
    if (!productById.has(v.product_id)) continue
    prevTotal += perServing(v.product_id) * (Number(v.units_sold) || 0)
  }

  // Per-kind breakdown with coverage.
  const by_kind: KindBreakdown[] = HOSPITALITY_KINDS.map((kind) => {
    const ofKind = productList.filter((p) => p.product_kind === kind)
    const costed = ofKind.filter((p) => scope3ById.has(p.id))
    const perCovers = costed.map((p) => perCoverClimateById.get(p.id) ?? 0).filter((n) => n > 0)
    const agg = kindAgg.get(kind) ?? { contribution: 0, units: 0 }
    return {
      kind,
      contribution: agg.contribution,
      units: agg.units,
      product_count: ofKind.length,
      costed_count: costed.length,
      avg_per_cover: perCovers.length > 0 ? perCovers.reduce((s, n) => s + n, 0) / perCovers.length : null,
    }
  })

  // Venue names.
  const venueNames = new Map<string, string>()
  if (venueIds.size > 0) {
    const { data: venues } = await db
      .from('hospitality_venues')
      .select('id, name')
      .in('id', Array.from(venueIds))
    for (const vn of venues ?? []) venueNames.set(vn.id, vn.name)
  }
  const by_venue: RankRow[] = Array.from(venueAgg.entries())
    .map(([key, agg]) => ({
      id: key,
      name: key === '__none__' ? 'Unassigned' : venueNames.get(key) ?? 'Venue',
      contribution: agg.contribution,
      units: agg.units,
    }))
    .sort((a, b) => b.contribution - a.contribution)

  const KIND_LABEL: Record<Kind, string> = {
    hospitality_meal: 'Meal',
    hospitality_drink: 'Drink',
    hospitality_room_night: 'Room',
  }
  const top_products = Array.from(productAgg.entries())
    .map(([pid, agg]) => {
      const meta = productById.get(pid)!
      return {
        id: String(pid),
        name: meta.name,
        kind: meta.kind,
        sub: KIND_LABEL[meta.kind],
        contribution: agg.contribution,
        units: agg.units,
      }
    })
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 8)

  // Menus (reuse the live menu impact computation) + venues count.
  let menus = 0
  let menusAvg: number | null = null
  const menusRes = await listMenus(db, organizationId)
  if (menusRes.ok) {
    const list = menusRes.data as Array<{ avg_co2e: number | null }>
    menus = list.length
    const priced = list.map((m) => m.avg_co2e).filter((n): n is number => typeof n === 'number')
    menusAvg = priced.length > 0 ? priced.reduce((s, n) => s + n, 0) / priced.length : null
  }
  const { count: venuesCount } = await db
    .from('hospitality_venues')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'active')

  return ok({
    year,
    total: food + supplies,
    food,
    supplies,
    volume_rows: countedRows,
    prev_total: prevTotal,
    monthly,
    by_kind,
    by_venue,
    top_products,
    coverage: {
      recipes_total: productList.length,
      recipes_costed: scope3ById.size,
      menus,
      menus_avg_co2e: menusAvg,
      venues: venuesCount ?? 0,
      has_sales: countedRows > 0,
    },
  })
}
