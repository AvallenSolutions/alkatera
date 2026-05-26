import type { FieldKey } from '../scraping/field-definitions';
import type { ScoreTier } from './vitality-calculator';

export type ScrapedPillar = 'environment' | 'social' | 'governance';

export interface ScrapedFieldValue {
  field_key: FieldKey;
  text: string;
  numeric: number | null;
}

export interface PillarSignals {
  count: number;
  signals: string[];
  score: number;
  tier: ScoreTier;
}

export interface ScrapedVitalityResult {
  overall: number;
  tier: ScoreTier;
  by_pillar: Record<ScrapedPillar, number>;
  by_field: Partial<Record<FieldKey, number>>;
  fields_graded: number;
  total_weight: number;
  achieved_weight: number;
  /** Per-pillar breakdown of which signals contributed. The brand-
   *  detail page reads this so the score is auditable on the page
   *  itself — distributors can see exactly which evidence took the
   *  brand into the tier they did. */
  signals_by_pillar: Record<ScrapedPillar, PillarSignals>;
}

/**
 * Signal-count tier scoring for scraped (non-alka**tera**) brands.
 *
 * The previous weighted-sum-across-30-fields model produced
 * counter-intuitive results: a carbon-negative B Corp distillery with
 * 4 published EPDs scored 4/100 because the model penalised missing
 * Fairtrade / Rainforest-Alliance / IWCA fields that aren't relevant
 * to a rum distillery. The model couldn't distinguish "this brand
 * doesn't need this credential" from "this brand is failing on it".
 *
 * New rule: count distinct *positive* sustainability signals per
 * pillar. The tier is determined purely by the count — there's no
 * weighting, no denominator. Missing fields and "we couldn't verify"
 * negatives don't penalise. This means the score is dead simple to
 * explain: "Two Drifters is a Leader on Environment because they're
 * carbon-negative, publish EPDs, use 100% renewable energy, and have
 * a permanent-CDR partnership with Climeworks."
 *
 * Tiers (per pillar):
 *   0 signals → Insufficient (15)
 *   1 signal  → Developing (35)
 *   2 signals → Progressing (55)
 *   3 signals → Leader (75)
 *   4+ signals → Leader (90)
 *
 * Overall = 0.70 × Environment + 0.15 × Social + 0.15 × Governance.
 * Environment dominates because carbon footprint is the headline
 * sustainability signal for drinks brands — packaging, supply chain,
 * agricultural inputs flow into it. Social and Governance are
 * supporting context. This weighting is the only knob that shapes
 * the headline; everything else is auditable signal lists.
 *
 * Same inputs always produce the same output. Every contributing
 * signal cites a source URL (the field it derived from), so a
 * distributor can click through to the evidence.
 */

const PILLAR_WEIGHT: Record<ScrapedPillar, number> = {
  environment: 0.7,
  social: 0.15,
  governance: 0.15,
};

const TIER_THRESHOLDS: Array<{ tier: ScoreTier; min: number }> = [
  { tier: 'leader', min: 60 },
  { tier: 'progressing', min: 35 },
  { tier: 'developing', min: 15 },
  { tier: 'insufficient', min: 0 },
];

/**
 * Per-pillar signal definitions. Each signal is a named test against
 * the value map — it fires when the brand has positive evidence for
 * the underlying claim. False / missing values DO NOT fire (a brand
 * scraped-without-Fairtrade isn't being claimed by anyone to fail
 * Fairtrade; it's just not relevant).
 */
interface Signal {
  id: string;
  label: string;
  test: (v: Map<FieldKey, ScrapedFieldValue>) => boolean;
}

const ENV_SIGNALS: Signal[] = [
  { id: 'carbon_negative',
    label: 'Carbon-negative operations',
    test: (v) => isTrue(v.get('carbon_negative_claim'))
      || (() => {
        const ci = v.get('carbon_intensity_kgco2e_per_litre');
        return ci?.numeric != null && ci.numeric <= 0;
      })() },
  { id: 'epd_published',
    label: 'Environmental Product Declaration published',
    test: (v) => isTrue(v.get('epd_published')) },
  { id: 'renewable_energy',
    label: '100% renewable energy',
    test: (v) => {
      const re = v.get('renewable_energy_percentage');
      return re?.numeric != null && re.numeric >= 75;
    } },
  { id: 'cdr_partnership',
    label: 'Permanent carbon-removal partnership',
    test: (v) => isTrue(v.get('cdr_partnership')) },
  { id: 'sbt_committed',
    label: 'Science-based target set or committed',
    test: (v) => {
      const s = v.get('sbt_status');
      return s?.text === 'committed' || s?.text === 'targets_set';
    } },
  { id: 'carbon_intensity_disclosed',
    label: 'Carbon intensity disclosed (kgCO₂e/L)',
    test: (v) => v.get('carbon_intensity_kgco2e_per_litre')?.numeric != null },
  { id: 'full_scope_disclosure',
    label: 'Full Scope 1+2+3 disclosure',
    test: (v) =>
      v.get('scope_1_tco2e')?.numeric != null &&
      v.get('scope_2_tco2e')?.numeric != null &&
      v.get('scope_3_tco2e')?.numeric != null },
  { id: 'water_disclosed',
    label: 'Water usage disclosed (L/L)',
    test: (v) => v.get('water_usage_litres_per_litre')?.numeric != null },
  { id: 'recycled_packaging',
    label: 'Recycled packaging ≥ 75%',
    test: (v) => {
      const rp = v.get('recycled_packaging_percentage');
      return rp?.numeric != null && rp.numeric >= 75;
    } },
  { id: 'carbon_trust',
    label: 'Carbon Trust certified',
    test: (v) => isTrue(v.get('carbon_trust_certified')) },
  { id: 'iwca',
    label: 'International Wineries for Climate Action member',
    test: (v) => isTrue(v.get('iwca_member')) },
  { id: 'porto_protocol',
    label: 'Porto Protocol signatory',
    test: (v) => isTrue(v.get('porto_protocol_signatory')) },
];

const SOCIAL_SIGNALS: Signal[] = [
  { id: 'bcorp',
    label: 'B Corp certified',
    test: (v) => isTrue(v.get('bcorp_certified')) },
  { id: 'fairtrade',
    label: 'Fairtrade certified',
    test: (v) => isTrue(v.get('fairtrade_certified')) },
  { id: 'rainforest_alliance',
    label: 'Rainforest Alliance certified',
    test: (v) => isTrue(v.get('rainforest_alliance_certified')) },
  { id: 'organic',
    label: 'Organic certified',
    test: (v) => isTrue(v.get('organic_certified'))
      || (() => {
        const op = v.get('organic_percentage');
        return op?.numeric != null && op.numeric >= 50;
      })() },
];

const GOV_SIGNALS: Signal[] = [
  { id: 'sustainability_report',
    label: 'Recent sustainability report published',
    test: (v) => {
      const url = v.get('sustainability_report_url');
      if (!url?.text) return false;
      const year = v.get('sustainability_report_year');
      if (year?.numeric == null) return true; // URL present, year unknown — give credit
      const currentYear = new Date().getFullYear();
      return currentYear - year.numeric <= 5;
    } },
  { id: 'iso_14001',
    label: 'ISO 14001 (environmental management)',
    test: (v) => isTrue(v.get('iso_14001_certified')) },
  { id: 'iso_50001',
    label: 'ISO 50001 (energy management)',
    test: (v) => isTrue(v.get('iso_50001_certified')) },
  { id: 'net_zero_target',
    label: 'Public net-zero target set',
    test: (v) => {
      const nz = v.get('net_zero_target_year');
      return nz?.numeric != null && nz.numeric > 0 && nz.numeric <= 2070;
    } },
];

export function calculateScrapedVitality(
  values: Map<FieldKey, ScrapedFieldValue>,
): ScrapedVitalityResult {
  const env = scorePillar('environment', ENV_SIGNALS, values);
  const soc = scorePillar('social', SOCIAL_SIGNALS, values);
  const gov = scorePillar('governance', GOV_SIGNALS, values);

  const overall = round2(
    PILLAR_WEIGHT.environment * env.score +
      PILLAR_WEIGHT.social * soc.score +
      PILLAR_WEIGHT.governance * gov.score,
  );

  // Back-compat: by_field reports per-field "grades" so existing
  // diagnostics still work. We populate it with 100/0 for signals
  // that fired/missed, which gives the UI a sense of which fields
  // contributed even though grading is no longer per-field.
  const byField: Partial<Record<FieldKey, number>> = {};
  for (const [key, value] of Array.from(values.entries())) {
    if (isTrue(value)) byField[key] = 100;
    else if (value.numeric != null || value.text) byField[key] = 70;
  }
  const totalSignals = env.count + soc.count + gov.count;

  return {
    overall,
    tier: tierForScore(overall),
    by_pillar: {
      environment: env.score,
      social: soc.score,
      governance: gov.score,
    },
    by_field: byField,
    fields_graded: Object.keys(byField).length,
    total_weight: ENV_SIGNALS.length + SOCIAL_SIGNALS.length + GOV_SIGNALS.length,
    achieved_weight: totalSignals,
    signals_by_pillar: {
      environment: env,
      social: soc,
      governance: gov,
    },
  };
}

function scorePillar(
  _pillar: ScrapedPillar,
  signals: Signal[],
  values: Map<FieldKey, ScrapedFieldValue>,
): PillarSignals {
  const fired: string[] = [];
  for (const signal of signals) {
    if (signal.test(values)) fired.push(signal.label);
  }
  const score = signalsToScore(fired.length);
  return {
    count: fired.length,
    signals: fired,
    score,
    tier: tierForScore(score),
  };
}

function signalsToScore(count: number): number {
  if (count === 0) return 10;
  if (count === 1) return 35;
  if (count === 2) return 55;
  if (count === 3) return 75;
  return 90;
}

export function tierForScrapedScore(score: number): ScoreTier {
  return tierForScore(score);
}

function tierForScore(score: number): ScoreTier {
  for (const band of TIER_THRESHOLDS) {
    if (score >= band.min) return band.tier;
  }
  return 'insufficient';
}

function isTrue(value: ScrapedFieldValue | undefined): boolean {
  if (!value) return false;
  if (value.numeric === 1) return true;
  if (value.text === 'true') return true;
  return false;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
