/**
 * Hint extraction for the Smart Upload learning loop: distils a confirmed
 * save into a small allowlisted set of key/value corrections stored on the
 * (org, supplier, type) document profile and injected into future classifier
 * prompts. Zero I/O, zero imports — bundle-safe for the Netlify background
 * function graph.
 */

export type HintValue = string | number;

const MAX_STRING_CHARS = 80;

/**
 * Sanitise a value bound for a classifier prompt: strip control characters
 * and angle brackets (the org-context block is XML-fenced), cap length.
 * Returns null when the value is unusable.
 */
export function sanitiseHintValue(value: unknown): HintValue | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\r\n\t<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean === '') return null;
  return clean.slice(0, MAX_STRING_CHARS);
}

type HintSource = (saved: Record<string, unknown>, context: Record<string, unknown>) => unknown;

function firstEntry(saved: Record<string, unknown>): Record<string, unknown> {
  const entries = saved?.entries;
  return Array.isArray(entries) && entries.length > 0 && typeof entries[0] === 'object' && entries[0] !== null
    ? (entries[0] as Record<string, unknown>)
    : {};
}

function firstSample(saved: Record<string, unknown>): Record<string, unknown> {
  const samples = saved?.samples;
  return Array.isArray(samples) && samples.length > 0 && typeof samples[0] === 'object' && samples[0] !== null
    ? (samples[0] as Record<string, unknown>)
    : {};
}

// The 2-4 highest-value learnable corrections per result type — things the
// classifier either guesses at (category, mode, treatment) or cannot know
// (which facility/asset the org files this supplier's documents against).
const HINT_SOURCES: Record<string, Record<string, HintSource>> = {
  utility_bill: {
    facility_name: (_s, c) => c.facility_name,
    primary_utility_type: (s) => firstEntry(s).utility_type,
    unit: (s) => firstEntry(s).unit,
  },
  water_bill: {
    facility_name: (_s, c) => c.facility_name,
    water_source_type: (s) => firstEntry(s).water_source_type,
    unit: (s) => firstEntry(s).unit,
  },
  waste_bill: {
    facility_name: (_s, c) => c.facility_name,
    waste_treatment_method: (s) => firstEntry(s).waste_treatment_method,
    unit: (s) => firstEntry(s).unit,
  },
  supplier_invoice: {
    category: (s) => s.category ?? s.suggested_category,
    currency: (s) => s.currency,
  },
  freight_invoice: {
    transport_mode: (s) => s.transport_mode,
    currency: (s) => s.currency,
  },
  refrigerant_service: {
    refrigerant_type: (s) => s.refrigerant_type,
    facility_name: (_s, c) => c.facility_name,
  },
  supplier_coa: {
    document_type: (s) => s.document_type,
    supplier_product_name: (_s, c) => c.supplier_product_name,
  },
  certification: {
    framework_code: (_s, c) => c.framework_code,
  },
  soil_carbon_lab: {
    asset_kind: (_s, c) => c.asset_kind,
    asset_name: (_s, c) => c.asset_name,
    soc_input_method: (s) => firstSample(s).soc_input_method,
    default_depth_cm: (s) => firstSample(s).depth_cm,
  },
};

/**
 * Extract the allowlisted hints for one confirmed save. Unknown result types
 * and missing values yield an empty object — never throws.
 */
export function deriveHints(
  resultType: string,
  saved: Record<string, unknown>,
  context: Record<string, unknown> = {},
): Record<string, HintValue> {
  const sources = HINT_SOURCES[resultType];
  if (!sources) return {};
  const hints: Record<string, HintValue> = {};
  for (const [key, source] of Object.entries(sources)) {
    try {
      const value = sanitiseHintValue(source(saved ?? {}, context ?? {}));
      if (value !== null) hints[key] = value;
    } catch {
      // A malformed payload never blocks feedback capture.
    }
  }
  return hints;
}
