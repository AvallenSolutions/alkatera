/**
 * Hospitality contribution to the company total (GHG Protocol Scope 3, Cat 1).
 *
 * Throughput-weighted: for each recorded service volume, the per-serving Scope-3
 * impact of the hospitality product (its PCF's scope3 ÷ covers) × units sold.
 *
 * What is INTENTIONALLY excluded, so nothing is double-counted:
 *   - Own-wine drinks served in the venue — not hospitality products; tagged
 *     internal_consumption on menus; already in production figures.
 *   - Venue energy/water — captured via facility data (Scope 1/2); room-night
 *     allocation is display-only and never enters the product PCF.
 * The remainder (purchased food + room consumables) is genuinely new Scope 3.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { summariseWaste } from '@/lib/hospitality/waste-service'
import { isHospitalityKind } from '@/lib/hospitality/constants'

export interface HospitalityEmissionsResult {
  /** Net-new Scope 3 from hospitality throughput + waste disposal, kg CO2e. */
  total: number
  /** Meals + made-drinks (purchased food/beverage ingredients). */
  food: number
  /** Room-night purchased consumables. */
  supplies: number
  /** Waste disposal (food + dry), GHG Protocol Scope 3 Cat 5, kg CO2e. */
  waste: number
  /**
   * Throughput-weighted EMBODIED water of the food/drink/consumables served, m³.
   * Supply-chain water (the ingredient PCFs), NOT the venue's operational metered
   * water — that stays in the facility water metric. Reported as its own line.
   */
  water_m3: number
  /** Throughput-weighted embodied land use of what was served, m². */
  land_m2: number
  /** Number of service-volume rows that contributed. */
  volume_rows: number
}

const EMPTY: HospitalityEmissionsResult = { total: 0, food: 0, supplies: 0, waste: 0, water_m3: 0, land_m2: 0, volume_rows: 0 }

function numFrom(aggregated: any, key: string): number {
  return Number(aggregated?.[key] ?? 0)
}

/**
 * Pull the Scope-3 figure from a PCF's aggregated_impacts. A hospitality meal is
 * cradle-to-gate so its impact is all Scope 3, but this guards against a PCF that
 * ever carries a Scope 1/2 split: use scope3 directly when present; if by_scope
 * exists without a scope3 key, derive total − scope1 − scope2 so facility Scope
 * 1/2 is never miscounted as Scope 3; only fall back to the full GWP when there
 * is no scope split at all.
 */
export function scope3Of(aggregated: any): number {
  const byScope = aggregated?.breakdown?.by_scope
  if (byScope && typeof byScope === 'object') {
    const s3 = Number(byScope.scope3 ?? NaN)
    if (Number.isFinite(s3)) return s3
    const total = Number(aggregated?.climate_change_gwp100 ?? 0)
    const s1 = Number(byScope.scope1 ?? 0)
    const s2 = Number(byScope.scope2 ?? 0)
    return Math.max(0, total - s1 - s2)
  }
  return Number(aggregated?.climate_change_gwp100 ?? 0)
}

export async function calculateHospitality(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart: string,
  yearEnd: string,
): Promise<HospitalityEmissionsResult> {
  const db = supabase as any

  // Waste disposal (Scope 3 Cat 5) counts even when no service volumes are recorded.
  const wasteSummary = await summariseWaste(db, organizationId, yearStart, yearEnd)
  const waste = wasteSummary.total_co2e

  const { data: vols } = await db
    .from('hospitality_service_volumes')
    .select('product_id, units_sold')
    .eq('organization_id', organizationId)
    .lte('period_start', yearEnd)
    .gte('period_end', yearStart)
  if (!vols || vols.length === 0) return { ...EMPTY, total: waste, waste }

  const productIds = Array.from(new Set(vols.map((v: any) => v.product_id)))

  const { data: products } = await db.from('products').select('id, product_kind').in('id', productIds)
  const kindById = new Map<number, string>((products ?? []).map((p: any) => [p.id, p.product_kind]))

  const { data: metas } = await db
    .from('hospitality_meal_meta')
    .select('product_id, covers, prep_waste_pct')
    .in('product_id', productIds)
  const coversById = new Map<number, number>((metas ?? []).map((m: any) => [m.product_id, Number(m.covers) || 1]))
  // Prep waste is extra food purchased beyond what is served, so it genuinely
  // belongs in Scope 3 (unlike cooking energy, which is display-only).
  const prepUpliftById = new Map<number, number>(
    (metas ?? []).map((m: any) => [m.product_id, 1 + Math.max(0, Number(m.prep_waste_pct) || 0) / 100]),
  )

  const { data: pcfs } = await db
    .from('product_carbon_footprints')
    .select('product_id, aggregated_impacts, created_at')
    .in('product_id', productIds)
    .order('created_at', { ascending: false })
  const scope3ById = new Map<number, number>()
  const waterById = new Map<number, number>()
  const landById = new Map<number, number>()
  for (const pcf of pcfs ?? []) {
    if (!scope3ById.has(pcf.product_id) && pcf.aggregated_impacts) {
      scope3ById.set(pcf.product_id, scope3Of(pcf.aggregated_impacts))
      waterById.set(pcf.product_id, numFrom(pcf.aggregated_impacts, 'water_consumption'))
      landById.set(pcf.product_id, numFrom(pcf.aggregated_impacts, 'land_use'))
    }
  }

  let food = 0
  let supplies = 0
  let water_m3 = 0
  let land_m2 = 0
  let counted = 0
  for (const v of vols) {
    const kind = kindById.get(v.product_id)
    if (!isHospitalityKind(kind)) continue
    const s3 = scope3ById.get(v.product_id)
    if (s3 == null) continue
    const covers = coversById.get(v.product_id) ?? 1
    const uplift = prepUpliftById.get(v.product_id) ?? 1
    const units = Number(v.units_sold) || 0
    const contribution = ((s3 * uplift) / covers) * units
    if (kind === 'hospitality_room_night') supplies += contribution
    else food += contribution
    water_m3 += (((waterById.get(v.product_id) ?? 0) * uplift) / covers) * units
    land_m2 += (((landById.get(v.product_id) ?? 0) * uplift) / covers) * units
    counted += 1
  }

  return { total: food + supplies + waste, food, supplies, waste, water_m3, land_m2, volume_rows: counted }
}
