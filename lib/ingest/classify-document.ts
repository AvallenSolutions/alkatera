import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import { BILL_TOOL_INPUT_SCHEMA } from '@/lib/claude/bill-schemas';
import { parseImportXLSX } from '@/lib/bulk-import/xlsx-parser';

/**
 * Shared Smart Upload classifier.
 *
 * Called by the Netlify background function. Runs Claude Opus 4.6 with a
 * union of mutually-exclusive tool schemas; Claude picks one and fills it in.
 * Returns a discriminated union that mirrors the existing IngestResponse
 * shape, so the client dispatches exactly as it did before the move to an
 * async job pattern.
 *
 * Also handles the deterministic paths (XLSX product workbook / spray diary,
 * CSV) that don't need Claude at all — we route everything through the job
 * so the client has one consistent shape to poll.
 */

const WATER_CATEGORY_VALUES = ['water_intake', 'water_discharge', 'water_recycled'] as const;
const WASTE_CATEGORY_VALUES = ['waste_general', 'waste_hazardous', 'waste_recycling'] as const;
const WATER_SOURCE_VALUES = ['municipal', 'groundwater', 'surface_water', 'recycled', 'rainwater', 'other'] as const;
const WASTE_TREATMENT_VALUES = [
  'landfill',
  'recycling',
  'composting',
  'incineration_with_recovery',
  'incineration_without_recovery',
  'anaerobic_digestion',
  'reuse',
  'other',
] as const;

export type ClassifierResultType =
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
  | 'unsupported';

export interface ClassifierResult {
  type: ClassifierResultType;
  payload: Record<string, unknown>;
}

export interface ClassifierInput {
  fileBytes: Uint8Array;
  fileName: string;
  fileMime: string;
}

export async function classifyDocument(input: ClassifierInput): Promise<ClassifierResult> {
  const { fileBytes, fileName, fileMime } = input;
  const lowerName = fileName.toLowerCase();
  const isXlsx =
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    fileMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileMime === 'application/vnd.ms-excel';
  const isCsv = lowerName.endsWith('.csv') || fileMime === 'text/csv' || fileMime === 'application/csv';
  const isPdf = fileMime === 'application/pdf' || lowerName.endsWith('.pdf');
  const isImage = fileMime.startsWith('image/');

  if (isCsv) {
    return {
      type: 'accounts_csv',
      payload: {
        note: 'Detected as an accounting CSV. Use the Xero / spend-data flow to import it.',
      },
    };
  }

  if (isXlsx) {
    // Create a proper ArrayBuffer slice so it's not a SharedArrayBuffer view.
    const buffer = fileBytes.buffer.slice(
      fileBytes.byteOffset,
      fileBytes.byteOffset + fileBytes.byteLength,
    );
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetNames = wb.SheetNames || [];
    const hasProductSheet = sheetNames.some((n) =>
      ['products', 'ingredients', 'packaging'].includes(n.trim().toLowerCase()),
    );
    if (hasProductSheet) {
      const parsed = parseImportXLSX(buffer as ArrayBuffer);
      return {
        type: 'bulk_xlsx',
        payload: {
          summary: {
            products: parsed.products.length,
            ingredients: parsed.ingredients.length,
            packaging: parsed.packaging.length,
            errors: parsed.errors.length,
          },
          errors: parsed.errors.slice(0, 10),
        },
      };
    }
    return {
      type: 'spray_diary',
      payload: { sheetNames: sheetNames.slice(0, 20) },
    };
  }

  if (!isPdf && !isImage) {
    return {
      type: 'unsupported',
      payload: {
        reason: 'Unsupported file type. Upload a PDF, image (JPEG/PNG/WebP), or Excel workbook.',
      },
    };
  }

  const base64Data = Buffer.from(fileBytes).toString('base64');
  const fileContent = isPdf
    ? ({
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64Data },
      })
    : ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: fileMime as 'image/jpeg' | 'image/png' | 'image/webp',
          data: base64Data,
        },
      });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    tools: [
      {
        name: 'extract_utility_bill',
        description:
          'Use for energy / utility bills — electricity, natural gas, LPG, diesel, HFO, biomass, district heat, or vehicle fuel. Captures consumption + MPAN/MPRN + meter type + rate breakdown + fuel mix for time-of-use analysis and market-based Scope 2.',
        input_schema: BILL_TOOL_INPUT_SCHEMA,
      },
      {
        name: 'extract_water_bill',
        description:
          'Use for water utility or wastewater / trade-effluent bills. Extract volumes consumed or discharged.',
        input_schema: {
          type: 'object',
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
          type: 'object',
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
          'Use for bills of materials (BOM), ingredient lists, or formulation sheets tied to a product. Return ONLY product-level metadata from the header — not line items.',
        input_schema: {
          type: 'object',
          properties: {
            note: { type: 'string', description: 'One short sentence describing what the BOM covers.' },
            product_name: { type: 'string' },
            product_sku: { type: 'string' },
            product_category: {
              type: 'string',
              enum: ['Spirits', 'Beer & Cider', 'Wine', 'Ready-to-Drink & Cocktails', 'Non-Alcoholic'],
            },
            supplier_name: { type: 'string' },
            product_description: { type: 'string' },
            unit_size_value: { type: 'number' },
            unit_size_unit: { type: 'string' },
          },
        },
      },
      {
        name: 'identify_soil_carbon_evidence',
        description:
          'Use for soil carbon / carbon farming / regenerative agriculture evidence documents. Identification only.',
        input_schema: {
          type: 'object',
          properties: {
            note: { type: 'string', description: 'Optional one-line note.' },
          },
        },
      },
      {
        name: 'extract_sustainability_report',
        description:
          'Use for annual sustainability / ESG / CSR / impact reports. Extract the headline metrics for ONE reporting year.',
        input_schema: {
          type: 'object',
          properties: {
            reporting_year: { type: 'number' },
            organization_name: { type: 'string' },
            scope1_tco2e: { type: 'number' },
            scope2_tco2e_market: { type: 'number' },
            scope2_tco2e_location: { type: 'number' },
            scope3_tco2e: { type: 'number' },
            water_m3: { type: 'number' },
            waste_tonnes: { type: 'number' },
            waste_diversion_rate_pct: { type: 'number' },
            headcount: { type: 'number' },
            revenue_gbp: { type: 'number' },
            certifications_held: { type: 'array', items: { type: 'string' } },
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
            },
          },
        },
      },
      {
        name: 'extract_lca_report',
        description:
          'Use for prior LCA / PCF / product carbon footprint study documents.',
        input_schema: {
          type: 'object',
          properties: {
            product_name: { type: 'string' },
            functional_unit: { type: 'string' },
            reference_year: { type: 'number' },
            system_boundary: {
              type: 'string',
              enum: ['cradle-to-gate', 'cradle-to-grave', 'gate-to-gate'],
            },
            total_gwp_kgco2e: { type: 'number' },
            stage_breakdown: {
              type: 'object',
              properties: {
                raw_materials: { type: 'number' },
                processing: { type: 'number' },
                packaging: { type: 'number' },
                transport: { type: 'number' },
                use: { type: 'number' },
                eol: { type: 'number' },
              },
            },
            water_footprint_l: { type: 'number' },
            methodology: { type: 'string' },
            study_commissioned_by: { type: 'string' },
          },
        },
      },
      {
        name: 'unsupported_document',
        description:
          'Use if the document is not one of the supported types above.',
        input_schema: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
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
  });

  const toolUse = response.content.find((c) => c.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return {
      type: 'unsupported',
      payload: { reason: 'The classifier did not return a structured answer.' },
    };
  }

  switch (toolUse.name) {
    case 'extract_utility_bill':
      return { type: 'utility_bill', payload: toolUse.input as Record<string, unknown> };
    case 'extract_water_bill':
      return { type: 'water_bill', payload: toolUse.input as Record<string, unknown> };
    case 'extract_waste_bill':
      return { type: 'waste_bill', payload: toolUse.input as Record<string, unknown> };
    case 'identify_bom':
      return { type: 'bom', payload: (toolUse.input as Record<string, unknown>) || {} };
    case 'identify_soil_carbon_evidence':
      return { type: 'soil_carbon_evidence', payload: (toolUse.input as Record<string, unknown>) || {} };
    case 'extract_sustainability_report':
      return {
        type: 'historical_sustainability_report',
        payload: (toolUse.input as Record<string, unknown>) || {},
      };
    case 'extract_lca_report':
      return {
        type: 'historical_lca_report',
        payload: (toolUse.input as Record<string, unknown>) || {},
      };
    case 'unsupported_document':
    default: {
      const input = toolUse.input as { reason?: string };
      return {
        type: 'unsupported',
        payload: { reason: input?.reason || 'This document is not one of the supported types yet.' },
      };
    }
  }
}
