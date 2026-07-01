// Plain-English guidance for B Corp 2026 requirements, so users understand what
// each one actually asks for, what counts as evidence, and where teams trip up.
// Pure data + a lookup — no server imports, safe in client components.
//
// Lookup order: exact requirement code -> topic-area default -> generic default.
// We deliberately keep copy jargon-free and concrete (British English).

import { getRequirementDef } from '@/lib/certifications/frameworks';
import { getBcorpV21Requirement } from '@/lib/certifications/frameworks/bcorp-v2';

export interface RequirementGuidance {
  /** What the requirement is really asking for, in plain terms. */
  summary: string;
  /** Concrete examples of evidence an auditor will accept. */
  evidence: string[];
  /** Common mistakes / things that fail review. */
  pitfalls?: string[];
  /** Starter wording the user can adapt for manual / document requirements. */
  template?: string;
}

/** Starter templates for the manual requirements where a blank page is the blocker. */
const TEMPLATES: Record<string, string> = {
  'IT1-Y0-001':
    '[Company] exists to [purpose]. We are committed to creating value for all our stakeholders — our workers, customers, suppliers, communities and the environment — not only our shareholders, and our board considers their interests in its decisions.',
  'IT1-Y0-002':
    'Code of Conduct: the standards of behaviour we expect of everyone at [Company], covering integrity, anti-bribery and conflicts of interest. Whistleblowing: anyone can raise a concern confidentially via [channel] without fear of retaliation.',
  'IT4-Y0-002':
    'Human Rights & Responsible Sourcing Policy: [Company] respects internationally recognised human rights across our operations and supply chain, expects the same of our suppliers, and assesses and acts on salient risks.',
  'IT7-Y0-001':
    'Responsible Government Affairs Statement: any advocacy or trade-association activity [Company] takes part in is consistent with our mission and disclosed; we do not lobby against our stated environmental and social commitments.',
};

/** Per-requirement-code guidance for the requirements users ask about most. */
const BY_CODE: Record<string, RequirementGuidance> = {
  'FR-R-000': {
    summary:
      'Complete the B Corp Risk Tool. It profiles your business by sector, geography, supply chain and workforce, and decides which extra requirements apply to you.',
    evidence: ['Finish the Risk Tool questionnaire in alkatera — that is the evidence.'],
    pitfalls: ['Answer honestly; under-stating risk only hides requirements you will still be audited against.'],
  },
  'IT1-Y0-001': {
    summary:
      'Show that your company has a clear purpose and a commitment to consider all stakeholders (workers, community, environment), not just shareholders.',
    evidence: [
      'Your mission / purpose statement (recorded in Governance).',
      'A board minute or policy committing to stakeholder governance.',
      'Articles of association or a legal commitment to stakeholders where applicable.',
    ],
    pitfalls: ['A marketing tagline is not enough — auditors want a documented, board-level commitment.'],
  },
  'IT1-Y0-002': {
    summary: 'Have the core governance policies in place that show the business is run responsibly.',
    evidence: ['Your published policies (recorded in Governance): ethics/code of conduct, anti-bribery, whistleblowing.'],
    pitfalls: ['Policies must be current and actually adopted, not drafts.'],
  },
  'IT2-Y0-001': {
    summary: 'Demonstrate you pay at least a living wage to your workers.',
    evidence: [
      'Employee compensation records (in People) showing pay levels by role.',
      'A comparison against the local living-wage benchmark for your region.',
    ],
    pitfalls: ['Statutory minimum wage is not the same as a living wage — benchmark against the real local living wage.'],
  },
  'IT2-Y3-002': {
    summary: 'Show you monitor and act on pay equity across your workforce.',
    evidence: ['Compensation records tagged with gender (and other relevant dimensions) so a pay-gap analysis can be run.'],
    pitfalls: ['Partial gender coverage weakens the analysis — aim for complete records.'],
  },
  'IT3-Y3-001': {
    summary: 'Track the diversity of your workforce and show you are managing inclusion.',
    evidence: ['Workforce demographics (in People) by the dimensions you collect, plus any DEI actions or policies.'],
  },
  'IT4-Y0-002': {
    summary: 'Show you have begun human-rights due diligence across your operations and supply chain.',
    evidence: ['Supplier ESG self-assessments (in Suppliers) covering labour and human rights.', 'A human-rights or responsible-sourcing policy.'],
    pitfalls: ['One assessed supplier is a start, not coverage — aim to assess your material suppliers.'],
  },
  'IT4-Y3-001': {
    summary: 'Deepen human-rights due diligence: assess salient risks like living income and country risk in your supply chain.',
    evidence: ['Supplier assessments that cover living-income and country-risk questions, with follow-up actions for higher-risk suppliers.'],
  },
  'IT5-Y0-001': {
    summary: 'Measure your greenhouse-gas footprint across Scope 1, 2 and 3.',
    evidence: ['Your corporate emissions inventory (alkatera calculates this from your facility and product data).'],
    pitfalls: ['Scope 3 (your supply chain) is usually the biggest share — a Scope 1 and 2 only inventory will not pass.'],
  },
  'IT5-Y0-002': {
    summary: 'Set a credible emissions-reduction target.',
    evidence: ['An emissions target in Pulse, ideally science-based (SBTi-aligned), with a baseline, target year and methodology.'],
    pitfalls: ['A target with no methodology or baseline reads as aspirational — record how it was set.'],
  },
  'IT5-Y3-002': {
    summary: 'Have a real plan to hit your emissions target, with owned, time-bound actions.',
    evidence: ['Reduction initiatives in Pulse linked to your emissions target, each with an owner, dates and live progress.'],
    pitfalls: ['A list of ideas is not a plan — actions need owners, deadlines and recent progress updates to qualify.'],
  },
  'IT5-Y5-001': {
    summary: 'Commit to a net-zero pathway and be acting on it.',
    evidence: ['A net-zero target (reducing to zero) plus an active, funded reduction plan behind it.'],
  },
  'IT5-Y3-001': {
    summary: 'Engage your suppliers on climate — measuring their footprint or setting their own targets.',
    evidence: ['Suppliers reporting Scope 3 data or science-based targets (tracked in Suppliers), with your engagement coverage.'],
  },
  'IT6-Y0-001': {
    summary: 'Measure and manage your environmental footprint beyond carbon — water, waste and resource use.',
    evidence: ['Facility activity data (in Operations) for water, waste and energy.'],
  },
  'IT6-Y0-002': {
    summary: 'Show you are managing waste and moving towards circularity.',
    evidence: ['Waste and recycling data per facility, plus any reuse / recycled-content actions.'],
  },
};

/** Topic-area fallback guidance for any requirement without a specific entry. */
const BY_TOPIC: Record<string, RequirementGuidance> = {
  foundation: {
    summary:
      'A baseline requirement every B Corp must meet before the impact topics open up — eligibility, a legal commitment to stakeholders, and basic risk management.',
    evidence: ['Legal documents, adopted policies and the completed Risk Tool, as relevant to this requirement.'],
    pitfalls: ['Foundation requirements are mandatory and block submission until met — do these first.'],
  },
  'Purpose & Stakeholder Governance': {
    summary: 'Show your company is governed for all stakeholders, with a clear purpose and responsible policies.',
    evidence: ['Mission statement, board commitments and governance policies (recorded in Governance).'],
  },
  'Fair Work': {
    summary: 'Demonstrate fair pay, good working conditions and worker voice across your business.',
    evidence: ['Compensation records, benefits, training and engagement data (in People).'],
  },
  'Justice, Equity, Diversity & Inclusion': {
    summary: 'Show you understand and are improving the diversity and inclusiveness of your workforce.',
    evidence: ['Workforce demographics and DEI actions (in People).'],
  },
  'Human Rights': {
    summary: 'Show you are identifying and managing human-rights risks in your operations and supply chain.',
    evidence: ['Supplier assessments and a human-rights / responsible-sourcing policy (in Suppliers).'],
  },
  'Climate Action': {
    summary: 'Measure your emissions, set a target and act to reduce them, deepening each year.',
    evidence: ['Your emissions inventory, targets and reduction initiatives (in Pulse).'],
  },
  'Environmental Stewardship & Circularity': {
    summary: 'Manage your wider environmental impact — water, waste, materials and nature.',
    evidence: ['Facility water and waste data, and circularity actions (in Operations).'],
  },
  'Government Affairs & Collective Action': {
    summary: 'Show responsible lobbying and that you use your influence for positive collective impact.',
    evidence: ['Lobbying disclosures, trade-association memberships and advocacy positions (in Governance).'],
  },
};

const GENERIC: RequirementGuidance = {
  summary: 'Provide evidence that your business meets this requirement of the B Corp 2026 standard.',
  evidence: ['Upload a document or link data from alkatera that demonstrates how you meet it.'],
};

/** Resolve guidance for a requirement: exact code, then topic, then generic. */
export function getRequirementGuidance(
  code: string | null | undefined,
  topicArea: string | null | undefined,
  frameworkCode?: string | null,
): RequirementGuidance {
  // Non-B-Corp frameworks carry their guidance inline in the framework registry.
  if (frameworkCode && frameworkCode !== 'bcorp_2026') {
    const def = getRequirementDef(frameworkCode, code);
    if (def) return { summary: def.summary, evidence: def.evidence, pitfalls: def.pitfalls };
    return GENERIC;
  }
  // B Corp v2.1 requirements carry their own summary in the content module.
  // The hand-written per-code guidance (evidence examples, pitfalls, templates)
  // is keyed by the OLD codes, so resolve the requirement's `legacy` code and
  // look guidance up under both — otherwise every v2.1 code (PSG1.1, CA1.1…)
  // would fall through to generic evidence.
  const v21 = getBcorpV21Requirement(code);
  const legacy = v21?.legacy ?? null;
  const coded =
    (code && BY_CODE[code]) || (legacy ? BY_CODE[legacy] : undefined) || null;

  let base: RequirementGuidance;
  if (v21) {
    // Current canonical wording, enriched with the rich legacy examples/pitfalls.
    base = {
      summary: v21.summary,
      evidence: coded?.evidence ?? GENERIC.evidence,
      pitfalls: coded?.pitfalls,
    };
  } else {
    base = coded || (topicArea && BY_TOPIC[topicArea]) || GENERIC;
  }

  const template =
    (code && TEMPLATES[code]) || (legacy ? TEMPLATES[legacy] : undefined);
  return template ? { ...base, template } : base;
}
