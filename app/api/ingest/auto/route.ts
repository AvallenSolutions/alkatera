import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { createClient } from '@supabase/supabase-js'
import { parseImportXLSX } from '@/lib/bulk-import/xlsx-parser'
import type { ExtractedBillData } from '@/app/api/utilities/import-from-pdf/route'
import type {
  ExtractedFacilityBillData,
  ExtractedWaterEntry,
  ExtractedWasteEntry,
} from '@/app/api/facilities/import-bill/route'

// ───────────────────────────────────────────────────────────────────────────────
// Universal Document Dropzone endpoint.
//
// Accepts a single document (PDF / image / XLSX) and either:
//   - Parses it locally (XLSX → products/ingredients/packaging), or
//   - Sends it to Claude Opus 4.6 with a *union* of mutually-exclusive tool
//     schemas. Claude picks one tool — utility bill / water bill / waste bill /
//     unsupported — and fills it in. We dispatch on tool name.
//
// TODO(ingest-refactor): The utility/water/waste tool schemas are duplicated
// from app/api/utilities/import-from-pdf/route.ts and app/api/facilities/
// import-bill/route.ts. Post-MVP, lift into lib/ingest/schemas.ts and have all
// three routes import from there. Until then, changes to either schema must be
// mirrored here.
// ───────────────────────────────────────────────────────────────────────────────

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

// Simple in-memory rate limit keyed by org. Mirrors the pattern used in
// app/api/lca/[id]/ai-suggestions/route.ts. Good enough for MVP; Redis later.
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(orgId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimits.get(orgId)
  if (!entry || entry.resetAt < now) {
    rateLimits.set(orgId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 }
  }
  entry.count += 1
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count }
}

// Stash the incoming file in the ingest-staging bucket so the target page
// can pick it up via a signed URL and feed it to the existing upload handler.
// Returns the stash id (== storage path) so the client can include it in the
// deep-link. We use the service-role client here so policies on the bucket
// don't need to cover every edge case; ownership is enforced at retrieval
// time by validating the path prefix against the requesting user.
async function stashFile(
  serviceClient: any,
  file: File,
  orgId: string,
  userId: string,
): Promise<string | null> {
  try {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const path = `${orgId}/${userId}/${unique}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await serviceClient.storage
      .from('ingest-staging')
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
    if (error) {
      console.error('[ingest/auto] Stash upload failed:', error.message)
      return null
    }
    return path
  } catch (err: any) {
    console.error('[ingest/auto] Stash unexpected error:', err?.message)
    return null
  }
}

export type IngestResultType =
  | 'utility_bill'
  | 'water_bill'
  | 'waste_bill'
  | 'bulk_xlsx'
  | 'spray_diary'
  | 'bom'
  | 'soil_carbon_evidence'
  | 'accounts_csv'
  | 'historical_sustainability_report'
  | 'historical_lca_report'
  | 'unsupported'

export interface IngestResponse {
  type: IngestResultType
  // For bills
  utilityBill?: ExtractedBillData
  waterBill?: ExtractedFacilityBillData<ExtractedWaterEntry>
  wasteBill?: ExtractedFacilityBillData<ExtractedWasteEntry>
  // For product workbooks
  xlsx?: {
    summary: { products: number; ingredients: number; packaging: number; errors: number }
    errors: string[]
  }
  // For spray diaries — the file is stashed and the user picks vineyard /
  // orchard / arable in the UI, then deep-links with the stash id so the
  // growing-profile page picks up the file automatically.
  sprayDiary?: {
    sheetNames: string[]
    note?: string
    stashId?: string
  }
  // For BOM PDFs — the file is stashed so the product-edit page can open
  // the existing BOM import wizard with it pre-loaded (skipping re-upload).
  bom?: {
    note?: string
    stashId?: string
  }
  // For soil-carbon evidence PDFs — the file is stashed so the target growing
  // profile page can pick it up with a single param round-trip.
  soilCarbonEvidence?: {
    note?: string
    stashId?: string
  }
  // For accounting CSVs — detection only; deep-link to the Xero / spend-data
  // flow, which is OAuth-sync-based rather than file-upload based.
  accountsCsv?: {
    note?: string
  }
  // For historical summary documents — extracted headline metrics only.
  // Stored separately from operational data via /api/ingest/historical.
  historicalSustainabilityReport?: {
    reporting_year?: number
    organization_name?: string
    scope1_tco2e?: number
    scope2_tco2e_market?: number
    scope2_tco2e_location?: number
    scope3_tco2e?: number
    water_m3?: number
    waste_tonnes?: number
    waste_diversion_rate_pct?: number
    headcount?: number
    revenue_gbp?: number
    certifications_held?: string[]
    targets?: Array<{ metric?: string; year?: number; percent_reduction?: number }>
    stashId?: string
  }
  historicalLcaReport?: {
    product_name?: string
    functional_unit?: string
    reference_year?: number
    system_boundary?: 'cradle-to-gate' | 'cradle-to-grave' | 'gate-to-gate'
    total_gwp_kgco2e?: number
    stage_breakdown?: {
      raw_materials?: number
      processing?: number
      packaging?: number
      transport?: number
      use?: number
      eol?: number
    }
    water_footprint_l?: number
    methodology?: string
    study_commissioned_by?: string
    stashId?: string
  }
  // For unsupported
  reason?: string
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
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 })
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
    }

    // Verify org membership before touching Claude or the rate-limit map.
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

    const rate = checkRateLimit(organizationId)
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Slow down — you've uploaded ${RATE_LIMIT_MAX} documents in the last hour. Try again shortly.`,
        },
        { status: 429 },
      )
    }

    const mimeType = file.type || ''
    const fileName = (file.name || '').toLowerCase()
    const isXlsx =
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    const isCsv =
      fileName.endsWith('.csv') ||
      mimeType === 'text/csv' ||
      mimeType === 'application/csv'

    // ── CSV path — detection only; Xero / spend-data flow is OAuth-sync-based
    if (isCsv) {
      const body: IngestResponse = {
        type: 'accounts_csv',
        accountsCsv: {
          note: 'Detected as an accounting CSV. Use the Xero / spend-data flow to import it.',
        },
      }
      return NextResponse.json(body)
    }

    // ── XLSX path — deterministic, no Claude ──────────────────────────────
    // Heuristic: product workbooks have sheets literally named "Products",
    // "Ingredients", or "Packaging". Anything else is treated as a spray
    // diary candidate and handed off to the relevant asset page.
    if (isXlsx) {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const sheetNames = wb.SheetNames || []
      const hasProductSheet = sheetNames.some((n) =>
        ['products', 'ingredients', 'packaging'].includes(n.trim().toLowerCase()),
      )

      if (hasProductSheet) {
        const parsed = parseImportXLSX(buffer)
        const body: IngestResponse = {
          type: 'bulk_xlsx',
          xlsx: {
            summary: {
              products: parsed.products.length,
              ingredients: parsed.ingredients.length,
              packaging: parsed.packaging.length,
              errors: parsed.errors.length,
            },
            errors: parsed.errors.slice(0, 10),
          },
        }
        return NextResponse.json(body)
      }

      // Not a product workbook — likely a spray diary. Stash the file so the
      // target asset page can pick it up without the user re-uploading.
      const stashId = await stashFile(serviceClient, file, organizationId, user.id)
      const body: IngestResponse = {
        type: 'spray_diary',
        sprayDiary: {
          sheetNames: sheetNames.slice(0, 20),
          stashId: stashId ?? undefined,
        },
      }
      return NextResponse.json(body)
    }

    // ── PDF / image path — Claude Opus 4.6 with union tool schema ────────
    const isPdf = mimeType === 'application/pdf'
    const isImage = mimeType.startsWith('image/')
    if (!isPdf && !isImage) {
      return NextResponse.json(
        {
          error:
            'Unsupported file type. Upload a PDF, image (JPEG/PNG/WebP), or Excel workbook.',
        },
        { status: 400 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const fileContent = isPdf
      ? ({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
        } as const)
      : ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
            data: base64Data,
          },
        } as const)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      tools: [
        {
          name: 'extract_utility_bill',
          description:
            'Use for energy / utility bills — electricity, natural gas, LPG, diesel, HFO, biomass, district heat, or vehicle fuel. Extract the consumption quantities.',
          input_schema: {
            type: 'object' as const,
            properties: {
              supplier_name: { type: 'string', description: 'Utility supplier name (e.g. British Gas, EDF).' },
              period_start: { type: 'string', description: 'Billing period start in YYYY-MM-DD.' },
              period_end: { type: 'string', description: 'Billing period end in YYYY-MM-DD.' },
              entries: {
                type: 'array',
                description: 'One entry per utility type on the bill.',
                items: {
                  type: 'object',
                  properties: {
                    utility_type: {
                      type: 'string',
                      enum: UTILITY_TYPE_VALUES,
                      description:
                        'Map to one of: electricity_grid, natural_gas (kWh), natural_gas_m3, lpg (litre), diesel_stationary, heavy_fuel_oil, biomass_solid (kg), heat_steam_purchased, diesel_mobile, petrol_mobile.',
                    },
                    quantity: { type: 'number', description: 'Consumption quantity, not cost.' },
                    unit: { type: 'string', description: 'kWh, m3, litre, kg.' },
                  },
                  required: ['utility_type', 'quantity', 'unit'],
                },
              },
            },
            required: ['entries'],
          },
        },
        {
          name: 'extract_water_bill',
          description:
            'Use for water utility or wastewater / trade-effluent bills. Extract volumes consumed or discharged.',
          input_schema: {
            type: 'object' as const,
            properties: {
              supplier_name: { type: 'string', description: 'Water supplier name (e.g. Thames Water).' },
              period_start: { type: 'string', description: 'Billing period start in YYYY-MM-DD.' },
              period_end: { type: 'string', description: 'Billing period end in YYYY-MM-DD.' },
              entries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    activity_category: {
                      type: 'string',
                      enum: WATER_CATEGORY_VALUES,
                      description:
                        'water_intake for fresh water supplied; water_discharge for wastewater; water_recycled for on-site reuse.',
                    },
                    quantity: { type: 'number', description: 'Volume, not cost.' },
                    unit: { type: 'string', description: 'm3, L, or ML.' },
                    water_source_type: {
                      type: 'string',
                      enum: WATER_SOURCE_VALUES,
                      description: 'Origin of water (municipal for most mains supply).',
                    },
                  },
                  required: ['activity_category', 'quantity', 'unit'],
                },
              },
            },
            required: ['entries'],
          },
        },
        {
          name: 'extract_waste_bill',
          description:
            'Use for waste collection invoices — general, hazardous, or recycling streams. Extract mass or volume collected.',
          input_schema: {
            type: 'object' as const,
            properties: {
              supplier_name: { type: 'string', description: 'Waste contractor name (e.g. Biffa, Veolia).' },
              period_start: { type: 'string', description: 'Service period start in YYYY-MM-DD.' },
              period_end: { type: 'string', description: 'Service period end in YYYY-MM-DD.' },
              entries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    activity_category: {
                      type: 'string',
                      enum: WASTE_CATEGORY_VALUES,
                      description:
                        'waste_general for mixed/residual; waste_hazardous for regulated streams; waste_recycling for segregated recycling.',
                    },
                    quantity: { type: 'number', description: 'Mass or volume, not cost.' },
                    unit: { type: 'string', description: 'kg, tonnes, m3, or L.' },
                    waste_treatment_method: {
                      type: 'string',
                      enum: WASTE_TREATMENT_VALUES,
                      description: 'Disposal / treatment route if stated.',
                    },
                  },
                  required: ['activity_category', 'quantity', 'unit'],
                },
              },
            },
            required: ['entries'],
          },
        },
        {
          name: 'identify_bom',
          description:
            'Use for bills of materials (BOM), ingredient lists, or formulation sheets tied to a product. Typically shows SKUs / ingredient names with quantities and units, often with cost columns. Identification only — we don\'t extract items from this schema.',
          input_schema: {
            type: 'object' as const,
            properties: {
              note: {
                type: 'string',
                description: 'Optional one-line note: product name, SKU, or what the BOM appears to describe.',
              },
            },
          },
        },
        {
          name: 'identify_soil_carbon_evidence',
          description:
            'Use for soil carbon / carbon farming / regenerative agriculture evidence documents — sampling reports, accreditation certificates, carbon measurement reports for a vineyard, orchard, or arable field. Identification only.',
          input_schema: {
            type: 'object' as const,
            properties: {
              note: {
                type: 'string',
                description: 'Optional one-line note: what the evidence document appears to prove.',
              },
            },
          },
        },
        {
          name: 'extract_sustainability_report',
          description:
            'Use for annual sustainability / ESG / CSR / impact reports — typically a company\'s published year-end summary of environmental and social performance. Extract the headline metrics for ONE reporting year (the primary year of the report).',
          input_schema: {
            type: 'object' as const,
            properties: {
              reporting_year: {
                type: 'number',
                description: 'Primary reporting year (four-digit calendar year).',
              },
              organization_name: {
                type: 'string',
                description: 'Reporting organisation\'s name — used to sanity-check against the user\'s org.',
              },
              scope1_tco2e: { type: 'number', description: 'Scope 1 emissions in tonnes CO2e. Convert from kg if needed.' },
              scope2_tco2e_market: { type: 'number', description: 'Scope 2 market-based emissions in tCO2e.' },
              scope2_tco2e_location: { type: 'number', description: 'Scope 2 location-based emissions in tCO2e.' },
              scope3_tco2e: { type: 'number', description: 'Scope 3 emissions total in tCO2e.' },
              water_m3: { type: 'number', description: 'Water withdrawal or consumption in cubic metres.' },
              waste_tonnes: { type: 'number', description: 'Total waste generated in tonnes.' },
              waste_diversion_rate_pct: { type: 'number', description: 'Waste diversion / recycling rate as a percentage (0-100).' },
              headcount: { type: 'number', description: 'Full-time equivalent employee count.' },
              revenue_gbp: { type: 'number', description: 'Annual revenue in GBP (convert from other currencies if stated).' },
              certifications_held: {
                type: 'array',
                items: { type: 'string' },
                description: 'Named certifications (B Corp, ISO 14001, SBTi commitment, etc.).',
              },
              targets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    metric: { type: 'string' },
                    year: { type: 'number' },
                    percent_reduction: { type: 'number' },
                  },
                },
                description: 'Stated reduction commitments (e.g. 50% by 2030). Each element: metric, target year, percent reduction.',
              },
            },
          },
        },
        {
          name: 'extract_lca_report',
          description:
            'Use for prior LCA / PCF / product carbon footprint study documents — typically a stand-alone report for a single product with functional unit, system boundary, and per-stage impact breakdown.',
          input_schema: {
            type: 'object' as const,
            properties: {
              product_name: { type: 'string', description: 'The product this LCA covers.' },
              functional_unit: {
                type: 'string',
                description: 'Functional unit as stated (e.g. "1 bottle of 750ml wine", "1 hectolitre of beer").',
              },
              reference_year: { type: 'number', description: 'Reference year of the LCA study.' },
              system_boundary: {
                type: 'string',
                enum: ['cradle-to-gate', 'cradle-to-grave', 'gate-to-gate'],
                description: 'System boundary of the study.',
              },
              total_gwp_kgco2e: { type: 'number', description: 'Total GWP in kg CO2e per functional unit.' },
              stage_breakdown: {
                type: 'object',
                properties: {
                  raw_materials: { type: 'number' },
                  processing:    { type: 'number' },
                  packaging:     { type: 'number' },
                  transport:     { type: 'number' },
                  use:           { type: 'number' },
                  eol:           { type: 'number' },
                },
                description: 'Per-stage kg CO2e contribution to total GWP.',
              },
              water_footprint_l: { type: 'number', description: 'Water footprint in litres per functional unit.' },
              methodology: {
                type: 'string',
                description: 'Methodology reference — e.g. ISO 14067, PEFCR Wine, GHG Protocol Product.',
              },
              study_commissioned_by: { type: 'string', description: 'Who commissioned / owns the study.' },
            },
          },
        },
        {
          name: 'unsupported_document',
          description:
            'Use if the document is not a utility bill, water bill, waste invoice, BOM, or soil-carbon evidence document.',
          input_schema: {
            type: 'object' as const,
            properties: {
              reason: {
                type: 'string',
                description: 'One short sentence describing what the document appears to be instead.',
              },
            },
            required: ['reason'],
          },
        },
      ],
      tool_choice: { type: 'any' },
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text: 'Identify what type of document this is and extract the relevant consumption data by calling exactly one of the available tools. Focus on quantities (consumption, volume, or mass), not on cost figures.',
            },
          ],
        },
      ],
    })

    const toolUse = response.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json(
        { type: 'unsupported', reason: 'The classifier did not return a structured answer.' } satisfies IngestResponse,
      )
    }

    switch (toolUse.name) {
      case 'extract_utility_bill':
        return NextResponse.json({
          type: 'utility_bill',
          utilityBill: toolUse.input as ExtractedBillData,
        } satisfies IngestResponse)
      case 'extract_water_bill':
        return NextResponse.json({
          type: 'water_bill',
          waterBill: toolUse.input as ExtractedFacilityBillData<ExtractedWaterEntry>,
        } satisfies IngestResponse)
      case 'extract_waste_bill':
        return NextResponse.json({
          type: 'waste_bill',
          wasteBill: toolUse.input as ExtractedFacilityBillData<ExtractedWasteEntry>,
        } satisfies IngestResponse)
      case 'identify_bom': {
        const input = toolUse.input as { note?: string }
        const stashId = await stashFile(serviceClient, file, organizationId, user.id)
        return NextResponse.json({
          type: 'bom',
          bom: { note: input?.note, stashId: stashId ?? undefined },
        } satisfies IngestResponse)
      }
      case 'identify_soil_carbon_evidence': {
        const input = toolUse.input as { note?: string }
        const stashId = await stashFile(serviceClient, file, organizationId, user.id)
        return NextResponse.json({
          type: 'soil_carbon_evidence',
          soilCarbonEvidence: { note: input?.note, stashId: stashId ?? undefined },
        } satisfies IngestResponse)
      }
      case 'extract_sustainability_report': {
        const input = toolUse.input as IngestResponse['historicalSustainabilityReport']
        const stashId = await stashFile(serviceClient, file, organizationId, user.id)
        return NextResponse.json({
          type: 'historical_sustainability_report',
          historicalSustainabilityReport: { ...(input || {}), stashId: stashId ?? undefined },
        } satisfies IngestResponse)
      }
      case 'extract_lca_report': {
        const input = toolUse.input as IngestResponse['historicalLcaReport']
        const stashId = await stashFile(serviceClient, file, organizationId, user.id)
        return NextResponse.json({
          type: 'historical_lca_report',
          historicalLcaReport: { ...(input || {}), stashId: stashId ?? undefined },
        } satisfies IngestResponse)
      }
      case 'unsupported_document':
      default: {
        const input = toolUse.input as { reason?: string }
        return NextResponse.json({
          type: 'unsupported',
          reason: input?.reason || 'This document is not one of the supported types yet.',
        } satisfies IngestResponse)
      }
    }
  } catch (err: any) {
    console.error('Universal ingest error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
