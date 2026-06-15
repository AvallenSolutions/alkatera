// The B Lab Standards v2.2 structure: Foundation Requirements + the 7 Impact
// Topics, in the order B Lab's platform presents them. Used to organise the
// evidence export the same way the B Corp assessment is laid out, so a user can
// drop each file straight into the matching section.
//
// Pure data + lookups: no server / Supabase imports, safe to unit-test and to
// use in client components.

export interface BCorpSection {
  /** Matches the requirement `topicArea` (and 'foundation'). */
  key: string;
  /** Display label as shown in the B Corp platform. */
  label: string;
  /** Official short code (PSG, FW, JEDI, ...). */
  abbrev: string;
  /** What belongs in this section. */
  note: string;
}

// Order mirrors the B Corp assessment: Foundation first, then the 7 Impact
// Topics.
export const BCORP_SECTIONS: BCorpSection[] = [
  {
    key: 'foundation',
    label: 'Foundation Requirements',
    abbrev: 'FR',
    note: 'Eligibility (ineligible industries and practices) and the legal accountability requirement.',
  },
  {
    key: 'Purpose & Stakeholder Governance',
    label: 'Purpose & Stakeholder Governance',
    abbrev: 'PSG',
    note: 'Acting on a defined purpose and embedding stakeholder governance in decision-making.',
  },
  {
    key: 'Fair Work',
    label: 'Fair Work',
    abbrev: 'FW',
    note: 'Good quality jobs and a positive workplace culture (pay, benefits, voice).',
  },
  {
    key: 'Justice, Equity, Diversity & Inclusion',
    label: 'Justice, Equity, Diversity & Inclusion',
    abbrev: 'JEDI',
    note: 'Inclusive, diverse workplaces and contribution to just and equitable communities.',
  },
  {
    key: 'Human Rights',
    label: 'Human Rights',
    abbrev: 'HR',
    note: 'Treating people across operations and the value chain with dignity and respect.',
  },
  {
    key: 'Climate Action',
    label: 'Climate Action',
    abbrev: 'CA',
    note: 'Measuring and acting to combat the climate crisis and its impacts.',
  },
  {
    key: 'Environmental Stewardship & Circularity',
    label: 'Environmental Stewardship & Circularity',
    abbrev: 'ESC',
    note: 'Environmental stewardship and circular-economy contribution in operations and value chain.',
  },
  {
    key: 'Government Affairs & Collective Action',
    label: 'Government Affairs & Collective Action',
    abbrev: 'GA',
    note: 'Leadership in shared understanding and solutions toward an equitable, regenerative economy.',
  },
];

// Impact-Topic code prefix (IT1..IT7, FR) -> section key, used when the topic
// label has been edited (codes are stable; labels are editable copy).
const CODE_PREFIX_TO_KEY: Record<string, string> = {
  FR: 'foundation',
  IT1: 'Purpose & Stakeholder Governance',
  IT2: 'Fair Work',
  IT3: 'Justice, Equity, Diversity & Inclusion',
  IT4: 'Human Rights',
  IT5: 'Climate Action',
  IT6: 'Environmental Stewardship & Circularity',
  IT7: 'Government Affairs & Collective Action',
};

const BY_KEY_LOWER = new Map(
  BCORP_SECTIONS.map((s) => [s.key.toLowerCase(), s]),
);

const FOUNDATION = BCORP_SECTIONS[0];

/** Resolve the B Corp section for a requirement by topic area, then code. */
export function bcorpSectionForRequirement(
  topicArea: string | null | undefined,
  code?: string | null,
): BCorpSection {
  const key = (topicArea ?? '').trim().toLowerCase();
  const byLabel = key ? BY_KEY_LOWER.get(key) : undefined;
  if (byLabel) return byLabel;
  const prefix = (code ?? '').split('-')[0]?.toUpperCase();
  const mappedKey = prefix ? CODE_PREFIX_TO_KEY[prefix] : undefined;
  if (mappedKey) {
    const byCode = BY_KEY_LOWER.get(mappedKey.toLowerCase());
    if (byCode) return byCode;
  }
  // Unknown topics land in Foundation rather than being dropped from the bundle.
  return FOUNDATION;
}
