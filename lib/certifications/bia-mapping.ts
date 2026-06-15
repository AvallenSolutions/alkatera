// Maps the B Corp 2026 standard's Foundation + 7 Impact Topics onto the five
// B Impact Assessment (BIA) Impact Areas, so an export can be organised the way
// B Lab's assessment expects rather than by alkatera requirement code.
//
// Pure data + lookups: no server / Supabase imports, safe to unit-test and to
// use in client components.

export const BIA_AREAS = [
  'Governance',
  'Workers',
  'Community',
  'Environment',
  'Customers',
] as const;

export type BiaArea = (typeof BIA_AREAS)[number];

/**
 * B Corp 2026 topic area (the `topicArea` on each requirement) -> BIA Impact
 * Area. Keys are matched case-insensitively and also by the `IT{n}` code prefix
 * as a fallback, so this keeps working if a topic label is edited slightly.
 */
const TOPIC_TO_BIA: Record<string, BiaArea> = {
  foundation: 'Governance',
  'purpose & stakeholder governance': 'Governance',
  'fair work': 'Workers',
  'justice, equity, diversity & inclusion': 'Workers',
  'human rights': 'Community',
  'climate action': 'Environment',
  'environmental stewardship & circularity': 'Environment',
  'government affairs & collective action': 'Community',
};

// Impact-Topic code prefix (IT1..IT7) -> BIA area, used when the topic label
// doesn't match (codes are stable; labels are editable copy).
const CODE_PREFIX_TO_BIA: Record<string, BiaArea> = {
  IT1: 'Governance',
  IT2: 'Workers',
  IT3: 'Workers',
  IT4: 'Community',
  IT5: 'Environment',
  IT6: 'Environment',
  IT7: 'Community',
  FR: 'Governance', // Foundation requirements
};

/** Where, in the B Impact Assessment, evidence for each area belongs. */
const AREA_NOTE: Record<BiaArea, string> = {
  Governance:
    'Mission, ethics, transparency and stakeholder governance. In the BIA this is the Governance Impact Area (plus the Disclosure Questionnaire for eligibility items).',
  Workers:
    'Pay, benefits, health, development and diversity, equity and inclusion. Maps to the Workers Impact Area in the BIA.',
  Community:
    'Supply chain, human rights, civic engagement and economic impact. Maps to the Community Impact Area in the BIA.',
  Environment:
    'Carbon, energy, water, waste and wider environmental stewardship. Maps to the Environment Impact Area in the BIA.',
  Customers:
    'Product stewardship and customer outcomes. Maps to the Customers Impact Area in the BIA.',
};

/** Resolve the BIA Impact Area for a requirement by topic area and/or code. */
export function biaAreaForRequirement(
  topicArea: string | null | undefined,
  code?: string | null,
): BiaArea {
  const key = (topicArea ?? '').trim().toLowerCase();
  if (key && TOPIC_TO_BIA[key]) return TOPIC_TO_BIA[key];
  const prefix = (code ?? '').split('-')[0]?.toUpperCase();
  if (prefix && CODE_PREFIX_TO_BIA[prefix]) return CODE_PREFIX_TO_BIA[prefix];
  // Unknown topics default to Governance (the catch-all disclosure area)
  // rather than being dropped from the bundle.
  return 'Governance';
}

export function biaAreaNote(area: BiaArea): string {
  return AREA_NOTE[area];
}
