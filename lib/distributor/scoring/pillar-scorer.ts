import {
  climateIntensitySubScore,
  waterIntensitySubScore,
  circularityAxisSubScore,
  interpolate,
} from '@/lib/vitality/environmental';
import type { VitalityComposite } from '@/lib/vitality/composite';
import {
  getBenchmarkForCategory,
  getWaterBenchmarkForCategory,
} from '@/lib/industry-benchmarks';
import type { FieldKey } from '../scraping/field-definitions';
import { certScoreForFields } from './certification-credibility';
import { scoreTarget } from './target-scorer';

/**
 * Unified brand sustainability scorer.
 *
 * One pillar model, one 0–100 scale, one set of tier bands for every
 * brand — whether the data came from open-web scraping or from the
 * brand's own alka**tera** platform account. The pillars mirror
 * alka**tera**'s own model: four environmental pillars (Climate, Nature,
 * Water, Circularity) plus Social and Governance.
 *
 * Two entry points land on the same scale:
 *   - {@link scoreFromAlkateraComposite}: an alka**tera**-linked brand —
 *     map the brand's real on-platform per-pillar scores across and
 *     re-roll them with the distributor weights.
 *   - {@link scoreFromScrapedFields}: estimate each pillar from whatever
 *     scraped / brand-verified fields we hold, category-adjusting the
 *     intensity pillars.
 *
 * Design rules shared by both:
 *   - A pillar with no data scores `null` and is dropped from the
 *     weighted mean (weight redistributes) — never a hard zero.
 *   - Environment dominates the headline (drinks retailers ask
 *     distributors for carbon and water first); Social + Governance are
 *     supporting context.
 *   - A confidence label reflects how much real data backs the score.
 */

export type ScorePillar =
  | 'climate'
  | 'nature'
  | 'water'
  | 'circularity'
  | 'social'
  | 'governance';

export type ScoreTier = 'leader' | 'progressing' | 'developing' | 'insufficient';

export type ScoreConfidence = 'high' | 'medium' | 'low';

/** How a brand's product category was resolved, fed in by the recalc. */
export type CategoryConfidence = 'declared' | 'detected' | 'industry_default';

export interface FieldValue {
  field_key: FieldKey;
  text: string;
  numeric: number | null;
  source?: string | null;
  /** Source URL the finding was extracted from, when known (display only). */
  source_url?: string | null;
}

export interface UnifiedPillarScores {
  climate: number | null;
  nature: number | null;
  water: number | null;
  circularity: number | null;
  social: number | null;
  governance: number | null;
}

export interface UnifiedScoreResult {
  overall: number;
  tier: ScoreTier;
  by_pillar: UnifiedPillarScores;
  /** E/S/G rollups for the explainer UI. */
  environment: number | null;
  social: number | null;
  governance: number | null;
  confidence: ScoreConfidence;
  evidence: {
    source: 'alkatera' | 'scraped';
    pillarsWithData: number;
    /** Per-pillar list of which positive signals fired (scraped path). */
    signals: Partial<Record<ScorePillar, string[]>>;
  };
}

// ── Weights ───────────────────────────────────────────────────
// Environment-dominant headline (≈70 / 30). Governance edges Social
// because it's better-evidenced from scraping and central to trust.
const TOP_WEIGHTS = { environment: 0.7, social: 0.12, governance: 0.18 } as const;

// Within environment: climate highest, then water/circularity, then
// nature — echoes the platform's 30/25/25/20, tilted harder to climate.
const ENV_WEIGHTS = { climate: 0.4, water: 0.25, circularity: 0.22, nature: 0.13 } as const;

const TIER_BANDS: Array<{ tier: ScoreTier; min: number }> = [
  { tier: 'leader', min: 70 },
  { tier: 'progressing', min: 50 },
  { tier: 'developing', min: 30 },
  { tier: 'insufficient', min: 0 },
];

/**
 * Which score-pillar each field informs. Kept separate from the
 * `FieldDefinition.pillar` (the legacy 6-pillar completeness model) so
 * completeness scoring stays untouched. Fields not listed here (the
 * corporate/context fields) don't directly drive a pillar score.
 */
export const FIELD_TO_SCORE_PILLAR: Partial<Record<FieldKey, ScorePillar>> = {
  // Climate
  carbon_intensity_kgco2e_per_litre: 'climate',
  scope_1_tco2e: 'climate',
  scope_2_tco2e: 'climate',
  scope_3_tco2e: 'climate',
  net_zero_target_year: 'climate',
  sbt_status: 'climate',
  carbon_trust_certified: 'climate',
  epd_published: 'climate',
  carbon_negative_claim: 'climate',
  renewable_energy_percentage: 'climate',
  cdr_partnership: 'climate',
  iwca_member: 'climate',
  porto_protocol_signatory: 'climate',
  interim_reduction_percentage: 'climate',
  interim_target_year: 'climate',
  target_baseline_year: 'climate',
  sbti_validated: 'climate',
  // Water
  water_usage_litres_per_litre: 'water',
  water_recycled_percentage: 'water',
  // Nature
  water_stress_region: 'nature',
  organic_certified: 'nature',
  organic_percentage: 'nature',
  rainforest_alliance_certified: 'nature',
  // Circularity
  recycled_packaging_percentage: 'circularity',
  packaging_primary_material: 'circularity',
  // Social
  fairtrade_certified: 'social',
  bcorp_certified: 'social',
  // Governance
  iso_14001_certified: 'governance',
  iso_50001_certified: 'governance',
  sustainability_report_url: 'governance',
  sustainability_report_year: 'governance',
};

export function tierForScore(score: number): ScoreTier {
  for (const band of TIER_BANDS) {
    if (score >= band.min) return band.tier;
  }
  return 'insufficient';
}

/** Weighted mean that skips null parts and renormalises over the rest. */
export function weightedAvgSkippingNull(
  parts: Array<{ v: number | null; w: number }>,
): number | null {
  let num = 0;
  let den = 0;
  for (const { v, w } of parts) {
    if (v == null || !Number.isFinite(v) || w <= 0) continue;
    num += v * w;
    den += w;
  }
  if (den === 0) return null;
  return num / den;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── Scraped path ──────────────────────────────────────────────

/**
 * Estimate a brand's unified pillar scores from its scraped /
 * brand-verified fields, category-adjusting the intensity pillars.
 */
export function scoreFromScrapedFields(
  values: Map<FieldKey, FieldValue>,
  ctx: { category: string | null; categoryConfidence: CategoryConfidence },
): UnifiedScoreResult {
  const num = (k: FieldKey): number | null => {
    const v = values.get(k);
    return v && v.numeric != null && Number.isFinite(v.numeric) ? v.numeric : null;
  };
  const isTrue = (k: FieldKey): boolean => {
    const v = values.get(k);
    return !!v && (v.numeric === 1 || v.text === 'true');
  };
  const str = (k: FieldKey): string | null => {
    const v = values.get(k);
    return v && v.text.trim() ? v.text.trim() : null;
  };

  const signals: Partial<Record<ScorePillar, string[]>> = {};
  const add = (p: ScorePillar, label: string) => {
    (signals[p] ??= []).push(label);
  };

  // ── Climate ────────────────────────────────────────────────
  let climateBase: number | null = null;
  const ci = num('carbon_intensity_kgco2e_per_litre');
  if (isTrue('carbon_negative_claim')) {
    climateBase = 100;
    add('climate', 'Carbon-negative operations');
  } else if (ci != null) {
    const benchmark = getBenchmarkForCategory(ctx.category).kgCO2ePerLitre;
    climateBase = climateIntensitySubScore(ci / benchmark);
    add('climate', `Carbon intensity disclosed (${ci} kgCO₂e/L)`);
  } else {
    // No measured intensity — credit leadership signals, capped below
    // the score a measured-and-good brand would earn.
    let sig = 0;
    if (num('scope_1_tco2e') != null && num('scope_2_tco2e') != null && num('scope_3_tco2e') != null) {
      sig++;
      add('climate', 'Full Scope 1+2+3 disclosure');
    }
    if (isTrue('epd_published')) { sig++; add('climate', 'EPD published'); }
    const re = num('renewable_energy_percentage');
    if (re != null && re >= 75) { sig++; add('climate', '≥75% renewable energy'); }
    if (isTrue('cdr_partnership')) { sig++; add('climate', 'Permanent carbon-removal partnership'); }
    if (isTrue('carbon_trust_certified')) { sig++; add('climate', 'Carbon Trust certified'); }
    if (sig > 0) {
      climateBase = interpolate(sig, [[0, 0], [1, 40], [2, 55], [3, 68], [4, 80], [5, 88]]);
    }
  }

  const targetScore = scoreTarget({
    interimReductionPct: num('interim_reduction_percentage'),
    interimTargetYear: num('interim_target_year'),
    baselineYear: num('target_baseline_year'),
    netZeroYear: num('net_zero_target_year'),
    sbtStatus: str('sbt_status'),
    sbtiValidated: isTrue('sbti_validated'),
  });
  if (targetScore != null) add('climate', 'Published reduction target');

  const climate = weightedAvgSkippingNull([
    { v: climateBase, w: 0.75 },
    { v: targetScore, w: 0.25 },
  ]);

  // ── Water ──────────────────────────────────────────────────
  let water: number | null = null;
  const wu = num('water_usage_litres_per_litre');
  if (wu != null) {
    const wb = getWaterBenchmarkForCategory(ctx.category).litresPerLitre;
    water = waterIntensitySubScore(wu / wb);
    add('water', `Water use disclosed (${wu} L/L)`);
  } else {
    const wr = num('water_recycled_percentage');
    if (wr != null) {
      water = Math.min(85, clamp(wr, 0, 100));
      add('water', `${Math.round(wr)}% water recycled`);
    }
  }

  // ── Nature ─────────────────────────────────────────────────
  let organicComponent: number | null = null;
  const op = num('organic_percentage');
  if (op != null) {
    organicComponent = clamp(op, 0, 100);
    add('nature', `${Math.round(op)}% organic ingredients`);
  } else if (isTrue('organic_certified')) {
    organicComponent = 60;
    add('nature', 'Organic certified');
  }
  const natureCert = certScoreForFields(['rainforest_alliance_certified'], isTrue);
  if (isTrue('rainforest_alliance_certified')) add('nature', 'Rainforest Alliance certified');
  let nature = weightedAvgSkippingNull([
    { v: organicComponent, w: 0.6 },
    { v: natureCert, w: 0.4 },
  ]);
  // Operating in a water-stressed region is a real nature/watershed
  // pressure — a mild context penalty, never a zero.
  if (nature != null && isTrue('water_stress_region')) {
    nature = Math.max(0, nature - 10);
    add('nature', 'Operates in a water-stressed region (context)');
  }

  // ── Circularity ────────────────────────────────────────────
  const circParts: number[] = [];
  const rp = num('recycled_packaging_percentage');
  if (rp != null) {
    circParts.push(clamp(rp, 0, 100));
    add('circularity', `${Math.round(rp)}% recycled packaging`);
  }
  const recyclability = materialRecyclability(str('packaging_primary_material'));
  if (recyclability != null) {
    circParts.push(recyclability);
    add('circularity', `${str('packaging_primary_material')} packaging`);
  }
  const circularity = circParts.length
    ? circularityAxisSubScore(circParts.reduce((a, b) => a + b, 0) / circParts.length)
    : null;

  // ── Social ─────────────────────────────────────────────────
  let socialSignals = 0;
  if (isTrue('fairtrade_certified')) { socialSignals++; add('social', 'Fairtrade certified'); }
  if (isTrue('bcorp_certified')) { socialSignals++; add('social', 'B Corp certified'); }
  const social = socialSignals === 0
    ? null
    : interpolate(socialSignals, [[0, 0], [1, 45], [2, 65]]);

  // ── Governance ─────────────────────────────────────────────
  let transparency: number | null = null;
  if (str('sustainability_report_url')) {
    const yr = num('sustainability_report_year');
    if (yr == null) {
      transparency = 60;
      add('governance', 'Sustainability report published');
    } else {
      const age = new Date().getFullYear() - yr;
      transparency = age <= 1 ? 100 : age <= 2 ? 80 : age <= 3 ? 50 : 20;
      add('governance', `Sustainability report (${yr})`);
    }
  }
  const govCert = certScoreForFields(
    ['bcorp_certified', 'iso_14001_certified', 'iso_50001_certified'],
    isTrue,
  );
  if (isTrue('iso_14001_certified')) add('governance', 'ISO 14001 certified');
  if (isTrue('iso_50001_certified')) add('governance', 'ISO 50001 certified');
  const governance = weightedAvgSkippingNull([
    { v: transparency, w: 0.5 },
    { v: govCert, w: 0.5 },
  ]);

  const byPillar: UnifiedPillarScores = {
    climate: roundOrNull(climate),
    nature: roundOrNull(nature),
    water: roundOrNull(water),
    circularity: roundOrNull(circularity),
    social: roundOrNull(social),
    governance: roundOrNull(governance),
  };

  return assemble(byPillar, 'scraped', signals, ctx.categoryConfidence);
}

// ── alka**tera** path ─────────────────────────────────────────

/**
 * Map an alka**tera**-linked brand's real on-platform composite onto the
 * unified pillars, then re-roll with the distributor weights so the
 * result sits on the same scale as scraped brands.
 */
export function scoreFromAlkateraComposite(composite: VitalityComposite): UnifiedScoreResult {
  const byPillar: UnifiedPillarScores = {
    climate: roundOrNull(composite.e?.sub?.climate ?? null),
    water: roundOrNull(composite.e?.sub?.water ?? null),
    circularity: roundOrNull(composite.e?.sub?.circularity ?? null),
    nature: roundOrNull(composite.e?.sub?.nature ?? null),
    social: roundOrNull(composite.s?.score ?? null),
    governance: roundOrNull(composite.g?.score ?? null),
  };
  return assemble(byPillar, 'alkatera', {}, 'declared');
}

// ── Shared assembly ───────────────────────────────────────────

function assemble(
  byPillar: UnifiedPillarScores,
  source: 'alkatera' | 'scraped',
  signals: Partial<Record<ScorePillar, string[]>>,
  categoryConfidence: CategoryConfidence,
): UnifiedScoreResult {
  const environment = roundOrNull(
    weightedAvgSkippingNull([
      { v: byPillar.climate, w: ENV_WEIGHTS.climate },
      { v: byPillar.water, w: ENV_WEIGHTS.water },
      { v: byPillar.circularity, w: ENV_WEIGHTS.circularity },
      { v: byPillar.nature, w: ENV_WEIGHTS.nature },
    ]),
  );

  const overallRaw = weightedAvgSkippingNull([
    { v: environment, w: TOP_WEIGHTS.environment },
    { v: byPillar.social, w: TOP_WEIGHTS.social },
    { v: byPillar.governance, w: TOP_WEIGHTS.governance },
  ]);

  const pillarsWithData = (Object.values(byPillar) as Array<number | null>).filter(
    (v) => v != null,
  ).length;

  // Coverage cap — leadership must be earned across the breadth of the
  // model, not inferred from a single strong data point. Without this,
  // a brand assessed on one pillar (e.g. only "glass packaging") has
  // every empty pillar dropped from the mean and that lone pillar
  // becomes the whole score — outranking a brand with comprehensive but
  // imperfect evidence. So we ceiling the headline by how many pillars
  // actually carry data:
  //   ≤1 pillar  → a single data point can't establish any tier
  //   2–3 pillars → solid, but Leader needs ≥4 of 6 dimensions
  //   no environmental data at all → can't lead on a drinks footprint
  let scoreCap = 100;
  if (pillarsWithData <= 1) scoreCap = 29;
  else if (pillarsWithData <= 3) scoreCap = 69;
  if (environment == null) scoreCap = Math.min(scoreCap, 49);

  const overall = overallRaw == null ? 0 : Math.min(round2(overallRaw), scoreCap);

  let confidence: ScoreConfidence;
  if (source === 'alkatera') {
    confidence = 'high';
  } else if (pillarsWithData <= 1) {
    confidence = 'low';
  } else if (pillarsWithData >= 4 && categoryConfidence !== 'industry_default') {
    confidence = 'high';
  } else {
    confidence = 'medium';
  }

  return {
    overall,
    tier: overallRaw == null ? 'insufficient' : tierForScore(overall),
    by_pillar: byPillar,
    environment,
    social: byPillar.social,
    governance: byPillar.governance,
    confidence,
    evidence: { source, pillarsWithData, signals },
  };
}

function roundOrNull(v: number | null): number | null {
  return v == null || !Number.isFinite(v) ? null : round2(v);
}

/**
 * Estimated recyclability of a primary packaging material, as a 0–100
 * input to the circularity axis curve. Widely-recycled materials score
 * high; mixed/flexible plastics low.
 */
function materialRecyclability(material: string | null): number | null {
  if (!material) return null;
  const m = material.toLowerCase().replace(/[^a-z]/g, '');
  if (['glass', 'aluminium', 'aluminum', 'paper', 'card', 'carton', 'tetrapak'].some((x) => m.includes(x))) {
    return 85;
  }
  if (['rpet', 'pet', 'hdpe'].some((x) => m.includes(x))) return 60;
  if (['pouch', 'baginbox', 'plastic', 'mixed', 'flexible', 'other'].some((x) => m.includes(x))) {
    return 30;
  }
  return null;
}
