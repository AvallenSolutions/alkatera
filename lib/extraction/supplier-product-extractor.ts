import type Anthropic from '@anthropic-ai/sdk';

/**
 * Structured extraction of `supplier_products`-shaped rows from a supplier
 * datasheet (single-product PDF, typically an EPD or technical spec) or a
 * catalogue (PDF table or CSV/XLSX rows).
 *
 * Two prompts:
 *   - datasheet mode: focused, expects 1–2 products
 *   - catalogue mode: tabular, expects many rows
 *
 * Both share the same output schema so the API/UI handles them uniformly.
 *
 * Hallucination guard: every numeric field carries a verbatim `_source_quote`
 * from the input. The confirm endpoint nulls any numeric without a quote so
 * a fabricated number never reaches `supplier_products`.
 */

export type ExtractionMode = 'datasheet' | 'catalogue';

export type Confidence = 'high' | 'medium' | 'low';

export type ExtractedField<T> = {
  value: T | null;
  confidence: Confidence;
  source_quote: string | null;
};

export interface ExtractedSupplierProduct {
  name: string;
  product_type: 'ingredient' | 'packaging';
  unit: string | null;

  // packaging-specific
  packaging_category: 'container' | 'label' | 'closure' | 'secondary' | 'shipment' | 'tertiary' | null;
  primary_material: string | null;
  epr_material_code: 'AL' | 'FC' | 'GL' | 'PC' | 'PL' | 'ST' | 'WD' | 'OT' | null;
  epr_is_drinks_container: boolean | null;

  // numeric fields with provenance
  weight_g: ExtractedField<number>;
  recycled_content_pct: ExtractedField<number>;
  recyclability_pct: ExtractedField<number>;
  impact_climate: ExtractedField<number>;
  impact_water: ExtractedField<number>;
  impact_waste: ExtractedField<number>;
  impact_land: ExtractedField<number>;

  origin_country_code: string | null;
  description: string | null;

  /** Overall row confidence; rendered as an amber border in the review UI when 'low'. */
  row_confidence: Confidence;
}

export interface ExtractionResult {
  products: ExtractedSupplierProduct[];
  /** Rows the model couldn't confidently map to our schema (e.g. unknown columns in a catalogue). */
  unmapped: Array<{ raw: string; reason: string }>;
  /** Mode actually used (auto-detected from input shape). */
  mode_used: ExtractionMode;
}

const NUMERIC_FIELD_SCHEMA = {
  type: 'object',
  properties: {
    value: { type: ['number', 'null'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    source_quote: {
      type: ['string', 'null'],
      description:
        'Verbatim sentence or table cell from the input that justifies this value. Required when value is not null. Set to null if and only if value is null.',
    },
  },
  required: ['value', 'confidence', 'source_quote'],
} as const;

const PRODUCT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Product name as stated by the supplier' },
    product_type: {
      type: 'string',
      enum: ['ingredient', 'packaging'],
      description:
        'ingredient = raw material, ferment, flavour, anything that goes inside the buyer\'s product. packaging = bottles, cans, labels, closures, cases, anything physical that wraps or contains the product.',
    },
    unit: {
      type: ['string', 'null'],
      description: 'Unit the impacts are expressed per (e.g. kg, litre, unit). For packaging this is almost always "unit".',
    },
    packaging_category: {
      type: ['string', 'null'],
      enum: ['container', 'label', 'closure', 'secondary', 'shipment', 'tertiary', null],
      description: 'Required when product_type=packaging. Null for ingredients.',
    },
    primary_material: {
      type: ['string', 'null'],
      description:
        'Dominant material for packaging products (e.g. glass, aluminium, recycled_paperboard, fibre_composite, plastic). Null for ingredients or when not stated.',
    },
    epr_material_code: {
      type: ['string', 'null'],
      enum: ['AL', 'FC', 'GL', 'PC', 'PL', 'ST', 'WD', 'OT', null],
      description: 'UK EPR (RPD) code: AL aluminium, FC fibre composite, GL glass, PC paper/card, PL plastic, ST steel, WD wood, OT other. Null if unknown.',
    },
    epr_is_drinks_container: {
      type: ['boolean', 'null'],
      description: 'True for bottles/cans/cups intended as a drinks container. Null when irrelevant or unknown.',
    },
    weight_g: NUMERIC_FIELD_SCHEMA,
    recycled_content_pct: NUMERIC_FIELD_SCHEMA,
    recyclability_pct: NUMERIC_FIELD_SCHEMA,
    impact_climate: { ...NUMERIC_FIELD_SCHEMA, description: 'kg CO2e per unit' },
    impact_water: { ...NUMERIC_FIELD_SCHEMA, description: 'm3 of water per unit' },
    impact_waste: NUMERIC_FIELD_SCHEMA,
    impact_land: NUMERIC_FIELD_SCHEMA,
    origin_country_code: {
      type: ['string', 'null'],
      description: 'ISO-3166 alpha-2 (preferred) or alpha-3 country code where the product is made. Null if unstated.',
    },
    description: { type: ['string', 'null'], description: 'One-sentence description of the product.' },
    row_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: [
    'name',
    'product_type',
    'unit',
    'packaging_category',
    'primary_material',
    'epr_material_code',
    'epr_is_drinks_container',
    'weight_g',
    'recycled_content_pct',
    'recyclability_pct',
    'impact_climate',
    'impact_water',
    'impact_waste',
    'impact_land',
    'origin_country_code',
    'description',
    'row_confidence',
  ],
} as const;

const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      description: 'Array of extracted supplier products.',
      items: PRODUCT_SCHEMA,
    },
    unmapped: {
      type: 'array',
      description:
        'Rows or sections from the input that could not be confidently mapped to the schema. Surfaced to the supplier so they know nothing was silently dropped.',
      items: {
        type: 'object',
        properties: {
          raw: { type: 'string', description: 'Raw row text or column header that was skipped.' },
          reason: { type: 'string', description: 'Short reason (e.g. "no recognisable product name").' },
        },
        required: ['raw', 'reason'],
      },
    },
  },
  required: ['products', 'unmapped'],
} as const;

const DATASHEET_PROMPT = `You are extracting structured product data from a single supplier's datasheet, EPD (Environmental Product Declaration), LCA report, or technical spec sheet for a sustainability platform.

The supplier sells either ingredients (raw materials, ferments, flavours) or packaging (bottles, cans, labels, closures, cases). Decide which based on the document content.

Hard rules:
- For every numeric field, copy the verbatim sentence or table cell that states the value into source_quote. If the document does not state the number, set value=null and source_quote=null.
- Never invent numbers. "Lightweight bottle" without a stated gram figure means weight_g.value=null.
- For packaging products, populate packaging_category, primary_material, and epr_material_code when they are stated or unambiguously implied (e.g. a paper bottle → packaging_category=container, primary_material=recycled_paperboard, epr_material_code=PC).
- recycled_content_pct=0 means "stated as 0% recycled". Use null only when the document is silent.
- row_confidence: high if name and the key impact figures are explicit; medium if some figures are inferred; low if you had to guess most fields.

If the document describes more than one product variant (e.g. a 500ml and 750ml of the same bottle), emit one row per variant.

Document content follows.`;

const CATALOGUE_PROMPT = `You are extracting a supplier's product catalogue into structured rows for a sustainability platform.

Each input row is one product. Map columns onto the schema. The supplier may include either ingredients (raw materials, ferments, flavours) or packaging (bottles, cans, labels, closures, cases) — set product_type per row, do not assume the whole catalogue is one type.

Hard rules:
- For numeric fields, copy the cell value into source_quote so we can audit the mapping. If the cell is empty, set value=null and source_quote=null.
- Never invent numbers from absent cells.
- If a row has no recognisable product name, push it to unmapped instead of fabricating one.
- If a column header is unrecognised (e.g. "internal_sku") and you cannot map it, that's fine — drop it silently. Only push whole rows with no usable data to unmapped.
- row_confidence: high if every column maps cleanly; medium if you had to infer the column meaning; low if many fields had to be guessed.

Input rows follow (tab-separated, first row is the header).`;

export interface BuildExtractionRequestArgs {
  mode: ExtractionMode;
  /** For datasheet mode, the parsed PDF text. For catalogue mode, the tabular text (TSV). */
  content: string;
  /** Optional: filename, used only in the prompt to give Claude minor context. */
  filename?: string;
}

/** Builds the Anthropic messages.create() arguments for either mode. */
export function buildExtractionRequest({
  mode,
  content,
  filename,
}: BuildExtractionRequestArgs): Anthropic.Messages.MessageCreateParamsNonStreaming {
  const intro = mode === 'datasheet' ? DATASHEET_PROMPT : CATALOGUE_PROMPT;
  const filenameLine = filename ? `\n\nFilename: ${filename}` : '';
  const truncated = content.slice(0, 80_000);

  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [
      {
        name: 'extract_supplier_products',
        description:
          'Return supplier_products-shaped rows from a datasheet or catalogue. Numeric fields must include the verbatim source quote.',
        input_schema: TOOL_SCHEMA as unknown as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'extract_supplier_products' },
    messages: [
      {
        role: 'user',
        content: `${intro}${filenameLine}\n\n---\n${truncated}`,
      },
    ],
  };
}

/**
 * Auto-detect the mode from a parsed-text shape.
 *
 * Heuristic:
 *   - if the text already looks tabular (header line followed by ≥3 rows of
 *     consistent tab/comma-separated values), it's a catalogue
 *   - otherwise (typical EPD / datasheet narrative), datasheet mode
 */
export function detectMode(content: string): ExtractionMode {
  const lines = content
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length < 4) return 'datasheet';

  // Count lines with at least 3 tab- or comma-separated columns.
  const tabular = lines.filter(l => l.split(/[\t,;]/).length >= 3).length;
  return tabular >= 4 && tabular / lines.length > 0.4 ? 'catalogue' : 'datasheet';
}

/**
 * Apply the hallucination guard: any numeric field whose `source_quote` is
 * blank gets `value` forced to null. Returns a sanitised copy.
 */
export function stripUnsourcedNumerics(p: ExtractedSupplierProduct): ExtractedSupplierProduct {
  const numericKeys: Array<keyof ExtractedSupplierProduct> = [
    'weight_g',
    'recycled_content_pct',
    'recyclability_pct',
    'impact_climate',
    'impact_water',
    'impact_waste',
    'impact_land',
  ];
  const out: ExtractedSupplierProduct = { ...p };
  for (const k of numericKeys) {
    const f = (out as any)[k] as ExtractedField<number> | undefined;
    if (!f) continue;
    if (!f.source_quote || !f.source_quote.trim()) {
      (out as any)[k] = { value: null, confidence: 'low', source_quote: null } as ExtractedField<number>;
    }
  }
  return out;
}

export function parseExtractionResponse(
  response: Anthropic.Messages.Message,
  modeUsed: ExtractionMode,
): ExtractionResult {
  const toolUse = response.content.find(block => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return { products: [], unmapped: [], mode_used: modeUsed };
  }
  const input = toolUse.input as { products?: ExtractedSupplierProduct[]; unmapped?: Array<{ raw: string; reason: string }> };
  const products = (input.products ?? []).map(stripUnsourcedNumerics);
  return {
    products,
    unmapped: input.unmapped ?? [],
    mode_used: modeUsed,
  };
}
