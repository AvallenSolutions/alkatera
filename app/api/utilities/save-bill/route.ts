import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { UTILITY_TYPES } from '@/lib/constants/utility-types'
import type { ExtractedBillData } from '@/app/api/utilities/import-from-pdf/route'

/**
 * Server-side save for utility bill entries.
 *
 * The previous client-side save (on the anon Supabase client) was failing with
 * "Could not find the 'account_number' column in the schema cache" — PostgREST
 * keeps a per-role cache and the anon role hadn't picked up the enrichment
 * columns added in 20262604800000_utility_bill_enrichment.sql. Routing the
 * insert through here lets us use the service-role client, which always sees
 * the live schema.
 */

interface SaveBillRequest {
  facilityId: string
  organizationId: string
  periodStart: string
  periodEnd: string
  billName?: string
  bill: ExtractedBillData
}

export async function POST(request: NextRequest) {
  try {
    const { client, user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as SaveBillRequest
    const { facilityId, organizationId, periodStart, periodEnd, billName, bill } = body

    if (!facilityId || !organizationId || !periodStart || !periodEnd || !bill) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: membership } = await (client as any)
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const valid = (bill.entries || []).filter((e) => e.utility_type && e.quantity > 0)
    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid utility entries to save' }, { status: 400 })
    }

    const trimmedName = (billName || '').trim()
    let saved = 0

    for (const entry of valid) {
      const utilityInfo = UTILITY_TYPES.find((u) => u.value === entry.utility_type)
      const unit = entry.unit || utilityInfo?.defaultUnit || 'kWh'
      const entryName = trimmedName
        ? valid.length > 1
          ? `${trimmedName} — ${utilityInfo?.label || entry.utility_type}`
          : trimmedName
        : null

      const mpan = entry.mpan ? String(entry.mpan).replace(/\s+/g, '') : null
      const mprn = entry.mprn ? String(entry.mprn).replace(/\s+/g, '') : null

      const { error: utilError } = await (client as any).from('utility_data_entries').insert({
        facility_id: facilityId,
        utility_type: entry.utility_type,
        quantity: entry.quantity,
        unit,
        reporting_period_start: periodStart,
        reporting_period_end: periodEnd,
        data_quality: 'actual',
        calculated_scope: '',
        created_by: user.id,
        name: entryName,
        mpan,
        mprn,
        meter_type: entry.meter_type ?? null,
        rate_breakdown:
          entry.rate_breakdown && entry.rate_breakdown.length > 0
            ? entry.rate_breakdown
            : null,
        emissions_factor_g_per_kwh: entry.emissions_factor_g_per_kwh ?? null,
        fuel_mix: bill.fuel_mix ?? null,
        is_green_tariff: bill.is_green_tariff ?? null,
        supply_address: bill.supply_address ?? null,
        supply_postcode: bill.supply_postcode ?? null,
        gsp_group: bill.gsp_group ?? null,
        account_number: bill.account_number ?? null,
        ccl_amount_gbp: bill.ccl_amount_gbp ?? null,
        total_charged_gbp: bill.total_charged_gbp ?? null,
      })
      if (utilError) {
        console.error('[utilities/save-bill] insert failed:', utilError)
        return NextResponse.json(
          { error: utilError.message || 'Failed to save utility entry' },
          { status: 500 },
        )
      }

      const category = utilityInfo?.scope === '1' ? 'Scope 1' : 'Scope 2'
      await (client as any).from('activity_data').insert({
        organization_id: organizationId,
        facility_id: facilityId,
        user_id: user.id,
        name:
          entryName ||
          `${utilityInfo?.label || entry.utility_type} - ${periodStart} to ${periodEnd}`,
        category,
        quantity: entry.quantity,
        unit,
        fuel_type: utilityInfo?.fuelType || entry.utility_type,
        activity_date: periodEnd,
        reporting_period_start: periodStart,
        reporting_period_end: periodEnd,
      })
      saved += 1
    }

    return NextResponse.json({ saved })
  } catch (err: any) {
    console.error('[utilities/save-bill] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
