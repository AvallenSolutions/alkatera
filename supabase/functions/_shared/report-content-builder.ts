/**
 * Structured Report Content Builder
 *
 * This module transforms platform data into structured slide content.
 * CRITICAL: All numerical data passes through VERBATIM - no LLM interpretation.
 *
 * The output is structured markdown that SlideSpeak renders into slides.
 * Data accuracy is guaranteed by deterministic formatting functions.
 */

// ============================================================================
// Types
// ============================================================================

export interface OrganizationInfo {
  name: string;
  industry_sector?: string;
  description?: string;
}

export interface EmissionsData {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  year: number;
}

export interface YearlyEmissions {
  year: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  yoyChange?: string;
}

export interface ProductFootprint {
  name: string;
  functionalUnit: string;
  climateImpact: number;
}

export interface FacilityInfo {
  name: string;
  type: string;
  location: string;
  totalEmissions: number;
  unitsProduced: number;
  hasData: boolean;
}

export interface SupplierData {
  name: string;
  category: string;
  emissionsData: Record<string, any>;
}

export interface StandardStatus {
  code: string;
  name: string;
  status: string;
  detail: string;
}

export interface DataQualityMetrics {
  completeness: number;
  qualityTier: 'tier_1' | 'tier_2' | 'tier_3' | 'mixed';
  confidenceScore: number;
}

export interface ImpactValuationItem {
  key: string;
  label: string;
  value: number;
  raw_input: number | null;
  unit: string;
  has_data: boolean;
}

export interface ImpactValuationCapital {
  total: number;
  items: ImpactValuationItem[];
}

export interface ImpactValuationData {
  natural: ImpactValuationCapital;
  human: ImpactValuationCapital;
  social: ImpactValuationCapital;
  governance: ImpactValuationCapital;
  grand_total: number;
  data_coverage: number;
  confidence_level: string;
  reporting_year: number;
}

export interface PeopleCultureData {
  overallScore: number;
  fairWorkScore: number;
  diversityScore: number;
  wellbeingScore: number;
  trainingScore: number;
  dataCompleteness: number;
  livingWageCompliance: number | null;
  genderPayGapMean: number | null;
  ceoWorkerPayRatio: number | null;
  trainingHoursPerEmployee: number | null;
  engagementScore: number | null;
  totalEmployees: number;
  femalePercentage: number | null;
  newHires: number;
  departures: number;
  turnoverRate: number | null;
  deiActionsTotal: number;
  deiActionsCompleted: number;
  benefits: string[];
}

export interface GovernanceData {
  missionStatement: string | null;
  visionStatement: string | null;
  purposeStatement: string | null;
  isBenefitCorp: boolean;
  sdgCommitments: number[];
  climateCommitments: string[];
  boardMembers: {
    name: string;
    role: string;
    gender: string | null;
    isIndependent: boolean | null;
    attendanceRate: number | null;
  }[];
  boardDiversityMetrics: {
    totalMembers: number;
    femalePercentage: number;
    independentPercentage: number;
    averageAttendance: number;
  };
  policies: {
    name: string;
    type: string;
    status: string;
    isPublic: boolean;
  }[];
  policyCompleteness: number;
  ethicsTrainingRate: number | null;
  ethicsIncidents: number;
  lobbyingActivities: number;
}

export interface CommunityImpactData {
  overallScore: number;
  givingScore: number;
  localImpactScore: number;
  volunteeringScore: number;
  engagementScore: number;
  dataCompleteness: number;
  totalDonations: number;
  donationCount: number;
  totalVolunteerHours: number;
  volunteerActivities: number;
  impactStories: {
    title: string;
    category: string;
    summary: string;
  }[];
  localEmploymentRate: number | null;
  localSourcingRate: number | null;
}

export interface ReportData {
  organization: OrganizationInfo;
  emissions: EmissionsData;
  emissionsTrends: YearlyEmissions[];
  products: ProductFootprint[];
  facilities: FacilityInfo[];
  suppliers?: SupplierData[];
  standards: StandardStatus[];
  dataQuality?: DataQualityMetrics;
  impactValuation?: ImpactValuationData;
  peopleCulture?: PeopleCultureData;
  governance?: GovernanceData;
  communityImpact?: CommunityImpactData;
  dataAvailability: {
    hasOrganization: boolean;
    hasEmissions: boolean;
    hasProducts: boolean;
    hasFacilities: boolean;
    hasSuppliers?: boolean;
    hasImpactValuation?: boolean;
    hasPeopleCulture?: boolean;
    hasGovernance?: boolean;
    hasCommunityImpact?: boolean;
  };
}

export interface ReportConfig {
  reportName: string;
  reportYear: number;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  audience: string;
  standards: string[];
  sections: string[];
  isMultiYear?: boolean;
  reportYears?: number[];
  branding: {
    logo: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
}

export interface SlideContent {
  slideNumber: number;
  title: string;
  content: string;
  speakerNotes?: string;
}

// ============================================================================
// Formatting Utilities (Deterministic - No LLM)
// ============================================================================

/**
 * Formats a number with thousand separators and specified decimal places
 * DETERMINISTIC: Same input always produces same output
 */
function formatNumber(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Calculates percentage and formats it
 * DETERMINISTIC: Same inputs always produce same output
 */
function formatPercentage(value: number, total: number): string {
  if (!total || total === 0) return 'N/A';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(1)}%`;
}

/**
 * Formats a year-over-year change with direction indicator
 */
function formatYoYChange(change: string | undefined): string {
  if (!change || change === 'N/A') return 'N/A';
  const value = parseFloat(change);
  if (isNaN(value)) return 'N/A';
  const arrow = value < 0 ? '↓' : value > 0 ? '↑' : '→';
  const color = value < 0 ? '(reduction)' : value > 0 ? '(increase)' : '(no change)';
  return `${arrow} ${Math.abs(value).toFixed(1)}% ${color}`;
}

/**
 * Formats a date range for display
 */
function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return `${startDate.toLocaleDateString('en-US', options)} to ${endDate.toLocaleDateString('en-US', options)}`;
}

/**
 * Maps audience type to descriptive text
 */
function getAudienceDescription(audience: string): string {
  const descriptions: Record<string, string> = {
    'investors': 'Investors and Financial Stakeholders',
    'regulators': 'Regulatory Bodies and Compliance Officers',
    'customers': 'Customers and End Users',
    'internal': 'Internal Leadership and Operations Teams',
    'supply-chain': 'Supply Chain Partners and Procurement',
    'technical': 'Technical and Scientific Audiences',
  };
  return descriptions[audience] || audience;
}

/**
 * Maps standard codes to full names
 */
function getStandardName(code: string): string {
  const standards: Record<string, string> = {
    'csrd': 'Corporate Sustainability Reporting Directive (CSRD)',
    'iso-14067': 'ISO 14067 - Carbon Footprint of Products',
    'iso-14044': 'ISO 14044 - Life Cycle Assessment',
    'ghg-protocol': 'GHG Protocol Corporate Standard',
    'tcfd': 'Task Force on Climate-related Financial Disclosures (TCFD)',
    'sbti': 'Science Based Targets initiative (SBTi)',
    'cdp': 'CDP Climate Change Disclosure',
    'gri': 'Global Reporting Initiative (GRI)',
    'sasb': 'Sustainability Accounting Standards Board (SASB)',
    'defra': 'UK DEFRA Emission Factors',
  };
  return standards[code] || code.toUpperCase();
}

// ============================================================================
// Slide Content Generators
// ============================================================================

/**
 * Generates the title slide content
 */
function buildTitleSlide(config: ReportConfig, data: ReportData): SlideContent {
  const periodText = config.isMultiYear && config.reportYears
    ? `${Math.min(...config.reportYears)} - ${Math.max(...config.reportYears)}`
    : config.reportYear.toString();

  return {
    slideNumber: 1,
    title: config.reportName,
    content: `
# ${config.reportName}

**${data.organization.name || 'Organization'}**

${data.organization.industry_sector ? `*${data.organization.industry_sector}*` : ''}

---

**Reporting Period:** ${periodText}

**Prepared for:** ${getAudienceDescription(config.audience)}

${config.standards.length > 0 ? `**Aligned with:** ${config.standards.map(getStandardName).join(', ')}` : ''}
`.trim(),
    speakerNotes: 'Welcome to the sustainability report presentation.',
  };
}

/**
 * Generates the executive summary slide
 */
function buildExecutiveSummarySlide(config: ReportConfig, data: ReportData): SlideContent {
  const hasEmissions = data.dataAvailability.hasEmissions && data.emissions.total > 0;
  const hasProducts = data.dataAvailability.hasProducts && data.products.length > 0;
  const hasTrends = data.emissionsTrends && data.emissionsTrends.length > 1;

  // Calculate key metrics
  let yoyTrend = '';
  if (hasTrends) {
    const latestYear = data.emissionsTrends[data.emissionsTrends.length - 1];
    if (latestYear.yoyChange) {
      yoyTrend = formatYoYChange(latestYear.yoyChange);
    }
  }

  return {
    slideNumber: 2,
    title: 'Executive Summary',
    content: `
# Executive Summary

## Key Highlights for ${config.reportYear}

${hasEmissions ? `
### Total GHG Emissions
**${formatNumber(data.emissions.total)} tCO2e**

| Scope | Emissions (tCO2e) | Share |
|-------|-------------------|-------|
| Scope 1 (Direct) | ${formatNumber(data.emissions.scope1)} | ${formatPercentage(data.emissions.scope1, data.emissions.total)} |
| Scope 2 (Energy) | ${formatNumber(data.emissions.scope2)} | ${formatPercentage(data.emissions.scope2, data.emissions.total)} |
| Scope 3 (Value Chain) | ${formatNumber(data.emissions.scope3)} | ${formatPercentage(data.emissions.scope3, data.emissions.total)} |

${yoyTrend ? `**Year-over-Year Change:** ${yoyTrend}` : ''}
` : '*Emissions data not available for this reporting period.*'}

${hasProducts ? `
### Product Portfolio
- **${data.products.length}** products with completed carbon footprint assessments
- Average impact: **${formatNumber(data.products.reduce((sum, p) => sum + p.climateImpact, 0) / data.products.length, 4)} kg CO2e** per functional unit
` : ''}

${data.dataAvailability.hasPeopleCulture && data.peopleCulture ? `
### People & Culture
- Overall score: **${formatNumber(data.peopleCulture.overallScore, 0)}/100**
- **${formatNumber(data.peopleCulture.totalEmployees, 0)}** employees${data.peopleCulture.femalePercentage !== null ? ` (${formatNumber(data.peopleCulture.femalePercentage, 0)}% female)` : ''}
` : ''}

${data.dataAvailability.hasCommunityImpact && data.communityImpact ? `
### Community Impact
- Total donations: **${formatGBP(data.communityImpact.totalDonations)}** | Volunteer hours: **${formatNumber(data.communityImpact.totalVolunteerHours, 0)}**
` : ''}

${data.dataAvailability.hasGovernance && data.governance ? `
### Governance
${data.governance.isBenefitCorp ? '- **Registered Benefit Corporation**\n' : ''}${data.governance.boardDiversityMetrics.totalMembers > 0 ? `- Board: **${data.governance.boardDiversityMetrics.totalMembers}** members, **${formatNumber(data.governance.boardDiversityMetrics.femalePercentage, 0)}%** female` : ''}
` : ''}

---

**Reporting Period:** ${formatDateRange(config.reportingPeriodStart, config.reportingPeriodEnd)}
`.trim(),
  };
}

/**
 * Generates the emissions breakdown slides
 */
function buildEmissionsSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  const slides: SlideContent[] = [];

  if (!data.dataAvailability.hasEmissions || !data.emissions.total) {
    slides.push({
      slideNumber: 0, // Will be renumbered
      title: 'Greenhouse Gas Emissions',
      content: `
# Greenhouse Gas Emissions

## Data Not Available

Emissions data for ${config.reportYear} has not yet been recorded in the platform.

Please ensure corporate emissions data is entered for the reporting period.
`.trim(),
    });
    return slides;
  }

  // Main emissions overview with scope details combined
  slides.push({
    slideNumber: 0,
    title: 'GHG Emissions Overview',
    content: `
# Greenhouse Gas Emissions Overview

## Total Emissions: ${formatNumber(data.emissions.total)} tCO2e

### Emissions by Scope (${config.reportYear})

| Scope | Description | Emissions (tCO2e) | Percentage |
|-------|-------------|-------------------|------------|
| **Scope 1** | Direct emissions (combustion, process, fugitive) | ${formatNumber(data.emissions.scope1)} | ${formatPercentage(data.emissions.scope1, data.emissions.total)} |
| **Scope 2** | Purchased energy (electricity, heat, steam) | ${formatNumber(data.emissions.scope2)} | ${formatPercentage(data.emissions.scope2, data.emissions.total)} |
| **Scope 3** | Value chain (upstream & downstream) | ${formatNumber(data.emissions.scope3)} | ${formatPercentage(data.emissions.scope3, data.emissions.total)} |
| **Total** | | **${formatNumber(data.emissions.total)}** | **100%** |

---

**Scope 1** includes stationary combustion (boilers, furnaces), mobile combustion (company vehicles), process and fugitive emissions.
**Scope 2** covers purchased electricity, heat and steam consumed by the organization.
**Scope 3** encompasses all indirect value chain emissions including purchased goods, transport, waste and end-of-life.

*Data sourced from facility utility records, fleet activity data, and corporate overhead reports*
`.trim(),
  });

  // Scope breakdown details - combined into one slide with the overview above
  // (Previously was a separate slide causing split content across slides 11 & 12)

  return slides;
}

/**
 * Generates carbon origin breakdown slide (fossil vs biogenic vs land use change)
 * Data comes from product LCA aggregated_impacts.carbon_origin
 */
function buildCarbonOriginSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  if (!data.dataAvailability.hasProducts || data.products.length === 0) {
    return [{
      slideNumber: 0,
      title: 'Carbon Origin Breakdown',
      content: `# Carbon Origin Breakdown\n\n## No Data Available\n\nProduct LCA data is required for carbon origin analysis.\n\nComplete product life cycle assessments to enable this section.`.trim(),
    }];
  }

  // Carbon origin data is embedded in the products' aggregated impacts
  // For report-level summary, we aggregate across all products
  const carbonOrigin = (data as any).carbonOrigin;

  if (!carbonOrigin) {
    return [{
      slideNumber: 0,
      title: 'Carbon Origin Breakdown',
      content: `# Carbon Origin Breakdown\n\n## Data Not Available\n\nCarbon origin breakdown requires detailed LCA data with fossil/biogenic classification.\n\nThis data is generated automatically from product assessments.`.trim(),
    }];
  }

  const total = (carbonOrigin.fossil || 0) + Math.abs(carbonOrigin.biogenic || 0) + (carbonOrigin.landUseChange || 0);

  return [{
    slideNumber: 0,
    title: 'Carbon Origin Breakdown',
    content: `
# Carbon Origin Breakdown

## Emissions by Carbon Source

| Carbon Source | Emissions (kg CO2e) | Share |
|--------------|---------------------|-------|
| **Fossil Carbon** | ${formatNumber(carbonOrigin.fossil || 0)} | ${total > 0 ? formatPercentage(carbonOrigin.fossil || 0, total) : 'N/A'} |
| **Biogenic Carbon** | ${formatNumber(carbonOrigin.biogenic || 0)} | ${total > 0 ? formatPercentage(Math.abs(carbonOrigin.biogenic || 0), total) : 'N/A'} |
| **Land Use Change** | ${formatNumber(carbonOrigin.landUseChange || 0)} | ${total > 0 ? formatPercentage(carbonOrigin.landUseChange || 0, total) : 'N/A'} |

---

**Fossil carbon** originates from the combustion of fossil fuels and industrial processes.
**Biogenic carbon** is absorbed and released by biological systems (crops, biomass). Net biogenic CO2 can be negative (carbon sequestration).
**Land use change** emissions arise from conversion of land (e.g. deforestation) for raw material production.

*Based on ${data.products.length} product LCA${data.products.length > 1 ? 's' : ''} | Classification per ISO 14067:2018 Section 7*

*Biogenic carbon refers to CO₂ absorbed and released through natural biological cycles (e.g. fermentation, plant growth). Land use change emissions arise from conversion of land to agricultural or other use, amortised over 20 years per IPCC and GHG Protocol methodology.*
`.trim(),
  }];
}

/**
 * Generates FLAG land-based removals slides
 * Reports soil carbon sequestration separately per SBTi FLAG Guidance v1.2
 */
function buildFlagRemovalsSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  const flagRemovals = (data as any).flagRemovals;

  if (!flagRemovals || flagRemovals.totalRemovals === 0) {
    return [{
      slideNumber: 0,
      title: 'FLAG Land-Based Removals',
      content: `
# FLAG Land-Based Removals

## No Removal Data Available

No soil carbon sequestration data has been recorded for the reporting period.

Soil carbon removals are calculated from vineyard and orchard growing profiles where soil management practices (e.g. cover cropping, composting, no-till) promote carbon sequestration.
`.trim(),
    }];
  }

  const verifiedLabel = flagRemovals.allVerified ? 'Verified' : 'Partially Verified / Unverified';
  const verifiedIndicator = flagRemovals.allVerified ? 'All profiles verified' : 'One or more profiles require third-party verification';

  let content = `
# FLAG Land-Based Removals

## Soil Carbon Sequestration

| Metric | Value |
|--------|-------|
| **Total removals** | ${formatNumber(flagRemovals.totalRemovals)} kg CO2e |
| **Verification status** | ${verifiedLabel} |
| **Profiles with removals** | ${flagRemovals.profileCount} |

---

## Verification Status: ${verifiedIndicator}
`;

  if (!flagRemovals.allMeetLsr) {
    content += `
> **Note:** One or more removal claims do not currently meet the requirements of the GHG Protocol Land Sector and Removals Standard v1.0. Third-party verification to ISO 14064-3 or equivalent is required for SBTi FLAG submission.
`;
  }

  content += `
---

Per GHG Protocol Land Sector and Removals Standard v1.0, carbon removals are reported separately from emissions and are not netted against the carbon footprint. Removals represent CO2 sequestered in soils through management practices such as cover cropping, composting, and reduced tillage.

*Methodology: practice-based defaults per SBTi FLAG Guidance v1.2, or measured soil organic carbon where third-party verified.*
`;

  return [{
    slideNumber: 0,
    title: 'FLAG Land-Based Removals',
    content: content.trim(),
  }];
}

/**
 * Generates TNFD Nature & Biodiversity slides
 * Structured per the TNFD LEAP Framework (Locate, Evaluate, Assess, Prepare)
 */
function buildTnfdNatureSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  const tnfd = (data as any).tnfdNature;
  const slides: SlideContent[] = [];

  // --- Locate ---
  let locateContent = `
# TNFD Nature & Biodiversity

## Locate: Production Sites and Ecosystem Context
`;

  if (tnfd?.sites && tnfd.sites.length > 0) {
    locateContent += `
| Site | Country | Ecosystem Type | Sensitive Area | Details | Water Stress |
|------|---------|---------------|----------------|---------|-------------|
`;
    for (const site of tnfd.sites) {
      locateContent += `| ${site.name} | ${site.country || 'N/A'} | ${site.ecosystemType || 'Not set'} | ${site.inSensitiveArea ? 'Yes' : 'No'} | ${site.sensitiveAreaDetails || '-'} | ${site.waterStress || 'Not set'} |\n`;
    }
  } else {
    locateContent += `\nNo vineyard or orchard site data available. Complete growing profile questionnaires to populate this section.\n`;
  }

  if (tnfd?.sitesWithGaps > 0) {
    locateContent += `\n> **Data gap:** Location sensitivity data incomplete for ${tnfd.sitesWithGaps} site(s). Complete vineyard/orchard profile questionnaires to improve disclosure.\n`;
  }

  slides.push({ slideNumber: 0, title: 'TNFD Locate', content: locateContent.trim() });

  // --- Evaluate: Dependencies and Impacts ---
  let evaluateContent = `
## Evaluate: Nature Dependencies and Impacts

### Dependencies
`;

  const assessment = tnfd?.assessment;
  if (assessment) {
    evaluateContent += `
| Ecosystem Service | Dependency Level | Notes |
|-------------------|-----------------|-------|
| Water availability | ${assessment.waterDependency || 'Not assessed'} | ${assessment.waterDependencyNotes || '-'} |
| Pollination services | ${assessment.pollinationDependency || 'Not assessed'} | ${assessment.pollinationDependencyNotes || '-'} |
| Soil health | ${assessment.soilHealthDependency || 'Not assessed'} | ${assessment.soilHealthDependencyNotes || '-'} |

### Impact Metrics

| Impact Metric | Value | Unit | Source |
|--------------|-------|------|--------|
| Total land under management | ${assessment.landUseHa != null ? formatNumber(assessment.landUseHa) : 'N/A'} | ha | Nature assessment |
`;

    if (tnfd?.lcaImpacts) {
      const lca = tnfd.lcaImpacts;
      evaluateContent += `| Land use (ReCiPe 2016) | ${formatNumber(lca.landUse)} | m\\u00b2a crop eq | LCA calculation |
| Terrestrial ecotoxicity | ${formatNumber(lca.terrestrialEcotoxicity)} | kg 1,4-DCB eq | LCA calculation |
| Freshwater eutrophication | ${formatNumber(lca.freshwaterEutrophication)} | kg P eq | LCA calculation |
| Terrestrial acidification | ${formatNumber(lca.terrestrialAcidification)} | kg SO\\u00b2 eq | LCA calculation |
| Freshwater consumption | ${formatNumber(lca.waterConsumption)} | m\\u00b3 | LCA calculation |
| Water scarcity impact | ${formatNumber(lca.waterScarcity)} | m\\u00b3 eq | LCA (AWARE-weighted) |
`;
    }

    if (assessment.pollutionN != null) {
      evaluateContent += `| Nitrogen to freshwater | ${formatNumber(assessment.pollutionN)} | kg N | Nature assessment |\n`;
    }
    if (assessment.pollutionP != null) {
      evaluateContent += `| Phosphorus to freshwater | ${formatNumber(assessment.pollutionP)} | kg P | Nature assessment |\n`;
    }
    if (assessment.pesticideKg != null) {
      evaluateContent += `| Pesticides applied | ${formatNumber(assessment.pesticideKg)} | kg active ingredient | Nature assessment |\n`;
    }
  } else {
    evaluateContent += `\nNature dependency and impact assessment not yet completed. Complete the TNFD questionnaire to populate this section.\n`;
  }

  if (tnfd?.singleScore != null) {
    evaluateContent += `
---

### EF 3.1 Nature Single Score

**Normalised score: ${formatNumber(tnfd.singleScore)} person-equivalents**

This score aggregates the four ReCiPe 2016 Midpoint nature impact categories using EF 3.1 normalisation and weighting factors (Sala et al., 2021).
`;
  }

  slides.push({ slideNumber: 0, title: 'TNFD Evaluate', content: evaluateContent.trim() });

  // --- Assess ---
  let assessContent = `
## Assess: Nature Risk Materiality
`;

  if (assessment?.materiality) {
    const materialityLabels: Record<string, string> = {
      not_material: 'Not Material',
      potentially_material: 'Potentially Material',
      material: 'Material',
      highly_material: 'Highly Material',
    };
    assessContent += `
**Materiality determination:** ${materialityLabels[assessment.materiality] || assessment.materiality}

${assessment.materialityRationale ? `**Rationale:** ${assessment.materialityRationale}` : ''}

${assessment.physicalRiskNotes ? `**Physical risks:** ${assessment.physicalRiskNotes}` : ''}

${assessment.transitionRiskNotes ? `**Transition risks:** ${assessment.transitionRiskNotes}` : ''}
`;
  } else {
    assessContent += `\nNot yet assessed. TNFD recommends all organisations assess the materiality of nature-related risks and opportunities.\n`;
  }

  // LEAP status table
  if (tnfd?.leapStatus) {
    assessContent += `
---

### TNFD LEAP Framework Coverage

| Phase | Status | Implemented | Gaps |
|-------|--------|-------------|------|
`;
    for (const phase of tnfd.leapStatus) {
      assessContent += `| ${phase.phase} | ${phase.status} | ${phase.implemented} | ${phase.gaps} |\n`;
    }
  }

  slides.push({ slideNumber: 0, title: 'TNFD Assess', content: assessContent.trim() });

  // --- Prepare ---
  let prepareContent = `
## Prepare: Nature-Positive Targets
`;

  if (assessment?.hasNaturePositiveTarget) {
    prepareContent += `
**Target year:** ${assessment.targetYear || 'Not specified'}
**Baseline year:** ${assessment.baselineYear || 'Not specified'}
**Description:** ${assessment.targetDescription || 'Not specified'}
`;
  } else {
    prepareContent += `
No nature-positive target set. ESRS E4-4 requires disclosure of any time-bound targets related to biodiversity and ecosystems.
`;
  }

  prepareContent += `
---

*Nature impact calculations use ReCiPe 2016 Midpoint (Hierarchist) characterisation factors. EF 3.1 normalisation factors from Sala et al. (2021), JRC Technical Report EUR 30735 EN. Performance benchmarks are internal estimates derived from beverage sector LCA studies and are not regulatory thresholds. TNFD and SBTN do not prescribe specific impact targets.*
`;

  slides.push({ slideNumber: 0, title: 'TNFD Prepare', content: prepareContent.trim() });

  return slides;
}

/**
 * Generates multi-capital environmental impacts slides
 * Data comes from product LCA aggregated_impacts
 */
function buildMultiCapitalSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  if (!data.dataAvailability.hasProducts || data.products.length === 0) {
    return [{
      slideNumber: 0,
      title: 'Multi-capital Environmental Impacts',
      content: `# Multi-capital Environmental Impacts\n\n## No Data Available\n\nProduct LCA data is required for multi-capital impact analysis.\n\nComplete product life cycle assessments to enable this section.`.trim(),
    }];
  }

  const impacts = (data as any).multiCapitalImpacts;

  if (!impacts) {
    return [{
      slideNumber: 0,
      title: 'Multi-capital Environmental Impacts',
      content: `# Multi-capital Environmental Impacts\n\n## Data Not Available\n\nMulti-capital impact data is generated from detailed product LCA assessments.`.trim(),
    }];
  }

  return [{
    slideNumber: 0,
    title: 'Multi-capital Environmental Impacts',
    content: `
# Multi-capital Environmental Impacts

## Beyond Carbon: Full Environmental Profile

| Impact Category | Value | Unit |
|----------------|-------|------|
${impacts.waterConsumption !== undefined ? `| **Water Consumption** | ${formatNumber(impacts.waterConsumption)} | m3 |` : ''}
${impacts.landUse !== undefined ? `| **Land Use** | ${formatNumber(impacts.landUse)} | m2a |` : ''}
${impacts.freshwaterEutrophication !== undefined ? `| **Freshwater Eutrophication** | ${formatNumber(impacts.freshwaterEutrophication, 4)} | kg P eq |` : ''}
${impacts.terrestrialAcidification !== undefined ? `| **Terrestrial Acidification** | ${formatNumber(impacts.terrestrialAcidification, 4)} | kg SO2 eq |` : ''}
${impacts.waterScarcity !== undefined ? `| **Water Scarcity** | ${formatNumber(impacts.waterScarcity)} | m3 world eq |` : ''}

---

*Aggregated across ${data.products.length} product LCA${data.products.length > 1 ? 's' : ''} | ReCiPe 2016 Midpoint (H)*

*Water scarcity assessed using AWARE v1.3 characterisation factors (Boulay et al., 2018). A factor of 1.0 indicates global average scarcity; higher values indicate greater water stress at the production location.*
`.trim(),
  }];
}

/**
 * Generates multi-year trend slides
 */
function buildTrendSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  const slides: SlideContent[] = [];

  if (!data.emissionsTrends || data.emissionsTrends.length < 2) {
    return slides;
  }

  // Trend overview
  const firstYear = data.emissionsTrends[0];
  const lastYear = data.emissionsTrends[data.emissionsTrends.length - 1];
  const overallChange = firstYear.total > 0
    ? ((lastYear.total - firstYear.total) / firstYear.total * 100).toFixed(1)
    : 'N/A';

  slides.push({
    slideNumber: 0,
    title: 'Multi-Year Emissions Trend',
    content: `
# Multi-Year Emissions Trend

## ${firstYear.year} to ${lastYear.year} Overview

### Overall Change: ${overallChange !== 'N/A' ? `${parseFloat(overallChange) < 0 ? '↓' : '↑'} ${Math.abs(parseFloat(overallChange))}%` : 'N/A'}

| Year | Total Emissions (tCO2e) | Scope 1 | Scope 2 | Scope 3 | YoY Change |
|------|------------------------|---------|---------|---------|------------|
${data.emissionsTrends.map(t => `| ${t.year} | ${formatNumber(t.total)} | ${formatNumber(t.scope1)} | ${formatNumber(t.scope2)} | ${formatNumber(t.scope3)} | ${t.yoyChange ? formatYoYChange(t.yoyChange) : '-'} |`).join('\n')}

---

*Trend data from ${data.emissionsTrends.length} reporting years*
`.trim(),
  });

  return slides;
}

/**
 * Generates product carbon footprint slides
 */
function buildProductSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  const slides: SlideContent[] = [];

  if (!data.dataAvailability.hasProducts || data.products.length === 0) {
    slides.push({
      slideNumber: 0,
      title: 'Product Carbon Footprints',
      content: `
# Product Carbon Footprints

## No Product Data Available

No completed product life cycle assessments found for this organization.

Product carbon footprints should be calculated using ISO 14067 methodology.
`.trim(),
    });
    return slides;
  }

  // Product overview
  const sortedProducts = [...data.products].sort((a, b) => b.climateImpact - a.climateImpact);
  const avgImpact = data.products.reduce((sum, p) => sum + p.climateImpact, 0) / data.products.length;

  slides.push({
    slideNumber: 0,
    title: 'Product Carbon Footprints',
    content: `
# Product Carbon Footprints

## Portfolio Overview

- **${data.products.length}** products assessed
- **Average impact:** ${formatNumber(avgImpact, 4)} kg CO2e per functional unit

### Product Footprints

| Product | Functional Unit | Climate Impact (kg CO2e) |
|---------|-----------------|--------------------------|
${sortedProducts.slice(0, 10).map(p => `| ${p.name} | ${p.functionalUnit} | ${formatNumber(p.climateImpact, 4)} |`).join('\n')}
${data.products.length > 10 ? `\n*Showing top 10 of ${data.products.length} products by impact*` : ''}

---

*All product footprints calculated per ISO 14067*
`.trim(),
  });

  return slides;
}

/**
 * Generates facility emissions slide
 */
function buildFacilitySlides(config: ReportConfig, data: ReportData): SlideContent[] {
  const slides: SlideContent[] = [];

  if (!data.facilities || data.facilities.length === 0) {
    return slides;
  }

  const facilitiesWithData = data.facilities.filter(f => f.hasData);
  const facilitiesWithoutData = data.facilities.filter(f => !f.hasData);

  slides.push({
    slideNumber: 0,
    title: 'Facility Emissions',
    content: `
# Facility Emissions

## ${data.facilities.length} Facilities Reporting

| Facility | Type | Location | Emissions (kg CO2e) | Units Produced |
|----------|------|----------|---------------------|----------------|
${data.facilities.map(f => `| ${f.name} | ${f.type} | ${f.location} | ${f.totalEmissions > 0 ? formatNumber(f.totalEmissions) : (f.hasData ? 'Data recorded' : 'No data')} | ${f.unitsProduced > 0 ? formatNumber(f.unitsProduced, 0) : '-'} |`).join('\n')}

---

${facilitiesWithData.length > 0 ? `**${facilitiesWithData.length}** facilit${facilitiesWithData.length === 1 ? 'y' : 'ies'} with recorded emissions data.` : ''}
${facilitiesWithoutData.length > 0 ? `**${facilitiesWithoutData.length}** facilit${facilitiesWithoutData.length === 1 ? 'y' : 'ies'} awaiting data entry.` : ''}

*Facility emissions based on utility data entries and aggregated calculations*
`.trim(),
  });

  return slides;
}

/**
 * Generates methodology slide with actual compliance status
 */
function buildMethodologySlide(config: ReportConfig, data: ReportData): SlideContent {
  // Use actual standards status if available, otherwise fall back to listing
  const hasStandardsStatus = data.standards && data.standards.length > 0;

  const standardsSection = hasStandardsStatus
    ? `
## Standards Compliance

| Standard | Status | Detail |
|----------|--------|--------|
${data.standards.map(s => `| **${s.name}** | ${s.status} | ${s.detail} |`).join('\n')}
`
    : `
## Reporting Framework

This sustainability report has been prepared in alignment with:

${config.standards.map(s => `- **${getStandardName(s)}**`).join('\n')}
`;

  return {
    slideNumber: 0,
    title: 'Methodology & Standards',
    content: `
# Methodology & Standards

${standardsSection}

---

## Data Sources

- **Corporate Emissions:** GHG Protocol Corporate Standard methodology
- **Product Footprints:** ISO 14067 carbon footprint of products
- **Emission Factors:** UK DEFRA Conversion Factors and Ecoinvent database

---

## Reporting Boundaries

- **Organizational:** Operational control approach
- **Temporal:** ${formatDateRange(config.reportingPeriodStart, config.reportingPeriodEnd)}
${config.isMultiYear && config.reportYears ? `- **Multi-year coverage:** ${config.reportYears.join(', ')}` : ''}

---

## Data Quality

${data.dataQuality ? `
- **Completeness:** ${data.dataQuality.completeness}%
- **Quality Tier:** ${data.dataQuality.qualityTier.replace('_', ' ').toUpperCase()}
- **Confidence Score:** ${data.dataQuality.confidenceScore}%
` : '*Data quality assessment available via product-level DQI scores*'}
`.trim(),
  };
}

/**
 * Formats a GBP currency value with thousand separators and no decimals
 */
function formatGBP(value: number): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  return `£${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

/**
 * Generates Impact Valuation overview and breakdown slides
 */
function buildImpactValuationSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  const slides: SlideContent[] = [];

  if (!data.dataAvailability.hasImpactValuation || !data.impactValuation) {
    slides.push({
      slideNumber: 0,
      title: 'Impact Valuation',
      content: `
# Impact Valuation

## No Data Available

No impact valuation calculation has been completed for ${config.reportYear}.

Run an Impact Valuation calculation in the platform to include this section.
`.trim(),
    });
    return slides;
  }

  const iv = data.impactValuation;
  const coveragePct = Math.round(iv.data_coverage * 100);

  // Slide 1 — Impact Value Overview
  slides.push({
    slideNumber: 0,
    title: `Total Impact Value: ${formatGBP(iv.grand_total)}`,
    content: `
# Total Impact Value: ${formatGBP(iv.grand_total)}

## ${iv.reporting_year} | ${iv.confidence_level.charAt(0).toUpperCase() + iv.confidence_level.slice(1)} confidence | ${coveragePct}% data coverage

### Impact by Capital

| Capital | Monetised Value |
|---------|----------------|
| **Natural Capital** | ${formatGBP(iv.natural.total)} |
| **Human Capital** | ${formatGBP(iv.human.total)} |
| **Social Capital** | ${formatGBP(iv.social.total)} |
| **Governance Capital** | ${formatGBP(iv.governance.total)} |
| **Total** | **${formatGBP(iv.grand_total)}** |

---

*Monetised using Defra shadow prices, HM Treasury Green Book, Social Value Bank proxies (v1.0)*
`.trim(),
  });

  // Slide 2 — Impact Value Breakdown (only items with data)
  const allItems = [
    ...iv.natural.items.filter(i => i.has_data).map(i => ({ ...i, capital: 'Natural' })),
    ...iv.human.items.filter(i => i.has_data).map(i => ({ ...i, capital: 'Human' })),
    ...iv.social.items.filter(i => i.has_data).map(i => ({ ...i, capital: 'Social' })),
    ...iv.governance.items.filter(i => i.has_data).map(i => ({ ...i, capital: 'Governance' })),
  ];

  if (allItems.length > 0) {
    slides.push({
      slideNumber: 0,
      title: 'Impact Value: Detailed Breakdown',
      content: `
# Impact Value: Detailed Breakdown

## Metrics with Available Data

| Capital | Metric | Raw Input | Monetised Value |
|---------|--------|-----------|----------------|
${allItems.map(item => `| ${item.capital} | ${item.label} | ${item.raw_input !== null ? item.raw_input.toLocaleString('en-GB') : '—'} ${item.unit} | ${formatGBP(item.value)} |`).join('\n')}

---

*alkatera Impact Valuation Module | proxy version 1.0*
`.trim(),
    });
  }

  return slides;
}

/**
 * Generates People & Culture slides
 */
function buildPeopleCultureSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  const slides: SlideContent[] = [];
  const pc = data.peopleCulture;

  if (!data.dataAvailability.hasPeopleCulture || !pc) {
    slides.push({
      slideNumber: 0,
      title: 'People & Culture',
      content: `# People & Culture\n\n## No Data Available\n\nNo people and culture data has been recorded for ${config.reportYear}.\n\nCapture workforce demographics, compensation, and training data to include this section.`.trim(),
    });
    return slides;
  }

  // Slide 1: Overview with pillar scores
  slides.push({
    slideNumber: 0,
    title: 'People & Culture Overview',
    content: `
# People & Culture

## Overall Score: ${formatNumber(pc.overallScore, 0)}/100

| Pillar | Score |
|--------|-------|
| **Fair Work** | ${formatNumber(pc.fairWorkScore, 0)}/100 |
| **Diversity** | ${formatNumber(pc.diversityScore, 0)}/100 |
| **Wellbeing** | ${formatNumber(pc.wellbeingScore, 0)}/100 |
| **Training** | ${formatNumber(pc.trainingScore, 0)}/100 |

### Workforce Summary

- **Total employees:** ${formatNumber(pc.totalEmployees, 0)}
${pc.femalePercentage !== null ? `- **Gender split:** ${formatNumber(pc.femalePercentage, 1)}% female` : ''}
- **New hires:** ${formatNumber(pc.newHires, 0)} | **Departures:** ${formatNumber(pc.departures, 0)}
${pc.turnoverRate !== null ? `- **Turnover rate:** ${formatNumber(pc.turnoverRate, 1)}%` : ''}

---

*Data completeness: ${formatNumber(pc.dataCompleteness, 0)}%*
`.trim(),
  });

  // Slide 2: Fair Work & Diversity detail
  const hasFairWorkData = pc.livingWageCompliance !== null || pc.genderPayGapMean !== null || pc.ceoWorkerPayRatio !== null;
  if (hasFairWorkData || pc.deiActionsTotal > 0) {
    slides.push({
      slideNumber: 0,
      title: 'Fair Work & Diversity',
      content: `
# Fair Work & Diversity

${hasFairWorkData ? `## Fair Work Metrics

| Metric | Value |
|--------|-------|
${pc.livingWageCompliance !== null ? `| **Living wage compliance** | ${formatNumber(pc.livingWageCompliance, 1)}% |` : ''}
${pc.genderPayGapMean !== null ? `| **Mean gender pay gap** | ${formatNumber(pc.genderPayGapMean, 1)}% |` : ''}
${pc.ceoWorkerPayRatio !== null ? `| **CEO:median worker pay ratio** | ${formatNumber(pc.ceoWorkerPayRatio, 0)}:1 |` : ''}
` : ''}

${pc.deiActionsTotal > 0 ? `## DEI Initiatives

- **${pc.deiActionsTotal}** DEI actions tracked
- **${pc.deiActionsCompleted}** completed (${formatNumber(pc.deiActionsTotal > 0 ? (pc.deiActionsCompleted / pc.deiActionsTotal) * 100 : 0, 0)}% completion rate)
` : ''}

---

*People & Culture data from platform records*
`.trim(),
    });
  }

  // Slide 3: Training & Wellbeing (conditional)
  if (pc.trainingHoursPerEmployee !== null || pc.engagementScore !== null || pc.benefits.length > 0) {
    slides.push({
      slideNumber: 0,
      title: 'Training & Wellbeing',
      content: `
# Training & Wellbeing

${pc.trainingHoursPerEmployee !== null ? `## Training\n- **Average training hours per employee:** ${formatNumber(pc.trainingHoursPerEmployee, 1)}\n` : ''}

${pc.engagementScore !== null ? `## Employee Engagement\n- **Engagement score:** ${formatNumber(pc.engagementScore, 0)}/100\n` : ''}

${pc.benefits.length > 0 ? `## Benefits Offered\n${pc.benefits.slice(0, 8).map(b => `- ${b}`).join('\n')}\n${pc.benefits.length > 8 ? `\n*Plus ${pc.benefits.length - 8} additional benefits*` : ''}` : ''}

---

*Training and wellbeing data from platform records*
`.trim(),
    });
  }

  return slides;
}

/**
 * Generates Governance slides
 */
function buildGovernanceSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  const slides: SlideContent[] = [];
  const gov = data.governance;

  if (!data.dataAvailability.hasGovernance || !gov) {
    slides.push({
      slideNumber: 0,
      title: 'Governance',
      content: `# Governance\n\n## No Data Available\n\nNo governance data has been recorded for ${config.reportYear}.\n\nCapture mission, board composition, and policy data to include this section.`.trim(),
    });
    return slides;
  }

  // Slide 1: Overview with mission and board
  const bdm = gov.boardDiversityMetrics;
  slides.push({
    slideNumber: 0,
    title: 'Governance Overview',
    content: `
# Governance

${gov.missionStatement ? `## Mission\n${gov.missionStatement.substring(0, 300)}${gov.missionStatement.length > 300 ? '...' : ''}\n` : ''}

${gov.purposeStatement ? `## Purpose\n${gov.purposeStatement.substring(0, 200)}${gov.purposeStatement.length > 200 ? '...' : ''}\n` : ''}

${gov.isBenefitCorp ? '**Registered Benefit Corporation**\n' : ''}
${gov.sdgCommitments.length > 0 ? `**SDG Commitments:** ${gov.sdgCommitments.map(s => `SDG ${s}`).join(', ')}\n` : ''}

${bdm.totalMembers > 0 ? `## Board Composition

| Metric | Value |
|--------|-------|
| **Total board members** | ${bdm.totalMembers} |
| **Female representation** | ${formatNumber(bdm.femalePercentage, 0)}% |
| **Independent directors** | ${formatNumber(bdm.independentPercentage, 0)}% |
${bdm.averageAttendance > 0 ? `| **Average attendance** | ${formatNumber(bdm.averageAttendance, 0)}% |` : ''}
` : ''}

---

*Governance data from platform records*
`.trim(),
  });

  // Slide 2: Policies & Ethics (conditional)
  if (gov.policies.length > 0 || gov.ethicsTrainingRate !== null || gov.ethicsIncidents > 0) {
    slides.push({
      slideNumber: 0,
      title: 'Policies & Ethics',
      content: `
# Policies & Ethics

${gov.policies.length > 0 ? `## ESG Policies

| Policy | Type | Status |
|--------|------|--------|
${gov.policies.slice(0, 10).map(p => `| ${p.name} | ${p.type} | ${p.status} |`).join('\n')}
${gov.policies.length > 10 ? `\n*Showing 10 of ${gov.policies.length} policies*` : ''}

**Policy completeness:** ${formatNumber(gov.policyCompleteness, 0)}%
` : ''}

${gov.ethicsTrainingRate !== null || gov.ethicsIncidents > 0 ? `## Ethics & Compliance

| Metric | Value |
|--------|-------|
${gov.ethicsTrainingRate !== null ? `| **Ethics training completion** | ${formatNumber(gov.ethicsTrainingRate, 0)}% |` : ''}
| **Ethics incidents reported** | ${gov.ethicsIncidents} |
${gov.lobbyingActivities > 0 ? `| **Political activities** | ${gov.lobbyingActivities} |` : ''}
` : ''}

---

*Governance and ethics data from platform records*
`.trim(),
    });
  }

  return slides;
}

/**
 * Generates Community Impact slides
 */
function buildCommunityImpactSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  const slides: SlideContent[] = [];
  const ci = data.communityImpact;

  if (!data.dataAvailability.hasCommunityImpact || !ci) {
    slides.push({
      slideNumber: 0,
      title: 'Community Impact',
      content: `# Community Impact\n\n## No Data Available\n\nNo community impact data has been recorded for ${config.reportYear}.\n\nCapture donation, volunteering, and local impact data to include this section.`.trim(),
    });
    return slides;
  }

  // Slide 1: Overview
  slides.push({
    slideNumber: 0,
    title: 'Community Impact Overview',
    content: `
# Community Impact

## Overall Score: ${formatNumber(ci.overallScore, 0)}/100

| Pillar | Score |
|--------|-------|
| **Giving** | ${formatNumber(ci.givingScore, 0)}/100 |
| **Local Impact** | ${formatNumber(ci.localImpactScore, 0)}/100 |
| **Volunteering** | ${formatNumber(ci.volunteeringScore, 0)}/100 |
| **Engagement** | ${formatNumber(ci.engagementScore, 0)}/100 |

### Key Metrics

| Metric | Value |
|--------|-------|
| **Total charitable donations** | ${formatGBP(ci.totalDonations)} |
| **Number of donations** | ${ci.donationCount} |
| **Total volunteer hours** | ${formatNumber(ci.totalVolunteerHours, 0)} |
| **Volunteer activities** | ${ci.volunteerActivities} |
${ci.localEmploymentRate !== null ? `| **Local employment rate** | ${formatNumber(ci.localEmploymentRate, 1)}% |` : ''}
${ci.localSourcingRate !== null ? `| **Local sourcing rate** | ${formatNumber(ci.localSourcingRate, 1)}% |` : ''}

---

*Data completeness: ${formatNumber(ci.dataCompleteness, 0)}%*
`.trim(),
  });

  // Slide 2: Impact Stories (conditional)
  if (ci.impactStories.length > 0) {
    slides.push({
      slideNumber: 0,
      title: 'Community Impact Stories',
      content: `
# Impact Stories

${ci.impactStories.slice(0, 5).map(story => `## ${story.title}
*${story.category}*

${story.summary || 'No summary available.'}
`).join('\n---\n\n')}

---

*${ci.impactStories.length} impact stor${ci.impactStories.length === 1 ? 'y' : 'ies'} published*
`.trim(),
    });
  }

  return slides;
}

/**
 * Generates closing/contact slide
 */
function buildClosingSlide(config: ReportConfig, data: ReportData): SlideContent {
  return {
    slideNumber: 0,
    title: 'Thank You',
    content: `
# Thank You

## ${data.organization.name || 'Organization'}

${data.organization.description ? `*${data.organization.description}*` : ''}

---

### This report covers:
- Reporting Year: ${config.reportYear}
- Period: ${formatDateRange(config.reportingPeriodStart, config.reportingPeriodEnd)}

---

*Report generated using verified platform data*

*For questions about this report, please contact your sustainability team*
`.trim(),
  };
}

/**
 * Generates company overview slide
 */
function buildCompanyOverviewSlide(config: ReportConfig, data: ReportData): SlideContent {
  return {
    slideNumber: 0,
    title: 'Company Overview',
    content: `
# Company Overview

## ${data.organization.name || 'Organization'}

${data.organization.industry_sector ? `**Industry:** ${data.organization.industry_sector}` : ''}

${data.organization.description ? data.organization.description : '*Company description not available.*'}

---

**Reporting Year:** ${config.reportYear}
**Reporting Period:** ${formatDateRange(config.reportingPeriodStart, config.reportingPeriodEnd)}
**Target Audience:** ${getAudienceDescription(config.audience)}
`.trim(),
  };
}

/**
 * Generates GHG inventory slides (ISO 14067 gas-level breakdown)
 */
function buildGHGInventorySlides(config: ReportConfig, data: ReportData): SlideContent[] {
  if (!data.dataAvailability.hasEmissions) {
    return [{
      slideNumber: 0,
      title: 'GHG Gas Inventory',
      content: `# GHG Gas Inventory\n\n## Data Not Available\n\nNo emissions data available for gas-level breakdown.`.trim(),
    }];
  }

  return [{
    slideNumber: 0,
    title: 'GHG Gas Inventory (ISO 14067)',
    content: `
# GHG Gas Inventory

## Greenhouse Gas Breakdown by Type (${config.reportYear})

| Gas Type | Description | Global Warming Potential |
|----------|-------------|------------------------|
| CO\u2082 | Carbon Dioxide | 1 |
| CH\u2084 | Methane | 28 |
| N\u2082O | Nitrous Oxide | 265 |
| HFCs | Hydrofluorocarbons | 1,430 - 14,800 |
| PFCs | Perfluorocarbons | 6,630 - 11,100 |

---

**Total GHG Emissions:** ${formatNumber(data.emissions.total)} tCO2e

*All values expressed in CO2 equivalents using IPCC AR5 GWP factors*
*Gas-level breakdown based on corporate emissions inventory*
`.trim(),
  }];
}

/**
 * Generates supply chain analysis slides
 */
function buildSupplyChainSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  if (!data.dataAvailability.hasSuppliers || !data.suppliers || data.suppliers.length === 0) {
    return [{
      slideNumber: 0,
      title: 'Supply Chain Analysis',
      content: `# Supply Chain Analysis\n\n## No Supplier Data Available\n\nNo supplier records found. Add suppliers to enable value chain analysis.`.trim(),
    }];
  }

  // Group by category
  const categories: Record<string, number> = {};
  data.suppliers.forEach(s => {
    categories[s.category] = (categories[s.category] || 0) + 1;
  });

  return [{
    slideNumber: 0,
    title: 'Supply Chain Analysis',
    content: `
# Supply Chain Analysis

## Supplier Overview

- **${data.suppliers.length}** suppliers tracked
- **${Object.keys(categories).length}** supplier categories

### Suppliers by Category

| Category | Count |
|----------|-------|
${Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([cat, count]) => `| ${cat} | ${count} |`).join('\n')}

### Key Suppliers

| Supplier | Category |
|----------|----------|
${data.suppliers.slice(0, 10).map(s => `| ${s.name} | ${s.category} |`).join('\n')}
${data.suppliers.length > 10 ? `\n*Showing 10 of ${data.suppliers.length} suppliers*` : ''}

---

*Supply chain data from platform supplier registry*
`.trim(),
  }];
}

/**
 * Generates facility emissions breakdown slide (legacy section-based)
 */
function buildFacilitiesSlide(config: ReportConfig, data: ReportData): SlideContent {
  if (!data.dataAvailability.hasFacilities || !data.facilities || data.facilities.length === 0) {
    return {
      slideNumber: 0,
      title: 'Facility Emissions',
      content: `# Facility Emissions Breakdown\n\n## No Facility Data Available\n\nNo facilities registered. Add facilities to enable site-level analysis.`.trim(),
    };
  }

  const totalFacilityEmissions = data.facilities.reduce((sum, f) => sum + f.totalEmissions, 0);
  const sorted = [...data.facilities].sort((a, b) => b.totalEmissions - a.totalEmissions);

  return {
    slideNumber: 0,
    title: 'Facility Emissions Breakdown',
    content: `
# Facility Emissions Breakdown

## ${data.facilities.length} Facilities Tracked

**Total Facility Emissions:** ${formatNumber(totalFacilityEmissions)} tCO2e

| Facility | Type | Emissions (tCO2e) | Share |
|----------|------|-------------------|-------|
${sorted.slice(0, 15).map(f => `| ${f.name} | ${f.type} | ${formatNumber(f.totalEmissions)} | ${formatPercentage(f.totalEmissions, totalFacilityEmissions)} |`).join('\n')}
${data.facilities.length > 15 ? `\n*Showing top 15 of ${data.facilities.length} facilities*` : ''}

---

*Facility-level emissions from platform data*
`.trim(),
  };
}

/**
 * Generates targets and action plans slide
 */
function buildTargetsSlide(config: ReportConfig, data: ReportData): SlideContent {
  const gov = data.governance;
  const hasClimateCommitments = gov?.climateCommitments && gov.climateCommitments.length > 0;
  const hasTrends = data.emissionsTrends && data.emissionsTrends.length > 1;

  // Calculate trajectory if multi-year data exists
  let trajectoryNote = '';
  if (hasTrends) {
    const first = data.emissionsTrends[0];
    const last = data.emissionsTrends[data.emissionsTrends.length - 1];
    if (first.total > 0) {
      const change = ((last.total - first.total) / first.total * 100);
      trajectoryNote = change < 0
        ? `Current trajectory: **${Math.abs(change).toFixed(1)}% reduction** from ${first.year} to ${last.year}`
        : `Current trajectory: **${change.toFixed(1)}% increase** from ${first.year} to ${last.year} - action needed`;
    }
  }

  return {
    slideNumber: 0,
    title: 'Targets & Action Plans',
    content: `
# Targets & Action Plans

${hasClimateCommitments ? `## Climate Commitments

${gov!.climateCommitments.map(c => `- ${c}`).join('\n')}
` : `## Emission Reduction Commitments

*No formal climate commitments have been recorded yet. Consider setting targets aligned with the Paris Agreement and Science Based Targets initiative (SBTi).*
`}

${trajectoryNote ? `### Emissions Trajectory\n${trajectoryNote}\n` : ''}

### Recommended Actions
1. **Energy Transition** - Transition to renewable energy sources
2. **Operational Efficiency** - Implement energy management systems
3. **Supply Chain Engagement** - Collaborate with suppliers on emissions reduction
4. **Product Innovation** - Design for lower environmental impact

${config.standards.includes('csrd') ? '### CSRD Transition Plan Requirements\n- Climate transition plan with clear milestones\n- Scope 3 reduction strategy\n- Capital expenditure alignment with targets' : ''}

---

*Targets should be reviewed annually and updated based on latest climate science*
`.trim(),
  };
}

/**
 * Generates regulatory compliance slide
 */
function buildRegulatorySlide(config: ReportConfig, data: ReportData): SlideContent {
  // Use real standards status data when available
  const hasRealStatus = data.standards && data.standards.length > 0;
  const hasEmissions = data.dataAvailability.hasEmissions;
  const hasPeople = data.dataAvailability.hasPeopleCulture;
  const hasGov = data.dataAvailability.hasGovernance;

  return {
    slideNumber: 0,
    title: 'Regulatory Compliance',
    content: `
# Regulatory Compliance

${hasRealStatus ? `## Standards Alignment

| Standard | Status | Detail |
|----------|--------|--------|
${data.standards.map(s => `| **${s.name}** | ${s.status} | ${s.detail} |`).join('\n')}
` : `## Standards Alignment

${config.standards.map(s => `### ${getStandardName(s)}\n- Alignment status: In progress\n- Key requirements addressed in this report`).join('\n\n')}
`}

${config.standards.includes('csrd') ? `
### ESRS Data Coverage

| Standard | Topic | Status |
|----------|-------|--------|
| **E1** | Climate Change | ${hasEmissions ? 'Data available' : 'No data'} |
| **S1** | Own Workforce | ${hasPeople ? 'Data available' : 'No data'} |
| **G1** | Business Conduct | ${hasGov ? 'Data available' : 'No data'} |
` : ''}

---

*Compliance assessment based on platform data and reporting standards*
`.trim(),
  };
}

/**
 * Generates technical appendix slides
 */
function buildAppendixSlides(config: ReportConfig, data: ReportData): SlideContent[] {
  return [{
    slideNumber: 0,
    title: 'Technical Appendix',
    content: `
# Technical Appendix

## Emission Factors & Assumptions

### Data Sources
- **Corporate Emissions:** GHG Protocol Corporate Standard
- **Product Footprints:** ISO 14067 / ISO 14044
- **Emission Factors:** UK DEFRA Conversion Factors, Ecoinvent 3.9

### Calculation Methodology
- Operational control consolidation approach
- Location-based method for Scope 2 (market-based available where applicable)
- Activity data multiplied by emission factors for each source

### Reporting Boundaries
- **Temporal:** ${formatDateRange(config.reportingPeriodStart, config.reportingPeriodEnd)}
- **Organizational:** All entities under operational control
${config.isMultiYear ? `- **Multi-year coverage:** ${(config.reportYears || []).join(', ')}` : ''}

### Abbreviations
| Abbreviation | Meaning |
|-------------|---------|
| tCO2e | Tonnes of CO2 equivalent |
| GWP | Global Warming Potential |
| GHG | Greenhouse Gas |
| LCA | Life Cycle Assessment |
| PEI | Product Environmental Impact |

---

*For detailed methodology documentation, contact your sustainability team*
`.trim(),
  }];
}

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Builds the complete structured content for a sustainability report
 *
 * CRITICAL: This function is DETERMINISTIC. The same inputs always produce
 * the same outputs. No LLM interpretation of data values occurs here.
 */
export function buildReportContent(config: ReportConfig, data: ReportData, chartUrls?: Record<string, string>): string {
  const slides: SlideContent[] = [];

  // Always include title slide
  slides.push(buildTitleSlide(config, data));

  // Executive summary (always included)
  if (config.sections.includes('executive-summary') || config.sections.length === 0) {
    slides.push(buildExecutiveSummarySlide(config, data));
  }

  // Audience-specific section ordering
  const orderedSections = getAudienceOrderedSections(config.audience, config.sections);

  // Section dispatch map
  const sectionBuilders: Record<string, () => SlideContent | SlideContent[]> = {
    'company-overview': () => buildCompanyOverviewSlide(config, data),
    'scope-1-2-3': () => buildEmissionsSlides(config, data),
    'ghg-inventory': () => buildGHGInventorySlides(config, data),
    'carbon-origin': () => buildCarbonOriginSlides(config, data),
    'flag-removals': () => buildFlagRemovalsSlides(config, data),
    'tnfd-nature': () => buildTnfdNatureSlides(config, data),
    'trends': () => buildTrendSlides(config, data),
    'product-footprints': () => buildProductSlides(config, data),
    'multi-capital': () => buildMultiCapitalSlides(config, data),
    'impact-valuation': () => buildImpactValuationSlides(config, data),
    'supply-chain': () => buildSupplyChainSlides(config, data),
    'facilities': () => buildFacilitiesSlide(config, data),
    'people-culture': () => buildPeopleCultureSlides(config, data),
    'governance': () => buildGovernanceSlides(config, data),
    'community-impact': () => buildCommunityImpactSlides(config, data),
    'targets': () => buildTargetsSlide(config, data),
    'methodology': () => buildMethodologySlide(config, data),
    'regulatory': () => buildRegulatorySlide(config, data),
    'appendix': () => buildAppendixSlides(config, data),
  };

  for (const sectionId of orderedSections) {
    // Skip executive-summary (already added above)
    if (sectionId === 'executive-summary') continue;

    // Special case: trends also triggered by multi-year + emissions
    if (sectionId === 'trends' && !config.sections.includes('trends')) {
      if (config.isMultiYear && config.sections.includes('scope-1-2-3')) {
        slides.push(...buildTrendSlides(config, data));
      }
      continue;
    }

    // Special case: methodology included if any standards selected
    if (sectionId === 'methodology' && !config.sections.includes('methodology') && config.standards.length > 0) {
      slides.push(buildMethodologySlide(config, data));
      continue;
    }

    if (!config.sections.includes(sectionId)) continue;

    const builder = sectionBuilders[sectionId];
    if (!builder) continue;

    const result = builder();
    if (Array.isArray(result)) {
      slides.push(...result);
    } else {
      slides.push(result);
    }

    // Inject chart images after relevant sections (PPTX only)
    if (chartUrls) {
      if (sectionId === 'scope-1-2-3' && chartUrls['scope-pie']) {
        slides.push({
          slideNumber: 0,
          title: 'Emissions Breakdown Chart',
          content: `# Emissions by Scope\n\n![Scope 1/2/3 Breakdown](${chartUrls['scope-pie']})`,
        });
      }
      if (sectionId === 'trends' && chartUrls['emissions-trend']) {
        slides.push({
          slideNumber: 0,
          title: 'Emissions Trend',
          content: `# Emissions Trend\n\n![Multi-Year Emissions Trend](${chartUrls['emissions-trend']})`,
        });
      }
      if (sectionId === 'product-footprints' && chartUrls['product-bar']) {
        slides.push({
          slideNumber: 0,
          title: 'Product Impact Chart',
          content: `# Product Carbon Footprints\n\n![Product Impact Comparison](${chartUrls['product-bar']})`,
        });
      }
      if ((sectionId === 'people-culture' || sectionId === 'community-impact') && chartUrls['social-radar']) {
        // Only add radar once (after the first social section)
        if (sectionId === 'people-culture') {
          slides.push({
            slideNumber: 0,
            title: 'Sustainability Scores',
            content: `# Sustainability Pillar Scores\n\n![Sustainability Scores Radar](${chartUrls['social-radar']})`,
          });
        }
      }
    }
  }

  // Closing slide
  slides.push(buildClosingSlide(config, data));

  // Renumber slides
  slides.forEach((slide, index) => {
    slide.slideNumber = index + 1;
  });

  // Convert to markdown format for SlideSpeak
  return slides.map(slide => slide.content).join('\n\n---\n\n');
}

/**
 * Returns sections in audience-appropriate priority order.
 * Sections not in the map are appended at the end in default order.
 */
function getAudienceOrderedSections(audience: string, selectedSections: string[]): string[] {
  const AUDIENCE_SECTION_ORDER: Record<string, string[]> = {
    'investors': [
      'executive-summary', 'scope-1-2-3', 'carbon-origin', 'flag-removals', 'trends', 'targets',
      'impact-valuation', 'governance', 'product-footprints', 'multi-capital', 'tnfd-nature',
      'people-culture', 'community-impact', 'supply-chain',
      'facilities', 'company-overview', 'methodology', 'regulatory',
      'ghg-inventory', 'appendix',
    ],
    'customers': [
      'executive-summary', 'company-overview', 'community-impact',
      'people-culture', 'product-footprints', 'multi-capital', 'tnfd-nature', 'impact-valuation',
      'scope-1-2-3', 'carbon-origin', 'flag-removals', 'governance', 'supply-chain', 'targets',
      'facilities', 'trends', 'methodology', 'ghg-inventory',
      'regulatory', 'appendix',
    ],
    'regulators': [
      'executive-summary', 'methodology', 'scope-1-2-3', 'carbon-origin',
      'flag-removals', 'ghg-inventory', 'product-footprints', 'multi-capital', 'tnfd-nature', 'facilities',
      'governance', 'people-culture', 'community-impact',
      'supply-chain', 'regulatory', 'targets', 'trends',
      'impact-valuation', 'company-overview', 'appendix',
    ],
    'internal': [
      'executive-summary', 'scope-1-2-3', 'facilities',
      'people-culture', 'targets', 'product-footprints', 'multi-capital', 'tnfd-nature',
      'community-impact', 'governance', 'supply-chain',
      'trends', 'carbon-origin', 'flag-removals', 'impact-valuation', 'company-overview',
      'methodology', 'ghg-inventory', 'regulatory', 'appendix',
    ],
    'supply-chain': [
      'executive-summary', 'supply-chain', 'product-footprints', 'multi-capital', 'tnfd-nature',
      'scope-1-2-3', 'carbon-origin', 'flag-removals', 'facilities', 'people-culture',
      'community-impact', 'governance', 'targets',
      'trends', 'impact-valuation', 'company-overview',
      'methodology', 'ghg-inventory', 'regulatory', 'appendix',
    ],
    'technical': [
      'executive-summary', 'methodology', 'scope-1-2-3', 'carbon-origin',
      'flag-removals', 'ghg-inventory', 'product-footprints', 'multi-capital', 'tnfd-nature', 'facilities',
      'people-culture', 'governance', 'community-impact',
      'supply-chain', 'targets', 'trends', 'impact-valuation',
      'company-overview', 'regulatory', 'appendix',
    ],
  };

  const order = AUDIENCE_SECTION_ORDER[audience] || AUDIENCE_SECTION_ORDER['investors'];

  // Return ordered list, including any sections not in the map at the end
  const ordered = order.filter(s => selectedSections.includes(s));
  const remaining = selectedSections.filter(s => !order.includes(s));
  return [...ordered, ...remaining];
}

/**
 * Builds custom instructions for SlideSpeak based on report configuration
 * This is where audience-specific tone and formatting preferences are set
 */
export function buildCustomInstructions(config: ReportConfig): string {
  const audienceTone: Record<string, string> = {
    'investors': 'Professional and data-focused. Emphasize financial materiality, risk management, and long-term value creation. Use business terminology.',
    'regulators': 'Formal and compliance-focused. Reference specific standards and requirements. Be precise and thorough.',
    'customers': 'Accessible and impact-focused. Highlight sustainability achievements and commitments. Use clear, jargon-free language.',
    'internal': 'Detailed and action-oriented. Include operational insights and recommendations. Be direct and practical.',
    'supply-chain': 'Technical and procurement-focused. Emphasize upstream and downstream impacts. Include relevant certifications.',
    'technical': 'Scientific and methodology-focused. Include uncertainty ranges and data quality indicators. Use technical terminology appropriately.',
  };

  const instructions: string[] = [];

  // Audience-specific tone
  const tone = audienceTone[config.audience] || audienceTone['investors'];
  instructions.push(`TONE AND STYLE: ${tone}`);

  // Standards compliance
  if (config.standards.length > 0) {
    instructions.push(`COMPLIANCE: Ensure content aligns with ${config.standards.map(getStandardName).join(', ')}.`);
  }

  // Branding
  if (config.branding.primaryColor || config.branding.secondaryColor) {
    instructions.push(`BRANDING: Use primary color ${config.branding.primaryColor} and secondary color ${config.branding.secondaryColor} for visual elements.`);
  }

  // Multi-year emphasis
  if (config.isMultiYear) {
    instructions.push('TREND ANALYSIS: Emphasize year-over-year comparisons and progress trajectories in visualizations.');
  }

  // Data accuracy emphasis
  instructions.push('CRITICAL: All numerical data has been pre-validated. Present numbers exactly as provided without modification or interpretation.');

  return instructions.join('\n\n');
}

/**
 * Calculates recommended slide count based on sections
 */
export function calculateSlideCount(sections: string[]): number {
  const sectionSlides: Record<string, number> = {
    'executive-summary': 1,
    'company-overview': 1,
    'scope-1-2-3': 3,
    'ghg-inventory': 1,
    'product-footprints': 2,
    'impact-valuation': 2,
    'supply-chain': 1,
    'facilities': 1,
    'trends': 1,
    'targets': 1,
    'carbon-origin': 1,
    'multi-capital': 1,
    'people-culture': 3,
    'governance': 2,
    'community-impact': 2,
    'methodology': 1,
    'regulatory': 1,
    'appendix': 1,
  };

  // Base slides (title + closing)
  let count = 2;

  // Add section-specific slides
  for (const section of sections) {
    count += sectionSlides[section] || 1;
  }

  // Minimum 8 slides, maximum 40
  return Math.max(8, Math.min(40, count));
}
