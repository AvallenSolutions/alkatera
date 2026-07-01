// Resolve a fuzzy user/Rosa query ("IT5-Y0-001", "living wage", "climate") to a
// single B Corp requirement, plus any other candidates. Pure (no server /
// Supabase imports) so it is unit-testable and shared by the per-requirement
// answer builder and Rosa's drafting tool.

import type { RequirementStatus } from './scoring';

export interface RequirementMatch {
  best: RequirementStatus;
  /** Other requirements that also matched the query, most relevant first. */
  others: RequirementStatus[];
}

/**
 * Match a query against the org's requirements. An exact code match always
 * wins; otherwise any requirement whose code, name or topic contains the query
 * is a candidate. Candidates are ranked most-actionable first: unmet before
 * met, earliest year first, then requirement order. Returns null when nothing
 * matches. Only requirements that apply to the org (size) are considered.
 */
export function matchRequirement(
  statuses: RequirementStatus[],
  query: string,
): RequirementMatch | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const applicable = statuses.filter((r) => r.applicable !== false);

  const exact = applicable.find((r) => r.code.toLowerCase() === q);
  const candidates = exact
    ? [exact]
    : applicable.filter(
        (r) =>
          r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.topicArea.toLowerCase().includes(q),
      );
  if (candidates.length === 0) return null;

  const ranked = [...candidates].sort((a, b) => {
    const aMet = a.status === 'passed' ? 1 : 0;
    const bMet = b.status === 'passed' ? 1 : 0;
    if (aMet !== bMet) return aMet - bMet;
    if (a.applicableFromYear !== b.applicableFromYear) {
      return a.applicableFromYear - b.applicableFromYear;
    }
    return a.orderIndex - b.orderIndex;
  });

  return { best: ranked[0], others: ranked.slice(1) };
}
