import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BCORP_2026_FRAMEWORK_CODE,
  computeReadiness,
  isRecertPrepActive,
  normaliseBand,
  type CertMetaInput,
  type CertificationReadiness,
  type RequirementInput,
} from './scoring';

export type {
  CertificationReadiness,
  RequirementStatus,
  RequirementStatusValue,
  TopicSummary,
  YearBand,
} from './scoring';
export { deriveYearBand, BCORP_2026_FRAMEWORK_CODE } from './scoring';

interface RequirementRow {
  id: string;
  requirement_code: string;
  requirement_name: string;
  description: string | null;
  section: string | null;
  topic_area: string | null;
  order_index: number | null;
  applicable_from_year: number | null;
}

interface EvidenceRow {
  requirement_id: string;
  verification_status: string | null;
}

/** Resolve the active B Corp 2026 framework id. */
export async function getBcorpFrameworkId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from('certification_frameworks')
    .select('id')
    .eq('framework_code', BCORP_2026_FRAMEWORK_CODE)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Load all inputs from Supabase and run the pure scoring engine.
 */
export async function calculateCertificationReadiness(
  supabase: SupabaseClient,
  organizationId: string,
  certificationId?: string | null,
): Promise<CertificationReadiness> {
  const frameworkId = await getBcorpFrameworkId(supabase);
  if (!frameworkId) return computeReadiness([], {}, null);
  const withFramework = (r: CertificationReadiness): CertificationReadiness => ({
    ...r,
    frameworkId,
  });

  let certQuery = supabase
    .from('organization_certifications')
    .select(
      'id, certification_type, ecgt_applicable, certification_start_date, status',
    )
    .eq('organization_id', organizationId)
    .eq('framework_id', frameworkId);
  certQuery = certificationId
    ? certQuery.eq('id', certificationId)
    : certQuery.order('created_at', { ascending: false });
  const { data: certRows } = await certQuery.limit(1);
  const certRow = certRows?.[0] ?? null;

  const cert: CertMetaInput | null = certRow
    ? {
        id: certRow.id,
        certificationType:
          (certRow.certification_type as
            | 'new'
            | 'recertification'
            | null) ?? null,
        ecgtApplicable: !!certRow.ecgt_applicable,
        certificationStartDate: certRow.certification_start_date ?? null,
      }
    : null;

  const { data: reqData } = await supabase
    .from('certification_framework_requirements')
    .select(
      'id, requirement_code, requirement_name, description, section, topic_area, order_index, applicable_from_year',
    )
    .eq('framework_id', frameworkId)
    .order('order_index', { ascending: true });

  const requirementRows = (reqData ?? []) as RequirementRow[];
  if (requirementRows.length === 0)
    return withFramework(computeReadiness([], {}, cert));

  const requirements: RequirementInput[] = requirementRows.map((r) => ({
    id: r.id,
    code: r.requirement_code,
    name: r.requirement_name,
    description: r.description,
    section: r.section,
    topicArea: r.topic_area ?? r.section ?? 'Other',
    orderIndex: r.order_index ?? 0,
    applicableFromYear: normaliseBand(r.applicable_from_year),
  }));

  const reqIds = requirements.map((r) => r.id);
  const { data: evidenceData } = await supabase
    .from('certification_evidence_links')
    .select('requirement_id, verification_status')
    .eq('organization_id', organizationId)
    .in('requirement_id', reqIds);

  const evidenceByReq: Record<string, Array<string | null>> = {};
  for (const row of (evidenceData ?? []) as EvidenceRow[]) {
    (evidenceByReq[row.requirement_id] ??= []).push(row.verification_status);
  }

  const result = withFramework(
    computeReadiness(requirements, evidenceByReq, cert),
  );

  // Stale evidence (Phase 4): map stale links back to requirement codes.
  const { data: staleRows } = await supabase
    .from('certification_evidence_links')
    .select('requirement_id')
    .eq('organization_id', organizationId)
    .eq('staleness_status', 'stale')
    .in('requirement_id', reqIds);
  const staleReqIds = new Set(
    ((staleRows ?? []) as Array<{ requirement_id: string }>).map(
      (r) => r.requirement_id,
    ),
  );
  result.staleRequirementCodes = result.requirementStatuses
    .filter((rs) => staleReqIds.has(rs.requirementId))
    .map((rs) => rs.code);

  result.recertPrepActive = isRecertPrepActive(
    result.certificationStartDate,
  );

  return result;
}

/**
 * Upsert today's readiness snapshot into certification_score_history
 * (one row per organisation + framework + day). Best-effort.
 */
export async function persistScoreHistory(
  supabase: SupabaseClient,
  organizationId: string,
  readiness: CertificationReadiness,
): Promise<void> {
  const frameworkId = await getBcorpFrameworkId(supabase);
  if (!frameworkId) return;

  const evaluated = readiness.requirementStatuses.filter(
    (rs) => rs.status !== 'future',
  );
  const met = evaluated.filter((rs) => rs.status === 'passed').length;
  const partial = evaluated.filter((rs) => rs.status === 'in_progress').length;
  const notMet = evaluated.filter((rs) => rs.status === 'not_started').length;
  const year0 = readiness.requirementStatuses.filter(
    (rs) => rs.applicableFromYear === 0,
  );
  const year0Met = year0.filter((rs) => rs.status === 'passed').length;
  const overallScore = readiness.isReadyToSubmit
    ? 100
    : year0.length > 0
      ? Math.round((year0Met / year0.length) * 100)
      : 0;

  const today = new Date().toISOString().slice(0, 10);

  await supabase.from('certification_score_history').upsert(
    {
      organization_id: organizationId,
      framework_id: frameworkId,
      score_date: today,
      overall_score: overallScore,
      category_scores: { topicSummaries: readiness.topicSummaries },
      requirements_met: met,
      requirements_partial: partial,
      requirements_not_met: notMet,
      total_requirements: evaluated.length,
    },
    { onConflict: 'organization_id,framework_id,score_date' },
  );
}
