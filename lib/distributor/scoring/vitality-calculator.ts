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
  /** Optional provenance — passed through from scraped_brand_data.source_name.
   *  alka**tera** scoring uses this to give a 1.25× weight bonus to
   *  fields where the source is platform-verified (alkatera_live or
   *  brand_verified). Omit when not known. */
  source?: string | null;
  /** Optional source URL — passed through from
   *  scraped_brand_data.source_url so the scraped vitality calculator
   *  can attribute each fired signal to a clickable evidence link in
   *  the breakdown panel. */
  source_url?: string | null;
}

/** Sources that earn the alka**tera** "verified" weight multiplier. */
const VERIFIED_SOURCES = new Set(['alkatera_live', 'brand_verified']);
/** Multiplier applied to a field's weight when the source is verified. */
const VERIFIED_WEIGHT_MULTIPLIER = 1.25;

export interface AlkateraInputs {
  /** ESG composite score from esg_score_snapshots (0..100). When
   *  present this is folded into the alka**tera** scorer as a high-
   *  weight Governance signal — captures the granular per-pillar
   *  calculation alka**tera** customers get on-platform that the
   *  field-level model can't replicate. */
  esgComposite?: number | null;
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

/**
 * Vitality for alka**tera**-linked brands.
 *
 * Now credit-based (same fairness as the scraped scorer) — missing
 * fields contribute zero rather than zero-times-high-weight. The
 * penalty model was unfair to alka**tera** customers who are mid-
 * journey of populating their data: a brand that's done the hard
 * work of running ghg_emissions through alka**tera** but hasn't filled
 * facility_water_data yet was getting punished harder than a scraped
 * brand with the same gap.
 *
 * What sets the alka**tera** scorer apart from the scraped scorer:
 *   1. The full 6-pillar breakdown (vs 3 pillars for scraped) —
 *      reflects the richer data structure alka**tera** customers have.
 *   2. Verified-source bonus: when a field's source is alkatera_live
 *      or brand_verified, the field's weight is multiplied by 1.25.
 *      Recognises that platform-verified data is materially stronger
 *      evidence than open-web scrapes.
 *   3. ESG composite from esg_score_snapshots folds in as a heavy
 *      Governance signal when present — captures alka**tera**'s
 *      granular per-pillar calculation the field model can't replicate.
 */
export function calculateVitality(
  values: Map<FieldKey, FieldValue>,
  alkateraInputs?: AlkateraInputs,
): VitalityResult {
  const perField: Partial<Record<FieldKey, number>> = {};
  const pillarTotals: Record<string, { weight: number; achieved: number }> = {};

  let graded = 0;
  let missing = 0;

  for (const def of FIELD_DEFINITIONS) {
    const baseWeight = WEIGHTS[def.key] ?? DEFAULT_WEIGHT;
    const value = values.get(def.key);

    // Pillar denominator always includes the base weight of every
    // field in the model — that's the "out of possible" semantics.
    // Missing fields don't earn anything (no penalty value of 0×weight)
    // but the score's ceiling stays bound by the data we're missing.
    const pillarBucket = pillarTotals[def.pillar] ?? { weight: 0, achieved: 0 };
    pillarBucket.weight += baseWeight;

    if (value === undefined) {
      missing += 1;
      pillarTotals[def.pillar] = pillarBucket;
      continue;
    }

    const score = gradeField(def.key, value);
    perField[def.key] = score;
    graded += 1;

    // Verified-source bonus: alka**tera**-platform data wins more
    // weight than scraped evidence. Brand-verified (the brand itself
    // confirmed via the upload portal) gets the same lift. Bonus only
    // applies to the *achieved* side — the denominator stays at
    // baseWeight so a brand with verified data can score *higher* than
    // 100 × baseWeight / baseWeight, lifting the overall.
    const verified = value.source ? VERIFIED_SOURCES.has(value.source) : false;
    const effectiveWeight = verified ? baseWeight * VERIFIED_WEIGHT_MULTIPLIER : baseWeight;

    pillarBucket.achieved += (score / 100) * effectiveWeight;
    pillarTotals[def.pillar] = pillarBucket;
  }

  // Fold in the ESG composite as a heavy Governance signal when
  // alka**tera** has computed one. Weight 5 — about half the existing
  // Governance pillar — so it materially lifts the score for brands
  // doing the full ESG calc without dominating the field-level data.
  if (alkateraInputs?.esgComposite != null && Number.isFinite(alkateraInputs.esgComposite)) {
    const ESG_WEIGHT = 5;
    const composite = Math.max(0, Math.min(100, alkateraInputs.esgComposite));
    const bucket = pillarTotals['governance'] ?? { weight: 0, achieved: 0 };
    bucket.weight += ESG_WEIGHT;
    bucket.achieved += (composite / 100) * ESG_WEIGHT;
    pillarTotals['governance'] = bucket;
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
