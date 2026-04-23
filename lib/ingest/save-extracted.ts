import { supabase } from '@/lib/supabaseClient'
import { WATER_CATEGORIES, WASTE_CATEGORIES } from '@/lib/constants/utility-types'
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
  // Delegates to /api/utilities/save-bill which runs on the service-role
  // client — the previous anon-client insert was hitting a PostgREST schema
  // cache miss on enrichment columns (account_number, mpan, etc.) and
  // failing with "Could not find the 'account_number' column…".
  const res = await fetch('/api/utilities/save-bill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      facilityId: common.facilityId,
      organizationId: common.organizationId,
      periodStart: common.periodStart,
      periodEnd: common.periodEnd,
      billName: common.billName,
      bill,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to save utility bill')
  }
  const data = (await res.json()) as { saved: number }

  triggerScope12Recalc(common.organizationId)

  return { saved: data.saved }
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
