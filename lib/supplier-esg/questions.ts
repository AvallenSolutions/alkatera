export type EsgResponse = 'yes' | 'partial' | 'no' | 'na'

export type EsgSection =
  | 'labour_human_rights'
  | 'environment'
  | 'ethics'
  | 'health_safety'
  | 'management_systems'

export interface EsgQuestion {
  id: string
  section: EsgSection
  sectionLabel: string
  text: string
  guidanceNote?: string
  allowNA?: boolean
  /**
   * B Corp 2026 requirement this question helps a buying organisation evidence,
   * when the supplier answers it affirmatively. Drives the supply-chain mappings
   * in lib/certifications/platform-data.ts.
   */
  bcorpRequirement?: string
}

/** Question ids tagged as evidence for a given B Corp requirement code. */
export function getBcorpQuestionIds(requirementCode: string): string[] {
  return ESG_QUESTIONS.filter((q) => q.bcorpRequirement === requirementCode).map((q) => q.id)
}

export const ESG_SECTIONS: { key: EsgSection; label: string }[] = [
  { key: 'labour_human_rights', label: 'Labour & Human Rights' },
  { key: 'environment', label: 'Environment' },
  { key: 'ethics', label: 'Ethics' },
  { key: 'health_safety', label: 'Health & Safety' },
  { key: 'management_systems', label: 'Management Systems' },
]

export const ESG_QUESTIONS: EsgQuestion[] = [
  // Labour & Human Rights (10 questions)
  {
    id: 'lhr_01',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: 'Do you have a written policy prohibiting forced or compulsory labour?',
  },
  {
    id: 'lhr_02',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: 'Do you have a written policy prohibiting child labour?',
  },
  {
    id: 'lhr_03',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: "Do you respect workers' rights to freedom of association and collective bargaining?",
  },
  {
    id: 'lhr_04',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: 'Do you pay all workers at least the legal minimum wage in their country of operation?',
  },
  {
    id: 'lhr_05',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: 'Do you benchmark wages against living wage standards in the regions you operate?',
    guidanceNote: 'Living wage benchmarks include the Living Wage Foundation or Anker methodology.',
  },
  {
    id: 'lhr_06',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: 'Do you have documented working hours policies that comply with local legal limits?',
  },
  {
    id: 'lhr_07',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: 'Do you prohibit all forms of discrimination in hiring, pay, and promotion?',
  },
  {
    id: 'lhr_08',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: 'Do you have a grievance mechanism that workers can use without fear of retaliation?',
  },
  {
    id: 'lhr_09',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: 'Do you conduct human rights due diligence on your own supply chain?',
    guidanceNote: 'This includes assessing risks related to modern slavery, child labour, and other abuses in your upstream suppliers.',
  },
  {
    id: 'lhr_10',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: 'Do you have a Modern Slavery statement (or equivalent for your jurisdiction)?',
    allowNA: true,
    guidanceNote: 'Required by law in some jurisdictions (e.g. UK Modern Slavery Act for businesses with turnover above £36m).',
  },
  {
    id: 'lhr_11',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: 'For any agricultural or commodity raw materials you supply, do you take action to support a living income for farmers and growers in your supply chain?',
    allowNA: true,
    bcorpRequirement: 'IT4-Y3-001',
    guidanceNote:
      'Living income is the net income a household needs for a decent standard of living. It is distinct from a living wage, which applies to employed workers. Examples of action include price premiums, long-term contracts, or Fairtrade/Fair for Life certification. Select N/A if you do not supply agricultural or commodity raw materials.',
  },
  {
    id: 'lhr_12',
    section: 'labour_human_rights',
    sectionLabel: 'Labour & Human Rights',
    text: 'Do you assess human rights and living wage risk by the specific countries and sites where you and your suppliers operate?',
    bcorpRequirement: 'IT4-Y3-001',
    guidanceNote:
      'Living wage benchmarks and human rights risk are location-dependent. Partial = some operating locations assessed but not all, or only your own sites and not your suppliers.',
  },

  // Environment (8 questions)
  {
    id: 'env_01',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Do you have a written environmental policy?',
  },
  {
    id: 'env_02',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Do you measure and track your greenhouse gas emissions (Scope 1 and 2)?',
  },
  {
    id: 'env_03',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Do you have targets to reduce your carbon emissions?',
  },
  {
    id: 'env_11',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Do you measure and track your Scope 3 (value chain) greenhouse gas emissions?',
    bcorpRequirement: 'IT5-Y3-001',
    guidanceNote:
      'Scope 3 covers indirect emissions across your value chain, including purchased goods and services, transport, and use of sold products. Partial = some Scope 3 categories measured but not a full inventory.',
  },
  {
    id: 'env_12',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Do you have a science-based emissions reduction target aligned with limiting global warming to 1.5°C?',
    bcorpRequirement: 'IT5-Y3-001',
    guidanceNote:
      'For example, a target validated by the Science Based Targets initiative (SBTi). Partial = a target is set but not yet validated, or aligned to well-below 2°C rather than 1.5°C.',
  },
  {
    id: 'env_04',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Do you track your water consumption and have reduction targets?',
  },
  {
    id: 'env_05',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Do you have a waste reduction programme with targets?',
  },
  {
    id: 'env_06',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Do you assess the environmental impact of your products or services?',
  },
  {
    id: 'env_07',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Do you have a policy for responsible chemical and hazardous substance management?',
    allowNA: true,
    guidanceNote: 'Select N/A if your operations do not involve chemical or hazardous substances.',
  },
  {
    id: 'env_08',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Do you comply with all applicable environmental regulations in your operating regions?',
  },
  {
    id: 'env_09',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Do you have a no-deforestation commitment covering the commodities you supply?',
    guidanceNote: 'A no-deforestation commitment means a policy commitment not to source from or contribute to the conversion of natural forests. This applies to any of the following commodities you supply: cattle, cocoa, palm oil, soy, timber, coffee, rubber.',
    allowNA: true,
  },
  {
    id: 'env_10',
    section: 'environment',
    sectionLabel: 'Environment',
    text: 'Which standard does your no-deforestation commitment align with?',
    guidanceNote: 'Select the primary certification or standard your commitment aligns with. If multiple apply, select the most stringent.',
    allowNA: true,
  },

  // Ethics (6 questions)
  {
    id: 'eth_01',
    section: 'ethics',
    sectionLabel: 'Ethics',
    text: 'Do you have a written anti-bribery and corruption policy?',
  },
  {
    id: 'eth_02',
    section: 'ethics',
    sectionLabel: 'Ethics',
    text: 'Do you have a code of ethics or conduct that applies to all employees?',
  },
  {
    id: 'eth_03',
    section: 'ethics',
    sectionLabel: 'Ethics',
    text: 'Do you have a whistleblowing or speak-up mechanism?',
  },
  {
    id: 'eth_04',
    section: 'ethics',
    sectionLabel: 'Ethics',
    text: 'Do you conduct background checks or due diligence on business partners?',
  },
  {
    id: 'eth_05',
    section: 'ethics',
    sectionLabel: 'Ethics',
    text: 'Do you have a conflicts of interest policy?',
  },
  {
    id: 'eth_06',
    section: 'ethics',
    sectionLabel: 'Ethics',
    text: 'Do you comply with all applicable data protection regulations (e.g. GDPR)?',
  },

  // Health & Safety (6 questions)
  {
    id: 'hs_01',
    section: 'health_safety',
    sectionLabel: 'Health & Safety',
    text: 'Do you have a written health and safety policy?',
  },
  {
    id: 'hs_02',
    section: 'health_safety',
    sectionLabel: 'Health & Safety',
    text: 'Do you conduct regular risk assessments for workplace hazards?',
  },
  {
    id: 'hs_03',
    section: 'health_safety',
    sectionLabel: 'Health & Safety',
    text: 'Do you record and investigate all workplace accidents and near-misses?',
  },
  {
    id: 'hs_04',
    section: 'health_safety',
    sectionLabel: 'Health & Safety',
    text: 'Do you provide health and safety training to all workers?',
  },
  {
    id: 'hs_05',
    section: 'health_safety',
    sectionLabel: 'Health & Safety',
    text: 'Do you have emergency response procedures in place?',
  },
  {
    id: 'hs_06',
    section: 'health_safety',
    sectionLabel: 'Health & Safety',
    text: 'Do you comply with all applicable health and safety regulations?',
  },

  // Management Systems (5 questions)
  {
    id: 'ms_01',
    section: 'management_systems',
    sectionLabel: 'Management Systems',
    text: 'Do you have a dedicated sustainability or ESG function or named responsible person?',
  },
  {
    id: 'ms_02',
    section: 'management_systems',
    sectionLabel: 'Management Systems',
    text: 'Do you set formal targets for your ESG performance?',
  },
  {
    id: 'ms_03',
    section: 'management_systems',
    sectionLabel: 'Management Systems',
    text: 'Do you publicly report on your ESG performance (annual report, website, etc.)?',
  },
  {
    id: 'ms_04',
    section: 'management_systems',
    sectionLabel: 'Management Systems',
    text: 'Do you hold any third-party sustainability certifications (e.g. B Corp, ISO 14001, SA8000)?',
  },
  {
    id: 'ms_05',
    section: 'management_systems',
    sectionLabel: 'Management Systems',
    text: 'Do you cascade ESG requirements to your own suppliers?',
  },
]

export function getQuestionsBySection(section: EsgSection): EsgQuestion[] {
  return ESG_QUESTIONS.filter((q) => q.section === section)
}
