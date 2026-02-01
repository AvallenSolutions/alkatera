// ============================================================================
// Shared types and constants for the Report Builder
// ============================================================================

export interface ReportConfig {
  reportName: string;
  reportYear: number;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  audience: 'investors' | 'regulators' | 'customers' | 'internal' | 'supply-chain' | 'technical';
  outputFormat: 'pptx';
  standards: string[];
  sections: string[];
  branding: {
    logo: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
  isMultiYear?: boolean;
  reportYears?: number[];
}

export interface ReportDefaults {
  branding: ReportConfig['branding'];
  audience: ReportConfig['audience'];
  standards: string[];
}

export interface SectionDefinition {
  id: string;
  label: string;
  description: string;
  required: boolean;
  category: string;
  comingSoon?: boolean;
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
    comingSoon: true,
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
    comingSoon: true,
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
  'Value Chain',
  'Operations',
  'Performance',
  'Strategy',
  'Compliance',
  'Technical',
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
  { id: 'tnfd', label: 'TNFD', fullName: 'Taskforce on Nature-related Financial Disclosures', scope: 'Nature & Biodiversity', recommended: false, platformSupport: 'emerging' as const },
];

export const SECTION_LABELS: Record<string, string> = {
  'executive-summary': 'Executive Summary',
  'company-overview': 'Company Overview',
  'scope-1-2-3': 'Scope 1/2/3 Emissions Breakdown',
  'ghg-inventory': 'GHG Gas Inventory (ISO 14067)',
  'carbon-origin': 'Carbon Origin Breakdown',
  'product-footprints': 'Product Environmental Impacts',
  'multi-capital': 'Multi-capital Impacts',
  'supply-chain': 'Supply Chain Analysis',
  facilities: 'Facility Emissions Breakdown',
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
