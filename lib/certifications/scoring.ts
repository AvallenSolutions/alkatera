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
  blockingRequirements: RequirementStatus[];
  requirementStatuses: RequirementStatus[];
  topicSummaries: TopicSummary[];
  staleRequirementCodes?: string[];
  recertPrepActive?: boolean;
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
    };
  });

  const foundationReqs = requirementStatuses.filter(
    (rs) => rs.topicArea === 'foundation',
  );
  const foundationComplete =
    foundationReqs.length > 0 &&
    foundationReqs.every((rs) => rs.status === 'passed');

  const riskTool = requirementStatuses.find(
    (rs) => rs.code === RISK_TOOL_REQUIREMENT_CODE,
  );
  const riskToolComplete = riskTool?.status === 'passed';

  const blockingRequirements = requirementStatuses.filter(
    (rs) => rs.applicableFromYear === 0 && rs.status !== 'passed',
  );
  const isReadyToSubmit = blockingRequirements.length === 0;

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
    const inTopic = requirementStatuses.filter(
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
    blockingRequirements,
    requirementStatuses,
    topicSummaries,
  };
}
