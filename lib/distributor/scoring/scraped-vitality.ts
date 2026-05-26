import type { FieldKey } from '../scraping/field-definitions';
import type { ScoreTier } from './vitality-calculator';

export type ScrapedPillar = 'environment' | 'social' | 'governance';

export interface ScrapedFieldValue {
  field_key: FieldKey;
  text: string;
  numeric: number | null;
}

export interface ScrapedVitalityResult {
  overall: number;
  tier: ScoreTier;
  by_pillar: Record<ScrapedPillar, number>;
  by_field: Partial<Record<FieldKey, number>>;
  fields_graded: number;
  /** Total weight available across the model (constant for a given config). */
  total_weight: number;
  /** Weight actually contributing — i.e. weight of fields with a value. */
  achieved_weight: number;
}

/**
 * Credit-based scoring for scraped (non-alka**tera**) brands.
 *
 * Why "credit-based" — when a brand isn't on alka**tera**, we can't
 * expect them to publish every metric publicly. Penalising missing
 * fields with a zero (the way the alka**tera** scorer does) crushes
 * the score even when the brand has solid certification evidence,
 * which is unfair and not what a distributor wants to see. Instead:
 *
 *   score = sum(weight × field_grade/100) / sum(weight) × 100
 *   missing field = contributes 0 (neither penalty nor credit)
 *
 * Same inputs always produce the same output. Every contributing
 * field cites a source_url, so the score is fully auditable.
 *
 * Three pillars, equal weight in the overall:
 *   - Environment: carbon, water, packaging, agriculture inputs
 *   - Social: labour / community / supplier responsibility certs
 *   - Governance: management systems, transparency, leadership
 *
 * B Corp deliberately appears in both Social and Governance because
 * the B Lab certification covers both areas; the duplication is the
 * right semantic, not a bug.
 */

interface FieldConfig {
  pillar: ScrapedPillar;
  weight: number;
}

/**
 * Field-to-pillar allocation. Editing this is the primary way to tune
 * the scoring model — change here and tests, no other moving parts.
 *
 * Some fields appear in multiple pillars (B Corp, organic_certified):
 * the field contributes its weight to each pillar it appears in. This
 * is intentional because those certs are genuinely cross-cutting.
 */
const FIELD_PILLARS: Partial<Record<FieldKey, FieldConfig[]>> = {
  // ───────────── Environment ─────────────
  // Leadership signals — heavy weight. A brand that publishes EPDs,
  // claims carbon-negative operations (with evidence), runs on 100%
  // renewable energy, and partners with a CDR provider is doing
  // materially harder work than one that just discloses Scope 1/2/3
  // numbers. The scoring model should recognise this.
  epd_published:                     [{ pillar: 'environment', weight: 3 }],
  carbon_negative_claim:             [{ pillar: 'environment', weight: 3 }],
  renewable_energy_percentage:       [{ pillar: 'environment', weight: 2 }],
  cdr_partnership:                   [{ pillar: 'environment', weight: 1.5 }],
  // Quantitative metrics — kept relevant when present but reduced so
  // a missing Scope 3 number doesn't dominate the pillar for a
  // genuinely-leading brand that hasn't published the raw figure.
  carbon_intensity_kgco2e_per_litre: [{ pillar: 'environment', weight: 2 }],
  scope_1_tco2e:                     [{ pillar: 'environment', weight: 1 }],
  scope_2_tco2e:                     [{ pillar: 'environment', weight: 1 }],
  scope_3_tco2e:                     [{ pillar: 'environment', weight: 1.5 }],
  net_zero_target_year:              [{ pillar: 'environment', weight: 1 }],
  sbt_status:                        [{ pillar: 'environment', weight: 1 }],
  water_usage_litres_per_litre:      [{ pillar: 'environment', weight: 1.5 }],
  water_recycled_percentage:         [{ pillar: 'environment', weight: 0.5 }],
  water_stress_region:               [{ pillar: 'environment', weight: 0.5 }],
  recycled_packaging_percentage:     [{ pillar: 'environment', weight: 1.5 }],
  packaging_primary_material:        [{ pillar: 'environment', weight: 1.5 }],
  carbon_trust_certified:            [{ pillar: 'environment', weight: 1 }],
  iwca_member:                       [{ pillar: 'environment', weight: 1 }],
  porto_protocol_signatory:          [{ pillar: 'environment', weight: 1 }],
  organic_percentage:                [{ pillar: 'environment', weight: 1 }],
  // ───────────── Social ─────────────
  fairtrade_certified:               [{ pillar: 'social', weight: 2 }],
  rainforest_alliance_certified:     [{ pillar: 'social', weight: 1.5 }],
  // Organic = labour/workers' exposure + environment input → both
  organic_certified: [
    { pillar: 'social', weight: 1 },
    { pillar: 'environment', weight: 1.5 },
  ],
  // B Corp = strong cross-cutting signal → Social AND Governance
  bcorp_certified: [
    { pillar: 'social', weight: 1.5 },
    { pillar: 'governance', weight: 2 },
  ],
  // ───────────── Governance ─────────────
  iso_14001_certified:               [{ pillar: 'governance', weight: 1.5 }],
  iso_50001_certified:               [{ pillar: 'governance', weight: 1.5 }],
  sustainability_report_url:         [{ pillar: 'governance', weight: 2 }],
  sustainability_report_year:        [{ pillar: 'governance', weight: 1 }],
  parent_company:                    [{ pillar: 'governance', weight: 1 }],
  hq_country:                        [{ pillar: 'governance', weight: 0.5 }],
  founding_year:                     [{ pillar: 'governance', weight: 0.5 }],
  company_registration_number:       [{ pillar: 'governance', weight: 0.5 }],
  contact_email:                     [{ pillar: 'governance', weight: 0.5 }],
  company_description:               [{ pillar: 'governance', weight: 0.5 }],
};

const TIER_BANDS: Array<{ tier: ScoreTier; min: number }> = [
  { tier: 'leader', min: 60 },
  { tier: 'progressing', min: 35 },
  { tier: 'developing', min: 15 },
  { tier: 'insufficient', min: 0 },
];

export function calculateScrapedVitality(
  values: Map<FieldKey, ScrapedFieldValue>,
): ScrapedVitalityResult {
  const pillarBuckets: Record<ScrapedPillar, { weight: number; achieved: number }> = {
    environment: { weight: 0, achieved: 0 },
    social: { weight: 0, achieved: 0 },
    governance: { weight: 0, achieved: 0 },
  };
  const perField: Partial<Record<FieldKey, number>> = {};
  let totalWeight = 0;
  let achievedWeight = 0;
  let graded = 0;

  for (const [key, configs] of Object.entries(FIELD_PILLARS) as Array<[
    FieldKey,
    FieldConfig[],
  ]>) {
    const value = values.get(key);
    const grade = value ? gradeField(key, value) : null;
    if (grade != null) perField[key] = grade;

    for (const cfg of configs) {
      pillarBuckets[cfg.pillar].weight += cfg.weight;
      totalWeight += cfg.weight;
      if (grade != null) {
        pillarBuckets[cfg.pillar].achieved += (grade / 100) * cfg.weight;
        achievedWeight += cfg.weight;
      }
    }
    if (value && grade != null) graded += 1;
  }

  const byPillar: Record<ScrapedPillar, number> = {
    environment: pillarBuckets.environment.weight > 0
      ? round2((pillarBuckets.environment.achieved / pillarBuckets.environment.weight) * 100)
      : 0,
    social: pillarBuckets.social.weight > 0
      ? round2((pillarBuckets.social.achieved / pillarBuckets.social.weight) * 100)
      : 0,
    governance: pillarBuckets.governance.weight > 0
      ? round2((pillarBuckets.governance.achieved / pillarBuckets.governance.weight) * 100)
      : 0,
  };

  // Overall: weighted mean across pillars by their total weight in the
  // model. (Equivalent to sum(achieved)/sum(weight) × 100.)
  const totalAchieved =
    pillarBuckets.environment.achieved +
    pillarBuckets.social.achieved +
    pillarBuckets.governance.achieved;
  const overall = totalWeight > 0 ? round2((totalAchieved / totalWeight) * 100) : 0;

  return {
    overall,
    tier: tierForScrapedScore(overall),
    by_pillar: byPillar,
    by_field: perField,
    fields_graded: graded,
    total_weight: round2(totalWeight),
    achieved_weight: round2(achievedWeight),
  };
}

export function tierForScrapedScore(score: number): ScoreTier {
  for (const band of TIER_BANDS) {
    if (score >= band.min) return band.tier;
  }
  return 'insufficient';
}

// ────────────────────────────────────────────────────────────────────
// Per-field grading. Mirrors the alka**tera** scorer's bands but with
// no "missing required" zero-out — credit-based means missing fields
// don't have a score at all (returned as null and skipped above).
// ────────────────────────────────────────────────────────────────────

function gradeField(key: FieldKey, value: ScrapedFieldValue): number {
  // Boolean certs + boolean leadership signals — common pattern.
  if (
    key.endsWith('_certified') ||
    key === 'iwca_member' ||
    key === 'porto_protocol_signatory' ||
    key === 'water_stress_region' ||
    key === 'epd_published' ||
    key === 'carbon_negative_claim' ||
    key === 'cdr_partnership'
  ) {
    if (value.numeric === 1 || value.text === 'true') return 100;
    if (value.numeric === 0 || value.text === 'false') return 0;
    return 0;
  }

  switch (key) {
    case 'carbon_intensity_kgco2e_per_litre':
      // Lower is better. Carbon-negative values (≤ 0.5) hit 100.
      return gradeFromBand(value.numeric, { excellent: 0.5, fair: 1.5, poor: 2.5, inverse: true });
    case 'water_usage_litres_per_litre':
      return gradeFromBand(value.numeric, { excellent: 2, fair: 7, poor: 15, inverse: true });
    case 'net_zero_target_year': {
      const year = value.numeric;
      if (year == null) return 0;
      if (year <= 2030) return 100;
      if (year >= 2050) return 30;
      const t = (year - 2030) / 20;
      return round2(100 - t * 70);
    }
    case 'sustainability_report_year': {
      const year = value.numeric;
      if (year == null) return 0;
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
      // Presence-only credit — having measured at all is the signal.
      return value.numeric != null ? 80 : 0;
    case 'recycled_packaging_percentage':
    case 'organic_percentage':
    case 'water_recycled_percentage':
    case 'renewable_energy_percentage': {
      const v = value.numeric;
      if (v == null) return 0;
      return Math.max(0, Math.min(100, Math.round(v)));
    }
    case 'sbt_status':
      if (value.text === 'targets_set') return 100;
      if (value.text === 'committed') return 70;
      if (value.text === 'none') return 0;
      return 0;
    case 'packaging_primary_material':
      // Presence-only credit for now — substance bands are a follow-on.
      return value.text ? 80 : 0;
    default:
      // String presence → 70 (parent_company, hq_country, contact_email, etc.).
      return value.text ? 70 : 0;
  }
}

function gradeFromBand(
  value: number | null,
  band: { excellent: number; fair: number; poor: number; inverse?: boolean },
): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const { excellent, fair, poor, inverse } = band;
  if (inverse) {
    if (value <= excellent) return 100;
    if (value >= poor) return 20;
    if (value <= fair) {
      const t = (value - excellent) / (fair - excellent);
      return round2(100 - t * 30);
    }
    const t = (value - fair) / (poor - fair);
    return round2(70 - t * 50);
  }
  if (value >= excellent) return 100;
  if (value <= poor) return 20;
  if (value >= fair) {
    const t = (value - fair) / (excellent - fair);
    return round2(70 + t * 30);
  }
  const t = (value - poor) / (fair - poor);
  return round2(20 + t * 50);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
