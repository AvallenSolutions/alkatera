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

export interface ReportData {
  organization: OrganizationInfo;
  emissions: EmissionsData;
  emissionsTrends: YearlyEmissions[];
  products: ProductFootprint[];
  facilities: FacilityInfo[];
  standards: StandardStatus[];
  dataQuality?: DataQualityMetrics;
  dataAvailability: {
    hasOrganization: boolean;
    hasEmissions: boolean;
    hasProducts: boolean;
    hasFacilities: boolean;
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

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Builds the complete structured content for a sustainability report
 *
 * CRITICAL: This function is DETERMINISTIC. The same inputs always produce
 * the same outputs. No LLM interpretation of data values occurs here.
 */
export function buildReportContent(config: ReportConfig, data: ReportData): string {
  const slides: SlideContent[] = [];

  // Always include title slide
  slides.push(buildTitleSlide(config, data));

  // Executive summary (if selected or always include)
  if (config.sections.includes('executive-summary') || config.sections.length === 0) {
    slides.push(buildExecutiveSummarySlide(config, data));
  }

  // Emissions data
  if (config.sections.includes('scope-1-2-3')) {
    slides.push(...buildEmissionsSlides(config, data));
  }

  // Facility emissions (always include if facilities exist)
  if (data.facilities && data.facilities.length > 0) {
    slides.push(...buildFacilitySlides(config, data));
  }

  // Multi-year trends (if multi-year mode enabled)
  if (config.isMultiYear && config.sections.includes('scope-1-2-3')) {
    slides.push(...buildTrendSlides(config, data));
  }

  // Product footprints
  if (config.sections.includes('product-footprints')) {
    slides.push(...buildProductSlides(config, data));
  }

  // Methodology
  if (config.sections.includes('methodology') || config.standards.length > 0) {
    slides.push(buildMethodologySlide(config, data));
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
    'scope-1-2-3': 3,
    'product-footprints': 2,
    'methodology': 1,
    'targets-progress': 2,
    'supply-chain': 2,
    'certifications': 1,
  };

  // Base slides (title + closing)
  let count = 2;

  // Add section-specific slides
  for (const section of sections) {
    count += sectionSlides[section] || 1;
  }

  // Minimum 8 slides, maximum 20
  return Math.max(8, Math.min(20, count));
}
