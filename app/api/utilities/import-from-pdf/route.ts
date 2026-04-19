import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import { BILL_TOOL_INPUT_SCHEMA } from '@/lib/claude/bill-schemas'

/** Per-utility-type line on the bill. Electricity-specific fields (mpan,
 *  meter_type, rate_breakdown, emissions_factor_g_per_kwh) are null for
 *  gas / fuel rows; gas rows carry mprn instead.
 */
export interface ExtractedUtilityEntry {
  utility_type: string
  quantity: number
  unit: string
  // Supply-point identifiers (electricity=mpan, gas=mprn).
  mpan?: string | null
  mprn?: string | null
  // Electricity meter classification — drives what we can say about
  // time-of-use and load-shifting in Pulse.
  meter_type?: 'single_rate' | 'economy_7' | 'economy_10' | 'half_hourly' | 'dual_rate' | 'other' | null
  // For multi-rate meters: breakdown of kWh per rate band.
  rate_breakdown?: Array<{
    label: string                // 'Day' / 'Night' / 'Peak' / 'Off-peak' / custom
    kwh: number
    rate_p_per_kwh?: number | null
  }> | null
  // Stated emissions intensity if the bill prints it (rare).
  emissions_factor_g_per_kwh?: number | null
}

/** Bill-level metadata extracted from the document header / charges block. */
export interface ExtractedBillData {
  supplier_name: string | null
  period_start: string | null  // YYYY-MM-DD
  period_end: string | null    // YYYY-MM-DD
  entries: ExtractedUtilityEntry[]
  // Generation-mix percentages if the supplier states them on this bill or
  // on an annual disclosure attached to it.
  fuel_mix?: {
    renewable_pct?: number | null
    gas_pct?: number | null
    nuclear_pct?: number | null
    coal_pct?: number | null
    other_pct?: number | null
    /** Which period the mix refers to: this bill, or the supplier's annual statement. */
    source?: 'bill' | 'annual' | null
  } | null
  is_green_tariff?: boolean | null
  supply_address?: string | null
  supply_postcode?: string | null
  /** UK grid supply point group / DNO region when stated (e.g. 'South East', 'London'). */
  gsp_group?: string | null
  account_number?: string | null
  ccl_amount_gbp?: number | null
  total_charged_gbp?: number | null
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const organizationId = formData.get('organizationId') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!organizationId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 })

    // Verify org membership
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')

    // Determine media type
    const mimeType = file.type || 'application/pdf'
    const isPdf = mimeType === 'application/pdf'
    const isImage = mimeType.startsWith('image/')
    if (!isPdf && !isImage) {
      return NextResponse.json({ error: 'Only PDF and image files are supported' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const fileContent = isPdf
      ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } } as const)
      : ({ type: 'image', source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: base64Data } } as const)

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      tools: [
        {
          name: 'extract_utility_bill',
          description:
            'Extract consumption + time-of-use + supply-point data from a utility or energy bill document. Capture MPAN/MPRN, meter type, rate breakdowns, and fuel mix when present — they drive the platform\'s Pulse carbon-intensity recommendations and market-based Scope 2 calc.',
          input_schema: BILL_TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'extract_utility_bill' },
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text:
                'Extract the utility consumption data from this bill. Priorities: \n' +
                '1) Per utility type on the bill, the total consumption quantity (not cost) with unit.\n' +
                "2) MPAN (21-digit electricity supply point ID) and MPRN (gas) when visible. Strip spaces.\n" +
                '3) Meter type — single_rate / economy_7 / economy_10 / half_hourly / dual_rate / other. Infer from rate bands printed on the bill (two bands = economy_7, many bands or "HH metered" wording = half_hourly).\n' +
                '4) Rate breakdown — if the bill shows kWh split by Day/Night/Peak/Off-peak, return each band with its kWh (and p/kWh rate if stated).\n' +
                "5) Fuel mix percentages if the supplier prints them (either for this billing period or an annual disclosure); note which via source: 'bill' or 'annual'.\n" +
                '6) is_green_tariff — true only if the supplier explicitly claims 100% renewable electricity.\n' +
                '7) Supply address + postcode + GSP group / DNO region if stated.\n' +
                '8) Account number, CCL amount (GBP), total charged (GBP).\n' +
                "Consumption quantities are the non-negotiable must-have; everything else is best-effort — omit fields you can't read with confidence.",
            },
          ],
        },
      ],
    })

    const toolUse = response.content.find(c => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'Could not extract data from the document' }, { status: 422 })
    }

    const extracted = toolUse.input as ExtractedBillData
    return NextResponse.json(extracted)
  } catch (err: any) {
    console.error('Utility bill import error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
