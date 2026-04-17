import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'

// Water & waste bill import. Mirrors /api/utilities/import-from-pdf but
// extracts fields that land in facility_activity_entries (water_intake /
// waste_general / etc.) rather than utility_data_entries.

const WATER_CATEGORY_VALUES = ['water_intake', 'water_discharge', 'water_recycled'] as const
const WASTE_CATEGORY_VALUES = ['waste_general', 'waste_hazardous', 'waste_recycling'] as const

const WATER_SOURCE_VALUES = ['municipal', 'groundwater', 'surface_water', 'recycled', 'rainwater', 'other'] as const
const WASTE_TREATMENT_VALUES = [
  'landfill',
  'recycling',
  'composting',
  'incineration_with_recovery',
  'incineration_without_recovery',
  'anaerobic_digestion',
  'reuse',
  'other',
] as const

export interface ExtractedWaterEntry {
  activity_category: (typeof WATER_CATEGORY_VALUES)[number]
  quantity: number
  unit: string
  water_source_type?: (typeof WATER_SOURCE_VALUES)[number] | null
}

export interface ExtractedWasteEntry {
  activity_category: (typeof WASTE_CATEGORY_VALUES)[number]
  quantity: number
  unit: string
  waste_treatment_method?: (typeof WASTE_TREATMENT_VALUES)[number] | null
}

export interface ExtractedFacilityBillData<TEntry> {
  supplier_name: string | null
  period_start: string | null
  period_end: string | null
  entries: TEntry[]
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
    const mode = formData.get('mode') as string | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!organizationId) return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    if (mode !== 'water' && mode !== 'waste') {
      return NextResponse.json({ error: "mode must be 'water' or 'waste'" }, { status: 400 })
    }

    // Verify org membership (service client bypasses RLS for this check only).
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')

    const mimeType = file.type || 'application/pdf'
    const isPdf = mimeType === 'application/pdf'
    const isImage = mimeType.startsWith('image/')
    if (!isPdf && !isImage) {
      return NextResponse.json({ error: 'Only PDF and image files are supported' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const fileContent = isPdf
      ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } } as const)
      : ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
            data: base64Data,
          },
        } as const)

    // Build a mode-specific tool schema so Claude is constrained to the
    // correct enum values for the requested domain.
    const toolSpec =
      mode === 'water'
        ? {
            name: 'extract_water_bill',
            description: 'Extract water consumption data from a water utility or discharge bill.',
            input_schema: {
              type: 'object' as const,
              properties: {
                supplier_name: { type: 'string', description: 'Water supplier name (e.g. Thames Water, SUEZ).' },
                period_start: { type: 'string', description: 'Billing period start (YYYY-MM-DD).' },
                period_end: { type: 'string', description: 'Billing period end (YYYY-MM-DD).' },
                entries: {
                  type: 'array',
                  description: 'One entry per water line item on the bill (usually one).',
                  items: {
                    type: 'object',
                    properties: {
                      activity_category: {
                        type: 'string',
                        enum: WATER_CATEGORY_VALUES,
                        description:
                          'water_intake for fresh water supplied; water_discharge for wastewater/trade effluent; water_recycled for on-site reuse.',
                      },
                      quantity: { type: 'number', description: 'Consumption quantity, not cost.' },
                      unit: { type: 'string', description: 'm3, L, or ML.' },
                      water_source_type: {
                        type: 'string',
                        enum: WATER_SOURCE_VALUES,
                        description: 'Origin of the water (municipal for most mains supply bills).',
                      },
                    },
                    required: ['activity_category', 'quantity', 'unit'],
                  },
                },
              },
              required: ['entries'],
            },
          }
        : {
            name: 'extract_waste_bill',
            description: 'Extract waste disposal data from a waste collection bill or invoice.',
            input_schema: {
              type: 'object' as const,
              properties: {
                supplier_name: { type: 'string', description: 'Waste contractor name (e.g. Biffa, Veolia, SUEZ).' },
                period_start: { type: 'string', description: 'Billing/service period start (YYYY-MM-DD).' },
                period_end: { type: 'string', description: 'Billing/service period end (YYYY-MM-DD).' },
                entries: {
                  type: 'array',
                  description: 'One entry per waste stream on the document.',
                  items: {
                    type: 'object',
                    properties: {
                      activity_category: {
                        type: 'string',
                        enum: WASTE_CATEGORY_VALUES,
                        description:
                          'waste_general for mixed/residual; waste_hazardous for regulated hazardous streams; waste_recycling for segregated recycling.',
                      },
                      quantity: { type: 'number', description: 'Mass or volume collected, not cost.' },
                      unit: { type: 'string', description: 'kg, tonnes, m3, or L.' },
                      waste_treatment_method: {
                        type: 'string',
                        enum: WASTE_TREATMENT_VALUES,
                        description: 'Disposal/treatment route if stated on the invoice.',
                      },
                    },
                    required: ['activity_category', 'quantity', 'unit'],
                  },
                },
              },
              required: ['entries'],
            },
          }

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      tools: [toolSpec],
      tool_choice: { type: 'tool', name: toolSpec.name },
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text:
                mode === 'water'
                  ? 'Extract the water consumption data from this bill. Focus on volumes in m³ or litres, not cost. Identify the billing period and supplier name.'
                  : 'Extract the waste disposal data from this document. Focus on mass or volume collected per waste stream, not cost. Identify the service period and contractor name.',
            },
          ],
        },
      ],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'Could not extract data from the document' }, { status: 422 })
    }

    return NextResponse.json(toolUse.input)
  } catch (err: any) {
    console.error('Facility bill import error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
