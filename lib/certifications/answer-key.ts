import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateCertificationReadiness } from './readiness';
import { queryBcorpAutoEvidence } from './bcorp-auto-evidence';
import { getRequirementGuidance } from './requirement-guidance';
import {
  BCORP_SECTIONS,
  bcorpSectionForRequirement,
} from './bcorp-structure';
import { synthesiseRequirementAnswer } from './answer-synthesiser';
import { matchRequirement } from './requirement-match';
import type { RequirementAnswer } from './answer-synthesiser';
import type { RequirementGuidance } from './requirement-guidance';
import type { RequirementStatus, RequirementStatusValue, YearBand } from './scoring';
import type { AnswerKeyData, AnswerKeyRow } from './answer-key-format';

export type { AnswerKeyData, AnswerKeyRow } from './answer-key-format';

const SECTION_ORDER = new Map(
  BCORP_SECTIONS.map((s, i) => [s.key, i]),
);

interface EvidenceLinkRow {
  requirement_id: string;
  source_module: string | null;
  evidence_description: string | null;
  verification_status: string | null;
  updated_at: string | null;
}

/** One evidence link rendered for the "Evidence on file" column. */
function describeEvidence(e: EvidenceLinkRow): string {
  const label =
    e.evidence_description?.trim() ||
    (e.source_module ? e.source_module.replace(/_/g, ' ') : 'Evidence');
  const status = e.verification_status || 'pending';
  return `${label} (${status})`;
}

/**
 * Build the B Corp answer key: one row per applicable requirement, each with a
 * paste-ready answer synthesised from the org's platform data and evidence.
 *
 * The "answer" prefers real values from the platform (emissions tonnes, wage
 * figures, target dates) and falls back to the descriptions of manually
 * uploaded evidence, so a user can work down the sheet while filling B Lab's
 * questionnaire.
 */
export async function buildAnswerKey(
  supabase: SupabaseClient,
  organizationId: string,
  certificationId?: string | null,
): Promise<AnswerKeyData> {
  const readiness = await calculateCertificationReadiness(
    supabase,
    organizationId,
    certificationId ?? null,
  );

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle();

  // Manual + linked evidence, grouped by requirement so we can list what is on
  // file and pull the most recent update date.
  const reqIds = readiness.requirementStatuses.map((r) => r.requirementId);
  const evidenceByReq = new Map<string, EvidenceLinkRow[]>();
  if (reqIds.length > 0) {
    const { data: links } = await supabase
      .from('certification_evidence_links')
      .select(
        'requirement_id, source_module, evidence_description, verification_status, updated_at',
      )
      .eq('organization_id', organizationId)
      .in('requirement_id', reqIds);
    for (const row of (links ?? []) as EvidenceLinkRow[]) {
      const list = evidenceByReq.get(row.requirement_id) ?? [];
      list.push(row);
      evidenceByReq.set(row.requirement_id, list);
    }
  }

  // Only requirements that actually apply to this org (size personalisation).
  const applicable = readiness.requirementStatuses.filter(
    (r) => r.applicable !== false,
  );

  const rows: AnswerKeyRow[] = [];
  for (const rs of applicable) {
    const section = bcorpSectionForRequirement(rs.topicArea, rs.code);
    const guidance = getRequirementGuidance(rs.code, rs.topicArea);
    const links = evidenceByReq.get(rs.requirementId) ?? [];

    // Real values from the platform where a mapping exists. Never throws — a
    // broken probe just yields no platform answer for that requirement.
    let platform = null as Awaited<ReturnType<typeof queryBcorpAutoEvidence>>;
    try {
      platform = await queryBcorpAutoEvidence(supabase, rs.code, organizationId);
    } catch {
      platform = null;
    }

    const synth = synthesiseRequirementAnswer({
      status: rs.status,
      platform,
      evidenceLinks: links.map((e) => ({
        description: e.evidence_description,
        status: e.verification_status,
        sourceModule: e.source_module,
      })),
      guidance,
    });

    const lastUpdated = links
      .map((e) => e.updated_at)
      .filter((d): d is string => !!d)
      .sort()
      .pop();

    rows.push({
      section: `${section.label} (${section.abbrev})`,
      code: rs.code,
      requirement: rs.name,
      applicableFromYear: rs.applicableFromYear,
      status: rs.status,
      // Real values first; then any actionable gap as a trailing note, so even
      // rows with partial or no data stay useful instead of blank.
      answer: [synth.answer, synth.gap ? `⚠ ${synth.gap}` : '']
        .filter(Boolean)
        .join('\n\n'),
      dataSource: synth.dataSource,
      evidence: links.map(describeEvidence).join('\n'),
      dataQuality: synth.dataQuality,
      lastUpdated: lastUpdated ? lastUpdated.slice(0, 10) : '',
      guidance: guidance.summary,
    });
  }

  // Order to mirror the B Corp assessment: by section, then requirement order.
  rows.sort((a, b) => {
    const sa =
      SECTION_ORDER.get(bcorpSectionForRequirement(null, a.code).key) ?? 99;
    const sb =
      SECTION_ORDER.get(bcorpSectionForRequirement(null, b.code).key) ?? 99;
    if (sa !== sb) return sa - sb;
    return a.code.localeCompare(b.code);
  });

  const generatedAt = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return {
    organisationName: org?.name ?? 'Your organisation',
    certificationType: readiness.certificationType,
    generatedAt,
    year0ReadinessPct: readiness.year0ReadinessPct,
    programmeReadinessPct: readiness.programmeReadinessPct,
    rows,
  };
}

export interface RequirementAnswerDetail {
  code: string;
  name: string;
  /** B Corp section label + abbrev, e.g. "Climate Action (CA)". */
  section: string;
  topicArea: string;
  status: RequirementStatusValue;
  applicableFromYear: YearBand;
  guidance: RequirementGuidance;
  synthesis: RequirementAnswer;
  /** Human list of evidence on file for this requirement. */
  evidenceOnFile: string[];
  /** Other requirement codes that also matched a fuzzy query, if any. */
  otherMatches: string[];
}

/**
 * Resolve one B Corp requirement for a fuzzy query (exact code, else a name /
 * topic substring) and synthesise its paste-ready answer from platform data +
 * evidence. Used by Rosa's per-requirement drafting tool so she can ground an
 * explanation or draft in the org's real data. Returns null when nothing
 * matches or no certification exists.
 */
export async function buildRequirementAnswerForCode(
  supabase: SupabaseClient,
  organizationId: string,
  query: string,
  certificationId?: string | null,
): Promise<RequirementAnswerDetail | null> {
  const readiness = await calculateCertificationReadiness(
    supabase,
    organizationId,
    certificationId ?? null,
  );
  if (!readiness.hasCertification || readiness.requirementStatuses.length === 0) {
    return null;
  }

  const match = matchRequirement(readiness.requirementStatuses, query);
  if (!match) return null;
  const rs: RequirementStatus = match.best;

  const { data: linkData } = await supabase
    .from('certification_evidence_links')
    .select(
      'requirement_id, source_module, evidence_description, verification_status, updated_at',
    )
    .eq('organization_id', organizationId)
    .eq('requirement_id', rs.requirementId);
  const links = (linkData ?? []) as EvidenceLinkRow[];

  let platform = null as Awaited<ReturnType<typeof queryBcorpAutoEvidence>>;
  try {
    platform = await queryBcorpAutoEvidence(supabase, rs.code, organizationId);
  } catch {
    platform = null;
  }

  const guidance = getRequirementGuidance(rs.code, rs.topicArea);
  const synthesis = synthesiseRequirementAnswer({
    status: rs.status,
    platform,
    evidenceLinks: links.map((e) => ({
      description: e.evidence_description,
      status: e.verification_status,
      sourceModule: e.source_module,
    })),
    guidance,
  });

  const section = bcorpSectionForRequirement(rs.topicArea, rs.code);

  return {
    code: rs.code,
    name: rs.name,
    section: `${section.label} (${section.abbrev})`,
    topicArea: rs.topicArea,
    status: rs.status,
    applicableFromYear: rs.applicableFromYear,
    guidance,
    synthesis,
    evidenceOnFile: links.map(describeEvidence),
    otherMatches: match.others.slice(0, 5).map((r) => r.code),
  };
}
