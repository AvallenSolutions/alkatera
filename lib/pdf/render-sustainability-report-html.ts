/**
 * Server-side Sustainability Report HTML Renderer
 *
 * Generates a self-contained HTML document for the sustainability report that
 * can be converted to PDF via PDFShift. Uses pure HTML/CSS (no React runtime,
 * no Tailwind CDN) for reliable server-side rendering.
 *
 * The output is a comprehensive multi-page A4 report with:
 * - Cover page with report name, organisation and standards badges
 * - Executive summary with emissions overview and scope donut
 * - Emissions breakdown with scope 1/2/3 table and bars
 * - Multi-year trends with YoY change arrows (conditional)
 * - Product impact table (conditional)
 * - People & culture pillar scores (conditional)
 * - Governance board and policy status (conditional)
 * - Community impact metrics (conditional)
 * - Supply chain supplier table (conditional)
 * - Targets and climate commitments
 * - Methodology and standards compliance
 * - Closing page with contact info
 *
 * Design matches the existing LCA template in lib/pdf/render-lca-html.ts
 */

// ============================================================================
// TYPES (duplicated from supabase/functions/_shared/report-content-builder.ts)
// ============================================================================

interface OrganizationInfo {
  name: string;
  industry_sector?: string;
  description?: string;
}

interface EmissionsData {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  year: number;
}

interface YearlyEmissions {
  year: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  yoyChange?: string;
}

interface ProductFootprint {
  name: string;
  functionalUnit: string;
  climateImpact: number;
}

interface FacilityInfo {
  name: string;
  type: string;
  location: string;
  totalEmissions: number;
  unitsProduced: number;
  hasData: boolean;
}

interface SupplierData {
  name: string;
  category: string;
  emissionsData: Record<string, any>;
}

interface StandardStatus {
  code: string;
  name: string;
  status: string;
  detail: string;
}

interface DataQualityMetrics {
  completeness: number;
  qualityTier: 'tier_1' | 'tier_2' | 'tier_3' | 'mixed';
  confidenceScore: number;
}

interface PeopleCultureData {
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

interface GovernanceData {
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

interface CommunityImpactData {
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

interface VineyardReportData {
  name: string;
  hectares: number;
  certification: string;
  climateZone: string;
  vintages: number;
  emissionsPerHa: number;
  waterPerHa: number;
  removalsPerHa: number;
  yieldPerHa: number;
}

interface ReportData {
  organization: OrganizationInfo;
  emissions: EmissionsData;
  emissionsTrends: YearlyEmissions[];
  products: ProductFootprint[];
  facilities: FacilityInfo[];
  suppliers?: SupplierData[];
  vineyards?: VineyardReportData[];
  standards: StandardStatus[];
  dataQuality?: DataQualityMetrics;
  peopleCulture?: PeopleCultureData;
  governance?: GovernanceData;
  communityImpact?: CommunityImpactData;
  dataAvailability: {
    hasOrganization: boolean;
    hasEmissions: boolean;
    hasProducts: boolean;
    hasFacilities: boolean;
    hasSuppliers?: boolean;
    hasVineyards?: boolean;
    hasPeopleCulture?: boolean;
    hasGovernance?: boolean;
    hasCommunityImpact?: boolean;
  };
}

interface ReportConfig {
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

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generate CSS for a donut chart using conic-gradient.
 */
function donutGradient(segments: Array<{ value: number; color: string }>): string {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return 'background: #333;';

  let cumulative = 0;
  const stops: string[] = [];
  for (const seg of segments) {
    const start = (cumulative / total) * 360;
    cumulative += seg.value;
    const end = (cumulative / total) * 360;
    stops.push(`${seg.color} ${start}deg ${end}deg`);
  }
  return `background: conic-gradient(${stops.join(', ')});`;
}

/**
 * Render a horizontal percentage bar.
 */
function percentBar(value: number, max: number, colour: string): string {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return `<div style="display: flex; align-items: center; gap: 8px;">
    <div style="flex: 1; height: 12px; background: #e7e5e4; border-radius: 6px; overflow: hidden;">
      <div style="height: 100%; width: ${pct}%; background: ${colour}; border-radius: 6px;"></div>
    </div>
    <span style="font-size: 12px; font-weight: 600; min-width: 40px; text-align: right;">${formatNumber(value, 1)}</span>
  </div>`;
}

/**
 * Format a number with thousand separators.
 */
function formatNumber(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a value as GBP currency.
 */
function formatGBP(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================================================
// BRAND ELEMENTS
// ============================================================================

const ALKATERA_LOGO_URL = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';

/** Renders the alkatera logo as an <img> element. Use dark=false for light backgrounds. */
function alkateraLogo(height: number, dark = true): string {
  const filter = dark ? '' : 'filter: brightness(0);';
  return `<img src="${ALKATERA_LOGO_URL}" alt="alkatera" style="height: ${height}px; width: auto; object-fit: contain; ${filter}" />`;
}

const SCOPE_COLOURS = {
  scope1: '#22c55e',
  scope2: '#3b82f6',
  scope3: '#f97316',
};

/**
 * Maps audience type to descriptive text.
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
 * Maps standard codes to full names.
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
    'vsme': 'Voluntary SME Sustainability Reporting Standard (VSME)',
    'esrs': 'European Sustainability Reporting Standards (ESRS)',
  };
  return standards[code] || code;
}

// ============================================================================
// SHARED ELEMENTS
// ============================================================================

function renderSectionHeader(number: string, title: string, dark = false, continuation = false): string {
  const borderColor = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
  const brandColor = '#ccff00';
  return `
    <div style="display: flex; align-items: baseline; gap: 16px; margin-bottom: ${continuation ? '24px' : '32px'}; border-bottom: 1px solid ${borderColor}; padding-bottom: 12px;">
      <span style="color: ${brandColor}; font-family: 'Fira Code', monospace; font-size: 14px; font-weight: 700; letter-spacing: 3px;">${number}</span>
      <h2 style="font-size: ${continuation ? '24px' : '32px'}; font-family: 'Playfair Display', serif; font-weight: 300;">${escapeHtml(title)}</h2>
      ${continuation ? '<span style="font-size: 10px; color: #a8a29e; font-family: \'Fira Code\', monospace;">(continued)</span>' : ''}
    </div>`;
}

function renderPageFooter(pageNumber?: number, dark = false, standardsLabel?: string): string {
  const color = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const bgColor = dark ? '#1c1917' : '#f5f5f4';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const rightText = standardsLabel || dateStr;

  return `
    <div style="position: absolute; bottom: 0; left: 0; right: 0; z-index: 10; background: ${bgColor}; padding: 0 48px 48px 48px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 9px; font-family: 'Fira Code', monospace; color: ${color}; text-transform: uppercase; letter-spacing: 3px; border-top: 1px solid ${color}; padding-top: 16px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>Generated by</span>
          ${alkateraLogo(14, dark)}
        </div>
        ${pageNumber !== undefined ? `<div style="font-weight: 700; font-size: 12px;">__PAGE_NUM__</div>` : ''}
        <div>${escapeHtml(rightText)}</div>
      </div>
    </div>`;
}

// ============================================================================
// PAGE RENDERERS
// ============================================================================

function renderCoverPage(config: ReportConfig, data: ReportData): string {
  const standardsBadges = config.standards.map(s =>
    `<div style="display: inline-block; padding: 6px 16px; border: 1px solid rgba(204,255,0,0.3); border-radius: 8px; font-size: 10px; font-family: 'Fira Code', monospace; color: #ccff00; margin-right: 8px; margin-bottom: 8px; background: rgba(204,255,0,0.05);">${escapeHtml(getStandardName(s))}</div>`
  ).join('');

  const logoHtml = config.branding.logo
    ? `<img src="${escapeHtml(config.branding.logo)}" alt="${escapeHtml(data.organization.name)}" style="height: 48px; width: auto; object-fit: contain; margin-bottom: 24px;" />`
    : '';

  return `
    <div class="page dark-page" style="justify-content: space-between; overflow: hidden; position: relative;">
      <div style="position: absolute; inset: 0; background: linear-gradient(135deg, #292524, #1c1917); opacity: 0.6;"></div>
      <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.4), transparent, rgba(0,0,0,0.8));"></div>

      <div style="position: relative; z-index: 10; padding-top: 48px;">
        ${alkateraLogo(44)}
      </div>

      <div style="position: relative; z-index: 10; width: 100%; max-width: 600px;">
        <div style="background: #ccff00; color: black; padding: 24px 32px; border-radius: 12px; margin-bottom: 60px; transform: rotate(-1deg);">
          <h2 style="font-family: 'Fira Code', monospace; font-weight: 700; font-style: italic; font-size: 22px; letter-spacing: -0.5px;">SUSTAINABILITY REPORT</h2>
          <p style="font-size: 11px; margin-top: 4px; opacity: 0.7;">${escapeHtml(config.reportYear.toString())} Reporting Period</p>
        </div>
        <h1 style="font-size: 56px; font-family: 'Playfair Display', serif; font-weight: 300; line-height: 1.1; margin-bottom: 16px; color: white;">
          ${escapeHtml(config.reportName)}
        </h1>
        <p style="font-size: 22px; color: #d6d3d1; font-weight: 300; margin-bottom: 16px;">${escapeHtml(data.organization.name)}</p>
        ${logoHtml}
        ${data.organization.description ? `<p style="font-size: 13px; color: #a8a29e; max-width: 480px; line-height: 1.6;">${escapeHtml(data.organization.description)}</p>` : ''}
      </div>

      <div style="position: relative; z-index: 10; margin-bottom: 80px;">
        <div style="display: flex; gap: 16px; margin-bottom: 24px;">
          <div style="border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 20px 24px; background: rgba(0,0,0,0.4); flex: 1;">
            <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 6px;">Reporting Period</div>
            <div style="font-size: 14px; font-family: 'Playfair Display', serif; color: white;">${escapeHtml(formatDateRange(config.reportingPeriodStart, config.reportingPeriodEnd))}</div>
          </div>
          <div style="border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 20px 24px; background: rgba(0,0,0,0.4);">
            <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 6px;">Audience</div>
            <div style="font-size: 14px; font-family: 'Playfair Display', serif; color: white;">${escapeHtml(getAudienceDescription(config.audience))}</div>
          </div>
          <div style="border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 20px 24px; background: rgba(0,0,0,0.4);">
            <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 6px;">Year</div>
            <div style="font-size: 14px; font-family: 'Playfair Display', serif; color: white;">${config.reportYear}</div>
          </div>
        </div>
        <div style="display: flex; flex-wrap: wrap;">${standardsBadges}</div>
      </div>

      ${renderPageFooter(undefined, true)}
    </div>`;
}

function renderExecSummaryPage(config: ReportConfig, data: ReportData): string {
  const { emissions, products, peopleCulture } = data;
  const total = emissions.total;
  const scope1Pct = total > 0 ? ((emissions.scope1 / total) * 100).toFixed(1) : '0';
  const scope2Pct = total > 0 ? ((emissions.scope2 / total) * 100).toFixed(1) : '0';
  const scope3Pct = total > 0 ? ((emissions.scope3 / total) * 100).toFixed(1) : '0';

  const donutStyle = donutGradient([
    { value: emissions.scope1, color: SCOPE_COLOURS.scope1 },
    { value: emissions.scope2, color: SCOPE_COLOURS.scope2 },
    { value: emissions.scope3, color: SCOPE_COLOURS.scope3 },
  ]);

  const socialHighlights: string[] = [];
  if (peopleCulture) {
    socialHighlights.push(`${peopleCulture.totalEmployees} employees`);
    if (peopleCulture.femalePercentage !== null) {
      socialHighlights.push(`${peopleCulture.femalePercentage.toFixed(0)}% female workforce`);
    }
    if (peopleCulture.livingWageCompliance !== null) {
      socialHighlights.push(`${peopleCulture.livingWageCompliance.toFixed(0)}% living wage compliance`);
    }
  }

  return `
    <div class="page light-page">
      ${renderSectionHeader('01', 'Executive Summary')}

      <div style="display: flex; gap: 24px; margin-bottom: 28px;">
        <div style="flex: 1; background: #1c1917; border-radius: 16px; padding: 32px; color: white;">
          <div style="font-size: 12px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Total Emissions</div>
          <div style="font-size: 48px; font-family: 'Playfair Display', serif; font-weight: 700; color: #ccff00;">${formatNumber(total, 1)}</div>
          <div style="font-size: 16px; color: #a8a29e; margin-top: 4px;">tonnes CO&#8322;e</div>
          <div style="font-size: 12px; color: #78716c; margin-top: 4px;">${config.reportYear} reporting year</div>
        </div>

        <div style="width: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="font-size: 11px; font-family: 'Fira Code', monospace; text-transform: uppercase; letter-spacing: 2px; color: #78716c; margin-bottom: 16px;">Scope Split</div>
          <div style="width: 140px; height: 140px; border-radius: 50%; ${donutStyle} position: relative;">
            <div style="position: absolute; inset: 35px; background: #f5f5f4; border-radius: 50%;"></div>
          </div>
          <div style="display: flex; gap: 12px; margin-top: 16px; font-size: 10px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${SCOPE_COLOURS.scope1};"></div>
              <span style="color: #78716c;">S1</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${SCOPE_COLOURS.scope2};"></div>
              <span style="color: #78716c;">S2</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${SCOPE_COLOURS.scope3};"></div>
              <span style="color: #78716c;">S3</span>
            </div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px;">
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Scope 1</div>
          <div class="metric-value" style="font-size: 24px; color: ${SCOPE_COLOURS.scope1};">${scope1Pct}%</div>
          <div class="metric-unit">${formatNumber(emissions.scope1, 1)} t</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Scope 2</div>
          <div class="metric-value" style="font-size: 24px; color: ${SCOPE_COLOURS.scope2};">${scope2Pct}%</div>
          <div class="metric-unit">${formatNumber(emissions.scope2, 1)} t</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Scope 3</div>
          <div class="metric-value" style="font-size: 24px; color: ${SCOPE_COLOURS.scope3};">${scope3Pct}%</div>
          <div class="metric-unit">${formatNumber(emissions.scope3, 1)} t</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Products</div>
          <div class="metric-value" style="font-size: 24px;">${products.length}</div>
          <div class="metric-unit">assessed</div>
        </div>
      </div>

      ${socialHighlights.length > 0 ? `
      <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px;">
        <div style="font-size: 11px; font-family: 'Fira Code', monospace; text-transform: uppercase; letter-spacing: 2px; color: #78716c; margin-bottom: 12px;">Social Highlights</div>
        <div style="display: flex; gap: 24px;">
          ${socialHighlights.map(h => `<div style="font-size: 14px; color: #44403c; font-weight: 500;">${escapeHtml(h)}</div>`).join('')}
        </div>
      </div>` : ''}

      ${renderPageFooter(1)}
    </div>`;
}

function renderEmissionsPage(config: ReportConfig, data: ReportData): string {
  const { emissions } = data;
  const total = emissions.total;
  const maxScope = Math.max(emissions.scope1, emissions.scope2, emissions.scope3, 0.001);

  const donutStyle = donutGradient([
    { value: emissions.scope1, color: SCOPE_COLOURS.scope1 },
    { value: emissions.scope2, color: SCOPE_COLOURS.scope2 },
    { value: emissions.scope3, color: SCOPE_COLOURS.scope3 },
  ]);

  const scopeRows = [
    { label: 'Scope 1 (Direct)', value: emissions.scope1, color: SCOPE_COLOURS.scope1, desc: 'On-site combustion, fleet, process emissions' },
    { label: 'Scope 2 (Indirect)', value: emissions.scope2, color: SCOPE_COLOURS.scope2, desc: 'Purchased electricity, heat, steam, cooling' },
    { label: 'Scope 3 (Value Chain)', value: emissions.scope3, color: SCOPE_COLOURS.scope3, desc: 'Supply chain, distribution, product use, end-of-life' },
  ];

  return `
    <div class="page light-page">
      ${renderSectionHeader('02', 'Emissions Breakdown')}

      <div style="display: flex; gap: 32px; margin-bottom: 28px; align-items: center;">
        <div style="width: 180px; height: 180px; border-radius: 50%; ${donutStyle} position: relative; flex-shrink: 0;">
          <div style="position: absolute; inset: 45px; background: #f5f5f4; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <span style="font-size: 12px; font-weight: 700; font-family: 'Playfair Display', serif; color: #1c1917;">${formatNumber(total, 1)}</span>
            <span style="font-size: 8px; color: #78716c;">tCO&#8322;e</span>
          </div>
        </div>

        <div style="flex: 1;">
          ${scopeRows.map(s => `
            <div style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                <span style="font-size: 13px; font-weight: 600; color: #1c1917;">${escapeHtml(s.label)}</span>
                <span style="font-size: 13px; font-weight: 700; color: ${s.color};">${formatNumber(s.value, 1)} t &middot; ${total > 0 ? ((s.value / total) * 100).toFixed(1) : '0'}%</span>
              </div>
              <div style="height: 16px; background: #e7e5e4; border-radius: 8px; overflow: hidden;">
                <div style="height: 100%; width: ${maxScope > 0 ? ((s.value / maxScope) * 100) : 0}%; background: ${s.color}; border-radius: 8px;"></div>
              </div>
              <div style="font-size: 10px; color: #a8a29e; margin-top: 4px;">${escapeHtml(s.desc)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Scope</th>
            <th>Category</th>
            <th style="text-align: right;">Emissions (tCO&#8322;e)</th>
            <th style="text-align: right;">Share</th>
          </tr>
        </thead>
        <tbody>
          ${scopeRows.map(s => `
            <tr>
              <td><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${s.color}; margin-right: 8px; vertical-align: middle;"></span>${escapeHtml(s.label.split(' (')[0])}</td>
              <td style="font-size: 11px; color: #78716c;">${escapeHtml(s.desc)}</td>
              <td style="text-align: right; font-weight: 600;">${formatNumber(s.value, 2)}</td>
              <td style="text-align: right; color: ${s.color}; font-weight: 600;">${total > 0 ? ((s.value / total) * 100).toFixed(1) : '0'}%</td>
            </tr>
          `).join('')}
          <tr style="border-top: 2px solid #e7e5e4; font-weight: 700;">
            <td colspan="2">Total</td>
            <td style="text-align: right;">${formatNumber(total, 2)}</td>
            <td style="text-align: right;">100%</td>
          </tr>
        </tbody>
      </table>

      ${renderPageFooter(2)}
    </div>`;
}

function renderTrendsPage(config: ReportConfig, data: ReportData): string {
  if (!data.emissionsTrends || data.emissionsTrends.length < 2) return '';

  const trends = data.emissionsTrends;
  const maxTotal = Math.max(...trends.map(t => t.total), 0.001);

  const trendRows = trends.map(t => {
    const yoyValue = t.yoyChange ? parseFloat(t.yoyChange) : NaN;
    const arrow = isNaN(yoyValue) ? '' : yoyValue < 0 ? '&#9660;' : yoyValue > 0 ? '&#9650;' : '&#9654;';
    const arrowColor = isNaN(yoyValue) ? '#78716c' : yoyValue < 0 ? '#22c55e' : yoyValue > 0 ? '#ef4444' : '#78716c';

    return `<tr>
      <td style="font-weight: 600;">${t.year}</td>
      <td style="text-align: right;">${formatNumber(t.scope1, 1)}</td>
      <td style="text-align: right;">${formatNumber(t.scope2, 1)}</td>
      <td style="text-align: right;">${formatNumber(t.scope3, 1)}</td>
      <td style="text-align: right; font-weight: 600;">${formatNumber(t.total, 1)}</td>
      <td style="text-align: right; color: ${arrowColor}; font-weight: 600;">
        ${isNaN(yoyValue) ? 'N/A' : `<span style="font-size: 10px;">${arrow}</span> ${Math.abs(yoyValue).toFixed(1)}%`}
      </td>
    </tr>`;
  }).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('03', 'Emissions Trends')}

      <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">MULTI-YEAR COMPARISON</div>

      <table class="data-table" style="margin-bottom: 28px;">
        <thead>
          <tr>
            <th>Year</th>
            <th style="text-align: right;">Scope 1</th>
            <th style="text-align: right;">Scope 2</th>
            <th style="text-align: right;">Scope 3</th>
            <th style="text-align: right;">Total (tCO&#8322;e)</th>
            <th style="text-align: right;">YoY Change</th>
          </tr>
        </thead>
        <tbody>${trendRows}</tbody>
      </table>

      <div style="margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 16px; color: #1c1917;">Annual Total Emissions</div>
        ${trends.map(t => `
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
            <div style="width: 50px; font-size: 13px; font-weight: 600; color: #1c1917; text-align: right; flex-shrink: 0;">${t.year}</div>
            <div style="flex: 1; height: 28px; background: #e7e5e4; border-radius: 6px; overflow: hidden; display: flex;">
              <div style="height: 100%; width: ${(t.scope1 / maxTotal) * 100}%; background: ${SCOPE_COLOURS.scope1};"></div>
              <div style="height: 100%; width: ${(t.scope2 / maxTotal) * 100}%; background: ${SCOPE_COLOURS.scope2};"></div>
              <div style="height: 100%; width: ${(t.scope3 / maxTotal) * 100}%; background: ${SCOPE_COLOURS.scope3};"></div>
            </div>
            <div style="width: 80px; font-size: 12px; font-weight: 600; color: #1c1917; flex-shrink: 0; text-align: right;">${formatNumber(t.total, 1)}</div>
          </div>
        `).join('')}
      </div>

      <div style="display: flex; gap: 16px; font-size: 11px; color: #78716c;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="width: 12px; height: 12px; border-radius: 3px; background: ${SCOPE_COLOURS.scope1};"></div>
          Scope 1
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="width: 12px; height: 12px; border-radius: 3px; background: ${SCOPE_COLOURS.scope2};"></div>
          Scope 2
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="width: 12px; height: 12px; border-radius: 3px; background: ${SCOPE_COLOURS.scope3};"></div>
          Scope 3
        </div>
      </div>

      ${renderPageFooter(3)}
    </div>`;
}

function renderProductsPage(config: ReportConfig, data: ReportData): string {
  if (!data.products || data.products.length === 0) return '';

  const avgImpact = data.products.reduce((sum, p) => sum + p.climateImpact, 0) / data.products.length;
  const maxImpact = Math.max(...data.products.map(p => p.climateImpact), 0.001);

  const productRows = data.products.slice(0, 15).map(p => `
    <tr>
      <td style="font-weight: 500;">${escapeHtml(p.name)}</td>
      <td style="font-size: 11px; color: #78716c;">${escapeHtml(p.functionalUnit)}</td>
      <td style="text-align: right; font-weight: 600;">${formatNumber(p.climateImpact, 4)}</td>
      <td style="width: 200px;">
        <div style="height: 12px; background: #e7e5e4; border-radius: 6px; overflow: hidden;">
          <div style="height: 100%; width: ${(p.climateImpact / maxImpact) * 100}%; background: ${p.climateImpact > avgImpact ? '#f97316' : '#22c55e'}; border-radius: 6px;"></div>
        </div>
      </td>
    </tr>
  `).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('04', 'Product Impact')}

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Products Assessed</div>
          <div class="metric-value" style="font-size: 32px;">${data.products.length}</div>
          <div class="metric-unit">with LCA data</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Average Impact</div>
          <div class="metric-value" style="font-size: 24px;">${formatNumber(avgImpact, 4)}</div>
          <div class="metric-unit">kg CO&#8322;e per unit</div>
        </div>
        <div class="metric-card" style="text-align: center; border-left: 3px solid #22c55e;">
          <div class="metric-label">Best Performer</div>
          <div class="metric-value" style="font-size: 16px;">${escapeHtml(data.products.reduce((best, p) => p.climateImpact < best.climateImpact ? p : best, data.products[0]).name)}</div>
          <div class="metric-unit">${formatNumber(Math.min(...data.products.map(p => p.climateImpact)), 4)} kg CO&#8322;e</div>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Functional Unit</th>
            <th style="text-align: right;">kg CO&#8322;e</th>
            <th>Relative Impact</th>
          </tr>
        </thead>
        <tbody>${productRows}</tbody>
      </table>

      ${data.products.length > 15 ? `<div style="font-size: 11px; color: #a8a29e; margin-top: 8px; font-style: italic;">Showing 15 of ${data.products.length} products</div>` : ''}

      ${renderPageFooter(4)}
    </div>`;
}

function renderVineyardsPage(config: ReportConfig, data: ReportData): string {
  if (!data.vineyards || data.vineyards.length === 0) return '';

  const totalHa = data.vineyards.reduce((sum, v) => sum + v.hectares, 0);
  const avgEmissions = data.vineyards.reduce((sum, v) => sum + v.emissionsPerHa, 0) / data.vineyards.length;
  const totalRemovals = data.vineyards.reduce((sum, v) => sum + v.removalsPerHa * v.hectares, 0);

  const vineyardRows = data.vineyards.map(v => `
    <tr>
      <td style="font-weight: 500;">${escapeHtml(v.name)}</td>
      <td style="text-align: center;">${formatNumber(v.hectares, 1)}</td>
      <td style="text-align: center; text-transform: capitalize;">${escapeHtml(v.certification)}</td>
      <td style="text-align: right;">${formatNumber(v.emissionsPerHa, 1)}</td>
      <td style="text-align: right;">${formatNumber(v.waterPerHa, 0)}</td>
      <td style="text-align: right; color: #22c55e;">${formatNumber(v.removalsPerHa, 1)}</td>
      <td style="text-align: center;">${v.vintages}</td>
    </tr>
  `).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('05', 'Viticulture &amp; Land Stewardship')}

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Vineyard Area</div>
          <div class="metric-value" style="font-size: 32px;">${formatNumber(totalHa, 1)}</div>
          <div class="metric-unit">hectares</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Avg Emissions</div>
          <div class="metric-value" style="font-size: 24px;">${formatNumber(avgEmissions, 1)}</div>
          <div class="metric-unit">kg CO&#8322;e per hectare</div>
        </div>
        <div class="metric-card" style="text-align: center; border-left: 3px solid #22c55e;">
          <div class="metric-label">Soil Carbon Removals</div>
          <div class="metric-value" style="font-size: 24px; color: #22c55e;">${formatNumber(totalRemovals, 0)}</div>
          <div class="metric-unit">kg CO&#8322;e sequestered</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Vineyards</div>
          <div class="metric-value" style="font-size: 32px;">${data.vineyards.length}</div>
          <div class="metric-unit">assessed</div>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Vineyard</th>
            <th style="text-align: center;">Hectares</th>
            <th style="text-align: center;">Certification</th>
            <th style="text-align: right;">kg CO&#8322;e/ha</th>
            <th style="text-align: right;">Water m&#179;/ha</th>
            <th style="text-align: right;">Removals/ha</th>
            <th style="text-align: center;">Vintages</th>
          </tr>
        </thead>
        <tbody>${vineyardRows}</tbody>
      </table>

      <div style="margin-top: 20px; padding: 16px; background: #f5f5f4; border-radius: 8px; font-size: 11px; color: #78716c;">
        <strong style="color: #1c1917;">SBTi FLAG Compliance:</strong> Emissions and soil carbon removals are reported
        separately in accordance with SBTi Forest, Land and Agriculture (FLAG) Guidance v1.2. Removals are never netted
        against emissions. N&#8322;O calculations use IPCC 2019 Refinement Tier 1 methodology with climate zone disaggregation.
      </div>

      ${renderPageFooter(5)}
    </div>`;
}

function renderPeopleCulturePage(config: ReportConfig, data: ReportData): string {
  if (!data.peopleCulture) return '';
  const pc = data.peopleCulture;

  const pillars = [
    { label: 'Fair Work', score: pc.fairWorkScore, color: '#22c55e' },
    { label: 'Diversity & Inclusion', score: pc.diversityScore, color: '#3b82f6' },
    { label: 'Wellbeing', score: pc.wellbeingScore, color: '#8b5cf6' },
    { label: 'Training & Development', score: pc.trainingScore, color: '#f97316' },
  ];

  const maxScore = 100;

  return `
    <div class="page light-page">
      ${renderSectionHeader('05', 'People &amp; Culture')}

      <div style="display: flex; gap: 24px; margin-bottom: 28px;">
        <div style="flex: 1; background: #1c1917; border-radius: 16px; padding: 28px; color: white;">
          <div style="font-size: 12px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Overall Score</div>
          <div style="font-size: 56px; font-family: 'Playfair Display', serif; font-weight: 700; color: #ccff00;">${pc.overallScore}<span style="font-size: 20px; color: #78716c;">/100</span></div>
          <div style="font-size: 12px; color: #a8a29e; margin-top: 4px;">${pc.dataCompleteness.toFixed(0)}% data completeness</div>
        </div>
        <div style="flex: 1;">
          ${pillars.map(p => `
            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 12px; font-weight: 500; color: #1c1917;">${escapeHtml(p.label)}</span>
                <span style="font-size: 12px; font-weight: 700; color: ${p.color};">${p.score}/100</span>
              </div>
              ${percentBar(p.score, maxScore, p.color)}
            </div>
          `).join('')}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Employees</div>
          <div class="metric-value" style="font-size: 24px;">${pc.totalEmployees}</div>
          <div class="metric-unit">total headcount</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Female %</div>
          <div class="metric-value" style="font-size: 24px;">${pc.femalePercentage !== null ? pc.femalePercentage.toFixed(0) + '%' : 'N/A'}</div>
          <div class="metric-unit">of workforce</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">New Hires</div>
          <div class="metric-value" style="font-size: 24px;">${pc.newHires}</div>
          <div class="metric-unit">${pc.departures} departures</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Turnover</div>
          <div class="metric-value" style="font-size: 24px;">${pc.turnoverRate !== null ? pc.turnoverRate.toFixed(1) + '%' : 'N/A'}</div>
          <div class="metric-unit">annual rate</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
        ${pc.livingWageCompliance !== null ? `
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Living Wage</div>
          <div class="metric-value" style="font-size: 24px; color: ${pc.livingWageCompliance >= 90 ? '#22c55e' : '#f97316'};">${pc.livingWageCompliance.toFixed(0)}%</div>
          <div class="metric-unit">compliance</div>
        </div>` : ''}
        ${pc.trainingHoursPerEmployee !== null ? `
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Training</div>
          <div class="metric-value" style="font-size: 24px;">${pc.trainingHoursPerEmployee.toFixed(1)}</div>
          <div class="metric-unit">hours per employee</div>
        </div>` : ''}
        ${pc.genderPayGapMean !== null ? `
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Gender Pay Gap</div>
          <div class="metric-value" style="font-size: 24px; color: ${pc.genderPayGapMean <= 5 ? '#22c55e' : '#f97316'};">${pc.genderPayGapMean.toFixed(1)}%</div>
          <div class="metric-unit">mean gap</div>
        </div>` : ''}
      </div>

      ${renderPageFooter(5)}
    </div>`;
}

function renderGovernancePage(config: ReportConfig, data: ReportData): string {
  if (!data.governance) return '';
  const gov = data.governance;

  const boardRows = gov.boardMembers.slice(0, 10).map(m => `
    <tr>
      <td style="font-weight: 500;">${escapeHtml(m.name)}</td>
      <td>${escapeHtml(m.role)}</td>
      <td>${m.gender ? escapeHtml(m.gender) : 'N/A'}</td>
      <td>${m.isIndependent === null ? 'N/A' : m.isIndependent ? 'Yes' : 'No'}</td>
      <td style="text-align: right;">${m.attendanceRate !== null ? m.attendanceRate.toFixed(0) + '%' : 'N/A'}</td>
    </tr>
  `).join('');

  const policyRows = gov.policies.slice(0, 8).map(p => {
    const statusColor = p.status === 'active' ? '#22c55e' : p.status === 'draft' ? '#eab308' : '#ef4444';
    return `
    <tr>
      <td style="font-weight: 500;">${escapeHtml(p.name)}</td>
      <td style="font-size: 11px; color: #78716c;">${escapeHtml(p.type)}</td>
      <td><span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: ${statusColor}20; color: ${statusColor};">${escapeHtml(p.status)}</span></td>
      <td>${p.isPublic ? '&#10003; Public' : 'Internal'}</td>
    </tr>`;
  }).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('06', 'Governance')}

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Board Size</div>
          <div class="metric-value" style="font-size: 24px;">${gov.boardDiversityMetrics.totalMembers}</div>
          <div class="metric-unit">members</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Female %</div>
          <div class="metric-value" style="font-size: 24px; color: #3b82f6;">${gov.boardDiversityMetrics.femalePercentage.toFixed(0)}%</div>
          <div class="metric-unit">board diversity</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Independent %</div>
          <div class="metric-value" style="font-size: 24px;">${gov.boardDiversityMetrics.independentPercentage.toFixed(0)}%</div>
          <div class="metric-unit">of directors</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Policy Score</div>
          <div class="metric-value" style="font-size: 24px; color: ${gov.policyCompleteness >= 75 ? '#22c55e' : '#f97316'};">${gov.policyCompleteness.toFixed(0)}%</div>
          <div class="metric-unit">completeness</div>
        </div>
      </div>

      <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">Board Composition</div>
      <table class="data-table" style="margin-bottom: 20px; font-size: 11px;">
        <thead>
          <tr><th>Name</th><th>Role</th><th>Gender</th><th>Independent</th><th style="text-align: right;">Attendance</th></tr>
        </thead>
        <tbody>${boardRows}</tbody>
      </table>

      <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">Policies &amp; Frameworks</div>
      <table class="data-table" style="margin-bottom: 20px; font-size: 11px;">
        <thead>
          <tr><th>Policy</th><th>Type</th><th>Status</th><th>Disclosure</th></tr>
        </thead>
        <tbody>${policyRows}</tbody>
      </table>

      ${gov.missionStatement ? `
      <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px;">
        <div style="font-size: 11px; font-weight: 600; color: #1c1917; margin-bottom: 6px;">Mission Statement</div>
        <p style="font-size: 12px; color: #44403c; line-height: 1.6; font-style: italic;">${escapeHtml(gov.missionStatement)}</p>
      </div>` : ''}

      ${renderPageFooter(6)}
    </div>`;
}

function renderCommunityImpactPage(config: ReportConfig, data: ReportData): string {
  if (!data.communityImpact) return '';
  const ci = data.communityImpact;

  const pillarScores = [
    { label: 'Giving', score: ci.givingScore, color: '#22c55e' },
    { label: 'Local Impact', score: ci.localImpactScore, color: '#3b82f6' },
    { label: 'Volunteering', score: ci.volunteeringScore, color: '#8b5cf6' },
    { label: 'Engagement', score: ci.engagementScore, color: '#f97316' },
  ];

  return `
    <div class="page light-page">
      ${renderSectionHeader('07', 'Community Impact')}

      <div style="display: flex; gap: 24px; margin-bottom: 24px;">
        <div style="flex: 1; background: #1c1917; border-radius: 16px; padding: 28px; color: white;">
          <div style="font-size: 12px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Community Score</div>
          <div style="font-size: 56px; font-family: 'Playfair Display', serif; font-weight: 700; color: #ccff00;">${ci.overallScore}<span style="font-size: 20px; color: #78716c;">/100</span></div>
          <div style="font-size: 12px; color: #a8a29e; margin-top: 4px;">${ci.dataCompleteness.toFixed(0)}% data completeness</div>
        </div>
        <div style="flex: 1;">
          ${pillarScores.map(p => `
            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 12px; font-weight: 500;">${escapeHtml(p.label)}</span>
                <span style="font-size: 12px; font-weight: 700; color: ${p.color};">${p.score}/100</span>
              </div>
              ${percentBar(p.score, 100, p.color)}
            </div>
          `).join('')}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Donations</div>
          <div class="metric-value" style="font-size: 20px;">${formatGBP(ci.totalDonations)}</div>
          <div class="metric-unit">${ci.donationCount} contributions</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Volunteer Hours</div>
          <div class="metric-value" style="font-size: 20px;">${formatNumber(ci.totalVolunteerHours, 0)}</div>
          <div class="metric-unit">${ci.volunteerActivities} activities</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Local Employment</div>
          <div class="metric-value" style="font-size: 20px;">${ci.localEmploymentRate !== null ? ci.localEmploymentRate.toFixed(0) + '%' : 'N/A'}</div>
          <div class="metric-unit">local hires</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Local Sourcing</div>
          <div class="metric-value" style="font-size: 20px;">${ci.localSourcingRate !== null ? ci.localSourcingRate.toFixed(0) + '%' : 'N/A'}</div>
          <div class="metric-unit">local suppliers</div>
        </div>
      </div>

      ${ci.impactStories.length > 0 ? `
      <div style="font-size: 12px; font-weight: 600; margin-bottom: 12px;">Impact Stories</div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
        ${ci.impactStories.slice(0, 4).map(s => `
          <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 10px; background: #f0fdf4; color: #166534;">${escapeHtml(s.category)}</span>
            </div>
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(s.title)}</div>
            <p style="font-size: 11px; color: #78716c; line-height: 1.5;">${escapeHtml(s.summary)}</p>
          </div>
        `).join('')}
      </div>` : ''}

      ${renderPageFooter(7)}
    </div>`;
}

function renderSupplyChainPage(config: ReportConfig, data: ReportData): string {
  if (!data.suppliers || data.suppliers.length === 0) return '';

  // Group suppliers by category
  const categories: Record<string, { count: number; suppliers: SupplierData[] }> = {};
  for (const s of data.suppliers) {
    const cat = s.category || 'Uncategorised';
    if (!categories[cat]) categories[cat] = { count: 0, suppliers: [] };
    categories[cat].count++;
    categories[cat].suppliers.push(s);
  }

  const categoryRows = Object.entries(categories)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(([cat, info]) => `
      <tr>
        <td style="font-weight: 500;">${escapeHtml(cat)}</td>
        <td style="text-align: center; font-weight: 600;">${info.count}</td>
        <td style="font-size: 11px; color: #78716c;">${info.suppliers.slice(0, 3).map(s => escapeHtml(s.name)).join(', ')}${info.count > 3 ? ` +${info.count - 3} more` : ''}</td>
      </tr>
    `).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('08', 'Supply Chain')}

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Total Suppliers</div>
          <div class="metric-value" style="font-size: 32px;">${data.suppliers.length}</div>
          <div class="metric-unit">in supply chain</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Categories</div>
          <div class="metric-value" style="font-size: 32px;">${Object.keys(categories).length}</div>
          <div class="metric-unit">supplier types</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Data Coverage</div>
          <div class="metric-value" style="font-size: 32px;">${data.suppliers.filter(s => Object.keys(s.emissionsData || {}).length > 0).length}</div>
          <div class="metric-unit">with emissions data</div>
        </div>
      </div>

      <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">Supplier Categories</div>
      <table class="data-table">
        <thead>
          <tr><th>Category</th><th style="text-align: center;">Count</th><th>Key Suppliers</th></tr>
        </thead>
        <tbody>${categoryRows}</tbody>
      </table>

      ${renderPageFooter(8)}
    </div>`;
}

function renderTargetsPage(config: ReportConfig, data: ReportData): string {
  const commitments = data.governance?.climateCommitments || [];

  return `
    <div class="page light-page">
      ${renderSectionHeader('09', 'Targets &amp; Commitments')}

      <div style="background: #1c1917; border-radius: 16px; padding: 28px; color: white; margin-bottom: 24px;">
        <div style="font-size: 12px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Climate Commitments</div>
        ${commitments.length > 0 ? commitments.map((c, i) => `
          <div style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px; padding-bottom: 16px; ${i < commitments.length - 1 ? 'border-bottom: 1px solid rgba(255,255,255,0.1);' : ''}">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: rgba(204,255,0,0.15); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <span style="font-size: 14px; font-weight: 700; color: #ccff00;">${i + 1}</span>
            </div>
            <div style="font-size: 14px; color: #d6d3d1; line-height: 1.6;">${escapeHtml(c)}</div>
          </div>
        `).join('') : `
          <p style="font-size: 14px; color: #78716c;">No climate commitments have been recorded yet. Consider setting Science Based Targets or committing to a net-zero pathway.</p>
        `}
      </div>

      ${data.governance?.sdgCommitments && data.governance.sdgCommitments.length > 0 ? `
      <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="font-size: 11px; font-family: 'Fira Code', monospace; text-transform: uppercase; letter-spacing: 2px; color: #78716c; margin-bottom: 12px;">UN Sustainable Development Goals</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${data.governance.sdgCommitments.map(sdg => `
            <div style="width: 48px; height: 48px; border-radius: 8px; background: #1c1917; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 18px; font-weight: 700; color: #ccff00;">${sdg}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px;">
        <div style="font-size: 11px; font-family: 'Fira Code', monospace; text-transform: uppercase; letter-spacing: 2px; color: #78716c; margin-bottom: 12px;">Emissions Trajectory</div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #a8a29e; margin-bottom: 4px;">Baseline Year</div>
            <div style="font-size: 20px; font-weight: 700; color: #1c1917;">${data.emissionsTrends.length > 0 ? data.emissionsTrends[0].year : config.reportYear}</div>
            <div style="font-size: 12px; color: #78716c;">${data.emissionsTrends.length > 0 ? formatNumber(data.emissionsTrends[0].total, 1) : formatNumber(data.emissions.total, 1)} tCO&#8322;e</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #a8a29e; margin-bottom: 4px;">Current Year</div>
            <div style="font-size: 20px; font-weight: 700; color: #1c1917;">${config.reportYear}</div>
            <div style="font-size: 12px; color: #78716c;">${formatNumber(data.emissions.total, 1)} tCO&#8322;e</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #a8a29e; margin-bottom: 4px;">Direction</div>
            ${data.emissionsTrends.length >= 2 ? (() => {
              const latest = data.emissionsTrends[data.emissionsTrends.length - 1];
              const yoy = latest.yoyChange ? parseFloat(latest.yoyChange) : NaN;
              const color = isNaN(yoy) ? '#78716c' : yoy < 0 ? '#22c55e' : '#ef4444';
              const label = isNaN(yoy) ? 'N/A' : yoy < 0 ? 'Decreasing' : 'Increasing';
              return `<div style="font-size: 20px; font-weight: 700; color: ${color};">${label}</div>
                <div style="font-size: 12px; color: #78716c;">${isNaN(yoy) ? '' : Math.abs(yoy).toFixed(1) + '% YoY'}</div>`;
            })() : `<div style="font-size: 20px; font-weight: 700; color: #78716c;">N/A</div><div style="font-size: 12px; color: #78716c;">Insufficient data</div>`}
          </div>
        </div>
      </div>

      ${renderPageFooter(9)}
    </div>`;
}

function renderMethodologyPage(config: ReportConfig, data: ReportData): string {
  const standardsRows = data.standards.map(s => {
    const statusColor = s.status === 'Compliant' || s.status === 'compliant' ? '#22c55e' : s.status === 'Partial' || s.status === 'partial' ? '#eab308' : '#78716c';
    return `
    <tr>
      <td style="font-weight: 500;">${escapeHtml(s.code)}</td>
      <td>${escapeHtml(s.name)}</td>
      <td><span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: ${statusColor}20; color: ${statusColor};">${escapeHtml(s.status)}</span></td>
      <td style="font-size: 11px; color: #78716c;">${escapeHtml(s.detail)}</td>
    </tr>`;
  }).join('');

  const qualityTierLabels: Record<string, string> = {
    tier_1: 'Tier 1 (Primary Data)',
    tier_2: 'Tier 2 (Secondary Data)',
    tier_3: 'Tier 3 (Proxy/Estimated)',
    mixed: 'Mixed Sources',
  };

  return `
    <div class="page light-page">
      ${renderSectionHeader('10', 'Methodology &amp; Standards')}

      <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">REPORTING FRAMEWORK COMPLIANCE</div>

      <table class="data-table" style="margin-bottom: 24px;">
        <thead>
          <tr><th>Code</th><th>Standard</th><th>Status</th><th>Detail</th></tr>
        </thead>
        <tbody>${standardsRows}</tbody>
      </table>

      ${data.dataQuality ? `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Data Completeness</div>
          <div class="metric-value" style="font-size: 24px; color: ${data.dataQuality.completeness >= 80 ? '#22c55e' : '#f97316'};">${data.dataQuality.completeness.toFixed(0)}%</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Quality Tier</div>
          <div style="font-size: 14px; font-weight: 600; color: #1c1917; margin-top: 8px;">${escapeHtml(qualityTierLabels[data.dataQuality.qualityTier] || data.dataQuality.qualityTier)}</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Confidence</div>
          <div class="metric-value" style="font-size: 24px;">${data.dataQuality.confidenceScore.toFixed(0)}%</div>
        </div>
      </div>` : ''}

      <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px;">
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 12px;">Data Sources</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; color: #44403c;">
          <div style="padding: 8px 12px; background: #fafaf9; border-radius: 8px;">
            <span style="font-weight: 600;">Emissions Data:</span> Direct measurement and utility records where available, supplemented with DEFRA emission factors
          </div>
          <div style="padding: 8px 12px; background: #fafaf9; border-radius: 8px;">
            <span style="font-weight: 600;">Product LCA:</span> Calculated using ISO 14044/14067 methodology with ecoinvent and AGRIBALYSE databases
          </div>
          <div style="padding: 8px 12px; background: #fafaf9; border-radius: 8px;">
            <span style="font-weight: 600;">Social Data:</span> Organisation records, HR systems, and self-reported metrics
          </div>
          <div style="padding: 8px 12px; background: #fafaf9; border-radius: 8px;">
            <span style="font-weight: 600;">Reporting Period:</span> ${escapeHtml(formatDateRange(config.reportingPeriodStart, config.reportingPeriodEnd))}
          </div>
        </div>
      </div>

      ${renderPageFooter(10)}
    </div>`;
}

function renderClosingPage(config: ReportConfig, data: ReportData): string {
  return `
    <div class="page dark-page" style="justify-content: center; align-items: center; text-align: center;">
      <div style="margin-bottom: 48px;">
        ${alkateraLogo(56)}
      </div>

      <h1 style="font-size: 48px; font-family: 'Playfair Display', serif; font-weight: 300; color: white; margin-bottom: 16px;">Thank You</h1>
      <p style="font-size: 16px; color: #a8a29e; max-width: 400px; line-height: 1.8; margin-bottom: 48px;">
        This sustainability report was prepared for ${escapeHtml(data.organization.name)} covering the ${config.reportYear} reporting period.
      </p>

      <div style="border-top: 1px solid rgba(255,255,255,0.15); padding-top: 32px; max-width: 400px;">
        <div style="font-size: 11px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 16px;">Prepared By</div>
        <p style="font-size: 14px; color: #d6d3d1; margin-bottom: 4px;">${escapeHtml(data.organization.name)}</p>
        ${data.organization.industry_sector ? `<p style="font-size: 12px; color: #78716c; margin-bottom: 16px;">${escapeHtml(data.organization.industry_sector)}</p>` : ''}
        <p style="font-size: 12px; color: #78716c; margin-bottom: 4px;">Generated with alkatera</p>
        <p style="font-size: 11px; color: #a8a29e;">alkatera.com</p>
      </div>

      <div style="position: absolute; bottom: 48px; left: 48px; right: 48px; display: flex; justify-content: space-between; font-size: 9px; font-family: 'Fira Code', monospace; color: rgba(255,255,255,0.2); text-transform: uppercase; letter-spacing: 3px;">
        <div>Confidential</div>
        <div>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>`;
}

// ============================================================================
// HELPER: Date formatting
// ============================================================================

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return `${startDate.toLocaleDateString('en-GB', options)} to ${endDate.toLocaleDateString('en-GB', options)}`;
}

// ============================================================================
// MAIN RENDERER
// ============================================================================

/**
 * Render the full sustainability report as a self-contained HTML document.
 *
 * This HTML can be sent directly to PDFShift for conversion to PDF.
 * Uses pure HTML/CSS with Google Fonts. No React runtime, no Tailwind CDN.
 * Charts are rendered using CSS conic-gradient and flex layouts.
 *
 * Pages are conditionally included based on config.sections and data availability.
 */
export function renderSustainabilityReportHtml(
  config: ReportConfig,
  data: ReportData,
): string {
  const sections = new Set(config.sections);

  const pages = [
    // Always included
    renderCoverPage(config, data),
    renderExecSummaryPage(config, data),
    renderEmissionsPage(config, data),
    // Conditional sections
    sections.has('trends') && data.emissionsTrends && data.emissionsTrends.length >= 2
      ? renderTrendsPage(config, data) : '',
    sections.has('products') && data.dataAvailability.hasProducts
      ? renderProductsPage(config, data) : '',
    data.dataAvailability.hasVineyards && data.vineyards && data.vineyards.length > 0
      ? renderVineyardsPage(config, data) : '',
    sections.has('people') && data.dataAvailability.hasPeopleCulture
      ? renderPeopleCulturePage(config, data) : '',
    sections.has('governance') && data.dataAvailability.hasGovernance
      ? renderGovernancePage(config, data) : '',
    sections.has('community') && data.dataAvailability.hasCommunityImpact
      ? renderCommunityImpactPage(config, data) : '',
    sections.has('supply-chain') && data.dataAvailability.hasSuppliers
      ? renderSupplyChainPage(config, data) : '',
    // Always included
    renderTargetsPage(config, data),
    renderMethodologyPage(config, data),
    renderClosingPage(config, data),
  ].filter(Boolean).join('\n');

  // Replace __PAGE_NUM__ placeholders with sequential page numbers.
  // The cover page has no page number, so the first __PAGE_NUM__ is page 1.
  let pageCounter = 0;
  const pagesWithNumbers = pages.replace(/__PAGE_NUM__/g, () => String(++pageCounter));

  const primaryColor = config.branding.primaryColor || '#ccff00';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(config.reportName)} - ${escapeHtml(data.organization.name)}</title>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@300;700&family=Fira+Code:wght@400;700&display=swap" rel="stylesheet" />

  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      background: white;
      color: #1c1917;
    }

    @page { size: A4; margin: 0; }

    .page {
      width: 794px;
      height: 1123px;
      position: relative;
      display: flex;
      flex-direction: column;
      padding: 48px;
      padding-bottom: 96px;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }

    .page:last-child { page-break-after: auto; break-after: auto; }

    .dark-page { background: #1c1917; color: white; }
    .light-page { background: #f5f5f4; color: #1c1917; }

    .metric-card {
      background: white;
      border: 1px solid #e7e5e4;
      border-radius: 12px;
      padding: 20px;
    }

    .metric-label {
      font-size: 11px;
      font-family: 'Fira Code', monospace;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #78716c;
      margin-bottom: 8px;
    }

    .metric-value {
      font-size: 32px;
      font-family: 'Playfair Display', serif;
      font-weight: 700;
      color: #1c1917;
    }

    .metric-unit {
      font-size: 12px;
      color: #a8a29e;
      margin-top: 4px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .data-table thead th {
      text-align: left;
      padding: 10px 12px;
      font-size: 11px;
      font-family: 'Fira Code', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #78716c;
      border-bottom: 2px solid #e7e5e4;
    }

    .data-table tbody td {
      padding: 10px 12px;
      border-bottom: 1px solid #f5f5f4;
      color: #44403c;
    }

    .data-table tbody tr:nth-child(even) { background: #fafaf9; }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .badge-low { background: #dcfce7; color: #166534; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-high { background: #fee2e2; color: #991b1b; }

    @media print {
      body { background: white; }
      .page { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
  ${pagesWithNumbers}
</body>
</html>`;
}
