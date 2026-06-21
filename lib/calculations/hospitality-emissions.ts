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

export interface HospitalityEmissionsResult {
  /** Net-new Scope 3 from hospitality throughput + waste disposal, kg CO2e. */
  total: number
  /** Meals + made-drinks (purchased food/beverage ingredients). */
  food: number
  /** Room-night purchased consumables. */
  supplies: number
  /** Waste disposal (food + dry), GHG Protocol Scope 3 Cat 5, kg CO2e. */
  waste: number
  /** Number of service-volume rows that contributed. */
  volume_rows: number
}

const HOSPITALITY_KINDS = ['hospitality_meal', 'hospitality_drink', 'hospitality_room_night']

const EMPTY: HospitalityEmissionsResult = { total: 0, food: 0, supplies: 0, waste: 0, volume_rows: 0 }

/** Pull the Scope-3 figure from a PCF's aggregated_impacts (ingredient impact is all Scope 3). */
function scope3Of(aggregated: any): number {
  const s3 = aggregated?.breakdown?.by_scope?.scope3
  if (typeof s3 === 'number') return s3
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
    .select('product_id, covers')
    .in('product_id', productIds)
  const coversById = new Map<number, number>((metas ?? []).map((m: any) => [m.product_id, Number(m.covers) || 1]))

  const { data: pcfs } = await db
    .from('product_carbon_footprints')
    .select('product_id, aggregated_impacts, created_at')
    .in('product_id', productIds)
    .order('created_at', { ascending: false })
  const scope3ById = new Map<number, number>()
  for (const pcf of pcfs ?? []) {
    if (!scope3ById.has(pcf.product_id) && pcf.aggregated_impacts) {
      scope3ById.set(pcf.product_id, scope3Of(pcf.aggregated_impacts))
    }
  }

  let food = 0
  let supplies = 0
  let counted = 0
  for (const v of vols) {
    const kind = kindById.get(v.product_id)
    if (!kind || !HOSPITALITY_KINDS.includes(kind)) continue
    const s3 = scope3ById.get(v.product_id)
    if (s3 == null) continue
    const covers = coversById.get(v.product_id) ?? 1
    const contribution = (s3 / covers) * (Number(v.units_sold) || 0)
    if (kind === 'hospitality_room_night') supplies += contribution
    else food += contribution
    counted += 1
  }

  return { total: food + supplies + waste, food, supplies, waste, volume_rows: counted }
}
