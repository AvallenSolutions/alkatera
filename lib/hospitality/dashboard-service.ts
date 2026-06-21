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
import { summariseWaste, wasteCo2e, type WasteRangeSummary } from './waste-service'

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

export interface ScoreComponent {
  key: string
  label: string
  /** 0..100, or null when there isn't enough data to score this dimension. */
  value: number | null
}
export interface VitalityScore {
  value: number
  label: string
  tone: 'good' | 'warn' | 'bad' | 'neutral'
  components: ScoreComponent[]
}

export interface WeeklyPoint {
  /** Week-start label, e.g. "12 May". */
  label: string
  value: number
}

export interface HospitalityDashboard {
  year: number
  total: number
  food: number
  supplies: number
  /** Carbon from throughput (food + supplies), kg CO2e — excludes waste. */
  throughput_co2e: number
  volume_rows: number
  prev_total: number
  /** 12 monthly contribution totals (Jan..Dec) for the year. */
  monthly: number[]
  /** Rolling 12-week trend of total footprint (carbon + waste), anchored to the latest activity. */
  weekly: WeeklyPoint[]
  /** Supply-chain water embodied in food/drink served, litres. */
  water_litres: number
  /** Land use embodied in food/drink served (biodiversity proxy), m²a. */
  land_m2a: number
  waste: WasteRangeSummary
  score: VitalityScore
  /** Per-pillar 0-100 ratings (year-on-year trend for climate/water/nature, diversion for waste). Null when not scorable. */
  pillar_scores: { climate: number | null; water: number | null; waste: number | null; nature: number | null }
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
function waterOf(aggregated: any): number {
  return Number(aggregated?.water_consumption ?? aggregated?.total_water ?? 0)
}
function landOf(aggregated: any): number {
  return Number(aggregated?.land_use ?? aggregated?.total_land ?? 0)
}

function isoWeekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = (x.getUTCDay() + 6) % 7 // Monday = 0
  x.setUTCDate(x.getUTCDate() - dow)
  return x
}
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`)
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
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
  const waterServeById = new Map<number, number>()
  const landServeById = new Map<number, number>()
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
        waterServeById.set(pcf.product_id, waterOf(pcf.aggregated_impacts) / covers)
        landServeById.set(pcf.product_id, landOf(pcf.aggregated_impacts) / covers)
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
  let waterLitres = 0
  let landM2a = 0
  let countedRows = 0
  const venueIds = new Set<string>()

  for (const v of vols ?? []) {
    const meta = productById.get(v.product_id)
    if (!meta) continue
    const contribution = perServing(v.product_id) * (Number(v.units_sold) || 0)
    const units = Number(v.units_sold) || 0
    countedRows += 1

    waterLitres += (waterServeById.get(v.product_id) ?? 0) * units
    landM2a += (landServeById.get(v.product_id) ?? 0) * units

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
  let prevWater = 0
  let prevLand = 0
  for (const v of prevVols ?? []) {
    if (!productById.has(v.product_id)) continue
    const units = Number(v.units_sold) || 0
    prevTotal += perServing(v.product_id) * units
    prevWater += (waterServeById.get(v.product_id) ?? 0) * units
    prevLand += (landServeById.get(v.product_id) ?? 0) * units
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

  // Waste (this year + prior year so YoY is like-for-like with the total).
  const waste = await summariseWaste(db, organizationId, yearStart, yearEnd)
  const prevWaste = await summariseWaste(db, organizationId, prevStart, prevEnd)
  const throughputCo2e = food + supplies
  const total = throughputCo2e + waste.total_co2e
  const prevTotalAll = prevTotal + prevWaste.total_co2e

  // Rolling 12-week trend of total footprint, anchored to the latest activity so
  // sparse data still shows a trend instead of an empty chart.
  const weekly = await buildWeekly(db, organizationId, perServing)

  // Self-contained 0-100 vitality score (no targets needed).
  const score = computeScore({
    recipesTotal: productList.length,
    recipesCosted: scope3ById.size,
    hasSales: countedRows > 0,
    waste,
    total,
    prevTotal: prevTotalAll,
  })

  // Per-pillar ratings. Climate/water/nature are year-on-year trend ratings
  // (lower is better → improvement scores above 50); waste is the diversion rate.
  const trendScore = (cur: number, prev: number): number | null =>
    prev > 0 ? Math.round(clamp(50 + ((prev - cur) / prev) * 100, 0, 100)) : null
  const pillar_scores = {
    climate: trendScore(total, prevTotalAll),
    water: trendScore(waterLitres, prevWater),
    nature: trendScore(landM2a, prevLand),
    waste: waste.total_kg > 0 ? Math.round(waste.diversion_rate * 100) : null,
  }

  return ok({
    year,
    total,
    food,
    supplies,
    throughput_co2e: throughputCo2e,
    volume_rows: countedRows,
    prev_total: prevTotalAll,
    monthly,
    weekly,
    water_litres: waterLitres,
    land_m2a: landM2a,
    waste,
    score,
    pillar_scores,
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

/** Build a 12-week footprint trend (carbon throughput + waste) ending at the latest activity week. */
async function buildWeekly(
  db: Db,
  organizationId: string,
  perServing: (productId: number) => number,
): Promise<WeeklyPoint[]> {
  const { data: vols } = await db
    .from('hospitality_service_volumes')
    .select('product_id, period_start, units_sold')
    .eq('organization_id', organizationId)
  const { data: wasteRows } = await db
    .from('hospitality_waste')
    .select('period_start, mass_kg, treatment_method')
    .eq('organization_id', organizationId)

  const dates = [
    ...(vols ?? []).map((v: any) => v.period_start),
    ...(wasteRows ?? []).map((w: any) => w.period_start),
  ].filter(Boolean) as string[]
  const anchor = dates.length > 0 ? new Date(Math.max(...dates.map((d) => parseDate(d).getTime()))) : new Date()
  const anchorWeek = isoWeekStart(anchor)

  // 12 weekly buckets ending at the anchor week.
  const buckets: WeeklyPoint[] = []
  const startMs = anchorWeek.getTime() - 11 * WEEK_MS
  const totals = new Array(12).fill(0) as number[]
  const weekIndex = (d: string): number => {
    const t = isoWeekStart(parseDate(d)).getTime()
    return Math.round((t - startMs) / WEEK_MS)
  }
  for (const v of vols ?? []) {
    const i = weekIndex(v.period_start)
    if (i >= 0 && i < 12) totals[i] += perServing(v.product_id) * (Number(v.units_sold) || 0)
  }
  for (const w of wasteRows ?? []) {
    const i = weekIndex(w.period_start)
    if (i >= 0 && i < 12) totals[i] += wasteCo2e(Number(w.mass_kg), w.treatment_method)
  }
  for (let i = 0; i < 12; i++) {
    const d = new Date(startMs + i * WEEK_MS)
    buckets.push({ label: `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`, value: totals[i] })
  }
  return buckets
}

function scoreBand(value: number): { label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' } {
  if (value >= 80) return { label: 'Strong', tone: 'good' }
  if (value >= 60) return { label: 'Good', tone: 'good' }
  if (value >= 40) return { label: 'Fair', tone: 'warn' }
  return { label: 'Needs work', tone: 'bad' }
}

function computeScore(input: {
  recipesTotal: number
  recipesCosted: number
  hasSales: boolean
  waste: WasteRangeSummary
  total: number
  prevTotal: number
}): VitalityScore {
  const { recipesTotal, recipesCosted, hasSales, waste, total, prevTotal } = input

  // Coverage: how complete the hospitality data is (always scorable).
  const costedRatio = recipesTotal > 0 ? recipesCosted / recipesTotal : 0
  const coverage = 0.7 * costedRatio * 100 + 0.3 * (hasSales ? 100 : 0)

  // Diversion: share of waste kept out of disposal (only when waste is logged).
  const diversion = waste.total_kg > 0 ? waste.diversion_rate * 100 : null

  // Trend: footprint moving down year on year (only when there's a prior year).
  const trend = prevTotal > 0 ? clamp(50 + ((prevTotal - total) / prevTotal) * 100, 0, 100) : null

  const parts: Array<{ key: string; label: string; value: number | null; weight: number }> = [
    { key: 'coverage', label: 'Data coverage', value: Math.round(coverage), weight: 0.4 },
    { key: 'diversion', label: 'Waste diversion', value: diversion == null ? null : Math.round(diversion), weight: 0.35 },
    { key: 'trend', label: 'Year-on-year trend', value: trend == null ? null : Math.round(trend), weight: 0.25 },
  ]
  const available = parts.filter((p) => p.value != null)
  const weightSum = available.reduce((s, p) => s + p.weight, 0) || 1
  const value = Math.round(available.reduce((s, p) => s + p.weight * (p.value as number), 0) / weightSum)
  const band = scoreBand(value)

  return {
    value,
    label: band.label,
    tone: band.tone,
    components: parts.map((p) => ({ key: p.key, label: p.label, value: p.value })),
  }
}
