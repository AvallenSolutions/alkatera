/**
 * Pulse -- CSRD/ESRS data-quality gap evaluator.
 *
 * Plain-English: tell the user what's missing or stale that would block
 * a CSRD/ESRS-aligned report. We pick a curated set of high-impact ESRS
 * disclosure points and run lightweight rules against the org's data.
 *
 * Scope (V1): 10 gap rules covering the most common ESRS topics for a
 * drinks-industry SME. Each rule produces a GapResult with severity,
 * evidence and a deep-link to "fix it now".
 *
 * Severity:
 *   - 'critical' : disclosure is required and there is no data at all.
 *   - 'warning'  : data exists but is stale, partial, or low quality.
 *   - 'ok'       : disclosure is covered.
 *
 * Each rule is intentionally a pure function so it can be unit-tested
 * without hitting Supabase. The runner orchestrates the queries and
 * threads the raw rows into each rule.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type GapSeverity = 'critical' | 'warning' | 'ok';

export interface GapRule {
  /** Stable id, used as React key + persisted "dismissed" flag in future. */
  id: string;
  /** ESRS standard reference, e.g. "ESRS E1-6". */
  esrs_ref: string;
  /** Human-readable title. */
  title: string;
  /** One-sentence "why this matters" copy. */
  why: string;
  /** UI category for grouping. */
  category: 'environmental' | 'social' | 'governance' | 'general';
}

export interface GapResult extends GapRule {
  severity: GapSeverity;
  /** One-line summary of the current state, e.g. "12 entries in last 12 months". */
  evidence: string;
  /** Deep-link to the page where the user can fix the gap. */
  fix_href: string;
  /** Optional CTA label override. Defaults to "Fix now". */
  fix_label?: string;
}

interface EvalContext {
  organizationId: string;
  /** Date 12 months before now, ISO date. */
  cutoffIso: string;
  /** Map keyed by activity_category. */
  activityCounts: Record<string, number>;
  /** Most recent activity_date in last 12 months for each category. */
  activityLast: Record<string, string | null>;
  hasWaterStressFacility: boolean;
  hasWaterStressRecycling: boolean;
  targetCount: number;
  hasNetZeroTarget: boolean;
  workforceRowCount: number;
  governancePolicyCount: number;
  materialityCompletedAt: string | null;
}

// ---------------------------------------------------------------------------
// Rule definitions (data-only; pure and unit-testable).
// ---------------------------------------------------------------------------

const RULES: Array<{
  rule: GapRule;
  evaluate: (ctx: EvalContext) => Omit<GapResult, keyof GapRule>;
}> = [
  // ESRS E1 -- Climate change ------------------------------------------------
  {
    rule: {
      id: 'e1-scope1-fuel',
      esrs_ref: 'ESRS E1-6',
      title: 'Scope 1 stationary combustion',
      why: 'Direct emissions from gas, fuel and on-site combustion are mandatory under E1-6.',
      category: 'environmental',
    },
    evaluate: ctx => {
      const fuel = (ctx.activityCounts['utility_gas'] ?? 0) + (ctx.activityCounts['utility_fuel'] ?? 0);
      if (fuel === 0) {
        return {
          severity: 'critical',
          evidence: 'No gas or fuel entries in the last 12 months.',
          fix_href: '/sustainability-data/scope-1-2',
        };
      }
      return {
        severity: 'ok',
        evidence: `${fuel} fuel/gas entr${fuel === 1 ? 'y' : 'ies'} in last 12 months.`,
        fix_href: '/sustainability-data/scope-1-2',
      };
    },
  },
  {
    rule: {
      id: 'e1-scope2-electricity',
      esrs_ref: 'ESRS E1-6',
      title: 'Scope 2 purchased electricity',
      why: 'Indirect emissions from purchased electricity are mandatory under E1-6.',
      category: 'environmental',
    },
    evaluate: ctx => {
      const elec = ctx.activityCounts['utility_electricity'] ?? 0;
      if (elec === 0) {
        return {
          severity: 'critical',
          evidence: 'No electricity entries in the last 12 months.',
          fix_href: '/sustainability-data/scope-1-2',
        };
      }
      return {
        severity: 'ok',
        evidence: `${elec} electricity entr${elec === 1 ? 'y' : 'ies'} in last 12 months.`,
        fix_href: '/sustainability-data/scope-1-2',
      };
    },
  },
  {
    rule: {
      id: 'e1-target',
      esrs_ref: 'ESRS E1-4',
      title: 'GHG reduction target',
      why: 'A quantified, time-bound emissions target is required under E1-4.',
      category: 'environmental',
    },
    evaluate: ctx => {
      if (ctx.targetCount === 0) {
        return {
          severity: 'critical',
          evidence: 'No sustainability targets set.',
          fix_href: '/pulse/targets',
          fix_label: 'Set a target',
        };
      }
      if (!ctx.hasNetZeroTarget) {
        return {
          severity: 'warning',
          evidence: `${ctx.targetCount} target${ctx.targetCount === 1 ? '' : 's'} set, none aligned to net-zero by 2050.`,
          fix_href: '/pulse/targets',
        };
      }
      return {
        severity: 'ok',
        evidence: `${ctx.targetCount} target${ctx.targetCount === 1 ? '' : 's'} including a net-zero commitment.`,
        fix_href: '/pulse/targets',
      };
    },
  },

  // ESRS E3 -- Water --------------------------------------------------------
  {
    rule: {
      id: 'e3-water-intake',
      esrs_ref: 'ESRS E3-4',
      title: 'Water intake disclosed',
      why: 'Total water withdrawal must be reported under E3-4.',
      category: 'environmental',
    },
    evaluate: ctx => {
      const intake = ctx.activityCounts['water_intake'] ?? 0;
      if (intake === 0) {
        return {
          severity: 'critical',
          evidence: 'No water intake entries in the last 12 months.',
          fix_href: '/sustainability-data/water',
        };
      }
      return {
        severity: 'ok',
        evidence: `${intake} water intake entr${intake === 1 ? 'y' : 'ies'} logged.`,
        fix_href: '/sustainability-data/water',
      };
    },
  },
  {
    rule: {
      id: 'e3-water-stress',
      esrs_ref: 'ESRS E3-4',
      title: 'Water-stress recycling rate',
      why: 'Operations in water-stressed areas must report a recycling rate.',
      category: 'environmental',
    },
    evaluate: ctx => {
      if (!ctx.hasWaterStressFacility) {
        return {
          severity: 'ok',
          evidence: 'No facilities flagged as water-stressed.',
          fix_href: '/sustainability-data/water',
        };
      }
      if (!ctx.hasWaterStressRecycling) {
        return {
          severity: 'warning',
          evidence: 'Water-stressed facility detected with no recycling rate captured.',
          fix_href: '/sustainability-data/water',
        };
      }
      return {
        severity: 'ok',
        evidence: 'Water-stressed facility with recycling rate captured.',
        fix_href: '/sustainability-data/water',
      };
    },
  },

  // ESRS E5 -- Resource use -------------------------------------------------
  {
    rule: {
      id: 'e5-waste',
      esrs_ref: 'ESRS E5-5',
      title: 'Waste flows by treatment',
      why: 'Total waste split by treatment route is required under E5-5.',
      category: 'environmental',
    },
    evaluate: ctx => {
      const waste =
        (ctx.activityCounts['waste_general'] ?? 0) +
        (ctx.activityCounts['waste_hazardous'] ?? 0) +
        (ctx.activityCounts['waste_recycling'] ?? 0);
      if (waste === 0) {
        return {
          severity: 'critical',
          evidence: 'No waste entries in the last 12 months.',
          fix_href: '/sustainability-data/waste',
        };
      }
      const recyclingShare =
        (ctx.activityCounts['waste_recycling'] ?? 0) / Math.max(waste, 1);
      if (recyclingShare === 0) {
        return {
          severity: 'warning',
          evidence: `${waste} waste entr${waste === 1 ? 'y' : 'ies'} logged, but no recycling/recovery flow.`,
          fix_href: '/sustainability-data/waste',
        };
      }
      return {
        severity: 'ok',
        evidence: `${waste} waste entr${waste === 1 ? 'y' : 'ies'}, ${(recyclingShare * 100).toFixed(0)}% routed to recycling.`,
        fix_href: '/sustainability-data/waste',
      };
    },
  },

  // ESRS S1 -- Own workforce -------------------------------------------------
  {
    rule: {
      id: 's1-headcount',
      esrs_ref: 'ESRS S1-6',
      title: 'Workforce headcount & demographics',
      why: 'Total headcount split by gender and contract type is mandatory under S1-6.',
      category: 'social',
    },
    evaluate: ctx => {
      if (ctx.workforceRowCount === 0) {
        return {
          severity: 'critical',
          evidence: 'No workforce demographics captured.',
          fix_href: '/people-culture',
          fix_label: 'Add headcount',
        };
      }
      return {
        severity: 'ok',
        evidence: `${ctx.workforceRowCount} workforce demographic row${ctx.workforceRowCount === 1 ? '' : 's'} captured.`,
        fix_href: '/people-culture',
      };
    },
  },

  // ESRS G1 -- Business conduct ---------------------------------------------
  {
    rule: {
      id: 'g1-policies',
      esrs_ref: 'ESRS G1-1',
      title: 'Business conduct policies',
      why: 'Anti-corruption, whistleblowing and supplier conduct policies are required under G1-1.',
      category: 'governance',
    },
    evaluate: ctx => {
      if (ctx.governancePolicyCount === 0) {
        return {
          severity: 'critical',
          evidence: 'No governance policies recorded.',
          fix_href: '/governance',
          fix_label: 'Add policies',
        };
      }
      if (ctx.governancePolicyCount < 3) {
        return {
          severity: 'warning',
          evidence: `Only ${ctx.governancePolicyCount} polic${ctx.governancePolicyCount === 1 ? 'y' : 'ies'} recorded; ESRS G1-1 typically expects 3+.`,
          fix_href: '/governance',
        };
      }
      return {
        severity: 'ok',
        evidence: `${ctx.governancePolicyCount} governance policies on file.`,
        fix_href: '/governance',
      };
    },
  },

  // ESRS 2 -- General disclosures -------------------------------------------
  {
    rule: {
      id: 'esrs2-materiality',
      esrs_ref: 'ESRS 2 IRO-1',
      title: 'Double-materiality assessment',
      why: 'Identifying material impacts, risks and opportunities is the foundation of CSRD reporting.',
      category: 'general',
    },
    evaluate: ctx => {
      if (!ctx.materialityCompletedAt) {
        return {
          severity: 'critical',
          evidence: 'No completed materiality assessment for the current year.',
          fix_href: '/materiality',
          fix_label: 'Run assessment',
        };
      }
      const ageDays = Math.floor(
        (Date.now() - new Date(ctx.materialityCompletedAt).getTime()) / 86_400_000,
      );
      if (ageDays > 365) {
        return {
          severity: 'warning',
          evidence: `Last assessment completed ${ageDays} days ago; CSRD expects an annual review.`,
          fix_href: '/materiality',
        };
      }
      return {
        severity: 'ok',
        evidence: `Last assessment completed ${ageDays} days ago.`,
        fix_href: '/materiality',
      };
    },
  },
];

export const ALL_GAP_RULE_IDS = RULES.map(r => r.rule.id);

// ---------------------------------------------------------------------------
// Public runner.
// ---------------------------------------------------------------------------

export async function evaluateCsrdGaps(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ results: GapResult[]; summary: { critical: number; warning: number; ok: number } }> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  // Activity counts by category.
  const { data: activities } = await supabase
    .from('facility_activity_entries')
    .select('activity_category, activity_date, water_stress_area_flag, water_recycling_rate_percent')
    .eq('organization_id', organizationId)
    .gte('activity_date', cutoffIso);

  const activityCounts: Record<string, number> = {};
  const activityLast: Record<string, string | null> = {};
  let hasWaterStressFacility = false;
  let hasWaterStressRecycling = false;
  for (const row of activities ?? []) {
    const cat = row.activity_category as string;
    activityCounts[cat] = (activityCounts[cat] ?? 0) + 1;
    if (!activityLast[cat] || (row.activity_date && row.activity_date > activityLast[cat]!)) {
      activityLast[cat] = row.activity_date;
    }
    if (row.water_stress_area_flag) {
      hasWaterStressFacility = true;
      if (row.water_recycling_rate_percent !== null && row.water_recycling_rate_percent !== undefined) {
        hasWaterStressRecycling = true;
      }
    }
  }

  // Targets.
  const { data: targets } = await supabase
    .from('sustainability_targets')
    .select('id, metric_key, target_date, target_value')
    .eq('organization_id', organizationId);
  const targetCount = targets?.length ?? 0;
  const hasNetZeroTarget = (targets ?? []).some(t => {
    const year = new Date(t.target_date as string).getFullYear();
    return (
      t.metric_key === 'total_co2e' &&
      year >= 2030 &&
      year <= 2050 &&
      Number(t.target_value) === 0
    );
  });

  // Workforce.
  const { count: workforceRowCount } = await supabase
    .from('people_workforce_demographics')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  // Governance.
  const { count: governancePolicyCount } = await supabase
    .from('governance_policies')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  // Materiality.
  const { data: materiality } = await supabase
    .from('materiality_assessments')
    .select('completed_at')
    .eq('organization_id', organizationId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const ctx: EvalContext = {
    organizationId,
    cutoffIso,
    activityCounts,
    activityLast,
    hasWaterStressFacility,
    hasWaterStressRecycling,
    targetCount,
    hasNetZeroTarget,
    workforceRowCount: workforceRowCount ?? 0,
    governancePolicyCount: governancePolicyCount ?? 0,
    materialityCompletedAt: (materiality?.completed_at as string | null) ?? null,
  };

  const results: GapResult[] = RULES.map(({ rule, evaluate }) => ({
    ...rule,
    ...evaluate(ctx),
  }));

  const summary = {
    critical: results.filter(r => r.severity === 'critical').length,
    warning: results.filter(r => r.severity === 'warning').length,
    ok: results.filter(r => r.severity === 'ok').length,
  };

  return { results, summary };
}

// Exported for unit testing.
export const __testing = { RULES };
