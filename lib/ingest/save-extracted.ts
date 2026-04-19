import { supabase } from '@/lib/supabaseClient'
import { UTILITY_TYPES, WATER_CATEGORIES, WASTE_CATEGORIES } from '@/lib/constants/utility-types'
import type { ExtractedBillData } from '@/app/api/utilities/import-from-pdf/route'
import type {
  ExtractedFacilityBillData,
  ExtractedWaterEntry,
  ExtractedWasteEntry,
} from '@/app/api/facilities/import-bill/route'

// Save helpers shared by the Universal Dropzone. Each mirrors the inline save
// logic of the matching dedicated dialog verbatim so we don't split behaviour.
//
// TODO(ingest-refactor): Post-MVP, have
//   components/facilities/UtilityBillImportDialog.tsx
//   components/facilities/WaterBillImportDialog.tsx
//   components/facilities/WasteBillImportDialog.tsx
// import from here so the save path exists in one place.

export interface SaveBillCommon {
  facilityId: string
  organizationId: string
  userId: string
  periodStart: string
  periodEnd: string
  /** Optional user-supplied label for the bill as a whole. */
  billName?: string
}

async function triggerScope12Recalc(organizationId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invoke-scope1-2-calculations`
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organization_id: organizationId }),
    })
  } catch {
    /* non-blocking */
  }
}

export async function saveUtilityBill(
  bill: ExtractedBillData,
  common: SaveBillCommon,
): Promise<{ saved: number }> {
  const valid = (bill.entries || []).filter(
    (e) => e.utility_type && e.quantity > 0,
  )
  if (valid.length === 0) throw new Error('No valid utility entries to save')

  const trimmedName = (common.billName || '').trim()

  for (const entry of valid) {
    const utilityInfo = UTILITY_TYPES.find((u) => u.value === entry.utility_type)
    const unit = entry.unit || utilityInfo?.defaultUnit || 'kWh'
    const entryName = trimmedName
      ? valid.length > 1
        ? `${trimmedName} — ${utilityInfo?.label || entry.utility_type}`
        : trimmedName
      : null

    // Strip whitespace from supply-point IDs so future lookups by exact match
    // work regardless of how the PDF formatted them.
    const mpan = entry.mpan ? String(entry.mpan).replace(/\s+/g, '') : null
    const mprn = entry.mprn ? String(entry.mprn).replace(/\s+/g, '') : null

    const { error: utilError } = await supabase.from('utility_data_entries').insert({
      facility_id: common.facilityId,
      utility_type: entry.utility_type,
      quantity: entry.quantity,
      unit,
      reporting_period_start: common.periodStart,
      reporting_period_end: common.periodEnd,
      data_quality: 'actual',
      calculated_scope: '',
      created_by: common.userId,
      name: entryName,
      // Enriched fields from the broadened Claude extractor. All nullable;
      // older rows continue to carry nulls.
      mpan,
      mprn,
      meter_type: entry.meter_type ?? null,
      rate_breakdown:
        entry.rate_breakdown && entry.rate_breakdown.length > 0
          ? entry.rate_breakdown
          : null,
      emissions_factor_g_per_kwh: entry.emissions_factor_g_per_kwh ?? null,
      // Bill-level metadata gets copied onto every entry of the bill so any
      // single row carries full context without a join.
      fuel_mix: bill.fuel_mix ?? null,
      is_green_tariff: bill.is_green_tariff ?? null,
      supply_address: bill.supply_address ?? null,
      supply_postcode: bill.supply_postcode ?? null,
      gsp_group: bill.gsp_group ?? null,
      account_number: bill.account_number ?? null,
      ccl_amount_gbp: bill.ccl_amount_gbp ?? null,
      total_charged_gbp: bill.total_charged_gbp ?? null,
    })
    if (utilError) throw utilError

    const category = utilityInfo?.scope === '1' ? 'Scope 1' : 'Scope 2'
    await supabase.from('activity_data').insert({
      organization_id: common.organizationId,
      facility_id: common.facilityId,
      user_id: common.userId,
      name:
        entryName ||
        `${utilityInfo?.label || entry.utility_type} - ${common.periodStart} to ${common.periodEnd}`,
      category,
      quantity: entry.quantity,
      unit,
      fuel_type: utilityInfo?.fuelType || entry.utility_type,
      activity_date: common.periodEnd,
      reporting_period_start: common.periodStart,
      reporting_period_end: common.periodEnd,
    })
  }

  // Non-blocking emissions recalc — fire and forget.
  triggerScope12Recalc(common.organizationId)

  return { saved: valid.length }
}

async function saveFacilityActivityEntries<
  TEntry extends { activity_category: string; quantity: number; unit: string },
>(
  entries: TEntry[],
  common: SaveBillCommon,
  extra: (entry: TEntry) => Record<string, unknown>,
  defaultUnit: string,
  categoryLabel: (value: string) => string,
): Promise<{ saved: number }> {
  const valid = entries.filter((e) => e.activity_category && e.quantity > 0)
  if (valid.length === 0) throw new Error('No valid entries to save')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const trimmed = (common.billName || '').trim()

  for (const entry of valid) {
    const entryName = trimmed
      ? valid.length > 1
        ? `${trimmed} — ${categoryLabel(entry.activity_category)}`
        : trimmed
      : null

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/add-facility-activity-entry`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          facility_id: common.facilityId,
          organization_id: common.organizationId,
          activity_category: entry.activity_category,
          activity_date: common.periodStart,
          reporting_period_start: common.periodStart,
          reporting_period_end: common.periodEnd,
          quantity: entry.quantity,
          unit: entry.unit || defaultUnit,
          data_provenance: 'primary_measured_onsite',
          allocation_basis: 'none',
          name: entryName,
          ...extra(entry),
        }),
      },
    )
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Failed to save entry')
    }
  }

  return { saved: valid.length }
}

export function saveWaterBill(
  bill: ExtractedFacilityBillData<ExtractedWaterEntry>,
  common: SaveBillCommon,
) {
  return saveFacilityActivityEntries(
    bill.entries || [],
    common,
    (e) => ({ water_source_type: e.water_source_type || undefined }),
    'm³',
    (v) => WATER_CATEGORIES.find((c) => c.value === v)?.label || v,
  )
}

export function saveWasteBill(
  bill: ExtractedFacilityBillData<ExtractedWasteEntry>,
  common: SaveBillCommon,
) {
  return saveFacilityActivityEntries(
    bill.entries || [],
    common,
    (e) => ({ waste_treatment_method: e.waste_treatment_method || undefined }),
    'kg',
    (v) => WASTE_CATEGORIES.find((c) => c.value === v)?.label || v,
  )
}
