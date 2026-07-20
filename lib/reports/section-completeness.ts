/**
 * The single completeness oracle for the social and value-chain report
 * sections.
 *
 * One declarative catalogue decides, per section, which measures exist and
 * whether each is present on the assembled report payload. BOTH consumers
 * read this module — the document renderer (to decide skeleton vs number)
 * and the report builder's funnel (to say "3 of 9 measures recorded") — so a
 * block can never be flagged complete in one and missing in the other.
 *
 * Pure by design: no I/O, no Supabase, no auth. The assembler attaches the
 * result to reportData.sectionCompleteness; anything else that needs it
 * recomputes from the same payload.
 */

import type {
  PeopleCultureData,
  GovernanceData,
  CommunityImpactData,
  SupplierData,
  FacilityInfo,
} from './sections/types';

export interface SectionBlock {
  id: string;
  label: string;
  present: boolean;
  /** In-app page where this measure gets recorded. */
  deepLink: string;
}

export interface SectionCompleteness {
  sectionId: string;
  blocks: SectionBlock[];
  presentCount: number;
  totalCount: number;
}

/** The slice of the assembled report payload the predicates read. */
export interface SectionReportData {
  peopleCulture?: PeopleCultureData | null;
  governance?: GovernanceData | null;
  communityImpact?: CommunityImpactData | null;
  suppliers?: SupplierData[] | null;
  facilities?: FacilityInfo[] | null;
}

interface BlockSpec {
  id: string;
  label: string;
  deepLink: string;
  predicate: (data: SectionReportData) => boolean;
}

const has = (v: unknown): boolean => v !== null && v !== undefined;

// ---------------------------------------------------------------------------
// The catalogue. Block ids are stable API: the funnel builds anchors from
// them and tests pin them, so renaming one is a breaking change.
// ---------------------------------------------------------------------------

const CATALOGUE: Record<string, BlockSpec[]> = {
  'people-culture': [
    { id: 'score', label: 'People & culture score', deepLink: '/people-culture', predicate: d => (d.peopleCulture?.dataCompleteness ?? 0) > 0 },
    { id: 'pillars', label: 'Pillar breakdown', deepLink: '/people-culture', predicate: d => (d.peopleCulture?.dataCompleteness ?? 0) > 0 },
    { id: 'headcount', label: 'Headcount', deepLink: '/people-culture/diversity-inclusion', predicate: d => has(d.peopleCulture?.totalEmployees) },
    { id: 'gender-diversity', label: 'Gender diversity', deepLink: '/people-culture/diversity-inclusion', predicate: d => has(d.peopleCulture?.femalePercentage) },
    { id: 'hires-departures', label: 'Hires and departures', deepLink: '/people-culture/diversity-inclusion', predicate: d => has(d.peopleCulture?.newHires) || has(d.peopleCulture?.departures) },
    { id: 'turnover', label: 'Turnover rate', deepLink: '/people-culture/diversity-inclusion', predicate: d => has(d.peopleCulture?.turnoverRate) },
    { id: 'living-wage', label: 'Living wage compliance', deepLink: '/people-culture/fair-work', predicate: d => has(d.peopleCulture?.livingWageCompliance) },
    { id: 'training', label: 'Training hours', deepLink: '/people-culture/training', predicate: d => has(d.peopleCulture?.trainingHoursPerEmployee) },
    { id: 'pay-gap', label: 'Gender pay gap', deepLink: '/people-culture/fair-work', predicate: d => has(d.peopleCulture?.genderPayGapMean) },
    { id: 'pay-ratio', label: 'CEO to worker pay ratio', deepLink: '/people-culture/fair-work', predicate: d => has(d.peopleCulture?.ceoWorkerPayRatio) },
    { id: 'engagement', label: 'Employee engagement', deepLink: '/people-culture/wellbeing', predicate: d => has(d.peopleCulture?.engagementScore) },
    { id: 'dei-actions', label: 'DEI actions', deepLink: '/people-culture/diversity-inclusion', predicate: d => has(d.peopleCulture?.deiActionsTotal) },
    { id: 'benefits', label: 'Employee benefits', deepLink: '/people-culture/wellbeing', predicate: d => (d.peopleCulture?.benefits?.length ?? 0) > 0 },
  ],
  governance: [
    { id: 'board-composition', label: 'Board composition', deepLink: '/governance/board', predicate: d => (d.governance?.boardMembers?.length ?? 0) > 0 },
    { id: 'board-diversity', label: 'Board gender diversity', deepLink: '/governance/board', predicate: d => has(d.governance?.boardDiversityMetrics?.femalePercentage) },
    { id: 'board-independence', label: 'Board independence', deepLink: '/governance/board', predicate: d => has(d.governance?.boardDiversityMetrics?.independentPercentage) },
    { id: 'board-attendance', label: 'Board attendance', deepLink: '/governance/board', predicate: d => has(d.governance?.boardDiversityMetrics?.averageAttendance) },
    { id: 'policies', label: 'Governance policies', deepLink: '/governance/policies', predicate: d => (d.governance?.policies?.length ?? 0) > 0 },
    { id: 'policy-score', label: 'Policy completeness', deepLink: '/governance/policies', predicate: d => has(d.governance?.policyCompleteness) },
    { id: 'mission', label: 'Mission statement', deepLink: '/governance', predicate: d => Boolean(d.governance?.missionStatement) },
    { id: 'sdg-commitments', label: 'SDG commitments', deepLink: '/governance', predicate: d => (d.governance?.sdgCommitments?.length ?? 0) > 0 },
    { id: 'climate-commitments', label: 'Climate commitments', deepLink: '/governance', predicate: d => (d.governance?.climateCommitments?.length ?? 0) > 0 },
    { id: 'ethics', label: 'Ethics records', deepLink: '/governance/transparency', predicate: d => has(d.governance?.ethicsTrainingRate) || has(d.governance?.ethicsIncidents) },
  ],
  'community-impact': [
    { id: 'score', label: 'Community impact score', deepLink: '/community-impact', predicate: d => (d.communityImpact?.dataCompleteness ?? 0) > 0 },
    { id: 'pillars', label: 'Pillar breakdown', deepLink: '/community-impact', predicate: d => (d.communityImpact?.dataCompleteness ?? 0) > 0 },
    { id: 'donations', label: 'Charitable giving', deepLink: '/community-impact/charitable-giving', predicate: d => has(d.communityImpact?.totalDonations) },
    { id: 'volunteering', label: 'Volunteering', deepLink: '/community-impact/volunteering', predicate: d => has(d.communityImpact?.totalVolunteerHours) },
    { id: 'local-employment', label: 'Local employment', deepLink: '/community-impact/local-impact', predicate: d => has(d.communityImpact?.localEmploymentRate) },
    { id: 'local-sourcing', label: 'Local sourcing', deepLink: '/community-impact/local-impact', predicate: d => has(d.communityImpact?.localSourcingRate) },
    { id: 'impact-stories', label: 'Impact stories', deepLink: '/community-impact/stories', predicate: d => (d.communityImpact?.impactStories?.length ?? 0) > 0 },
  ],
  'supply-chain': [
    { id: 'roster', label: 'Supplier roster', deepLink: '/suppliers', predicate: d => (d.suppliers?.length ?? 0) > 0 },
    { id: 'categories', label: 'Supplier categories', deepLink: '/suppliers', predicate: d => (d.suppliers ?? []).some(s => Boolean(s.category)) },
    { id: 'data-shared', label: 'Supplier data shared', deepLink: '/suppliers', predicate: d => (d.suppliers ?? []).some(s => s.emissionsData && Object.keys(s.emissionsData).length > 0) },
  ],
  facilities: [
    { id: 'inventory', label: 'Site inventory', deepLink: '/company/facilities', predicate: d => (d.facilities?.length ?? 0) > 0 },
    { id: 'emissions', label: 'Site emissions', deepLink: '/company/facilities', predicate: d => (d.facilities ?? []).some(f => has(f.totalEmissions)) },
    { id: 'production', label: 'Production volumes', deepLink: '/company/facilities', predicate: d => (d.facilities ?? []).some(f => has(f.unitsProduced)) },
    { id: 'intensity', label: 'Emissions intensity', deepLink: '/company/facilities', predicate: d => (d.facilities ?? []).some(f => has(f.totalEmissions) && has(f.unitsProduced) && (f.unitsProduced as number) > 0) },
  ],
};

/** The renderer accepts legacy aliases for two sections; the oracle does too. */
const SECTION_ALIASES: Record<string, string> = {
  people: 'people-culture',
  community: 'community-impact',
  suppliers: 'supply-chain',
};

export function normaliseSectionId(sectionId: string): string {
  return SECTION_ALIASES[sectionId] ?? sectionId;
}

/** Section ids this oracle knows about (post-normalisation). */
export function isCompletenessSection(sectionId: string): boolean {
  return normaliseSectionId(sectionId) in CATALOGUE;
}

export function computeSectionCompleteness(
  sectionId: string,
  reportData: SectionReportData,
): SectionCompleteness {
  const canonical = normaliseSectionId(sectionId);
  const specs = CATALOGUE[canonical] ?? [];
  const blocks: SectionBlock[] = specs.map(spec => ({
    id: spec.id,
    label: spec.label,
    deepLink: spec.deepLink,
    present: spec.predicate(reportData),
  }));
  return {
    sectionId: canonical,
    blocks,
    presentCount: blocks.filter(b => b.present).length,
    totalCount: blocks.length,
  };
}

export function computeAllSectionCompleteness(
  sections: string[],
  reportData: SectionReportData,
): Record<string, SectionCompleteness> {
  const result: Record<string, SectionCompleteness> = {};
  for (const sectionId of sections) {
    const canonical = normaliseSectionId(sectionId);
    if (!(canonical in CATALOGUE) || canonical in result) continue;
    result[canonical] = computeSectionCompleteness(canonical, reportData);
  }
  return result;
}
