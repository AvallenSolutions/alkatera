import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
// Relative imports (not `@/`) so this module bundles cleanly inside the
// Netlify background function. esbuild's tsconfig-paths support inside
// Netlify's lambda zipper is unreliable; one bad alias resolution makes the
// whole function silently fail to cold-start, leaving ingest jobs stuck at
// "Queued…" forever.
import { BILL_TOOL_INPUT_SCHEMA } from '../claude/bill-schemas';
import { parseImportXLSX } from '../bulk-import/xlsx-parser';
import { parseHalfHourlyCsv } from '../energy/hh-csv-parser';
import { readingsSpan, deriveMonthlyEntries } from '../energy/derive-utility';
import { logClaudeUsage } from '../ai/usage-log';
import { workbookToText, csvToText, sanitiseFileName } from './spreadsheet-text';

/**
 * Shared Smart Upload classifier.
 *
 * Called by the Netlify background function. Runs Claude (CLASSIFIER_MODEL)
 * with a union of mutually-exclusive tool schemas; Claude picks one and fills it in.
 * Returns a discriminated union that mirrors the existing IngestResponse
 * shape, so the client dispatches exactly as it did before the move to an
 * async job pattern.
 *
 * Every input kind reaches Claude: PDFs and images as native binary blocks,
 * spreadsheets and CSVs serialised to bounded text (see spreadsheet-text.ts).
 * Only two deterministic fast paths remain, where the signature is
 * near-certain: half-hourly smart-meter CSVs and the platform's own bulk
 * product-import workbook template.
 */

// Tool-forced classification with document/vision input; no thinking needed.
// Sonnet-tier handles this well at ~40% the cost of Opus.
const CLASSIFIER_MODEL = 'claude-sonnet-4-6';

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
// Coarse Scope 3 spend categories a supplier invoice can map to. Subset of the
// corporate_overheads.category CHECK enum that realistically applies to a
// purchased-goods/services invoice; the spend save route maps each to a DEFRA
// spend-based emission factor.
const SPEND_CATEGORY_VALUES = [
  'purchased_services',
  'capital_goods',
  'upstream_transportation',
  'operational_waste',
  'other',
] as const;
// Refrigerant keys recognised by REFRIGERANT_GWP in lib/ghg-constants.ts; the
// save route clamps anything else to r134a.
const REFRIGERANT_KEYS = [
  'r134a',
  'r404a',
  'r410a',
  'r407c',
  'r507a',
  'r32',
  'r1234yf',
  'r717',
  'r744',
  'r290',
] as const;
// Freight transport modes (DEFRA tonne-km factors).
const TRANSPORT_MODE_VALUES = ['truck', 'train', 'ship', 'air'] as const;
// Packaging component roles (product_materials.packaging_category). 'container'
// is the primary bottle/can; there is no 'primary' value.
const PACKAGING_ROLE_VALUES = ['container', 'label', 'closure', 'secondary', 'shipment', 'tertiary'] as const;
// Certification frameworks the platform recognises (framework_code). Anything
// without a matching framework row falls back to a picker / no-op.
const CERTIFICATION_HINTS = [
  'bcorp',
  'iso14001',
  'iso50001',
  'csrd',
  'sbti',
  'gri',
  'cdp_climate',
  'ecovadis',
  'other',
] as const;

export type ClassifierResultType =
  | 'utility_bill'
  | 'water_bill'
  | 'waste_bill'
  | 'bulk_xlsx'
  | 'spray_diary'
  | 'bom'
  | 'supplier_invoice'
  | 'freight_invoice'
  | 'refrigerant_service'
  | 'packaging_spec'
  | 'supplier_coa'
  | 'certification'
  | 'soil_carbon_lab'
  | 'soil_carbon_evidence'
  | 'accounts_csv'
  | 'smart_meter_csv'
  | 'historical_sustainability_report'
  | 'historical_lca_report'
  | 'hospitality_menu'
  | 'pos_sales_export'
  | 'unsupported';

export interface ClassifierResult {
  type: ClassifierResultType;
  payload: Record<string, unknown>;
  /** Self-reported classification confidence, captured for the learning loop. */
  meta?: { confidence?: 'high' | 'medium' | 'low'; alternate?: string };
}

export interface ClassifierInput {
  fileBytes: Uint8Array;
  fileName: string;
  fileMime: string;
  /**
   * Optional pre-formatted org context block (see lib/ingest/org-context.ts):
   * industry, facility/supplier/product names and learned document profiles.
   * Appended to the prompt as reference hints; absent = classify as before.
   */
  orgContext?: string;
}

/**
 * Map the classifier's discriminated `{ type, payload }` to the wire shape
 * the existing client (UniversalDropzone, UtilityBillImportDialog, etc.)
 * already understands — same field names as IngestResponse. Shared by the
 * Netlify background function and the inline-fallback in /api/ingest/auto.
 */
export function shapeIngestResult(
  type: string,
  payload: Record<string, unknown>,
  stashId: string,
  meta?: ClassifierResult['meta'],
): { result_type: string; result_payload: Record<string, unknown> } {
  const shaped = shapeIngestResultInner(type, payload, stashId);
  if (meta && Object.keys(meta).length > 0) {
    shaped.result_payload = { ...shaped.result_payload, classifierMeta: meta };
  }
  return shaped;
}

function shapeIngestResultInner(
  type: string,
  payload: Record<string, unknown>,
  stashId: string,
): { result_type: string; result_payload: Record<string, unknown> } {
  switch (type) {
    case 'utility_bill':
      return { result_type: type, result_payload: { type, utilityBill: payload } };
    case 'water_bill':
      return { result_type: type, result_payload: { type, waterBill: payload } };
    case 'waste_bill':
      return { result_type: type, result_payload: { type, wasteBill: payload } };
    case 'bulk_xlsx':
      return { result_type: type, result_payload: { type, xlsx: payload } };
    case 'spray_diary':
      return { result_type: type, result_payload: { type, sprayDiary: { ...payload, stashId } } };
    case 'bom':
      return { result_type: type, result_payload: { type, bom: { ...payload, stashId } } };
    case 'supplier_invoice':
      return {
        result_type: type,
        result_payload: { type, supplierInvoice: { ...payload, stashId } },
      };
    case 'freight_invoice':
      return {
        result_type: type,
        result_payload: { type, freightInvoice: { ...payload, stashId } },
      };
    case 'refrigerant_service':
      return {
        result_type: type,
        result_payload: { type, refrigerantService: { ...payload, stashId } },
      };
    case 'packaging_spec':
      return {
        result_type: type,
        result_payload: { type, packagingSpec: { ...payload, stashId } },
      };
    case 'supplier_coa':
      return {
        result_type: type,
        result_payload: { type, supplierCoa: { ...payload, stashId } },
      };
    case 'certification':
      return {
        result_type: type,
        result_payload: { type, certification: { ...payload, stashId } },
      };
    case 'soil_carbon_lab':
      return {
        result_type: type,
        result_payload: { type, soilCarbonLab: { ...payload, stashId } },
      };
    case 'soil_carbon_evidence':
      return {
        result_type: type,
        result_payload: { type, soilCarbonEvidence: { ...payload, stashId } },
      };
    case 'accounts_csv':
      return { result_type: type, result_payload: { type, accountsCsv: payload } };
    case 'smart_meter_csv':
      return { result_type: type, result_payload: { type, smartMeter: { ...payload, stashId } } };
    case 'historical_sustainability_report':
      return {
        result_type: type,
        result_payload: { type, historicalSustainabilityReport: { ...payload, stashId } },
      };
    case 'historical_lca_report':
      return {
        result_type: type,
        result_payload: { type, historicalLcaReport: { ...payload, stashId } },
      };
    case 'hospitality_menu':
      return {
        result_type: type,
        result_payload: { type, hospitalityMenu: { ...payload, stashId } },
      };
    case 'pos_sales_export':
      return {
        result_type: type,
        result_payload: { type, posSalesExport: { ...payload, stashId } },
      };
    case 'unsupported':
    default:
      return {
        result_type: 'unsupported',
        result_payload: { type: 'unsupported', reason: (payload as any)?.reason },
      };
  }
}

export type ClassifierFileKind = 'csv' | 'xlsx' | 'pdf' | 'image' | 'other';

export function detectFileKind(fileName: string, fileMime: string): ClassifierFileKind {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.csv') || fileMime === 'text/csv' || fileMime === 'application/csv') {
    return 'csv';
  }
  if (
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    fileMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileMime === 'application/vnd.ms-excel'
  ) {
    return 'xlsx';
  }
  if (fileMime === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
  if (fileMime.startsWith('image/')) return 'image';
  return 'other';
}

type AnthropicImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

type ClassifierContentBlock =
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: AnthropicImageMediaType; data: string };
    }
  | { type: 'text'; text: string };

const UNSUPPORTED_REASON =
  'Unsupported file type. Upload a PDF, image (JPEG/PNG/WebP), spreadsheet or CSV.';

// The only image media types the Anthropic vision API accepts. An HEIC phone
// photo, TIFF, BMP etc. detects as image/* but would 400 the API, so we guard
// early with a friendly message instead of letting the raw error through.
const SUPPORTED_IMAGE_MIMES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Friendly, user-facing reason for an image format we cannot send to Claude. */
function unsupportedImageReason(fileMime: string): string {
  const label = (fileMime.split('/')[1] || 'this format').toUpperCase();
  return `This image format (${label}) isn't supported yet. Please convert it to JPEG or PNG and try again.`;
}

/**
 * Build the content block Claude reads. PDFs and images go as native binary
 * blocks; spreadsheets and CSVs are serialised to bounded CSV text (Claude
 * cannot read xlsx/csv bytes natively). Pass `preparsedWorkbook` when the
 * caller has already run XLSX.read, so the file is not parsed twice.
 * Returns null for unsupported kinds.
 */
export function buildClassifierContent(
  fileBytes: Uint8Array,
  fileName: string,
  fileMime: string,
  preparsedWorkbook?: XLSX.WorkBook,
): ClassifierContentBlock | null {
  const kind = detectFileKind(fileName, fileMime);
  if (kind === 'pdf' || kind === 'image') {
    const base64Data = Buffer.from(fileBytes).toString('base64');
    return kind === 'pdf'
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: fileMime as AnthropicImageMediaType,
            data: base64Data,
          },
        };
  }
  if (kind === 'csv') {
    return {
      type: 'text',
      text: `<spreadsheet_content>\n${csvToText(fileBytes, fileName)}\n</spreadsheet_content>`,
    };
  }
  if (kind === 'xlsx') {
    const wb = preparsedWorkbook ?? XLSX.read(toArrayBuffer(fileBytes), { type: 'array' });
    return {
      type: 'text',
      text: `<spreadsheet_content>\n${workbookToText(wb, fileName)}\n</spreadsheet_content>`,
    };
  }
  return null;
}

/** Create a proper ArrayBuffer slice so it's not a SharedArrayBuffer view. */
function toArrayBuffer(fileBytes: Uint8Array): ArrayBuffer {
  return fileBytes.buffer.slice(
    fileBytes.byteOffset,
    fileBytes.byteOffset + fileBytes.byteLength,
  ) as ArrayBuffer;
}

export async function classifyDocument(input: ClassifierInput): Promise<ClassifierResult> {
  const { fileBytes, fileName, fileMime, orgContext } = input;
  const kind = detectFileKind(fileName, fileMime);

  if (kind === 'other') {
    return { type: 'unsupported', payload: { reason: UNSUPPORTED_REASON } };
  }

  // Reject image formats the vision API can't read (HEIC, TIFF, etc.) before we
  // waste a job on a raw 400.
  if (kind === 'image' && !SUPPORTED_IMAGE_MIMES.has(fileMime.toLowerCase())) {
    return { type: 'unsupported', payload: { reason: unsupportedImageReason(fileMime) } };
  }

  let preparsedWorkbook: XLSX.WorkBook | undefined;

  if (kind === 'csv') {
    // Half-hourly smart-meter export? ("long" timestamp+kWh, or "wide" date+48 cols.)
    // Near-certain signature, so this deterministic fast path stays free.
    const hh = parseHalfHourlyCsv(fileBytes);
    if (hh.format !== 'unknown' && hh.readings.length >= 48) {
      const span = readingsSpan(hh.readings);
      return {
        type: 'smart_meter_csv',
        payload: {
          format: hh.format,
          readings: hh.readings.length,
          totalKwh: Math.round(hh.readings.reduce((s, r) => s + r.kwh, 0)),
          firstDate: span?.from ?? null,
          lastDate: span?.to ?? null,
          months: deriveMonthlyEntries(hh.readings, 'electricity').length,
        },
      };
    }
    // Any other CSV goes to Claude as serialised text. The old accounts_csv
    // catch-all misfiled every non-ledger CSV; a ledger export is now one of
    // the choosable tools (identify_accounts_csv) instead.
  }

  if (kind === 'xlsx') {
    const buffer = toArrayBuffer(fileBytes);
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetNames = wb.SheetNames || [];
    const hasProductSheet = sheetNames.some((n) =>
      ['products', 'ingredients', 'packaging'].includes(n.trim().toLowerCase()),
    );
    if (hasProductSheet) {
      // The platform's own bulk-import template — near-certain, stays free.
      const parsed = parseImportXLSX(buffer);
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
    // Every other workbook goes to Claude on its serialised sheets. The old
    // code defaulted every non-template workbook to spray_diary, which
    // misfiled recipes, ledgers and anything else arriving as a spreadsheet.
    preparsedWorkbook = wb;
  }

  const contentBlock = buildClassifierContent(fileBytes, fileName, fileMime, preparsedWorkbook);
  if (!contentBlock) {
    return { type: 'unsupported', payload: { reason: UNSUPPORTED_REASON } };
  }

  return callClassifier({ contentBlock, fileName, orgContext, usageTag: 'ingest_classify' });
}

/**
 * Which classifier tool extracts each user-selectable document type. Drives
 * the "Change document type" reclassify flow: the client offers these types
 * and the server re-runs extraction with tool_choice forced to the mapped
 * tool. bulk_xlsx and smart_meter_csv are deterministic parsers, not tools,
 * and are special-cased in extractWithForcedTool.
 */
export const RECLASSIFY_TARGETS: Partial<Record<ClassifierResultType, string>> = {
  utility_bill: 'extract_utility_bill',
  water_bill: 'extract_water_bill',
  waste_bill: 'extract_waste_bill',
  bom: 'identify_bom',
  spray_diary: 'identify_spray_diary',
  supplier_invoice: 'extract_supplier_invoice',
  freight_invoice: 'extract_freight_invoice',
  refrigerant_service: 'extract_refrigerant_service',
  packaging_spec: 'extract_packaging_spec',
  supplier_coa: 'extract_supplier_coa',
  certification: 'extract_certification',
  soil_carbon_lab: 'extract_soil_carbon_lab',
  soil_carbon_evidence: 'identify_soil_carbon_evidence',
  historical_sustainability_report: 'extract_sustainability_report',
  historical_lca_report: 'extract_lca_report',
  hospitality_menu: 'identify_hospitality_menu',
  pos_sales_export: 'identify_pos_sales_export',
  accounts_csv: 'identify_accounts_csv',
};

/**
 * Re-run extraction with the document type the user has chosen (the
 * "Change document type" flow). Same content handling as classifyDocument,
 * but tool_choice is forced to the tool for `targetType`.
 */
export async function extractWithForcedTool(
  input: ClassifierInput & { targetType: ClassifierResultType },
): Promise<ClassifierResult> {
  const { fileBytes, fileName, fileMime, orgContext, targetType } = input;

  // Deterministic parsers, not Claude tools.
  if (targetType === 'bulk_xlsx') {
    if (detectFileKind(fileName, fileMime) !== 'xlsx') {
      return {
        type: 'unsupported',
        payload: { reason: 'A product import must be an Excel workbook using the platform template.' },
      };
    }
    const parsed = parseImportXLSX(toArrayBuffer(fileBytes));
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
  if (targetType === 'smart_meter_csv') {
    const hh = parseHalfHourlyCsv(fileBytes);
    if (hh.format === 'unknown' || hh.readings.length < 48) {
      return {
        type: 'unsupported',
        payload: {
          reason:
            'This file does not look like a half-hourly smart-meter export (a timestamp plus kWh column, or a date plus 48 half-hour columns).',
        },
      };
    }
    const span = readingsSpan(hh.readings);
    return {
      type: 'smart_meter_csv',
      payload: {
        format: hh.format,
        readings: hh.readings.length,
        totalKwh: Math.round(hh.readings.reduce((s, r) => s + r.kwh, 0)),
        firstDate: span?.from ?? null,
        lastDate: span?.to ?? null,
        months: deriveMonthlyEntries(hh.readings, 'electricity').length,
      },
    };
  }

  const forcedTool = RECLASSIFY_TARGETS[targetType];
  if (!forcedTool) {
    return {
      type: 'unsupported',
      payload: { reason: `Cannot re-read this document as "${targetType}".` },
    };
  }

  if (
    detectFileKind(fileName, fileMime) === 'image' &&
    !SUPPORTED_IMAGE_MIMES.has(fileMime.toLowerCase())
  ) {
    return { type: 'unsupported', payload: { reason: unsupportedImageReason(fileMime) } };
  }

  const contentBlock = buildClassifierContent(fileBytes, fileName, fileMime);
  if (!contentBlock) {
    return { type: 'unsupported', payload: { reason: UNSUPPORTED_REASON } };
  }

  return callClassifier({
    contentBlock,
    fileName,
    orgContext,
    forcedTool,
    usageTag: 'ingest_reclassify',
  });
}

interface CallClassifierParams {
  contentBlock: ClassifierContentBlock;
  fileName: string;
  orgContext?: string;
  /** Force a specific tool (the reclassify path); absent lets Claude choose. */
  forcedTool?: string;
  usageTag: string;
}

/**
 * Append confidence-capture fields to every tool schema. Near-zero cost
 * (~300 prompt tokens) and lets the admin page chart confidence against the
 * correction rate before we invest in a low-confidence chooser UI.
 */
function withConfidenceFields(tools: Anthropic.Tool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    ...t,
    input_schema: {
      ...t.input_schema,
      properties: {
        ...(t.input_schema.properties as Record<string, unknown>),
        classification_confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'How confident you are that this is the right document type.',
        },
        second_choice_type: {
          type: 'string',
          description: 'If confidence is not high: the other plausible document type.',
        },
      },
    },
  }));
}

async function callClassifier(params: CallClassifierParams): Promise<ClassifierResult> {
  const { contentBlock, fileName, orgContext, forcedTool, usageTag } = params;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: CLASSIFIER_MODEL,
    // Soil lab reports can carry many sampling locations × depth layers, so the
    // tool-call payload (a samples array) is larger than the single-object bills.
    max_tokens: 4000,
    tools: withConfidenceFields([
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
          'Use for bills of materials (BOM), ingredient lists, or formulation sheets tied to a product. Includes spreadsheet recipe/formulation workbooks: rows of ingredients or packaging components with quantity-per-unit columns such as g/Litre, kg/hL or per-bottle dosages, even when the sheet name is generic (e.g. Sheet1). Capture the product header metadata AND the ingredient / packaging lines (name, quantity, unit) when they are visible, so the recipe can be pre-filled. Report each dosage exactly as written with its quantity_basis (e.g. a "g/L" column is quantity + unit "g" + quantity_basis "per_litre"); never pre-divide a per-litre dosage down to a per-bottle amount yourself, the app does that from the product size.',
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
            line_items: {
              type: 'array',
              description: 'The ingredient and packaging components, if the document lists them. One entry per line.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Ingredient or packaging component name.' },
                  quantity: { type: 'number', description: 'The number in the amount/dosage column, exactly as written. Do NOT rescale it yourself; report quantity_basis instead so the app can convert.' },
                  unit: { type: 'string', description: 'The base mass or volume unit only, e.g. kg, g, mg, L, ml, units. If the column header is a dosage like "g/L" or "kg/hL", put just the numerator here ("g", "kg") and set quantity_basis.' },
                  quantity_basis: {
                    type: 'string',
                    enum: ['per_litre', 'per_hectolitre', 'per_unit'],
                    description: 'What the quantity is measured against. Dosage columns like g/L, ml/L, mg/L -> "per_litre". kg/hL, g/hL -> "per_hectolitre". An absolute amount per finished bottle/can, and EVERY packaging component (the can, bottle, cap, label), -> "per_unit". Default to "per_unit" only when there is no per-volume basis.',
                  },
                  type: {
                    type: 'string',
                    enum: ['ingredient', 'packaging'],
                    description: 'Whether the line is an ingredient or a packaging component.',
                  },
                },
                required: ['name'],
              },
            },
          },
        },
      },
      {
        name: 'extract_supplier_invoice',
        description:
          'Use for supplier invoices, purchase invoices, bills, or delivery notes for GOODS or SERVICES the company bought (ingredients, dry goods, packaging supplies, equipment, professional/IT services, freight). Extract the supplier, date, currency and the priced line items. Do NOT use this for energy/water/waste utility bills (use those tools) or for a bill of materials tied to a single product recipe (use identify_bom).',
        input_schema: {
          type: 'object',
          properties: {
            supplier_name: { type: 'string', description: 'The supplier / vendor name.' },
            invoice_date: { type: 'string', description: 'Invoice date in YYYY-MM-DD.' },
            currency: {
              type: 'string',
              enum: ['GBP', 'USD', 'EUR'],
              description: 'Invoice currency. Default to GBP if not shown.',
            },
            suggested_category: {
              type: 'string',
              enum: SPEND_CATEGORY_VALUES,
              description:
                'Best-fit Scope 3 spend category for what was bought: purchased_services for most goods & services, capital_goods for equipment/machinery, upstream_transportation for inbound freight, operational_waste for waste services.',
            },
            line_items: {
              type: 'array',
              description: 'One entry per priced line. Use the line net total, not the unit price.',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string', description: 'What the line is for.' },
                  amount: {
                    type: 'number',
                    description: 'Line total in the invoice currency, excluding tax if shown separately.',
                  },
                  quantity: {
                    type: 'number',
                    description: 'Quantity delivered on this line, if stated (enables activity-based detail).',
                  },
                  unit: {
                    type: 'string',
                    description: 'Unit for the quantity, e.g. kg, L, units, cases.',
                  },
                },
                required: ['amount'],
              },
            },
            invoice_total: {
              type: 'number',
              description: 'Invoice grand total (net of tax) as a fallback when the lines are not itemised.',
            },
          },
        },
      },
      {
        name: 'extract_freight_invoice',
        description:
          'Use for freight, shipping, courier, haulage, or logistics invoices for moving GOODS (inbound or outbound). Prefer the activity detail (mode, weight, distance) for an accurate tonne-km estimate; also capture the spend as a fallback.',
        input_schema: {
          type: 'object',
          properties: {
            carrier_name: { type: 'string', description: 'The freight carrier / logistics provider.' },
            shipment_date: { type: 'string', description: 'Shipment or invoice date in YYYY-MM-DD.' },
            transport_mode: {
              type: 'string',
              enum: TRANSPORT_MODE_VALUES,
              description: 'truck for road/HGV, train for rail, ship for sea, air for air freight.',
            },
            weight_kg: { type: 'number', description: 'Total shipment weight in kilograms.' },
            distance_km: { type: 'number', description: 'Distance travelled in kilometres, if stated.' },
            origin: { type: 'string', description: 'Origin location, if stated (helps estimate distance).' },
            destination: { type: 'string', description: 'Destination location, if stated.' },
            amount: { type: 'number', description: 'Invoice amount (spend fallback when weight/distance are missing).' },
            currency: { type: 'string', enum: ['GBP', 'USD', 'EUR'], description: 'Invoice currency.' },
          },
        },
      },
      {
        name: 'extract_refrigerant_service',
        description:
          'Use for refrigeration / air-conditioning / chiller / F-gas service records, gas logs, or maintenance sheets that report refrigerant recharged or topped up. This is a Scope 1 fugitive emission.',
        input_schema: {
          type: 'object',
          properties: {
            service_date: { type: 'string', description: 'Service date in YYYY-MM-DD.' },
            refrigerant_type: {
              type: 'string',
              enum: REFRIGERANT_KEYS,
              description:
                'Refrigerant recharged, mapped to its key: e.g. R-134a→r134a, R-410A→r410a, R-404A→r404a, R-407C→r407c, R-507A→r507a, R-32→r32, R-1234yf→r1234yf, ammonia/NH3→r717, CO2→r744, propane→r290.',
            },
            quantity_kg: {
              type: 'number',
              description: 'Mass of refrigerant added / recharged / topped up, in kilograms (not the total system charge).',
            },
            equipment: { type: 'string', description: 'Equipment or unit serviced, if named.' },
            engineer: { type: 'string', description: 'Servicing company or engineer, if named.' },
          },
        },
      },
      {
        name: 'extract_packaging_spec',
        description:
          'Use for packaging specification sheets / technical datasheets describing a packaging component (bottle, can, closure, label, carton, case) with its material and weight. Extract one entry per component. Do NOT use this for a full product BOM (use identify_bom).',
        input_schema: {
          type: 'object',
          properties: {
            product_hint: { type: 'string', description: 'Product or SKU the packaging is for, if named.' },
            components: {
              type: 'array',
              description: 'One entry per packaging component.',
              items: {
                type: 'object',
                properties: {
                  component_name: { type: 'string', description: 'Name of the component, e.g. "750ml flint bottle".' },
                  material: {
                    type: 'string',
                    description: 'Material as a lowercase key: glass, aluminium, pet, hdpe, steel, paperboard, cork, paper.',
                  },
                  role: {
                    type: 'string',
                    enum: PACKAGING_ROLE_VALUES,
                    description: 'container for the primary bottle/can; closure for caps/corks; label; secondary/shipment/tertiary for outer packaging.',
                  },
                  weight_g: { type: 'number', description: 'Component weight in grams.' },
                  recycled_content_pct: { type: 'number', description: 'Recycled content as a percentage. 0 means the document states 0% recycled (virgin material) — report that 0. Omit the field only when the document is silent.' },
                  recyclability_pct: { type: 'number', description: 'Recyclability as a percentage. 0 means the document states it is not recyclable — report that 0. Omit the field only when the document is silent.' },
                },
                required: ['component_name'],
              },
            },
          },
          required: ['components'],
        },
      },
      {
        name: 'extract_supplier_coa',
        description:
          'Use for a supplier Certificate of Analysis (CoA), product specification sheet, or test report for an INGREDIENT or material the company buys. Capture the header metadata so it can be filed against the supplier product.',
        input_schema: {
          type: 'object',
          properties: {
            supplier_name: { type: 'string' },
            product_name: { type: 'string', description: 'The supplier product the document describes.' },
            document_type: {
              type: 'string',
              enum: ['specification_sheet', 'test_report', 'carbon_certificate'],
              description: 'specification_sheet for a spec/datasheet, test_report for a CoA/lab test, carbon_certificate for a carbon/EPD claim.',
            },
            document_date: { type: 'string', description: 'Document / test date in YYYY-MM-DD.' },
            expiry_date: { type: 'string', description: 'Expiry date in YYYY-MM-DD, if any.' },
            reference_number: { type: 'string', description: 'Batch / lot / certificate reference, if shown.' },
            covers_climate: { type: 'boolean', description: 'True if the document reports carbon / climate data.' },
            covers_water: { type: 'boolean', description: 'True if it reports water data.' },
            covers_waste: { type: 'boolean', description: 'True if it reports waste data.' },
          },
        },
      },
      {
        name: 'extract_certification',
        description:
          'Use for an organisation-level certification certificate or audit summary (B Corp, ISO 14001, ISO 50001, CDP, SBTi, GRI, EcoVadis). Capture the framework, certificate number and dates.',
        input_schema: {
          type: 'object',
          properties: {
            framework_hint: {
              type: 'string',
              enum: CERTIFICATION_HINTS,
              description: 'bcorp for B Corp; iso14001 / iso50001 for ISO; csrd, sbti, gri, cdp_climate, ecovadis; other if none fit.',
            },
            certificate_name: { type: 'string', description: 'The certification name as printed.' },
            issuer: { type: 'string', description: 'Certifying / awarding body.' },
            certificate_number: { type: 'string' },
            issue_date: { type: 'string', description: 'Issue / certified date in YYYY-MM-DD.' },
            expiry_date: { type: 'string', description: 'Expiry date in YYYY-MM-DD.' },
          },
        },
      },
      {
        name: 'extract_soil_carbon_lab',
        description:
          'Use for soil laboratory analysis reports / soil test results that report MEASURED soil organic carbon (SOC) for one or more sampling locations — typically a table of fields/blocks/paddocks with organic carbon %, organic matter %, bulk density, and/or a carbon stock figure. Extract one entry per sampling location AND depth layer. This is the structured measurement path; only use identify_soil_carbon_evidence for soil-carbon documents that carry NO numeric SOC measurements.',
        input_schema: {
          type: 'object',
          properties: {
            lab_name: { type: 'string', description: 'Laboratory or testing provider name, if printed.' },
            methodology: {
              type: 'string',
              description: 'Analytical method if stated (e.g. Dumas combustion, Walkley-Black, loss-on-ignition).',
            },
            default_sample_date: {
              type: 'string',
              description: 'Sampling or report date in YYYY-MM-DD, used for entries that do not state their own date.',
            },
            samples: {
              type: 'array',
              description: 'One entry per sampling location and depth layer.',
              items: {
                type: 'object',
                properties: {
                  location_label: {
                    type: 'string',
                    description: 'Field / block / paddock / sample ID exactly as printed, so the user can map it to a land unit.',
                  },
                  sample_date: {
                    type: 'string',
                    description: 'Sampling date in YYYY-MM-DD if this entry states its own; otherwise omit.',
                  },
                  depth_cm: {
                    type: 'number',
                    description: 'Thickness of the sampled layer in cm. For a depth range like "0-30 cm" use 30; for "0-10 cm" use 10.',
                  },
                  soc_input_method: {
                    type: 'string',
                    enum: ['stock', 'concentration'],
                    description:
                      'Use "stock" when a carbon stock (tC/ha or t C/ha) is reported directly; use "concentration" when reporting organic carbon % (ideally with bulk density).',
                  },
                  soc_stock_tc_ha: {
                    type: 'number',
                    description: 'Measured SOC stock in tonnes carbon per hectare, when the report gives it directly.',
                  },
                  soc_concentration_pct: {
                    type: 'number',
                    description:
                      'Soil organic carbon as a percentage. If only organic MATTER % is reported, multiply by 0.58 to estimate organic carbon and record that value here.',
                  },
                  bulk_density_g_cm3: {
                    type: 'number',
                    description: 'Dry bulk density in g/cm3, if reported. Needed alongside concentration to compute a stock.',
                  },
                  sampling_points: {
                    type: 'number',
                    description: 'Number of cores / sub-samples composited for this entry, if stated.',
                  },
                },
                required: ['depth_cm', 'soc_input_method'],
              },
            },
          },
          required: ['samples'],
        },
      },
      {
        name: 'identify_soil_carbon_evidence',
        description:
          'Use ONLY for soil-carbon / carbon farming / regenerative agriculture documents that contain NO numeric SOC measurements — e.g. a verification certificate, a carbon farming plan, or a methodology description. If the document reports organic carbon %, organic matter %, bulk density, or a carbon stock, use extract_soil_carbon_lab instead. Identification only.',
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
        name: 'identify_hospitality_menu',
        description:
          "Use for a food/drink MENU: a list of dishes, meals, cocktails or drinks with names (and often prices/descriptions), e.g. a restaurant menu, bar/cocktail list or room-service card. This is a menu to build recipes from, NOT a supplier invoice or a bill of materials for one product. Just identify it; the hospitality menu importer does the extraction.",
        input_schema: {
          type: 'object',
          properties: {
            looks_like: {
              type: 'string',
              enum: ['food_menu', 'drinks_menu', 'mixed_menu'],
              description: 'Whether the menu is mostly food, mostly drinks, or both.',
            },
            approx_item_count: { type: 'number', description: 'Rough number of menu items seen.' },
          },
          required: [],
        },
      },
      {
        name: 'identify_pos_sales_export',
        description:
          "Use for a POS/till SALES export or item-sales report: rows of menu items with quantities SOLD over a period (e.g. a Square, Toast or Lightspeed product-sales report). This records throughput, not purchases. Just identify it; the hospitality sales importer does the extraction.",
        input_schema: {
          type: 'object',
          properties: {
            pos_hint: { type: 'string', description: 'POS system if identifiable (e.g. Square, Toast, Lightspeed).' },
          },
          required: [],
        },
      },
      {
        name: 'identify_spray_diary',
        description:
          'Use for vineyard / orchard / farm spray diaries or agrochemical application records: rows of application dates, plant-protection products or active ingredients applied to LAND, dose rates per hectare, areas or blocks treated, operator or EAMU details. Do NOT use for beverage recipes or ingredient dosage sheets, even when they list chemical-sounding ingredients with quantities per litre (use identify_bom). Identification only; the user attaches it to a vineyard or orchard.',
        input_schema: {
          type: 'object',
          properties: {
            note: { type: 'string', description: 'One short sentence describing the records seen.' },
            sheet_names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Sheet names, when the document is a workbook.',
            },
          },
        },
      },
      {
        name: 'identify_accounts_csv',
        description:
          'Use for an accounting / ledger / spend export (Xero, QuickBooks, Sage, or a bank statement export): rows of dated transactions with amounts and account codes, categories or contact names. This records money spent, not goods on one invoice. Identification only; the spend-data importer handles the rows.',
        input_schema: {
          type: 'object',
          properties: {
            note: { type: 'string', description: 'One short sentence describing the export.' },
            source_hint: {
              type: 'string',
              description: 'Accounting system if identifiable (e.g. Xero, QuickBooks, Sage).',
            },
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
    ]),
    tool_choice: forcedTool ? { type: 'tool', name: forcedTool } : { type: 'any' },
    messages: [
      {
        role: 'user',
        content: [
          contentBlock,
          {
            type: 'text',
            text: [
              `Uploaded file name: ${sanitiseFileName(fileName)}`,
              contentBlock.type === 'text'
                ? 'The document is a spreadsheet serialised to CSV text; classify it from its rows and headers.'
                : null,
              forcedTool
                ? `The user has confirmed the document type; extract it with the ${forcedTool} tool.`
                : 'Identify what type of document this is and extract the relevant consumption data by calling exactly one of the available tools. Focus on quantities (consumption, volume, or mass), not on cost figures.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
          ...(orgContext ? [{ type: 'text' as const, text: orgContext }] : []),
        ],
      },
    ],
  });

  logClaudeUsage(usageTag, CLASSIFIER_MODEL, response);

  const toolUse = response.content.find((c) => c.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return {
      type: 'unsupported',
      payload: { reason: 'The classifier did not return a structured answer.' },
    };
  }

  // Strip the confidence-capture fields out of the extraction payload; they
  // ride along as meta instead.
  const {
    classification_confidence: confidence,
    second_choice_type: alternate,
    ...payloadInput
  } = (toolUse.input as Record<string, unknown>) ?? {};

  const result = mapToolUseToResult(toolUse.name, payloadInput);
  const meta: ClassifierResult['meta'] = {
    ...(confidence === 'high' || confidence === 'medium' || confidence === 'low'
      ? { confidence }
      : {}),
    ...(typeof alternate === 'string' && alternate ? { alternate: alternate.slice(0, 60) } : {}),
  };
  if (Object.keys(meta).length > 0) result.meta = meta;
  return result;
}

/** Map the chosen tool call to the classifier's discriminated result. */
function mapToolUseToResult(name: string, input: Record<string, unknown>): ClassifierResult {
  switch (name) {
    case 'extract_utility_bill':
      return { type: 'utility_bill', payload: input };
    case 'extract_water_bill':
      return { type: 'water_bill', payload: input };
    case 'extract_waste_bill':
      return { type: 'waste_bill', payload: input };
    case 'identify_bom':
      return { type: 'bom', payload: input };
    case 'extract_supplier_invoice': {
      const payload = input;
      const items = Array.isArray((payload as any).line_items) ? (payload as any).line_items : [];
      // Not itemised but a grand total was read → synthesise one spend line so
      // the invoice is still saveable.
      if (items.length === 0 && (payload as any).invoice_total != null) {
        (payload as any).line_items = [
          { description: 'Invoice total', amount: (payload as any).invoice_total },
        ];
      }
      return { type: 'supplier_invoice', payload };
    }
    case 'extract_freight_invoice':
      return { type: 'freight_invoice', payload: input };
    case 'extract_refrigerant_service':
      return { type: 'refrigerant_service', payload: input };
    case 'extract_packaging_spec': {
      const payload = input;
      const components = Array.isArray((payload as any).components) ? (payload as any).components : [];
      if (components.length === 0) {
        return { type: 'unsupported', payload: { reason: 'Packaging document detected, but no components could be read.' } };
      }
      return { type: 'packaging_spec', payload };
    }
    case 'extract_supplier_coa':
      return { type: 'supplier_coa', payload: input };
    case 'extract_certification':
      return { type: 'certification', payload: input };
    case 'extract_soil_carbon_lab': {
      const payload = input;
      const samples = Array.isArray((payload as any).samples) ? (payload as any).samples : [];
      // A soil-carbon document with no readable measurements falls back to the
      // evidence handoff rather than presenting an empty review table.
      if (samples.length === 0) {
        return {
          type: 'soil_carbon_evidence',
          payload: { note: 'Soil-carbon document detected, but no measurements could be read.' },
        };
      }
      return { type: 'soil_carbon_lab', payload };
    }
    case 'identify_soil_carbon_evidence':
      return { type: 'soil_carbon_evidence', payload: input };
    case 'identify_spray_diary': {
      const sheetNames = Array.isArray((input as any).sheet_names)
        ? ((input as any).sheet_names as string[]).slice(0, 20)
        : [];
      const note = typeof (input as any).note === 'string' ? (input as any).note : undefined;
      return { type: 'spray_diary', payload: { sheetNames, ...(note ? { note } : {}) } };
    }
    case 'identify_accounts_csv': {
      const hint = typeof (input as any).source_hint === 'string' ? (input as any).source_hint : null;
      return {
        type: 'accounts_csv',
        payload: {
          note: hint
            ? `Detected as an accounting export (${hint}). Use the Xero / spend-data flow to import it.`
            : 'Detected as an accounting export. Use the Xero / spend-data flow to import it.',
        },
      };
    }
    case 'extract_sustainability_report':
      return {
        type: 'historical_sustainability_report',
        payload: input,
      };
    case 'identify_hospitality_menu':
      return { type: 'hospitality_menu', payload: input };
    case 'identify_pos_sales_export':
      return { type: 'pos_sales_export', payload: input };
    case 'extract_lca_report':
      return {
        type: 'historical_lca_report',
        payload: input,
      };
    case 'unsupported_document':
    default: {
      const reason = (input as { reason?: string })?.reason;
      return {
        type: 'unsupported',
        payload: { reason: reason || 'This document is not one of the supported types yet.' },
      };
    }
  }
}
