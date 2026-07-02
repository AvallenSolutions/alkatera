// Pure scoring logic for B Corp 2026 certification readiness.
// No server-only / Supabase imports here so this is unit-testable and
// safe to import from client components for shared types.

export const BCORP_2026_FRAMEWORK_CODE = 'bcorp_2026';

export type RequirementStatusValue =
  | 'passed'
  | 'in_progress'
  | 'not_started'
  | 'future';

export type YearBand = 0 | 3 | 5;

export interface RequirementStatus {
  requirementId: string;
  code: string;
  name: string;
  description: string | null;
  topicArea: string;
  section: string | null;
  orderIndex: number;
  applicableFromYear: YearBand;
  status: RequirementStatusValue;
  evidenceCount: number;
  verifiedCount: number;
  /** False when the requirement's size threshold excludes this org. */
  applicable: boolean;
}

// B Lab v2.1 size bands (nw..xxl), plus legacy small/medium/large for back-compat.
export type OrgSize =
  | 'nw'
  | 'mi'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'xxl'
  | 'small'
  | 'medium'
  | 'large'
  | null
  | undefined;

const V21_BANDS = new Set(['nw', 'mi', 'sm', 'md', 'lg', 'xl', 'xxl']);
const SIZE_RANK: Record<string, number> = { small: 0, medium: 1, large: 2 };
const THRESHOLD_MIN: Record<string, number> = { all: 0, medium_large: 1, large_only: 2 };

/**
 * Whether a requirement applies given its size threshold and the org's size.
 * Unknown org size never hides a requirement (fail safe towards showing it).
 *
 * Two encodings are supported: the v2.1 band-list (comma-separated band codes,
 * e.g. "lg,xl,xxl" — applies if the org's band is in the list) and the legacy
 * small/medium/large rank threshold.
 */
export function requirementApplies(
  sizeThreshold: string | null | undefined,
  orgSize: OrgSize,
): boolean {
  if (!sizeThreshold || sizeThreshold === 'all') return true;
  if (orgSize == null) return true;
  const parts = sizeThreshold
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > 0 && parts.every((p) => V21_BANDS.has(p))) {
    return parts.includes(orgSize);
  }
  return (SIZE_RANK[orgSize] ?? 0) >= (THRESHOLD_MIN[sizeThreshold] ?? 0);
}

export interface TopicYearBand {
  met: number;
  total: number;
  applicable: boolean;
}

export interface TopicSummary {
  topicArea: string;
  isFoundation: boolean;
  byYear: Record<YearBand, TopicYearBand>;
}

export interface PlatformHealthEntry {
  module: string;
  moduleLabel: string;
  moduleLink: string;
  status: 'complete' | 'partial' | 'missing';
  requirementCodes: string[];
  note: string | null;
  /** Per-record deep links shown as chips under the note (e.g. individual actions). */
  actionLinks?: { label: string; url: string }[];
}

export interface CertificationReadiness {
  hasCertification: boolean;
  frameworkId: string | null;
  platformHealth?: PlatformHealthEntry[];
  certificationId: string | null;
  certificationType: 'new' | 'recertification' | null;
  ecgtApplicable: boolean;
  certificationStartDate: string | null;
  currentYearBand: YearBand;
  foundationComplete: boolean;
  riskToolComplete: boolean;
  isReadyToSubmit: boolean;
  /** % of Year-0 requirements passed — the "can we submit?" number. */
  year0ReadinessPct: number;
  /** % of every requirement (Year 0/3/5) passed — the whole-programme view. */
  programmeReadinessPct: number;
  blockingRequirements: RequirementStatus[];
  requirementStatuses: RequirementStatus[];
  topicSummaries: TopicSummary[];
  staleRequirementCodes?: string[];
  recertPrepActive?: boolean;
}

/** passed / total as a 0-100 integer; 0 when there are no requirements. */
function pct(passed: number, total: number): number {
  return total > 0 ? Math.round((passed / total) * 100) : 0;
}

/**
 * Recertification preparation activates 4 years after the cycle start
 * (one year before the 5-year cycle ends).
 */
export function isRecertPrepActive(
  certificationStartDate: string | null | undefined,
  today: Date = new Date(),
): boolean {
  if (!certificationStartDate) return false;
  const start = new Date(certificationStartDate);
  if (Number.isNaN(start.getTime())) return false;
  const fourYears = new Date(start);
  fourYears.setFullYear(fourYears.getFullYear() + 4);
  return today.getTime() >= fourYears.getTime();
}

export const IMPACT_TOPIC_ORDER = [
  'Purpose & Stakeholder Governance',
  'Fair Work',
  'Justice, Equity, Diversity & Inclusion',
  'Human Rights',
  'Climate Action',
  'Environmental Stewardship & Circularity',
  'Government Affairs & Collective Action',
];

export const YEAR_BANDS: YearBand[] = [0, 3, 5];

export const RISK_TOOL_REQUIREMENT_CODE = 'FR-R-000';

/**
 * Derive the certification year band (0, 3 or 5) from the start date.
 * Null/future start dates and anything before the first anniversary are Year 0.
 */
export function deriveYearBand(
  certificationStartDate: string | null | undefined,
  today: Date = new Date(),
): YearBand {
  if (!certificationStartDate) return 0;
  const start = new Date(certificationStartDate);
  if (Number.isNaN(start.getTime()) || start.getTime() > today.getTime()) {
    return 0;
  }
  let years = today.getFullYear() - start.getFullYear();
  const monthDiff = today.getMonth() - start.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < start.getDate())) {
    years -= 1;
  }
  if (years >= 5) return 5;
  if (years >= 3) return 3;
  return 0;
}

export function normaliseBand(value: number | null | undefined): YearBand {
  if (value === 3) return 3;
  if (value === 5) return 5;
  return 0;
}

/**
 * Status for a single requirement. Pending/needs_review never satisfies;
 * not-yet-due Year 3/5 requirements are `future`, not failures.
 */
export function evaluateStatus(
  verificationStatuses: Array<string | null>,
  applicableFromYear: YearBand,
  currentYearBand: YearBand,
): RequirementStatusValue {
  if (applicableFromYear > currentYearBand) return 'future';
  if (verificationStatuses.some((s) => s === 'verified')) return 'passed';
  if (
    verificationStatuses.some(
      (s) => s === 'pending' || s === 'needs_review' || s == null,
    )
  ) {
    return 'in_progress';
  }
  return 'not_started';
}

export interface RequirementInput {
  id: string;
  code: string;
  name: string;
  description: string | null;
  section: string | null;
  topicArea: string;
  orderIndex: number;
  applicableFromYear: YearBand;
  sizeThreshold?: string | null;
}

export interface CertMetaInput {
  id: string | null;
  certificationType: 'new' | 'recertification' | null;
  ecgtApplicable: boolean;
  certificationStartDate: string | null;
}

/**
 * Pure readiness computation. Given the requirement set, the verification
 * statuses of each requirement's evidence, and the cert metadata, produce
 * the full readiness object.
 */
export function computeReadiness(
  requirements: RequirementInput[],
  evidenceByReq: Record<string, Array<string | null>>,
  cert: CertMetaInput | null,
  today: Date = new Date(),
  orgSize: OrgSize = null,
): CertificationReadiness {
  const base: CertificationReadiness = {
    hasCertification: !!cert,
    frameworkId: null,
    certificationId: cert?.id ?? null,
    certificationType: cert?.certificationType ?? null,
    ecgtApplicable: !!cert?.ecgtApplicable,
    certificationStartDate: cert?.certificationStartDate ?? null,
    currentYearBand: deriveYearBand(cert?.certificationStartDate ?? null, today),
    foundationComplete: false,
    riskToolComplete: false,
    isReadyToSubmit: false,
    year0ReadinessPct: 0,
    programmeReadinessPct: 0,
    blockingRequirements: [],
    requirementStatuses: [],
    topicSummaries: [],
  };

  if (requirements.length === 0) return base;

  const currentYearBand = base.currentYearBand;

  const requirementStatuses: RequirementStatus[] = requirements.map((r) => {
    const links = evidenceByReq[r.id] ?? [];
    return {
      requirementId: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      topicArea: r.topicArea,
      section: r.section,
      orderIndex: r.orderIndex,
      applicableFromYear: r.applicableFromYear,
      status: evaluateStatus(links, r.applicableFromYear, currentYearBand),
      evidenceCount: links.length,
      verifiedCount: links.filter((s) => s === 'verified').length,
      applicable: requirementApplies(r.sizeThreshold, orgSize),
    };
  });

  // Everything below counts only requirements that actually apply to this org,
  // so size-excluded requirements never penalise readiness or block submission.
  const applicableStatuses = requirementStatuses.filter((rs) => rs.applicable);

  const foundationReqs = applicableStatuses.filter(
    (rs) => rs.topicArea === 'foundation',
  );
  const foundationComplete =
    foundationReqs.length > 0 &&
    foundationReqs.every((rs) => rs.status === 'passed');

  const riskTool = requirementStatuses.find(
    (rs) => rs.code === RISK_TOOL_REQUIREMENT_CODE,
  );
  const riskToolComplete = riskTool?.status === 'passed';

  const blockingRequirements = applicableStatuses.filter(
    (rs) => rs.applicableFromYear === 0 && rs.status !== 'passed',
  );
  const isReadyToSubmit = blockingRequirements.length === 0;

  // Two honest readiness figures: Year-0 (submit-readiness) and the whole
  // Year 0/3/5 programme. Only `passed` (human-verified) counts; only
  // applicable requirements are in the denominator.
  const year0Reqs = applicableStatuses.filter((rs) => rs.applicableFromYear === 0);
  const year0ReadinessPct = isReadyToSubmit
    ? 100
    : pct(year0Reqs.filter((rs) => rs.status === 'passed').length, year0Reqs.length);
  const programmeReadinessPct = pct(
    applicableStatuses.filter((rs) => rs.status === 'passed').length,
    applicableStatuses.length,
  );

  const topicAreas = Array.from(
    new Set(requirementStatuses.map((rs) => rs.topicArea)),
  );
  const orderedTopics = [
    ...(topicAreas.includes('foundation') ? ['foundation'] : []),
    ...IMPACT_TOPIC_ORDER.filter((t) => topicAreas.includes(t)),
    ...topicAreas.filter(
      (t) => t !== 'foundation' && !IMPACT_TOPIC_ORDER.includes(t),
    ),
  ];

  const topicSummaries: TopicSummary[] = orderedTopics.map((topicArea) => {
    const inTopic = applicableStatuses.filter(
      (rs) => rs.topicArea === topicArea,
    );
    const byYear = {} as Record<YearBand, TopicYearBand>;
    for (const band of YEAR_BANDS) {
      const bandReqs = inTopic.filter((rs) => rs.applicableFromYear === band);
      byYear[band] = {
        met: bandReqs.filter((rs) => rs.status === 'passed').length,
        total: bandReqs.length,
        applicable: band <= currentYearBand,
      };
    }
    return { topicArea, isFoundation: topicArea === 'foundation', byYear };
  });

  return {
    ...base,
    foundationComplete,
    riskToolComplete,
    isReadyToSubmit,
    year0ReadinessPct,
    programmeReadinessPct,
    blockingRequirements,
    requirementStatuses,
    topicSummaries,
  };
}
