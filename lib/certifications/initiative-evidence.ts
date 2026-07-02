// Pure completeness rules for the climate action-plan B Corp requirements.
// Kept free of Supabase so the decision logic is directly testable; the
// queries live in platform-data.ts.
//
// IT5-Y3-002 (Emissions Reduction Plan, Year 3): "Implement and track
// progress against a time-bound emissions reduction plan." Platform evidence
// is a reduction initiative that is approved (active/completed), time-bound
// (start and end dates), owned (a named person), and tracked (progress
// updated, or freshly approved, within the last 90 days).
//
// IT5-Y5-001 (Net Zero Pathway, Year 5): conservative — platform data can at
// most show a net-zero target plus a qualifying initiative; validation
// documents usually still need manual upload.

export const PROGRESS_FRESHNESS_DAYS = 90;

export interface InitiativeEvidenceRow {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  approved_at: string | null;
  percent_complete: number | null;
  progress_updated_at: string | null;
  expected_annual_reduction_value: number | null;
  expected_annual_reduction_unit: string | null;
}

export interface TargetEvidenceRow {
  id: string;
  metric_key: string;
  target_value: number | null;
  target_date: string | null;
  scope: string | null;
  status: string | null;
  methodology?: string | null;
  notes?: string | null;
}

export type Completeness = 'complete' | 'partial' | 'missing';

export interface PlanAssessment {
  completeness: Completeness;
  note: string;
  /** Initiatives that fully qualify as reduction-plan evidence */
  qualifying: InitiativeEvidenceRow[];
}

/** Shared emissions-metric test (the same rule IT5-Y0-002 has always used). */
export function isEmissionsTarget(t: { metric_key: string; scope?: string | null }): boolean {
  return /co2|carbon|emission|ghg|scope/i.test(`${t.metric_key} ${t.scope ?? ''}`);
}

/** Whether a target declares its method (e.g. SBTi), used to strengthen IT5-Y0-002. */
export function hasDeclaredMethodology(t: TargetEvidenceRow): boolean {
  const text = `${t.methodology ?? ''} ${t.notes ?? ''}`.trim();
  return text.length > 0;
}

function isFresh(initiative: InitiativeEvidenceRow, now: number): boolean {
  const cutoff = now - PROGRESS_FRESHNESS_DAYS * 86_400_000;
  const progressAt = initiative.progress_updated_at ? Date.parse(initiative.progress_updated_at) : null;
  const approvedAt = initiative.approved_at ? Date.parse(initiative.approved_at) : null;
  return (progressAt !== null && progressAt >= cutoff) || (approvedAt !== null && approvedAt >= cutoff);
}

function hasOwner(initiative: InitiativeEvidenceRow): boolean {
  return Boolean(initiative.owner_user_id || (initiative.owner_name || '').trim());
}

function isTimeBound(initiative: InitiativeEvidenceRow): boolean {
  return Boolean(initiative.start_date && initiative.end_date);
}

function isApprovedStatus(status: string): boolean {
  return status === 'active' || status === 'completed';
}

/**
 * IT5-Y3-002: assess emissions-linked initiatives as reduction-plan evidence.
 * `initiatives` must already be filtered to those linked to an emissions
 * target (the join happens in platform-data.ts).
 */
export function assessReductionPlan(
  initiatives: InitiativeEvidenceRow[],
  now: number = Date.now(),
): PlanAssessment {
  if (initiatives.length === 0) {
    return {
      completeness: 'missing',
      note: 'No reduction actions are linked to your emissions targets yet. Create an action plan on the Targets page.',
      qualifying: [],
    };
  }

  const approved = initiatives.filter((i) => isApprovedStatus(i.status));
  const qualifying = approved.filter((i) => isTimeBound(i) && hasOwner(i) && isFresh(i, now));

  if (qualifying.length > 0) {
    return {
      completeness: 'complete',
      note: `${qualifying.length} approved reduction action${qualifying.length === 1 ? '' : 's'} with an owner, a timeline and tracked progress.`,
      qualifying,
    };
  }

  // Name the most actionable gap, in priority order.
  if (approved.length === 0) {
    const pending = initiatives.filter((i) => i.status === 'pending_approval').length;
    return {
      completeness: 'partial',
      note:
        pending > 0
          ? `You have ${initiatives.length} planned action${initiatives.length === 1 ? '' : 's'} but none has been approved yet. An organisation owner or admin can approve from the Targets page.`
          : `You have ${initiatives.length} draft action${initiatives.length === 1 ? '' : 's'}. Send one for approval to evidence your reduction plan.`,
      qualifying: [],
    };
  }

  const missingTimebound = approved.filter((i) => !isTimeBound(i));
  if (missingTimebound.length === approved.length) {
    const names = missingTimebound
      .slice(0, 3)
      .map((i) => `"${i.title}"`)
      .join(', ');
    const more = missingTimebound.length > 3 ? ` and ${missingTimebound.length - 3} more` : '';
    return {
      completeness: 'partial',
      note: `${missingTimebound.length === 1 ? 'Action' : 'Actions'} ${names}${more} need a start date and a finish date to count as a time-bound plan. Open each action on the Targets page to add the dates.`,
      qualifying: [],
    };
  }

  const missingOwner = approved.filter((i) => isTimeBound(i) && !hasOwner(i));
  if (missingOwner.length > 0 && approved.every((i) => !isTimeBound(i) || !hasOwner(i))) {
    const names = missingOwner
      .slice(0, 3)
      .map((i) => `"${i.title}"`)
      .join(', ');
    const more = missingOwner.length > 3 ? ` and ${missingOwner.length - 3} more` : '';
    return {
      completeness: 'partial',
      note: `${missingOwner.length === 1 ? 'Action' : 'Actions'} ${names}${more} need a named owner. Open each action on the Targets page to assign one.`,
      qualifying: [],
    };
  }

  return {
    completeness: 'partial',
    note: `Progress has not been updated in over ${PROGRESS_FRESHNESS_DAYS} days. Open an active action on the Targets page and update its progress to show the plan is being tracked.`,
    qualifying: [],
  };
}

/**
 * IT5-Y5-001: net zero pathway. Conservative: platform data can show a
 * net-zero target (an emissions target heading to zero) plus a qualifying
 * active initiative; the validated pathway documents are usually manual.
 */
export function assessNetZeroPathway(
  targets: TargetEvidenceRow[],
  initiatives: InitiativeEvidenceRow[],
  now: number = Date.now(),
): PlanAssessment {
  const netZeroTargets = targets.filter(
    (t) => isEmissionsTarget(t) && Number(t.target_value) === 0 && Boolean(t.target_date),
  );

  if (netZeroTargets.length === 0) {
    return {
      completeness: 'missing',
      note: 'No net-zero target found. Set an emissions target of zero with a date on the Targets page. A validated pathway document is usually also needed.',
      qualifying: [],
    };
  }

  const plan = assessReductionPlan(initiatives, now);
  if (plan.completeness === 'complete') {
    return {
      completeness: 'complete',
      note: 'A net-zero target with an approved, tracked action plan. A validated pathway document (for example SBTi validation) is usually still needed as manual evidence.',
      qualifying: plan.qualifying,
    };
  }

  return {
    completeness: 'partial',
    note: `You have a net-zero target but no approved, tracked action plan behind it yet. ${plan.note}`,
    qualifying: [],
  };
}
