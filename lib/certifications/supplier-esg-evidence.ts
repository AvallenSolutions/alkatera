import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBcorpQuestionIds } from '@/lib/supplier-esg/questions';

/** Deeper due-diligence questions (living income, country-level risk) tagged to IT4-Y3-001. */
export const DUE_DILIGENCE_QUESTION_IDS = getBcorpQuestionIds('IT4-Y3-001');

/**
 * Supplier ESG survey results -> B Corp supply-chain evidence.
 *
 * A brand sends the ESG self-assessment to its suppliers (see /api/send-esg-survey).
 * When suppliers complete it, the results become supply-chain due-diligence evidence
 * for the brand's own B Corp 2026 certification. This module computes the org-level
 * coverage that the platform-data mappings feed into the readiness engine.
 *
 * Product decisions (confirmed):
 *  - Denominator: Tier 1 (direct) suppliers; fall back to ALL suppliers when none
 *    are tier-classified (and say so in the note so the brand classifies tiers).
 *  - "Assessed" = the supplier has SUBMITTED the assessment (verification is shown
 *    as a stronger signal but does not gate "complete").
 *  - Completeness threshold = 80% of the denominator.
 */

export type Completeness = 'complete' | 'partial' | 'missing';

/** Fraction of the denominator that must be assessed for a "complete" status. */
export const SUPPLIER_ESG_COVERAGE_TARGET = 0.8;

/** A supplier row joined to its (optional) ESG assessment. */
export interface SupplierEsgRow {
  supplierId: string;
  name: string | null;
  tier: string | null;
  annualSpend: number | null;
  assessmentId: string | null;
  submitted: boolean;
  isVerified: boolean;
  scoreTotal: number | null;
  scoreLabour: number | null;
  scoreEthics: number | null;
  scoreEnvironment: number | null;
  scoreRating: string | null;
  answers: Record<string, string> | null;
}

export interface AssessedSupplier {
  assessmentId: string;
  name: string;
  rating: string | null;
  labour: number | null;
  ethics: number | null;
  environment: number | null;
  verified: boolean;
}

export interface SupplierEsgCoverage {
  tierBasis: 'tier_1' | 'all';
  denominator: number;
  assessed: number;
  verified: number;
  coveragePct: number; // 0..1
  completeness: Completeness;
  note: string | null;
  avgLabour: number | null;
  avgEthics: number | null;
  avgEnvironment: number | null;
  distribution: { leader: number; progressing: number; needs_improvement: number };
  assessedSuppliers: AssessedSupplier[];
}

export interface ClimateEngagedSupplier {
  assessmentId: string;
  name: string;
  measuresScope3: boolean;
  hasScienceTarget: boolean;
}

export interface SupplierClimateCoverage {
  tierBasis: 'tier_1' | 'all';
  denominator: number;
  engaged: number; // measures Scope 3 OR has a science-based target
  measuresScope3: number;
  hasScienceTarget: number;
  coveragePct: number; // 0..1
  completeness: Completeness;
  note: string | null;
  engagedSuppliers: ClimateEngagedSupplier[];
}

function avg(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function completenessFor(assessed: number, denominator: number, target: number): Completeness {
  if (assessed === 0) return 'missing';
  if (denominator === 0) return 'missing';
  return assessed / denominator >= target ? 'complete' : 'partial';
}

function pickDenominator(rows: SupplierEsgRow[]): { basis: 'tier_1' | 'all'; rows: SupplierEsgRow[] } {
  const tier1 = rows.filter((r) => r.tier === 'tier_1');
  if (tier1.length > 0) return { basis: 'tier_1', rows: tier1 };
  return { basis: 'all', rows };
}

function affirmative(answer: string | undefined): boolean {
  return answer === 'yes' || answer === 'partial';
}

/**
 * Pure, testable summary of supplier ESG coverage for the human-rights /
 * due-diligence requirements (IT4). Operates on already-fetched rows.
 */
export function summariseSupplierEsg(
  allRows: SupplierEsgRow[],
  opts?: { target?: number; requireAnyAffirmed?: string[]; coverageLabel?: string },
): SupplierEsgCoverage {
  const target = opts?.target ?? SUPPLIER_ESG_COVERAGE_TARGET;
  const required = opts?.requireAnyAffirmed ?? [];
  const coverageLabel = opts?.coverageLabel ?? 'have completed the ESG self-assessment';
  const { basis, rows } = pickDenominator(allRows);
  const denominator = rows.length;
  // "Assessed" = submitted. When requireAnyAffirmed is set (e.g. Year-3 deeper due
  // diligence), the supplier must also affirm at least one of those tagged questions.
  const assessedRows = rows.filter(
    (r) =>
      r.submitted &&
      r.assessmentId &&
      (required.length === 0 || required.some((qid) => affirmative(r.answers?.[qid]))),
  );
  const assessed = assessedRows.length;
  const verified = assessedRows.filter((r) => r.isVerified).length;
  const coveragePct = denominator > 0 ? assessed / denominator : 0;
  const completeness = completenessFor(assessed, denominator, target);

  const distribution = { leader: 0, progressing: 0, needs_improvement: 0 };
  for (const r of assessedRows) {
    if (r.scoreRating === 'leader') distribution.leader += 1;
    else if (r.scoreRating === 'progressing') distribution.progressing += 1;
    else if (r.scoreRating === 'needs_improvement') distribution.needs_improvement += 1;
  }

  const tierWord = basis === 'tier_1' ? 'direct (Tier 1) suppliers' : 'suppliers';
  let note: string | null;
  if (denominator === 0) {
    note = 'No suppliers on alkatera yet. Add suppliers and send them the ESG survey.';
  } else if (assessed === 0) {
    note = `None of your ${denominator} ${tierWord} ${coverageLabel} yet. Send them the survey from the Suppliers page.`;
  } else {
    const labourAvg = avg(assessedRows.map((r) => r.scoreLabour));
    note =
      `${assessed} of ${denominator} ${tierWord} ${coverageLabel}` +
      (verified > 0 ? ` (${verified} verified)` : '') +
      (labourAvg != null ? `, average labour & human-rights score ${labourAvg}` : '') +
      '.';
    if (basis === 'all') {
      note +=
        ' No suppliers are classified by tier yet, so this counts all suppliers. Classify your direct suppliers as Tier 1 for a sharper B Corp view.';
    }
  }

  return {
    tierBasis: basis,
    denominator,
    assessed,
    verified,
    coveragePct,
    completeness,
    note,
    avgLabour: avg(assessedRows.map((r) => r.scoreLabour)),
    avgEthics: avg(assessedRows.map((r) => r.scoreEthics)),
    avgEnvironment: avg(assessedRows.map((r) => r.scoreEnvironment)),
    distribution,
    assessedSuppliers: assessedRows.map((r) => ({
      assessmentId: r.assessmentId as string,
      name: r.name ?? 'Unnamed supplier',
      rating: r.scoreRating,
      labour: r.scoreLabour,
      ethics: r.scoreEthics,
      environment: r.scoreEnvironment,
      verified: r.isVerified,
    })),
  };
}

/**
 * Pure, testable summary of value-chain climate engagement for IT5 (Scope 3).
 * A supplier is "engaged" when its submitted assessment says it measures Scope 3
 * (env_11) and/or has a science-based 1.5C target (env_12).
 */
export function summariseSupplierClimate(
  allRows: SupplierEsgRow[],
  opts?: { target?: number },
): SupplierClimateCoverage {
  const target = opts?.target ?? SUPPLIER_ESG_COVERAGE_TARGET;
  const { basis, rows } = pickDenominator(allRows);
  const denominator = rows.length;
  const assessedRows = rows.filter((r) => r.submitted && r.assessmentId);

  const engagedSuppliers: ClimateEngagedSupplier[] = [];
  let measuresScope3 = 0;
  let hasScienceTarget = 0;
  for (const r of assessedRows) {
    const s3 = affirmative(r.answers?.env_11);
    const sbt = affirmative(r.answers?.env_12);
    if (s3) measuresScope3 += 1;
    if (sbt) hasScienceTarget += 1;
    if (s3 || sbt) {
      engagedSuppliers.push({
        assessmentId: r.assessmentId as string,
        name: r.name ?? 'Unnamed supplier',
        measuresScope3: s3,
        hasScienceTarget: sbt,
      });
    }
  }
  const engaged = engagedSuppliers.length;
  const coveragePct = denominator > 0 ? engaged / denominator : 0;
  const completeness = completenessFor(engaged, denominator, target);

  const tierWord = basis === 'tier_1' ? 'direct (Tier 1) suppliers' : 'suppliers';
  let note: string | null;
  if (denominator === 0) {
    note = 'No suppliers on alkatera yet.';
  } else if (engaged === 0) {
    note = `None of your ${denominator} ${tierWord} report measuring Scope 3 or holding a science-based target. This is supplementary value-chain evidence; your own emissions data drives this requirement.`;
  } else {
    note =
      `${engaged} of ${denominator} ${tierWord} engage on value-chain climate ` +
      `(${measuresScope3} measure Scope 3, ${hasScienceTarget} hold a science-based target). ` +
      'Supplementary to your own emissions and targets.';
    if (basis === 'all') {
      note += ' Tier-classify your direct suppliers for a sharper view.';
    }
  }

  return {
    tierBasis: basis,
    denominator,
    engaged,
    measuresScope3,
    hasScienceTarget,
    coveragePct,
    completeness,
    note,
    engagedSuppliers,
  };
}

/**
 * Fetch the org's suppliers joined to their ESG assessments. Service-role only
 * (supplier_esg_assessments is RLS-protected to the supplier's own org), which is
 * how the auto-evidence cron and the readiness API already run.
 */
export async function fetchSupplierEsgRows(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<SupplierEsgRow[]> {
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, supplier_tier, annual_spend')
    .eq('organization_id', organizationId);

  const supplierRows = suppliers ?? [];
  if (supplierRows.length === 0) return [];

  const ids = supplierRows.map((s: any) => s.id);
  const { data: assessments } = await supabase
    .from('supplier_esg_assessments')
    .select(
      'supplier_id, id, submitted, is_verified, score_total, score_labour, score_ethics, score_environment, score_rating, answers',
    )
    .in('supplier_id', ids);

  const bySupplier = new Map<string, any>();
  for (const a of assessments ?? []) bySupplier.set(a.supplier_id, a);

  return supplierRows.map((s: any) => {
    const a = bySupplier.get(s.id);
    return {
      supplierId: s.id,
      name: s.name ?? null,
      tier: s.supplier_tier ?? null,
      annualSpend: s.annual_spend ?? null,
      assessmentId: a?.id ?? null,
      submitted: !!a?.submitted,
      isVerified: !!a?.is_verified,
      scoreTotal: a?.score_total ?? null,
      scoreLabour: a?.score_labour ?? null,
      scoreEthics: a?.score_ethics ?? null,
      scoreEnvironment: a?.score_environment ?? null,
      scoreRating: a?.score_rating ?? null,
      answers: (a?.answers as Record<string, string> | null) ?? null,
    };
  });
}

export async function getSupplierEsgCoverage(
  supabase: SupabaseClient,
  organizationId: string,
  opts?: { target?: number; requireAnyAffirmed?: string[]; coverageLabel?: string },
): Promise<SupplierEsgCoverage> {
  return summariseSupplierEsg(await fetchSupplierEsgRows(supabase, organizationId), opts);
}

export async function getSupplierClimateCoverage(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<SupplierClimateCoverage> {
  return summariseSupplierClimate(await fetchSupplierEsgRows(supabase, organizationId));
}
