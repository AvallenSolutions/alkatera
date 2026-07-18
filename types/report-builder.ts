// ============================================================================
// Shared types and constants for the Report Builder
// ============================================================================

export interface ReportConfig {
  reportName: string;
  reportYear: number;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  audience: 'investors' | 'regulators' | 'customers' | 'internal' | 'supply-chain' | 'technical';
  /** Audience-led style preset (lib/pdf/templates/report-styles.ts): binds look, narrative order and tone. */
  style?: 'marketing' | 'customers' | 'compliance' | 'investors' | 'supply-chain';
  outputFormat: 'pdf' | 'html';
  /** Report template/theme ID. See lib/pdf/templates/themes.ts for options. */
  template?: 'classic' | 'modern' | 'executive' | 'data-dense' | 'narrative';
  /** Orientation override. If not set, uses the template's default. */
  orientation?: 'portrait' | 'landscape';
  standards: string[];
  sections: string[];
  branding: {
    logo: string | null;
    primaryColor: string;
    secondaryColor: string;
    /** Photos uploaded by the user. First image is used as the cover hero. */
    heroImages?: string[];
    /** Leadership message to appear as a full page in storytelling reports. */
    leadership?: {
      name?: string;
      title?: string;
      message?: string;
      photo?: string;
    };
  };
  isMultiYear?: boolean;
  reportYears?: number[];
  /** Step 0 framing: what the report author wants the audience to take away */
  reportFramingStatement?: string;
}

export interface ReportDefaults {
  branding: ReportConfig['branding'];
  audience: ReportConfig['audience'];
  standards: string[];
  template?: ReportConfig['template'];
  orientation?: ReportConfig['orientation'];
}

export interface SectionDefinition {
  id: string;
  label: string;
  description: string;
  required: boolean;
  category: string;
  comingSoon?: boolean;
  requiresFeature?: string;
}

export const AVAILABLE_SECTIONS: SectionDefinition[] = [
  {
    id: 'executive-summary',
    label: 'Executive Summary',
    description: 'High-level overview of key findings and recommendations',
    required: true,
    category: 'Overview',
  },
  {
    id: 'company-overview',
    label: 'Company Overview',
    description: 'Organization details, industry context, and scope of operations',
    required: false,
    category: 'Overview',
  },
  {
    id: 'scope-1-2-3',
    label: 'Scope 1/2/3 Emissions Breakdown',
    description: 'Comprehensive GHG emissions across all scopes with category breakdown',
    required: false,
    category: 'Emissions',
  },
  {
    id: 'ghg-inventory',
    label: 'GHG Gas Inventory (ISO 14067)',
    description: 'Detailed breakdown by gas type (CO\u2082, CH\u2084, N\u2082O, HFCs/PFCs) with GWP factors',
    required: false,
    category: 'Emissions',
  },
  {
    id: 'carbon-origin',
    label: 'Carbon Origin Breakdown',
    description: 'Fossil carbon vs. biogenic carbon vs. land use change emissions',
    required: false,
    category: 'Emissions',
  },
  {
    id: 'product-footprints',
    label: 'Product Environmental Impacts',
    description: 'Individual product environmental impact results with functional units',
    required: false,
    category: 'Products',
  },
  {
    id: 'multi-capital',
    label: 'Multi-capital Impacts',
    description: 'Water depletion, land use, waste generation, and other impact categories',
    required: false,
    category: 'Environmental Impacts',
  },
  {
    id: 'impact-valuation',
    label: 'Impact Valuation',
    description: 'Monetised £ value of sustainability impact across four capitals',
    required: false,
    category: 'Impact',
    requiresFeature: 'impact_valuation_beta',
  },
  {
    id: 'people-culture',
    label: 'People & Culture',
    description: 'Workforce demographics, living wage, gender pay gap, DEI, training and wellbeing',
    required: false,
    category: 'Social Impact',
  },
  {
    id: 'governance',
    label: 'Governance',
    description: 'Board composition, policies, ethics, mission and stakeholder governance',
    required: false,
    category: 'Social Impact',
  },
  {
    id: 'community-impact',
    label: 'Community Impact',
    description: 'Charitable giving, volunteering, local employment, impact stories',
    required: false,
    category: 'Social Impact',
  },
  {
    id: 'supply-chain',
    label: 'Supply Chain Analysis',
    description: 'Supplier emissions, hotspot analysis, and value chain mapping',
    required: false,
    category: 'Value Chain',
  },
  {
    id: 'facilities',
    label: 'Facility Emissions Breakdown',
    description: 'Site-level emissions intensity and production allocation',
    required: false,
    category: 'Operations',
  },
  {
    id: 'flag-removals',
    label: 'FLAG Land-Based Removals',
    description: 'Soil carbon sequestration reported separately per SBTi FLAG Guidance v1.2',
    required: false,
    category: 'Emissions',
  },
  {
    id: 'tnfd-nature',
    label: 'TNFD Nature & Biodiversity',
    description: 'Nature dependencies, impacts, and risks per the TNFD LEAP Framework (Locate, Evaluate, Assess, Prepare) and CSRD ESRS E4.',
    required: false,
    category: 'Environmental Impacts',
  },
  {
    id: 'key-findings',
    label: 'Key Findings & Change Drivers',
    description: 'AI-generated narrative explaining the most significant drivers of year-on-year emission changes',
    required: false,
    category: 'Performance',
  },
  {
    id: 'trends',
    label: 'Year-over-Year Trends',
    description: 'Historical emissions data and trajectory analysis',
    required: false,
    category: 'Performance',
  },
  {
    id: 'targets',
    label: 'Targets & Action Plans',
    description: 'Emission reduction goals, timelines, and strategic initiatives',
    required: false,
    category: 'Strategy',
  },
  {
    id: 'transition-roadmap',
    label: 'Transition Roadmap',
    description: 'Visual timeline of decarbonisation milestones and reduction targets from your Transition Plan',
    required: false,
    category: 'Strategy',
  },
  {
    id: 'risks-and-opportunities',
    label: 'Climate Risks & Opportunities',
    description: 'AI-generated and reviewed assessment of physical and transition climate risks and strategic opportunities',
    required: false,
    category: 'Strategy',
  },
  {
    id: 'methodology',
    label: 'Methodology & Data Quality',
    description: 'Calculation approaches, data sources, and quality assessment',
    required: false,
    category: 'Technical',
  },
  {
    id: 'regulatory',
    label: 'Regulatory Compliance',
    description: 'Alignment with CSRD, ISO 14067, and other standards',
    required: false,
    category: 'Compliance',
  },
  {
    id: 'appendix',
    label: 'Technical Appendix',
    description: 'Detailed assumptions, emission factors, and supplementary data',
    required: false,
    category: 'Technical',
  },
];

export const SECTION_CATEGORIES = [
  'Overview',
  'Emissions',
  'Products',
  'Environmental Impacts',
  'Impact',
  'Social Impact',
  'Value Chain',
  'Operations',
  'Performance',
  'Strategy',
  'Compliance',
  'Technical',
];

/**
 * The five audience-led report styles. Each bundles the reader, the look
 * (theme), the narrative structure and the tone of voice; picking one is the
 * builder's primary choice. Section/standard suggestions land as editable
 * defaults.
 */
export const REPORT_STYLE_CHOICES = [
  {
    value: 'marketing' as const,
    label: 'Marketing',
    description: 'Storytelling and imagery, brand-forward',
    audience: 'customers' as const,
    template: 'narrative',
    sections: ['executive-summary', 'scope-1-2-3', 'key-findings', 'community-impact', 'people-culture', 'product-footprints', 'targets'],
    standards: ['ghg-protocol'],
    cues: ['The story of the year, told through people and progress', 'Hero photography, chapter dividers and the leadership foreword', 'A few numbers that carry the story, not tables of them'],
  },
  {
    value: 'customers' as const,
    label: 'Customers',
    description: 'Product focus, plain and honest',
    audience: 'customers' as const,
    template: 'modern',
    sections: ['executive-summary', 'scope-1-2-3', 'product-footprints', 'key-findings', 'trends', 'targets'],
    standards: ['iso-14067'],
    cues: ['Per-product footprints front and centre', 'What changed this year, in plain language', 'Honest about what is not yet measured'],
  },
  {
    value: 'compliance' as const,
    label: 'Compliance',
    description: 'The full technical document, standards-first',
    audience: 'regulators' as const,
    template: 'data-dense',
    sections: ['executive-summary', 'scope-1-2-3', 'trends', 'key-findings', 'product-footprints', 'supply-chain', 'governance', 'targets', 'transition-roadmap', 'risks-and-opportunities', 'methodology', 'regulatory'],
    standards: ['csrd', 'iso-14064', 'gri'],
    cues: ['Framework compliance (CSRD, GRI, ISO)', 'Methodology transparency and data quality', 'Complete disclosure, tables before stories'],
  },
  {
    value: 'investors' as const,
    label: 'Investors &amp; Board'.replace('&amp;', '&'),
    description: 'Financially focused board brief',
    audience: 'investors' as const,
    template: 'executive',
    sections: ['executive-summary', 'scope-1-2-3', 'targets', 'risks-and-opportunities', 'trends', 'transition-roadmap', 'key-findings', 'governance'],
    standards: ['csrd', 'tcfd'],
    cues: ['Material risks, targets and transition economics first', 'Emissions connected to cost and revenue exposure', 'Board-brief register: landscape, metrics-led'],
  },
  {
    value: 'supply-chain' as const,
    label: 'Supply Chain Partners',
    description: 'Collaborative, with mutual goals',
    audience: 'supply-chain' as const,
    template: 'modern',
    sections: ['executive-summary', 'scope-1-2-3', 'supply-chain', 'key-findings', 'targets', 'transition-roadmap'],
    standards: ['ghg-protocol'],
    cues: ['Shared footprint and joint achievements', 'What we ask of partners next, and the support offered', 'Mutual goals over one-way reporting'],
  },
];

export const AUDIENCE_TYPES = [
  { value: 'investors' as const, label: 'Investors & Shareholders', description: 'Financial focus, ROI, risk assessment' },
  { value: 'regulators' as const, label: 'Regulatory Bodies', description: 'Compliance-focused, technical detail' },
  { value: 'customers' as const, label: 'Customers & Consumers', description: 'Accessible language, product focus' },
  { value: 'internal' as const, label: 'Internal Stakeholders', description: 'Operational focus, actionable insights' },
  { value: 'supply-chain' as const, label: 'Supply Chain Partners', description: 'Collaborative tone, mutual goals' },
  { value: 'technical' as const, label: 'Technical/Scientific Audience', description: 'Detailed methodology, peer review' },
];

export const REPORTING_STANDARDS = [
  { id: 'csrd', label: 'CSRD', fullName: 'Corporate Sustainability Reporting Directive', scope: 'EU Mandatory Reporting', recommended: true, platformSupport: 'full' as const },
  { id: 'iso-14067', label: 'ISO 14067', fullName: 'Product Carbon Footprint', scope: 'International Standard', recommended: true, platformSupport: 'full' as const },
  { id: 'gri', label: 'GRI', fullName: 'Global Reporting Initiative', scope: 'Universal Sustainability Reporting', recommended: false, platformSupport: 'partial' as const },
  { id: 'tcfd', label: 'TCFD', fullName: 'Task Force on Climate-related Financial Disclosures', scope: 'Climate Risk Reporting', recommended: false, platformSupport: 'partial' as const },
  { id: 'cdp', label: 'CDP', fullName: 'Carbon Disclosure Project', scope: 'Environmental Disclosure', recommended: false, platformSupport: 'partial' as const },
  { id: 'iso-14064', label: 'ISO 14064', fullName: 'GHG Accounting & Verification', scope: 'International Standard', recommended: false, platformSupport: 'full' as const },
  { id: 'sasb', label: 'SASB', fullName: 'Sustainability Accounting Standards Board', scope: 'Industry-Specific Standards', recommended: false, platformSupport: 'partial' as const },
  { id: 'tnfd', label: 'TNFD', fullName: 'Taskforce on Nature-related Financial Disclosures', scope: 'Nature & Biodiversity', recommended: false, platformSupport: 'beta' as const },
];

export const SECTION_LABELS: Record<string, string> = {
  'executive-summary': 'Executive Summary',
  'company-overview': 'Company Overview',
  'scope-1-2-3': 'Scope 1/2/3 Emissions Breakdown',
  'ghg-inventory': 'GHG Gas Inventory (ISO 14067)',
  'carbon-origin': 'Carbon Origin Breakdown',
  'product-footprints': 'Product Environmental Impacts',
  'multi-capital': 'Multi-capital Impacts',
  'impact-valuation': 'Impact Valuation',
  'people-culture': 'People & Culture',
  'governance': 'Governance',
  'community-impact': 'Community Impact',
  'supply-chain': 'Supply Chain Analysis',
  facilities: 'Facility Emissions Breakdown',
  'tnfd-nature': 'TNFD Nature & Biodiversity',
  'key-findings': 'Key Findings & Change Drivers',
  trends: 'Year-over-Year Trends',
  targets: 'Targets & Action Plans',
  methodology: 'Methodology & Data Quality',
  regulatory: 'Regulatory Compliance',
  appendix: 'Technical Appendix',
};

export const STANDARDS_LABELS: Record<string, string> = {
  csrd: 'CSRD',
  'iso-14067': 'ISO 14067',
  gri: 'GRI',
  tcfd: 'TCFD',
  cdp: 'CDP',
  'iso-14064': 'ISO 14064',
  sasb: 'SASB',
  tnfd: 'TNFD',
};

export const AUDIENCE_LABELS: Record<string, string> = {
  investors: 'Investors & Shareholders',
  regulators: 'Regulatory Bodies',
  customers: 'Customers & Consumers',
  internal: 'Internal Stakeholders',
  'supply-chain': 'Supply Chain Partners',
  technical: 'Technical/Scientific Audience',
};
