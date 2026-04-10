import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

const UTILITY_TYPE_VALUES = [
  'electricity_grid',
  'heat_steam_purchased',
  'natural_gas',
  'natural_gas_m3',
  'lpg',
  'diesel_stationary',
  'heavy_fuel_oil',
  'biomass_solid',
  'refrigerant_leakage',
  'diesel_mobile',
  'petrol_mobile',
] as const

export interface ExtractedUtilityEntry {
  utility_type: string
  quantity: number
  unit: string
}

export interface ExtractedBillData {
  supplier_name: string | null
  period_start: string | null  // YYYY-MM-DD
  period_end: string | null    // YYYY-MM-DD
  entries: ExtractedUtilityEntry[]
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
      max_tokens: 1024,
      tools: [
        {
          name: 'extract_utility_bill',
          description: 'Extract utility consumption data from a utility or energy bill document.',
          input_schema: {
            type: 'object' as const,
            properties: {
              supplier_name: {
                type: 'string',
                description: 'Name of the utility supplier (e.g. British Gas, EDF, Thames Water)',
              },
              period_start: {
                type: 'string',
                description: 'Billing period start date in YYYY-MM-DD format. Infer from bill date or statement period.',
              },
              period_end: {
                type: 'string',
                description: 'Billing period end date in YYYY-MM-DD format.',
              },
              entries: {
                type: 'array',
                description: 'One entry per utility type found on the bill (usually one, sometimes multiple).',
                items: {
                  type: 'object',
                  properties: {
                    utility_type: {
                      type: 'string',
                      enum: UTILITY_TYPE_VALUES,
                      description: `Map to one of these values:
- electricity_grid: mains electricity (kWh on bill)
- natural_gas: gas by kWh
- natural_gas_m3: gas by m³ or cubic metres
- lpg: LPG, propane, or butane (litres)
- diesel_stationary: diesel for generators or stationary equipment
- heavy_fuel_oil: HFO or fuel oil
- biomass_solid: wood pellets, chips, biogas (kg)
- heat_steam_purchased: district heat or steam
- diesel_mobile: diesel for company vehicles/fleet
- petrol_mobile: petrol for company vehicles/fleet`,
                    },
                    quantity: {
                      type: 'number',
                      description: 'Consumption quantity (not cost). E.g. 1250 for 1250 kWh.',
                    },
                    unit: {
                      type: 'string',
                      description: 'Unit matching the quantity: kWh, m3, litre, kg, etc.',
                    },
                  },
                  required: ['utility_type', 'quantity', 'unit'],
                },
              },
            },
            required: ['entries'],
          },
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
              text: 'Extract the utility consumption data from this bill. Focus on the consumption quantities (kWh, m³, litres, etc.), not the cost. Identify the billing period and supplier name if visible.',
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
