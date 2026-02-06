/**
 * ISO 14044 Compliance Checker
 *
 * Evaluates completion status of each ISO 14044 section for a given PCF record.
 * Used by ComplianceTracker and ComplianceWizard to show users what's done and what's missing.
 */

export interface ComplianceSection {
  id: string;
  title: string;
  isoRef: string;
  description: string;
  status: 'complete' | 'incomplete' | 'not_started';
  completedItems: number;
  totalItems: number;
  items: ComplianceItem[];
}

export interface ComplianceItem {
  id: string;
  label: string;
  hint: string;
  complete: boolean;
  required: boolean;
}

export interface ComplianceResult {
  sections: ComplianceSection[];
  overallScore: number; // 0-100
  completedSections: number;
  totalSections: number;
  requiredActionCount: number;
}

export interface PcfComplianceData {
  // Goal & Scope fields
  intended_application?: string | null;
  reasons_for_study?: string | null;
  intended_audience?: string[] | null;
  is_comparative_assertion?: boolean | null;
  assumptions_limitations?: any[] | null;
  data_quality_requirements?: any | null;
  critical_review_type?: string | null;
  critical_review_justification?: string | null;
  cutoff_criteria?: string | null;  // ISO 14044 4.2.3.3.2
  // Core LCA fields
  functional_unit?: string | null;
  system_boundary?: string | null;
  reference_year?: number | null;
  aggregated_impacts?: any | null;
  dqi_score?: number | null;
  // Related data presence
  hasMaterials?: boolean;
  hasInterpretation?: boolean;
  interpretationData?: {
    completeness_score?: number | null;
    methodology_consistent?: boolean | null;
    key_findings?: string[] | null;
    sensitivity_results?: any[] | null;
  } | null;
  hasReview?: boolean;
  reviewData?: {
    status?: string | null;
    is_approved?: boolean | null;
    reviewers?: any[] | null;
    reviewer_statement?: string | null;
  } | null;
  // ISO 14044 Data Quality Assessment (from lib/data-quality-assessment.ts)
  dataQualityAssessment?: {
    overallDqi?: number;                    // 0-100 pedigree-based score
    overallConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
    weightedUncertainty?: number;           // Propagated uncertainty %
    temporalCoverage?: {
      staleMaterialCount?: number;
      staleImpactShare?: number;            // % of impact using >3yr old data
    };
    qualityFlags?: Array<{
      severity: 'critical' | 'warning' | 'info';
      code: string;
      message: string;
    }>;
    isoCompliant?: boolean;
    complianceGaps?: string[];
  } | null;
}

export function evaluateCompliance(data: PcfComplianceData): ComplianceResult {
  const sections: ComplianceSection[] = [];

  // 1. Goal Definition (ISO 14044 Section 4.2.2)
  const goalItems: ComplianceItem[] = [
    {
      id: 'intended_application',
      label: 'Intended application',
      hint: 'Describe how this LCA will be used (e.g., product improvement, marketing, EPD publication)',
      complete: !!data.intended_application?.trim(),
      required: true,
    },
    {
      id: 'reasons_for_study',
      label: 'Reasons for the study',
      hint: 'Why is this LCA being carried out? (e.g., regulatory requirement, customer request)',
      complete: !!data.reasons_for_study?.trim(),
      required: true,
    },
    {
      id: 'intended_audience',
      label: 'Intended audience',
      hint: 'Who will see this report? Select all relevant audiences',
      complete: (data.intended_audience?.length || 0) > 0,
      required: true,
    },
    {
      id: 'comparative_assertion',
      label: 'Comparative assertion declared',
      hint: 'Will this LCA be used to compare products publicly? If yes, an external panel review is required',
      complete: data.is_comparative_assertion !== null && data.is_comparative_assertion !== undefined,
      required: false,
    },
  ];
  sections.push(buildSection('goal', 'Goal Definition', '4.2.2', 'Define the purpose and intended use of this LCA study', goalItems));

  // 2. Scope Definition (ISO 14044 Section 4.2.3)
  const scopeItems: ComplianceItem[] = [
    {
      id: 'functional_unit',
      label: 'Functional unit defined',
      hint: 'The quantified performance of the product system (e.g., "250ml bottle of pressé")',
      complete: !!data.functional_unit?.trim(),
      required: true,
    },
    {
      id: 'system_boundary',
      label: 'System boundary defined',
      hint: 'What lifecycle stages are included? (e.g., cradle-to-gate, cradle-to-grave)',
      complete: !!data.system_boundary?.trim(),
      required: true,
    },
    {
      id: 'cutoff_criteria',
      label: 'Cut-off criteria documented',
      hint: 'ISO 14044 4.2.3.3.2: Document which flows are excluded and the materiality threshold (e.g., "flows <1% excluded")',
      complete: !!data.cutoff_criteria?.trim(),
      required: true,
    },
    {
      id: 'assumptions',
      label: 'Assumptions & limitations documented',
      hint: 'List at least one assumption or limitation of this study (e.g., "Transport distances estimated")',
      complete: (data.assumptions_limitations?.length || 0) > 0,
      required: true,
    },
    {
      id: 'reference_year',
      label: 'Reference year set',
      hint: 'The year the data represents',
      complete: !!data.reference_year,
      required: true,
    },
  ];
  sections.push(buildSection('scope', 'Scope Definition', '4.2.3', 'Define what is included in the assessment boundary', scopeItems));

  // 3. Data Quality (ISO 14044 Section 4.2.3.6)
  const dqr = data.data_quality_requirements || {};
  const dqa = data.dataQualityAssessment || {};
  const dataQualityItems: ComplianceItem[] = [
    {
      id: 'temporal_coverage',
      label: 'Temporal coverage',
      hint: 'What time period does the data cover? (e.g., "2024-2025")',
      complete: !!dqr.temporal_coverage?.trim(),
      required: true,
    },
    {
      id: 'geographic_coverage',
      label: 'Geographic coverage',
      hint: 'What geographic region does the data represent? (e.g., "UK", "EU average")',
      complete: !!dqr.geographic_coverage?.trim(),
      required: true,
    },
    {
      id: 'technological_coverage',
      label: 'Technological coverage',
      hint: 'What technology level does the data represent? (e.g., "Industry average", "Best available")',
      complete: !!dqr.technological_coverage?.trim(),
      required: true,
    },
    {
      id: 'precision',
      label: 'Data precision assessed',
      hint: 'How precise is your data? High = verified primary data, Medium = mix, Low = mostly estimates',
      complete: !!dqr.precision,
      required: false,
    },
    {
      id: 'completeness',
      label: 'Completeness estimated',
      hint: 'What percentage of relevant data flows are covered? Aim for 95%+ for ISO compliance',
      complete: (dqr.completeness || 0) > 0,
      required: false,
    },
    {
      id: 'pedigree_matrix',
      label: 'Pedigree Matrix assessment',
      hint: 'ISO 14044: 5-dimensional data quality scoring (reliability, completeness, temporal, geographic, technological)',
      complete: (dqa.overallDqi || 0) >= 60,
      required: true,
    },
    {
      id: 'uncertainty_analysis',
      label: 'Uncertainty quantified',
      hint: 'ISO 14044 4.5.3.3: Propagated uncertainty through all materials (<40% recommended)',
      complete: (dqa.weightedUncertainty || 100) <= 50,
      required: true,
    },
    {
      id: 'temporal_representativeness',
      label: 'Data temporally representative',
      hint: 'Less than 20% of impact should use data >3 years old',
      complete: (dqa.temporalCoverage?.staleImpactShare || 100) <= 20,
      required: true,
    },
  ];
  sections.push(buildSection('data_quality', 'Data Quality', '4.2.3.6', 'Document the quality and coverage of your data sources', dataQualityItems));

  // 4. Life Cycle Inventory (ISO 14044 Section 4.3)
  const inventoryItems: ComplianceItem[] = [
    {
      id: 'materials_added',
      label: 'Materials / ingredients added',
      hint: 'Add all raw materials and ingredients that make up your product',
      complete: !!data.hasMaterials,
      required: true,
    },
    {
      id: 'lca_calculated',
      label: 'LCA calculation completed',
      hint: 'Run the LCA calculator to compute environmental impacts from your inventory data',
      complete: !!data.aggregated_impacts,
      required: true,
    },
    {
      id: 'dqi_acceptable',
      label: 'Data quality score acceptable (>70%)',
      hint: 'A DQI of 70%+ indicates sufficient data quality for ISO compliance. Improve by adding supplier EPDs',
      complete: (data.dqi_score || 0) >= 70,
      required: false,
    },
  ];
  sections.push(buildSection('inventory', 'Life Cycle Inventory', '4.3', 'Collect and calculate data for all material and energy flows', inventoryItems));

  // 5. Impact Assessment (ISO 14044 Section 4.4)
  const impactItems: ComplianceItem[] = [
    {
      id: 'climate_impact',
      label: 'Climate change impact calculated',
      hint: 'GWP100 result in kg CO₂eq — this is automatically calculated from your inventory',
      complete: (data.aggregated_impacts?.climate_change_gwp100 || 0) > 0,
      required: true,
    },
    {
      id: 'multiple_categories',
      label: 'Multiple impact categories assessed',
      hint: 'ISO 14044 requires assessing more than just climate. Water, land use, and resource impacts should be included',
      complete: hasMultipleImpactCategories(data.aggregated_impacts),
      required: true,
    },
  ];
  sections.push(buildSection('impact', 'Impact Assessment', '4.4', 'Calculate environmental impacts across multiple categories', impactItems));

  // 6. Life Cycle Interpretation (ISO 14044 Section 4.5)
  const interpData = data.interpretationData;
  const interpretationItems: ComplianceItem[] = [
    {
      id: 'interpretation_generated',
      label: 'Interpretation generated',
      hint: 'Click "Generate Interpretation" on the Interpretation tab to run contribution, sensitivity, and completeness analyses',
      complete: !!data.hasInterpretation,
      required: true,
    },
    {
      id: 'completeness_check',
      label: 'Completeness check passed (>80%)',
      hint: 'The interpretation engine checks that sufficient data is available across all lifecycle stages',
      complete: (interpData?.completeness_score || 0) >= 80,
      required: true,
    },
    {
      id: 'consistency_check',
      label: 'Consistency check passed',
      hint: 'Verifies that the same methodology, data sources, and assumptions are applied consistently',
      complete: interpData?.methodology_consistent === true,
      required: true,
    },
    {
      id: 'sensitivity_analysis',
      label: 'Sensitivity analysis completed',
      hint: 'Shows how results change when key inputs vary by ±10%. Identifies which parameters matter most',
      complete: (interpData?.sensitivity_results?.length || 0) > 0,
      required: true,
    },
    {
      id: 'conclusions',
      label: 'Conclusions documented',
      hint: 'Key findings, limitations, and recommendations should be reviewed and accepted',
      complete: (interpData?.key_findings?.length || 0) > 0,
      required: true,
    },
  ];
  sections.push(buildSection('interpretation', 'Life Cycle Interpretation', '4.5', 'Analyse results to identify significant issues and draw conclusions', interpretationItems));

  // 7. Critical Review (ISO 14044 Section 6)
  const reviewData = data.reviewData;
  const isComparative = data.is_comparative_assertion === true;
  const criticalReviewItems: ComplianceItem[] = [
    {
      id: 'review_type_set',
      label: 'Review type selected',
      hint: isComparative
        ? 'Comparative assertions REQUIRE an external panel review per ISO 14044 Section 6'
        : 'Choose internal, external expert, or external panel review depending on the intended use',
      complete: !!data.critical_review_type && data.critical_review_type !== 'none',
      required: isComparative,
    },
    {
      id: 'review_initiated',
      label: 'Review initiated',
      hint: 'Start the review process and assign at least one reviewer',
      complete: !!data.hasReview,
      required: isComparative,
    },
    {
      id: 'review_approved',
      label: 'Review approved',
      hint: 'The reviewer has approved the study after addressing all comments',
      complete: reviewData?.is_approved === true,
      required: false,
    },
    {
      id: 'reviewer_statement',
      label: 'Reviewer statement provided',
      hint: 'The reviewer provides a formal statement on the study\'s compliance with ISO 14044',
      complete: !!reviewData?.reviewer_statement?.trim(),
      required: false,
    },
  ];
  sections.push(buildSection('review', 'Critical Review', '6', 'Independent review of the LCA study for quality and compliance', criticalReviewItems));

  // Calculate overall score
  const totalRequired = sections.reduce((sum, s) => sum + s.items.filter(i => i.required).length, 0);
  const completedRequired = sections.reduce((sum, s) => sum + s.items.filter(i => i.required && i.complete).length, 0);
  const overallScore = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;

  const completedSections = sections.filter(s => s.status === 'complete').length;
  const requiredActionCount = sections.reduce((sum, s) => sum + s.items.filter(i => i.required && !i.complete).length, 0);

  return {
    sections,
    overallScore,
    completedSections,
    totalSections: sections.length,
    requiredActionCount,
  };
}

function buildSection(
  id: string,
  title: string,
  isoRef: string,
  description: string,
  items: ComplianceItem[],
): ComplianceSection {
  const completedItems = items.filter(i => i.complete).length;
  const totalItems = items.length;
  const requiredComplete = items.filter(i => i.required).every(i => i.complete);
  const anyComplete = completedItems > 0;

  return {
    id,
    title,
    isoRef,
    description,
    status: requiredComplete ? 'complete' : anyComplete ? 'incomplete' : 'not_started',
    completedItems,
    totalItems,
    items,
  };
}

function hasMultipleImpactCategories(impacts: any): boolean {
  if (!impacts) return false;
  let count = 0;
  if ((impacts.climate_change_gwp100 || 0) > 0) count++;
  if ((impacts.water_consumption || 0) > 0) count++;
  if ((impacts.land_use || 0) > 0) count++;
  if ((impacts.fossil_resource_scarcity || 0) > 0) count++;
  if ((impacts.terrestrial_ecotoxicity || 0) > 0) count++;
  if ((impacts.freshwater_eutrophication || 0) > 0) count++;
  return count >= 2;
}

// Contextual help text for each field across all forms
export const FIELD_HELP: Record<string, { what: string; why: string; example: string }> = {
  intended_application: {
    what: 'How will this LCA report be used?',
    why: 'ISO 14044 requires stating the intended application so readers understand the context and any limitations of the study.',
    example: 'To identify environmental hotspots in our packaging supply chain and support eco-design decisions for our 2026 product range.',
  },
  reasons_for_study: {
    what: 'Why is this LCA being carried out?',
    why: 'Documenting the motivation helps readers assess whether the study scope is appropriate for its conclusions.',
    example: 'CSRD reporting obligation under ESRS E1, combined with customer requests for product-level carbon footprint data.',
  },
  intended_audience: {
    what: 'Who will read or use this report?',
    why: 'The audience determines how much technical detail is needed and whether a critical review is required.',
    example: 'Internal management and board for strategic decisions; customers for B2B sustainability reporting.',
  },
  comparative_assertion: {
    what: 'Will this LCA compare your product to competitors or alternatives?',
    why: 'ISO 14044 requires an external panel critical review if the LCA makes public comparative assertions.',
    example: 'Yes — if you plan to say "Our product has 30% less carbon than Brand X" in public materials.',
  },
  assumptions_limitations: {
    what: 'What assumptions were made? What are the known limitations?',
    why: 'Transparency about assumptions is essential for ISO compliance and helps readers interpret results correctly.',
    example: 'Transport distances estimated from supplier postcodes. Steady-state production assumed. No capital goods included.',
  },
  temporal_coverage: {
    what: 'What time period does your data cover?',
    why: 'Data should be representative of current conditions. Older data may not reflect current processes.',
    example: '2024-2025 (most recent full production year)',
  },
  geographic_coverage: {
    what: 'What geographic region does your data represent?',
    why: 'Environmental impacts vary significantly by region (e.g., electricity grid mix, water scarcity).',
    example: 'UK for production; EU average for imported packaging materials; global average for citric acid.',
  },
  technological_coverage: {
    what: 'What level of technology does your data represent?',
    why: 'Technology differences affect emissions. Best-available technology has lower impacts than industry average.',
    example: 'Industry average for glass production; site-specific for our brewing operations.',
  },
  critical_review_type: {
    what: 'What type of independent review will this study undergo?',
    why: 'ISO 14044 recommends critical review for public studies and requires it for comparative assertions.',
    example: 'External expert review for an EPD publication; external panel for comparative marketing claims.',
  },
  critical_review_justification: {
    what: 'Why was this review type chosen?',
    why: 'Documents the rationale for the review approach selected.',
    example: 'External expert review selected as the study will be published as an EPD but does not make comparative assertions.',
  },
  cutoff_criteria: {
    what: 'What flows are excluded from the study and why?',
    why: 'ISO 14044 Section 4.2.3.3.2 requires documenting which processes or flows are excluded based on materiality thresholds.',
    example: 'Flows contributing <1% of total mass and <1% of total environmental impact are excluded. Capital goods excluded per ISO 14067 Clause 6.3.5.',
  },
  pedigree_matrix: {
    what: 'Has the 5-dimensional data quality matrix been assessed?',
    why: 'ISO 14044 Section 4.2.3.6 requires systematic assessment of reliability, completeness, temporal, geographic, and technological representativeness.',
    example: 'Overall DQI of 75% based on weighted pedigree scores: Reliability 2.3, Completeness 2.8, Temporal 2.1, Geographic 3.0, Technological 2.5.',
  },
  uncertainty_analysis: {
    what: 'Has uncertainty been quantified and propagated through the model?',
    why: 'ISO 14044 Section 4.5.3.3 requires uncertainty analysis in interpretation. Propagated uncertainty helps assess result reliability.',
    example: 'Overall uncertainty ±28% (95% CI) propagated from material-level uncertainties using root-sum-of-squares.',
  },
  temporal_representativeness: {
    what: 'Is the data temporally representative of current conditions?',
    why: 'Using outdated data reduces result accuracy. ISO 14044 recommends data <3 years old for most applications.',
    example: 'Average data age 2.1 years. 12% of impact uses data >3 years old (glass packaging factors from 2021 LCA).',
  },
};

// Smart defaults that can be pre-populated
export const SMART_DEFAULTS = {
  assumptions: [
    'Steady-state production conditions assumed',
    'Transport distances estimated from supplier postcode data',
    'End-of-life scenarios based on UK average recycling rates',
    'Capital goods excluded per cut-off criteria (<1% contribution)',
    'Water treatment processes based on regional average data',
  ],
  intended_application_suggestions: [
    'Internal product development and eco-design decisions',
    'CSRD / ESRS E1 corporate sustainability reporting',
    'Environmental Product Declaration (EPD) publication',
    'Customer / B2B sustainability reporting',
    'Marketing and public communication of environmental performance',
    'Supply chain optimisation and hotspot identification',
  ],
  reasons_suggestions: [
    'CSRD reporting obligation under ESRS E1',
    'Customer request for product-level carbon footprint data',
    'Internal sustainability target monitoring',
    'Environmental Product Declaration (EPD) registration',
    'Regulatory compliance with upcoming packaging regulations',
    'Supply chain transparency and Scope 3 reporting',
  ],
  cutoff_criteria_suggestions: [
    'Flows contributing <1% of total mass and <1% of total environmental impact excluded per ISO 14044 Section 4.2.3.3.2',
    'Capital goods excluded per ISO 14067 Clause 6.3.5 and PAS 2050 Clause 6.2.4',
    'Administrative and office activities excluded (<0.1% contribution)',
    'Human labour excluded per standard LCA practice',
    'Packaging of raw material inputs included; tertiary transport packaging excluded',
  ],
};
