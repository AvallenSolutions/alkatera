// B Lab Risk Tool (V2.1) questionnaire. Pure and dependency-free so it is
// unit-testable and importable on client and server.
//
// The Risk Tool assesses four risk dimensions. Where B Lab's exact published
// wording is available it is used; otherwise close approximations consistent
// with the V2.1 standards framework are used. Each option carries a weight
// (0 low, 1 medium, 2 high) which is summed per dimension.

export type RiskDimension =
  | 'sector'
  | 'geographic'
  | 'supply_chain'
  | 'workforce';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskOption {
  value: string;
  label: string;
  weight: 0 | 1 | 2;
}

export interface RiskQuestion {
  id: string;
  dimension: RiskDimension;
  prompt: string;
  options: RiskOption[];
}

export const RISK_DIMENSION_LABELS: Record<RiskDimension, string> = {
  sector: 'Sector risk',
  geographic: 'Geographic risk',
  supply_chain: 'Supply chain risk',
  workforce: 'Workforce risk',
};

export const RISK_TOOL_QUESTIONS: RiskQuestion[] = [
  // Sector risk
  {
    id: 'sector_industry',
    dimension: 'sector',
    prompt:
      'Which best describes your primary industry sector and its ESG risk exposure?',
    options: [
      {
        value: 'low',
        label: 'Low-impact services or low-risk manufacturing',
        weight: 0,
      },
      {
        value: 'medium',
        label: 'Food, beverage or general consumer goods',
        weight: 1,
      },
      {
        value: 'high',
        label:
          'Extractives, agriculture-intensive, alcohol, or other elevated-risk sector',
        weight: 2,
      },
    ],
  },
  {
    id: 'sector_controversy',
    dimension: 'sector',
    prompt:
      'Does your sector face significant regulatory scrutiny or public controversy on social or environmental issues?',
    options: [
      { value: 'no', label: 'No notable scrutiny', weight: 0 },
      { value: 'some', label: 'Some scrutiny in specific areas', weight: 1 },
      { value: 'high', label: 'Significant ongoing scrutiny', weight: 2 },
    ],
  },
  // Geographic risk
  {
    id: 'geo_operations',
    dimension: 'geographic',
    prompt:
      'Where does your organisation primarily operate?',
    options: [
      {
        value: 'low',
        label: 'Countries with strong governance and rule of law',
        weight: 0,
      },
      {
        value: 'mixed',
        label: 'A mix of low-risk and higher-risk jurisdictions',
        weight: 1,
      },
      {
        value: 'high',
        label: 'Predominantly in jurisdictions with weak governance',
        weight: 2,
      },
    ],
  },
  {
    id: 'geo_sourcing',
    dimension: 'geographic',
    prompt:
      'Do you source materials or services from countries with elevated human rights or corruption risk?',
    options: [
      { value: 'no', label: 'No', weight: 0 },
      { value: 'limited', label: 'Limited sourcing from such countries', weight: 1 },
      { value: 'significant', label: 'Significant sourcing from such countries', weight: 2 },
    ],
  },
  // Supply chain risk
  {
    id: 'sc_complexity',
    dimension: 'supply_chain',
    prompt: 'How complex is your supply chain?',
    options: [
      { value: 'simple', label: 'Short, mostly direct suppliers', weight: 0 },
      { value: 'moderate', label: 'Several tiers, mostly known', weight: 1 },
      {
        value: 'complex',
        label: 'Many tiers with limited visibility beyond tier 1',
        weight: 2,
      },
    ],
  },
  {
    id: 'sc_visibility',
    dimension: 'supply_chain',
    prompt:
      'Do you have due diligence in place for indirect (sub-tier) suppliers?',
    options: [
      { value: 'yes', label: 'Yes, robust due diligence', weight: 0 },
      { value: 'partial', label: 'Partial, for key suppliers only', weight: 1 },
      { value: 'no', label: 'No formal due diligence', weight: 2 },
    ],
  },
  // Workforce risk
  {
    id: 'wf_model',
    dimension: 'workforce',
    prompt: 'Which best describes your employment model?',
    options: [
      {
        value: 'direct',
        label: 'Mostly permanent, directly employed staff',
        weight: 0,
      },
      {
        value: 'mixed',
        label: 'A mix of permanent staff and contractors',
        weight: 1,
      },
      {
        value: 'contingent',
        label: 'Heavy reliance on contractors or seasonal labour',
        weight: 2,
      },
    ],
  },
  {
    id: 'wf_vulnerable',
    dimension: 'workforce',
    prompt:
      'Does your workforce (or that of your suppliers) include populations vulnerable to exploitation (e.g. migrant or low-wage seasonal workers)?',
    options: [
      { value: 'no', label: 'No', weight: 0 },
      { value: 'some', label: 'Some, with safeguards in place', weight: 1 },
      { value: 'significant', label: 'Significant, with limited safeguards', weight: 2 },
    ],
  },
];

const DIMENSIONS: RiskDimension[] = [
  'sector',
  'geographic',
  'supply_chain',
  'workforce',
];

/**
 * Compute the low/medium/high level per dimension from raw responses
 * (questionId -> selected option value). Each dimension has 2 questions
 * (max weight 4): 0-1 low, 2-3 medium, 4 high.
 */
export function computeRiskProfile(
  responses: Record<string, string>,
): Record<RiskDimension, RiskLevel> {
  const profile = {} as Record<RiskDimension, RiskLevel>;
  for (const dimension of DIMENSIONS) {
    const questions = RISK_TOOL_QUESTIONS.filter(
      (q) => q.dimension === dimension,
    );
    let score = 0;
    for (const q of questions) {
      const selected = responses[q.id];
      const opt = q.options.find((o) => o.value === selected);
      score += opt?.weight ?? 0;
    }
    profile[dimension] =
      score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  }
  return profile;
}

/**
 * Requirement codes that warrant elevated focus given high-risk dimensions.
 * These requirements are already mandatory; this list flags where the
 * organisation should concentrate evidence.
 */
export function deriveTriggeredRequirements(
  profile: Record<RiskDimension, RiskLevel>,
): string[] {
  const triggered = new Set<string>();
  if (profile.sector === 'high') {
    triggered.add('FR-R-001');
    triggered.add('IT5-Y0-001');
  }
  if (profile.geographic === 'high') {
    triggered.add('IT4-Y0-001');
    triggered.add('IT4-Y0-002');
  }
  if (profile.supply_chain === 'high') {
    triggered.add('IT4-Y0-002');
    triggered.add('IT4-Y3-001');
  }
  if (profile.workforce === 'high') {
    triggered.add('IT2-Y0-001');
    triggered.add('IT2-Y0-002');
  }
  return Array.from(triggered);
}

export function isRiskToolComplete(
  responses: Record<string, string>,
): boolean {
  return RISK_TOOL_QUESTIONS.every((q) => !!responses[q.id]);
}
