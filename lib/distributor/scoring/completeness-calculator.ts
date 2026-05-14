import { FIELD_DEFINITIONS, type FieldKey, type Pillar } from '../scraping/field-definitions';

/**
 * Fields a brand must have to be considered "minimally complete" for
 * UK retailer sustainability reporting. Not currently used to gate the
 * score (the weights below already give them outsized impact), but
 * exported so the UI can render a "still missing required" list.
 */
export const REQUIRED_FIELDS: FieldKey[] = [
  'carbon_intensity_kgco2e_per_litre',
  'scope_1_tco2e',
  'scope_2_tco2e',
  'scope_3_tco2e',
  'water_usage_litres_per_litre',
  'packaging_primary_material',
  'recycled_packaging_percentage',
  'organic_certified',
  'sustainability_report_url',
];

/**
 * Weights tilt the score toward the fields retailers care about most.
 * Anything not listed gets DEFAULT_WEIGHT.
 */
const FIELD_WEIGHTS: Partial<Record<FieldKey, number>> = {
  carbon_intensity_kgco2e_per_litre: 3,
  scope_1_tco2e: 2,
  scope_2_tco2e: 2,
  scope_3_tco2e: 2,
  net_zero_target_year: 2,
  water_usage_litres_per_litre: 2,
  bcorp_certified: 2,
  sustainability_report_url: 2,
};

const DEFAULT_WEIGHT = 1;

export interface CompletenessResult {
  overall: number;
  by_pillar: Record<Pillar, number>;
  fields_populated: number;
  fields_total: number;
  missing_required: FieldKey[];
}

/**
 * Compute a single brand's completeness score from the set of field
 * keys we have data for. Pure function — no I/O — so it's trivial to
 * unit-test and reuse server-side or client-side.
 */
export function calculateCompleteness(
  populatedFieldKeys: Iterable<string>,
): CompletenessResult {
  const populated = new Set<string>(populatedFieldKeys);

  let totalWeight = 0;
  let achievedWeight = 0;
  const pillarTotals: Record<string, number> = {};
  const pillarAchieved: Record<string, number> = {};

  for (const field of FIELD_DEFINITIONS) {
    const weight = FIELD_WEIGHTS[field.key] ?? DEFAULT_WEIGHT;
    totalWeight += weight;
    pillarTotals[field.pillar] = (pillarTotals[field.pillar] ?? 0) + weight;
    if (populated.has(field.key)) {
      achievedWeight += weight;
      pillarAchieved[field.pillar] = (pillarAchieved[field.pillar] ?? 0) + weight;
    }
  }

  const overall = totalWeight > 0 ? (achievedWeight / totalWeight) * 100 : 0;
  const by_pillar = {} as Record<Pillar, number>;
  for (const pillar of Object.keys(pillarTotals)) {
    const total = pillarTotals[pillar];
    const achieved = pillarAchieved[pillar] ?? 0;
    (by_pillar as Record<string, number>)[pillar] = total > 0 ? round2((achieved / total) * 100) : 0;
  }

  const fieldsPopulated = countKnownPopulated(populated);
  const missingRequired = REQUIRED_FIELDS.filter((key) => !populated.has(key));

  return {
    overall: round2(overall),
    by_pillar,
    fields_populated: fieldsPopulated,
    fields_total: FIELD_DEFINITIONS.length,
    missing_required: missingRequired,
  };
}

function countKnownPopulated(populated: Set<string>): number {
  let n = 0;
  for (const field of FIELD_DEFINITIONS) {
    if (populated.has(field.key)) n += 1;
  }
  return n;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
