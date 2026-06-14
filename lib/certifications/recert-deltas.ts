// For recertifying B Corps: which 2026 requirements are NEW, CHANGED, or simply
// CARRIED OVER from what an existing B Corp already does. This lets recertifiers
// focus only on the deltas instead of re-proving everything.
//
// This is best-effort guidance on the shift from the legacy BIA (points) model
// to the 2026 pass/fail Foundation + Impact Topic structure, not a line-by-line
// feed from B Lab. Framed as orientation, not legal advice.

import type { YearBand } from './scoring';

export type DeltaKind = 'new' | 'changed' | 'carried_over';

export interface RecertDelta {
  kind: DeltaKind;
  note: string;
}

export const DELTA_LABEL: Record<DeltaKind, string> = {
  new: 'New in 2026',
  changed: 'Changed in 2026',
  carried_over: 'Carried over',
};

const BY_CODE: Record<string, RecertDelta> = {
  'FR-R-000': { kind: 'new', note: 'New: a mandatory Risk Tool that tailors which requirements apply to you.' },
  'FR-R-001': { kind: 'new', note: 'New: explicit risk-management requirement.' },
  'FR-R-002': { kind: 'new', note: 'New: explicit risk-management requirement.' },
  'FR-R-003': { kind: 'new', note: 'New: explicit risk-management requirement.' },
  'FR-E-001': { kind: 'carried_over', note: 'Eligibility basics you already meet as a certified B Corp.' },
  'FR-E-002': { kind: 'carried_over', note: 'Eligibility basics you already meet as a certified B Corp.' },
  'FR-E-003': { kind: 'carried_over', note: 'Eligibility basics you already meet as a certified B Corp.' },
  'FR-L-001': { kind: 'carried_over', note: 'The legal stakeholder commitment you already made at first certification.' },
  'FR-L-002': { kind: 'carried_over', note: 'The legal stakeholder commitment you already made at first certification.' },
  'IT1-Y0-001': { kind: 'carried_over', note: 'Your existing mission/governance commitment likely covers this.' },
  'IT1-Y0-002': { kind: 'carried_over', note: 'Core governance policies you most likely already hold.' },
  'IT2-Y0-001': { kind: 'carried_over', note: 'Living wage was assessed under the old BIA — confirm it still holds.' },
  'IT2-Y3-002': { kind: 'changed', note: 'Strengthened: pay-equity monitoring is now an explicit requirement.' },
  'IT3-Y0-001': { kind: 'new', note: 'New in 2026: explicit Justice, Equity, Diversity & Inclusion requirements.' },
  'IT3-Y3-001': { kind: 'new', note: 'New in 2026: workforce diversity tracking under JEDI.' },
  'IT4-Y0-002': { kind: 'changed', note: 'Expanded: formal human-rights due diligence, beyond the old BIA questions.' },
  'IT4-Y3-001': { kind: 'changed', note: 'Expanded: deeper supply-chain human-rights diligence (living income, country risk).' },
  'IT5-Y0-001': { kind: 'changed', note: 'Strengthened: a full Scope 1/2/3 GHG inventory is now mandatory.' },
  'IT5-Y0-002': { kind: 'changed', note: 'Strengthened: a credible, ideally science-based emissions target is required.' },
  'IT5-Y3-002': { kind: 'new', note: 'New: an owned, time-bound emissions reduction plan, not just a target.' },
  'IT5-Y5-001': { kind: 'new', note: 'New: a net-zero pathway commitment by Year 5.' },
  'IT6-Y0-001': { kind: 'changed', note: 'Broadened: water, waste and resource management beyond carbon.' },
  'IT7-Y0-001': { kind: 'new', note: 'New in 2026: responsible government affairs and collective action.' },
};

const BY_TOPIC: Record<string, RecertDelta> = {
  foundation: { kind: 'carried_over', note: 'Foundation basics largely reflect your existing certification.' },
  'Purpose & Stakeholder Governance': { kind: 'carried_over', note: 'Governance commitments you most likely already hold.' },
  'Fair Work': { kind: 'carried_over', note: 'Builds on fair-work practices already assessed in your BIA.' },
  'Justice, Equity, Diversity & Inclusion': { kind: 'new', note: 'New, more explicit JEDI requirements in 2026.' },
  'Human Rights': { kind: 'changed', note: 'Expanded human-rights due diligence in 2026.' },
  'Climate Action': { kind: 'changed', note: 'Strengthened climate requirements in 2026.' },
  'Environmental Stewardship & Circularity': { kind: 'changed', note: 'Broader environmental requirements in 2026.' },
  'Government Affairs & Collective Action': { kind: 'new', note: 'New government-affairs requirements in 2026.' },
};

/**
 * Resolve the recert delta for a requirement: exact code, then year-band
 * default (Year 3/5 requirements are part of the new progression), then topic.
 */
export function getRecertDelta(
  code: string | null | undefined,
  topicArea: string | null | undefined,
  applicableFromYear: YearBand,
): RecertDelta {
  if (code && BY_CODE[code]) return BY_CODE[code];
  if (applicableFromYear > 0) {
    return { kind: 'new', note: `New under the 2026 Year ${applicableFromYear} progression — not part of the old standard.` };
  }
  if (topicArea && BY_TOPIC[topicArea]) return BY_TOPIC[topicArea];
  return { kind: 'changed', note: 'Reframed under the 2026 standard — review against your existing evidence.' };
}
