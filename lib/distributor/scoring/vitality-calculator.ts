import { FIELD_DEFINITIONS, type FieldKey, type Pillar } from '../scraping/field-definitions';

export type ScoreTier = 'leader' | 'progressing' | 'developing' | 'insufficient';

/**
 * A single coerced data point. Matches the shape of an active
 * scraped_brand_data row (one row per field, supersede-aware).
 */
export interface FieldValue {
  field_key: FieldKey;
  /** Stringified value (matches scraped_brand_data.field_value). */
  text: string;
  /** Numeric mirror for number / year / boolean fields. */
  numeric: number | null;
}

export interface VitalityResult {
  overall: number;
  tier: ScoreTier;
  /** Per-pillar 0–100 scores. */
  by_pillar: Record<Pillar, number>;
  /** Per-field grade 0–100 — useful for debugging and UI tooltips. */
  by_field: Partial<Record<FieldKey, number>>;
  fields_graded: number;
  fields_missing: number;
}

/**
 * Vitality scoring rules.
 *
 * Different from completeness: completeness measures "how much data do
 * we have?". Vitality measures "how strong is the sustainability story
 * here, penalising missing data?".
 *
 * Per-field grading:
 *   - boolean certs: 100 if certified, 0 if explicitly not, 0 if
 *     missing. (Yes-or-no fields are the easiest signal.)
 *   - carbon_intensity (kgCO2e/litre): graded against a benchmark band.
 *     Lower is better. Drinks-industry typical ~0.5–2.5 kgCO2e/L.
 *   - net_zero_target_year: graded by how soon — 2030 or earlier = 100,
 *     sliding down to 2050 = 30.
 *   - scope_1/2/3_tco2e: presence-only credit (we can't grade absolute
 *     emissions without revenue/volume context, so we credit *having
 *     measured* — a reasonable proxy for engagement).
 *   - sustainability_report_year: recent (≤ 2 yr) full credit, older
 *     fades, missing = 0.
 *   - recycled_packaging_percentage: 0–100 maps linearly to 0–100.
 *   - water_usage / organic_percentage: graded against soft bands.
 *   - string fields (parent_company, hq_country etc.): presence-only,
 *     small weight.
 *
 * Weights mirror the completeness weights (carbon intensity = 3× the
 * default weight, etc.) but with explicit "required" gating: a brand
 * missing any required field gets a hard hit even if everything else
 * looks good.
 */

const REQUIRED_FIELDS: FieldKey[] = [
  'carbon_intensity_kgco2e_per_litre',
  'water_usage_litres_per_litre',
  'packaging_primary_material',
  'sustainability_report_url',
];

const WEIGHTS: Partial<Record<FieldKey, number>> = {
  carbon_intensity_kgco2e_per_litre: 4,
  scope_1_tco2e: 2,
  scope_2_tco2e: 2,
  scope_3_tco2e: 3,
  net_zero_target_year: 2.5,
  water_usage_litres_per_litre: 2,
  recycled_packaging_percentage: 2,
  packaging_primary_material: 1.5,
  bcorp_certified: 2.5,
  carbon_trust_certified: 1.5,
  fairtrade_certified: 1.5,
  organic_certified: 1.5,
  rainforest_alliance_certified: 1,
  iso_14001_certified: 1,
  iso_50001_certified: 1,
  sustainability_report_url: 1.5,
  sustainability_report_year: 1,
  organic_percentage: 1,
};
const DEFAULT_WEIGHT = 0.5;

const TIER_BANDS: Array<{ tier: ScoreTier; min: number }> = [
  { tier: 'leader', min: 75 },
  { tier: 'progressing', min: 50 },
  { tier: 'developing', min: 25 },
  { tier: 'insufficient', min: 0 },
];

const TYPE_BY_KEY = new Map<FieldKey, string>(FIELD_DEFINITIONS.map((f) => [f.key, f.type]));
const PILLAR_BY_KEY = new Map<FieldKey, Pillar>(FIELD_DEFINITIONS.map((f) => [f.key, f.pillar]));

export function calculateVitality(values: Map<FieldKey, FieldValue>): VitalityResult {
  const perField: Partial<Record<FieldKey, number>> = {};
  const pillarTotals: Record<string, { weight: number; achieved: number }> = {};

  let graded = 0;
  let missing = 0;

  for (const def of FIELD_DEFINITIONS) {
    const weight = WEIGHTS[def.key] ?? DEFAULT_WEIGHT;
    const value = values.get(def.key);

    let score: number;
    if (value === undefined) {
      // Missing — required fields hurt more than nice-to-haves.
      score = REQUIRED_FIELDS.includes(def.key) ? 0 : 10;
      missing += 1;
    } else {
      score = gradeField(def.key, value);
      graded += 1;
    }
    perField[def.key] = score;

    const pillarBucket = pillarTotals[def.pillar] ?? { weight: 0, achieved: 0 };
    pillarBucket.weight += weight;
    pillarBucket.achieved += (score / 100) * weight;
    pillarTotals[def.pillar] = pillarBucket;
  }

  const totalWeight = Object.values(pillarTotals).reduce((acc, p) => acc + p.weight, 0);
  const totalAchieved = Object.values(pillarTotals).reduce((acc, p) => acc + p.achieved, 0);
  const overall = totalWeight > 0 ? (totalAchieved / totalWeight) * 100 : 0;

  const byPillar = {} as Record<Pillar, number>;
  for (const [pillar, bucket] of Object.entries(pillarTotals)) {
    const v = bucket.weight > 0 ? (bucket.achieved / bucket.weight) * 100 : 0;
    (byPillar as Record<string, number>)[pillar] = round2(v);
  }

  return {
    overall: round2(overall),
    tier: tierForScore(overall),
    by_pillar: byPillar,
    by_field: perField,
    fields_graded: graded,
    fields_missing: missing,
  };
}

export function tierForScore(score: number): ScoreTier {
  for (const band of TIER_BANDS) {
    if (score >= band.min) return band.tier;
  }
  return 'insufficient';
}

// ------------------------------------------------------------
// Per-field grading
// ------------------------------------------------------------

function gradeField(key: FieldKey, value: FieldValue): number {
  const type = TYPE_BY_KEY.get(key);

  // Boolean fields: certs etc.
  if (type === 'boolean') {
    if (value.numeric === 1 || value.text === 'true') return 100;
    if (value.numeric === 0 || value.text === 'false') return 0;
    return 0;
  }

  switch (key) {
    case 'carbon_intensity_kgco2e_per_litre':
      // Drinks-industry rough bands: < 0.5 excellent, > 2.5 poor.
      return gradeFromBand(value.numeric, { excellent: 0.5, fair: 1.5, poor: 2.5, inverse: true });

    case 'water_usage_litres_per_litre':
      // Spirits typical 5–10 L/L, wine 1–4 L/L, beer 3–7 L/L.
      // Below 2 = excellent, above 15 = poor.
      return gradeFromBand(value.numeric, { excellent: 2, fair: 7, poor: 15, inverse: true });

    case 'net_zero_target_year': {
      const year = value.numeric;
      if (year == null) return 30;
      if (year <= 2030) return 100;
      if (year >= 2050) return 30;
      // Linear taper between 2030 and 2050.
      const t = (year - 2030) / 20;
      return Math.round((100 - t * 70) * 100) / 100;
    }

    case 'sustainability_report_year': {
      const year = value.numeric;
      if (year == null) return 30;
      const currentYear = new Date().getFullYear();
      const age = currentYear - year;
      if (age <= 1) return 100;
      if (age <= 2) return 80;
      if (age <= 3) return 50;
      return 20;
    }

    case 'scope_1_tco2e':
    case 'scope_2_tco2e':
    case 'scope_3_tco2e':
      // Presence-only credit: we can't grade absolutes without
      // revenue/volume context. Having measured = engagement signal.
      return value.numeric != null && value.numeric > 0 ? 80 : 40;

    case 'recycled_packaging_percentage': {
      const v = value.numeric;
      if (v == null) return 30;
      return Math.max(0, Math.min(100, Math.round(v)));
    }

    case 'organic_percentage': {
      const v = value.numeric;
      if (v == null) return 30;
      return Math.max(0, Math.min(100, Math.round(v)));
    }

    case 'sbt_status': {
      if (value.text === 'targets_set') return 100;
      if (value.text === 'committed') return 70;
      if (value.text === 'none') return 0;
      return 30;
    }
  }

  if (type === 'year' || type === 'number') {
    // Presence-only credit for numeric fields we haven't graded
    // explicitly above.
    return value.numeric != null ? 60 : 0;
  }
  if (type === 'string' || type === 'longtext') {
    // Strings: just credit for presence.
    return value.text.trim().length > 0 ? 60 : 0;
  }
  return 0;
}

/**
 * Map a numeric value to a 0–100 score using three reference points.
 * `inverse: true` flips the polarity (lower-is-better for emissions /
 * intensity / water use).
 */
function gradeFromBand(
  value: number | null,
  band: { excellent: number; fair: number; poor: number; inverse?: boolean },
): number {
  if (value == null || !Number.isFinite(value)) return 30;
  const { excellent, fair, poor, inverse } = band;
  let v = value;
  if (inverse) {
    if (v <= excellent) return 100;
    if (v >= poor) return 20;
    if (v <= fair) {
      // Linear 100 → 70 in [excellent, fair].
      const t = (v - excellent) / (fair - excellent);
      return round2(100 - t * 30);
    }
    // Linear 70 → 20 in [fair, poor].
    const t = (v - fair) / (poor - fair);
    return round2(70 - t * 50);
  }
  if (v >= excellent) return 100;
  if (v <= poor) return 20;
  if (v >= fair) {
    const t = (v - fair) / (excellent - fair);
    return round2(70 + t * 30);
  }
  const t = (v - poor) / (fair - poor);
  return round2(20 + t * 50);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
