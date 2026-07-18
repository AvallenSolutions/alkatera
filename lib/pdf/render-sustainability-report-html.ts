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

import { resolveTheme, getThemeFontImport, type ReportTheme } from '@/lib/pdf/templates/themes';
import {
  INK, CREAM, PAPER, HAIR, DIM, GOOD, ATTN, STALE, MONO, SG, INTER,
  onBand, wordmark, toneChip,
} from '@/lib/pdf/studio-kit';

// ============================================================================
// DENSITY HELPERS
// ============================================================================

/** Returns font sizes and spacing derived from the theme's density setting. */
function getDensityStyles(theme?: ReportTheme) {
  const density = theme?.density ?? 'comfortable';
  switch (density) {
    case 'dense':
      return { bodySize: 11, headingSize: 20, padding: 36, gap: 12, sectionGap: 20 };
    case 'compact':
      return { bodySize: 12, headingSize: 24, padding: 40, gap: 14, sectionGap: 24 };
    case 'comfortable':
    default:
      return { bodySize: 13, headingSize: 32, padding: 48, gap: 16, sectionGap: 32 };
  }
}

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
  // Hospitality element (Scope 3 Cat 1), reported as its own line when counted
  // in the total. All in kg CO2e. Optional so existing callers are unaffected.
  hospitality?: number;
  hospitalityFood?: number;
  hospitalitySupplies?: number;
  hospitalityWaste?: number;
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
    photo?: string;
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

interface KeyFinding {
  title: string;
  narrative: string;
  scope: string;
  direction: string;
  magnitude_pct: number;
  confidence: string;
}

// ============================================================================
// NARRATIVE TYPES (mirrored from lib/claude/section-narrative-assistant.ts)
// ============================================================================

interface SectionNarrative {
  headlineInsight: string;
  contextParagraph: string;
  nextStepPrompt: string;
  dataConfidenceStatement: string | null;
  methodologyFootnote: string | null;
  readonly aiGenerated: true;
}

interface ExecutiveSummaryNarrative {
  summaryText: string;
  primaryMessage: string;
  readonly aiGenerated: true;
}

interface ReportNarratives {
  executiveSummary?: ExecutiveSummaryNarrative;
  sections?: Partial<Record<string, SectionNarrative>>;
}

// ============================================================================

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
  keyFindings?: KeyFinding[];
  /** Pre-generated AI narrative blocks, keyed by section ID */
  narratives?: ReportNarratives;
  /** Materiality assessment data for callouts and ESRS index */
  materiality?: {
    priority_topics: string[];
    topics: Array<{
      id: string;
      name: string;
      category: string;
      status: string;
      impactScore?: number;
      financialScore?: number;
      rationale?: string;
      esrsReference?: string;
      griReference?: string;
    }>;
    completed_at: string | null;
  };
  materialityComplete?: boolean;
  /** Set to true when CSRD is selected but materiality assessment is incomplete */
  csrdGatingWarning?: boolean;
  /** Transition plan data for Roadmap and R&O sections */
  transitionPlan?: {
    plan_year: number;
    baseline_year: number;
    baseline_emissions_tco2e: number | null;
    targets: Array<{
      id: string;
      scope: 'scope1' | 'scope2' | 'scope3' | 'total';
      targetYear: number;
      reductionPct: number;
      absoluteTargetTco2e?: number;
      notes?: string;
    }>;
    milestones: Array<{
      id: string;
      title: string;
      targetDate: string;
      status: 'not_started' | 'in_progress' | 'complete';
      emissionsImpactTco2e?: number;
      notes?: string;
    }>;
    risks_and_opportunities: Array<{
      id: string;
      type: 'risk' | 'opportunity';
      category: string;
      title: string;
      description: string;
      likelihood: 'low' | 'medium' | 'high';
      impact: 'low' | 'medium' | 'high';
      timeHorizon: 'short' | 'medium' | 'long';
      aiGenerated: boolean;
    }> | null;
    sbti_aligned: boolean;
    sbti_target_year: number | null;
  };
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
  /** Theme id (lib/pdf/templates/themes.ts); falls back to Classic. */
  template?: string;
  orientation?: 'portrait' | 'landscape';
  branding: {
    logo: string | null;
    primaryColor: string;
    secondaryColor: string;
    heroImages?: string[];
    leadership?: {
      name?: string;
      title?: string;
      message?: string;
      photo?: string;
    };
  };
  reportFramingStatement?: string;
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
    <div style="flex: 1; height: 12px; background: #D9D6CB; border-radius: 6px; overflow: hidden;">
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

// ============================================================================
// STORYTELLING TIER
// ============================================================================

/**
 * Determines the storytelling richness for a given audience.
 * - 'full'       → leadership page, section dividers, rich story cards (investors, customers, supply-chain)
 * - 'balanced'   → section dividers + story cards, no leadership page (internal)
 * - 'data-first' → no storytelling additions (regulators, technical)
 */
function getStorytellingTier(audience: string): 'full' | 'balanced' | 'data-first' {
  if (['customers', 'investors', 'supply-chain'].includes(audience)) return 'full';
  if (audience === 'internal') return 'balanced';
  return 'data-first';
}

// ============================================================================
// BRAND ELEMENTS
// ============================================================================

const ALKATERA_LOGO_URL = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';

/** Renders the organisation logo (falls back to alkatera logo if none set). */
function orgLogo(config: { branding: { logo: string | null } }, height: number, _dark = true): string {
  const logoUrl = config.branding.logo || ALKATERA_LOGO_URL;
  const altText = config.branding.logo ? 'Organisation Logo' : 'alkatera';
  // Org logos render as-is (no colour filter). They may be designed for light or dark backgrounds.
  // If the org uploads a dark logo used on a dark cover, they can fix it by uploading a lighter version.
  return `<img src="${logoUrl}" alt="${altText}" style="height: ${height}px; width: auto; object-fit: contain;" />`;
}

/** @deprecated Use orgLogo() instead — this always renders the alkatera logo */
function alkateraLogo(height: number, dark = true): string {
  const filter = dark ? '' : 'filter: brightness(0);';
  return `<img src="${ALKATERA_LOGO_URL}" alt="alkatera" style="height: ${height}px; width: auto; object-fit: contain; ${filter}" />`;
}

/**
 * Returns the brand colour to use in templates.
 * Organisations set their own primaryColor; falls back to a neutral blue if not set.
 */
function getBrandColor(config: { branding: { primaryColor: string } }): string {
  return config.branding.primaryColor || '#205E40';
}

/** Returns the secondary colour for accents. */
function getSecondaryColor(config: { branding: { secondaryColor?: string } }): string {
  return (config.branding as any).secondaryColor || '#047857';
}

const SCOPE_COLOURS = {
  scope1: '#047857',
  scope2: '#2B46C0',
  scope3: '#BF4B2A',
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

/**
 * Section header in the studio idiom. The customer's brand colour takes the
 * saturated-band slot with automatic ink/cream contrast (studio-kit onBand);
 * the three theme styles map to the band's registers:
 * - 'numbered' (Annual/Editorial): the full colour band, `NN · TITLE` mono.
 * - 'divider-line' (Working/Technical): quiet register — mono eyebrow in the
 *   brand accent over an SG title on an ink hairline. No saturated block.
 * - 'bold-block' (Board): the band at poster padding.
 */
function renderSectionHeader(number: string, title: string, _dark = false, continuation = false, brandColor = '#205E40', theme?: ReportTheme): string {
  const ds = getDensityStyles(theme);
  const style = theme?.sectionHeaderStyle ?? 'numbered';
  const meta = continuation ? 'CONTINUED' : '';
  const mb = continuation ? ds.sectionGap - 8 : ds.sectionGap;

  if (style === 'divider-line') {
    return `
    <div style="margin-bottom: ${mb}px; border-bottom: 1px solid ${INK}; padding-bottom: 10px;">
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${brandColor};margin-bottom:6px">${number}${continuation ? ' · CONTINUED' : ''}</div>
      <h2 style="font-family:${SG};font-size:${continuation ? 20 : 24}px;font-weight:700;letter-spacing:-.02em;color:${INK}">${escapeHtml(title)}</h2>
    </div>`;
  }

  const on = onBand(brandColor);
  const pad = style === 'bold-block' ? '18px 24px' : '14px 20px';
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;background:${brandColor};border-radius:6px;padding:${pad};margin-bottom:${mb}px">
      <div style="font-family:${MONO};font-size:10.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${on.fg}">${number} · ${escapeHtml(title)}</div>
      ${meta ? `<div style="font-family:${MONO};font-size:9px;font-weight:500;letter-spacing:.12em;text-align:right;color:${on.meta}">${meta}</div>` : ''}
    </div>`;
}

/** The studio footer: GENERATED BY wordmark · page number · meta + date. */
function renderPageFooter(config: ReportConfig, pageNumber?: number, dark = false, standardsLabel?: string, theme?: ReportTheme): string {
  const pad = theme?.pagePadding ?? 48;
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  const rightText = standardsLabel ? `${standardsLabel.toUpperCase()} · ${dateStr}` : dateStr;
  const fg = dark ? 'rgba(242,241,234,.6)' : DIM;
  const rule = dark ? 'rgba(242,241,234,.3)' : HAIR;
  const bgColor = dark ? (theme?.pageDarkBackground ?? INK) : (theme?.pageBackground ?? PAPER);

  return `
    <div class="page-footer" style="position: absolute; bottom: 0; left: 0; right: 0; z-index: 10; background: ${bgColor}; padding: 0 ${pad}px 26px ${pad}px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid ${rule};padding-top:8px;font-family:${MONO};font-size:9px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:${fg}">
        <div>GENERATED BY <span style="text-transform:none">${wordmark(11, dark ? CREAM : INK)}</span></div>
        ${pageNumber !== undefined ? `<div style="font-weight:700">__PAGE_NUM__</div>` : ''}
        <div>${escapeHtml(rightText)}</div>
      </div>
    </div>`;
}

/**
 * Renders an AI-generated narrative block as styled HTML.
 * Visually distinct from data tables — light background, left accent bar.
 * The dataConfidenceStatement renders in a smaller, muted style below.
 */
function renderNarrativeBlock(narrative: SectionNarrative): string {
  return `
    <!-- AI_GENERATED -->
    <div class="narrative-block">
      <div class="narrative-headline">${escapeHtml(narrative.headlineInsight)}</div>
      <div class="narrative-context">${escapeHtml(narrative.contextParagraph)}</div>
      <div class="narrative-next-step">${escapeHtml(narrative.nextStepPrompt)}</div>
      ${narrative.dataConfidenceStatement ? `
      <div class="narrative-confidence">${escapeHtml(narrative.dataConfidenceStatement)}</div>` : ''}
    </div>
    ${narrative.methodologyFootnote ? `
    <div class="narrative-footnote">${escapeHtml(narrative.methodologyFootnote)}</div>` : ''}`;
}

/**
 * Renders the executive summary narrative block (slightly larger, no footnote).
 */
function renderExecutiveSummaryNarrativeBlock(narrative: ExecutiveSummaryNarrative): string {
  return `
    <!-- AI_GENERATED -->
    <div class="narrative-block" style="border-left-width: 4px; margin-bottom: 24px;">
      <div class="narrative-headline" style="font-size: 16px;">${escapeHtml(narrative.primaryMessage)}</div>
      <div class="narrative-context" style="font-size: 14px; line-height: 1.7;">${escapeHtml(narrative.summaryText)}</div>
    </div>`;
}

// Maps section IDs to materiality topic IDs (mirrors section-narrative-assistant.ts)
const SECTION_TO_TOPIC: Record<string, string> = {
  'scope-1-2-3': 'climate-mitigation',
  'emissions-breakdown': 'climate-mitigation',
  'key-findings': 'climate-mitigation',
  'trends': 'climate-mitigation',
  'products': 'product-footprints',
  'people': 'employee-wellbeing',
  'governance': 'governance-accountability',
  'community': 'community-engagement',
  'supply-chain': 'supply-chain-standards',
};

/**
 * Renders a small materiality context callout for a given section.
 * Shows "This is a priority topic" if the topic is in priority_topics,
 * or "This is a material topic" if status === 'material'.
 * Returns empty string if the topic is not material.
 */
function renderMaterialityCallout(config: ReportConfig, sectionId: string, data: ReportData): string {
  if (!data.materiality?.completed_at) return '';
  const topicId = SECTION_TO_TOPIC[sectionId];
  if (!topicId) return '';
  const topic = data.materiality.topics.find(t => t.id === topicId);
  if (!topic || topic.status !== 'material') return '';

  const brandColor = getBrandColor(config);
  const isPriority = data.materiality.priority_topics.includes(topicId);
  const accentColor = isPriority ? brandColor : '#F2F1EA';
  const dotColor = isPriority ? '#047857' : '#047857';
  const textColor = isPriority ? '#1A1B1D' : '#205E40';
  const label = isPriority ? 'Priority Material Topic' : 'Material Topic';
  const rationale = topic.rationale ? ` — ${topic.rationale}` : '';

  return `
    <div style="display: flex; align-items: flex-start; gap: 10px; background: ${accentColor}20; border: 1px solid ${accentColor}80; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
      <div style="width: 6px; height: 6px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0; margin-top: 4px;"></div>
      <div>
        <span style="font-size: 10px; font-family: 'JetBrains Mono', monospace; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: ${textColor};">${escapeHtml(label)}</span>
        <span style="font-size: 10px; color: ${textColor}; opacity: 0.8;">${escapeHtml(rationale)}</span>
        ${topic.esrsReference ? `<span style="display: inline-block; margin-left: 8px; font-size: 9px; font-family: 'JetBrains Mono', monospace; color: ${textColor}; opacity: 0.6;">ESRS ${escapeHtml(topic.esrsReference)}</span>` : ''}
      </div>
    </div>`;
}

// ============================================================================
// STORYTELLING PAGE RENDERERS
// ============================================================================

/**
 * Full-page leadership message. Only rendered when config.branding.leadership.message is set
 * and the audience tier is 'full'. Placed immediately after the cover page.
 */
/**
 * Leadership foreword: a brand poster block on the paper ground. The message
 * speaks in the statement voice; the author signs on a hairline, with the
 * portrait beside when provided. On-colour text follows onBand (ink on light
 * brands, cream on dark).
 */
function renderLeadershipPage(config: ReportConfig, theme?: ReportTheme): string {
  const leadership = config.branding?.leadership;
  if (!leadership?.message) return '';

  const brandColor = getBrandColor(config);
  const on = onBand(brandColor);
  const hasPhoto = !!leadership.photo;

  return `
    <div class="page" style="position: relative;">
      <div style="background:${brandColor};border-radius:6px;color:${on.fg};position:relative;overflow:hidden;height:calc(100% - 40px);display:flex;flex-direction:column;justify-content:space-between;padding:48px 52px;box-sizing:border-box">
        <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;opacity:.75;position:relative">A MESSAGE FROM OUR LEADERSHIP</div>
        <div style="position:relative;display:flex;gap:44px;align-items:flex-end">
          <div style="flex:1;max-width:${hasPhoto ? '440px' : '560px'}">
            <p style="font-family:${SG};font-size:22px;font-weight:600;line-height:1.4;letter-spacing:-.01em;margin:0">${escapeHtml(leadership.message)}</p>
          </div>
          ${hasPhoto ? `
          <div style="flex:none;width:200px;height:250px;border-radius:6px;overflow:hidden;border:1px solid ${on.hairline}">
            <img src="${escapeHtml(leadership.photo!)}" alt="${escapeHtml(leadership.name || 'Leadership')}" style="width:100%;height:100%;object-fit:cover" />
          </div>` : ''}
        </div>
        <div style="position:relative;display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid ${on.hairline};padding-top:20px">
          <div>
            <div style="font-family:${SG};font-size:15px;font-weight:600">${escapeHtml(leadership.name || '')}</div>
            <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;opacity:.75;margin-top:4px">${escapeHtml(leadership.title || '')}</div>
          </div>
          ${config.branding.logo ? `<img src="${escapeHtml(config.branding.logo)}" alt="" style="max-height:24px;width:auto;object-fit:contain" />` : ''}
        </div>
      </div>
      ${renderPageFooter(config, undefined, false, undefined, theme)}
    </div>`;
}

/**
 * Chapter divider: a full brand poster block on paper. One big honest number,
 * a statement label, quiet subtitle. The Editorial theme lets a hero photo
 * fill the block behind a brand scrim.
 */
function renderSectionDividerPage(
  config: ReportConfig,
  stat: string,
  statLabel: string,
  subtitle: string,
  chapterLabel: string,
  theme?: ReportTheme,
): string {
  const brandColor = getBrandColor(config);
  const on = onBand(brandColor);
  const dividerHero = (theme?.showHeroImages !== false) ? config.branding?.heroImages?.[1] : undefined;

  return `
    <div class="page" style="position: relative;">
      <div style="background:${brandColor};border-radius:6px;color:${on.fg};position:relative;overflow:hidden;height:calc(100% - 40px);display:flex;flex-direction:column;justify-content:space-between;padding:48px 52px;box-sizing:border-box">
        ${dividerHero ? `<img src="${escapeHtml(dividerHero)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.22" />
        <div style="position:absolute;inset:0;background:linear-gradient(to top, ${brandColor} 30%, transparent 100%)"></div>` : ''}
        <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;opacity:.75;position:relative">${escapeHtml(chapterLabel)}</div>
        <div style="position:relative">
          <div style="font-family:${SG};font-size:72px;font-weight:700;line-height:.95;letter-spacing:-.035em;font-variant-numeric:tabular-nums">${escapeHtml(stat)}</div>
          <div style="font-family:${SG};font-size:20px;font-weight:600;margin-top:14px;max-width:460px">${escapeHtml(statLabel)}</div>
          <div style="font-family:${INTER};font-size:13px;line-height:1.6;opacity:.85;margin-top:16px;max-width:420px">${escapeHtml(subtitle)}</div>
        </div>
        <div style="position:relative;border-top:1px solid ${on.hairline};padding-top:16px;font-family:${MONO};font-size:9px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;opacity:.7">${escapeHtml(config.reportName)}</div>
      </div>
      ${renderPageFooter(config, undefined, false, undefined, theme)}
    </div>`;
}

// ============================================================================
// PAGE RENDERERS
// ============================================================================

/**
 * Cover in the studio idiom. The customer's brand colour takes the poster
 * block; text on it follows onBand (ink on light brands, cream on dark).
 * Styles:
 * - 'hero-photo' (Annual) / 'editorial' (Editorial): full brand poster block,
 *   optional hero photo behind a brand scrim (stronger in editorial), fact
 *   grid on a hairline at the base. Standards read as a quiet mono line —
 *   never badge pills.
 * - 'brand-block' (Board): the same block, compact for landscape.
 * - 'minimal' (Working/Technical): no saturated block — quiet paper cover
 *   with the brand as an accent only.
 */
function renderCoverPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  const brandColor = getBrandColor(config);
  const on = onBand(brandColor);
  const coverStyle = theme?.coverStyle ?? 'hero-photo';
  const coverHero = (theme?.showHeroImages !== false) ? config.branding?.heroImages?.[0] : undefined;

  const standardsLine = config.standards.map(s => escapeHtml(getStandardName(s).toUpperCase())).join(' &nbsp;·&nbsp; ');
  const periodLine = (config.reportingPeriodStart && config.reportingPeriodEnd)
    ? formatDateRange(config.reportingPeriodStart, config.reportingPeriodEnd)
    : String(config.reportYear);

  const logoTop = config.branding.logo
    ? `<img src="${escapeHtml(config.branding.logo)}" alt="${escapeHtml(data.organization.name)}" style="max-height:40px;width:auto;object-fit:contain" />`
    : `<div style="font-family:${SG};font-size:20px;font-weight:700">${escapeHtml(data.organization.name)}</div>`;

  const fact = (label: string, value: string) => `<div>
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;opacity:.7">${label}</div>
      <div style="font-family:${SG};font-size:14px;font-weight:600;margin-top:8px;line-height:1.3">${value}</div>
    </div>`;

  // ---- minimal (Working / Technical): quiet paper cover ----
  if (coverStyle === 'minimal') {
    return `
    <div class="page" style="position:relative">
      <div style="display:flex;flex-direction:column;justify-content:space-between;height:calc(100% - 30px)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          ${logoTop}
          <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${brandColor}">SUSTAINABILITY REPORT</div>
        </div>
        <div>
          <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${DIM};margin-bottom:16px">${escapeHtml(data.organization.name)} · ${config.reportYear}</div>
          <h1 style="font-family:${SG};font-size:46px;font-weight:700;line-height:.98;letter-spacing:-.03em;color:${INK};max-width:560px">${escapeHtml(config.reportName)}.</h1>
          ${data.organization.description ? `<p style="font-family:${INTER};font-size:13px;line-height:1.6;color:${DIM};margin-top:20px;max-width:440px">${escapeHtml(data.organization.description)}</p>` : ''}
        </div>
        <div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;border-top:1px solid ${INK};padding-top:20px;color:${INK}">
            ${fact('Reporting period', escapeHtml(periodLine))}
            ${fact('Audience', escapeHtml(getAudienceDescription(config.audience)))}
            ${fact('Year', String(config.reportYear))}
          </div>
          <div style="font-family:${MONO};font-size:9px;font-weight:500;letter-spacing:.14em;color:${DIM};margin-top:16px">${standardsLine}</div>
        </div>
      </div>
      ${renderPageFooter(config, undefined, false, undefined, theme)}
    </div>`;
  }

  // ---- poster covers (hero-photo / editorial / brand-block) ----
  const heroOpacity = coverStyle === 'editorial' ? 0.34 : 0.2;
  const heroLayer = coverHero
    ? `<img src="${escapeHtml(coverHero)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${heroOpacity}" />
       <div style="position:absolute;inset:0;background:linear-gradient(to top, ${brandColor} 22%, transparent 85%)"></div>`
    : '';
  const titleSize = coverStyle === 'brand-block' ? 40 : 52;

  return `
    <div class="page" style="position:relative">
      <div style="background:${brandColor};border-radius:6px;color:${on.fg};position:relative;overflow:hidden;height:calc(100% - 30px);display:flex;flex-direction:column;justify-content:space-between;padding:48px 52px;box-sizing:border-box">
        ${heroLayer}
        <div style="display:flex;justify-content:space-between;align-items:center;position:relative">
          ${logoTop}
          <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;opacity:.85">SUSTAINABILITY REPORT</div>
        </div>
        <div style="position:relative">
          <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;opacity:.75;margin-bottom:18px">${escapeHtml(data.organization.name)} · ${config.reportYear}</div>
          <h1 style="font-family:${SG};font-size:${titleSize}px;font-weight:700;line-height:.95;letter-spacing:-.035em;max-width:540px;margin:0">${escapeHtml(config.reportName)}.</h1>
          ${data.organization.description ? `<p style="font-family:${INTER};font-size:13px;line-height:1.55;opacity:.85;margin-top:22px;max-width:420px">${escapeHtml(data.organization.description)}</p>` : ''}
        </div>
        <div style="position:relative">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;border-top:1px solid ${on.hairline};padding-top:20px">
            ${fact('Reporting period', escapeHtml(periodLine))}
            ${fact('Audience', escapeHtml(getAudienceDescription(config.audience)))}
            ${fact('Year', String(config.reportYear))}
          </div>
          <div style="font-family:${MONO};font-size:9px;font-weight:500;letter-spacing:.14em;opacity:.75;margin-top:16px">${standardsLine}</div>
        </div>
      </div>
    </div>`;
}

function renderExecSummaryPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  const brandColor = getBrandColor(config);
  const headingFont = theme?.headingFont ?? "'Space Grotesk', sans-serif";
  const darkBg = theme?.pageDarkBackground ?? '#1A1B1D';
  const lightBg = theme?.pageBackground ?? '#ECEAE3';
  const textColor = theme?.textColor ?? '#1A1B1D';
  const mutedColor = theme?.mutedTextColor ?? '#6F6F68';
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

  const execNarrative = data.narratives?.executiveSummary;

  return `
    <div class="page light-page">
      ${renderSectionHeader('01', 'Executive Summary', false, false, brandColor, theme)}

      ${(theme?.showNarratives !== false) && execNarrative ? renderExecutiveSummaryNarrativeBlock(execNarrative) : ''}

      <div style="display: flex; gap: 24px; margin-bottom: 28px;">
        <div style="flex: 1; background: ${darkBg}; border-radius: 16px; padding: 32px; color: white;">
          <div style="font-size: 12px; font-family: 'JetBrains Mono', monospace; color: ${brandColor}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Total Emissions</div>
          <div style="font-size: 48px; font-family: ${headingFont}; font-weight: 700; color: ${brandColor};">${formatNumber(total, 1)}</div>
          <div style="font-size: 16px; color: ${mutedColor}; margin-top: 4px;">tonnes CO&#8322;e</div>
          <div style="font-size: 12px; color: ${mutedColor}; margin-top: 4px;">${config.reportYear} reporting year</div>
        </div>

        <div style="width: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 2px; color: ${mutedColor}; margin-bottom: 16px;">Scope Split</div>
          <div style="width: 140px; height: 140px; border-radius: 50%; ${donutStyle} position: relative;">
            <div style="position: absolute; inset: 35px; background: ${lightBg}; border-radius: 50%;"></div>
          </div>
          <div style="display: flex; gap: 12px; margin-top: 16px; font-size: 10px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${SCOPE_COLOURS.scope1};"></div>
              <span style="color: ${mutedColor};">S1</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${SCOPE_COLOURS.scope2};"></div>
              <span style="color: ${mutedColor};">S2</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <div style="width: 8px; height: 8px; border-radius: 50%; background: ${SCOPE_COLOURS.scope3};"></div>
              <span style="color: ${mutedColor};">S3</span>
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

      ${data.transitionPlan?.sbti_aligned ? `
      <div style="display: flex; align-items: center; gap: 12px; background: ${brandColor}15; border: 1px solid ${brandColor}50; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #047857; flex-shrink: 0;"></div>
        <div style="font-size: 12px; font-weight: 600; color: #1A1B1D;">SBTi Aligned</div>
        <div style="font-size: 11px; color: #6F6F68;">Science Based Targets initiative — targets consistent with 1.5&deg;C pathway</div>
        ${data.transitionPlan.sbti_target_year ? `<div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #6F6F68; margin-left: auto;">Target year: ${data.transitionPlan.sbti_target_year}</div>` : ''}
      </div>` : ''}

      ${socialHighlights.length > 0 ? `
      <div style="background: #F2F1EA; border: 1px solid #D9D6CB; border-radius: 12px; padding: 20px;">
        <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 2px; color: #6F6F68; margin-bottom: 12px;">Social Highlights</div>
        <div style="display: flex; gap: 24px;">
          ${socialHighlights.map(h => `<div style="font-size: 14px; color: #1A1B1D; font-weight: 500;">${escapeHtml(h)}</div>`).join('')}
        </div>
      </div>` : ''}

      ${renderPageFooter(config, 1, false, undefined, theme)}
    </div>`;
}

function renderEmissionsPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
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

  const emissionsNarrative = data.narratives?.sections?.['scope-1-2-3'];

  return `
    <div class="page light-page">
      ${renderSectionHeader('02', 'Emissions Breakdown', false, false, getBrandColor(config), theme)}

      ${renderMaterialityCallout(config, 'scope-1-2-3', data)}
      ${(theme?.showNarratives !== false) && emissionsNarrative ? renderNarrativeBlock(emissionsNarrative) : ''}

      <div style="display: flex; gap: 32px; margin-bottom: 28px; align-items: center;">
        <div style="width: 180px; height: 180px; border-radius: 50%; ${donutStyle} position: relative; flex-shrink: 0;">
          <div style="position: absolute; inset: 45px; background: ${theme?.pageBackground ?? '#ECEAE3'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <span style="font-size: 12px; font-weight: 700; font-family: ${theme?.headingFont ?? "'Space Grotesk', sans-serif"}; color: ${theme?.textColor ?? '#1A1B1D'};">${formatNumber(total, 1)}</span>
            <span style="font-size: 8px; color: ${theme?.mutedTextColor ?? '#6F6F68'};">tCO&#8322;e</span>
          </div>
        </div>

        <div style="flex: 1;">
          ${scopeRows.map(s => `
            <div style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                <span style="font-size: 13px; font-weight: 600; color: #1A1B1D;">${escapeHtml(s.label)}</span>
                <span style="font-size: 13px; font-weight: 700; color: ${s.color};">${formatNumber(s.value, 1)} t &middot; ${total > 0 ? ((s.value / total) * 100).toFixed(1) : '0'}%</span>
              </div>
              <div style="height: 16px; background: #D9D6CB; border-radius: 8px; overflow: hidden;">
                <div style="height: 100%; width: ${maxScope > 0 ? ((s.value / maxScope) * 100) : 0}%; background: ${s.color}; border-radius: 8px;"></div>
              </div>
              <div style="font-size: 10px; color: #6F6F68; margin-top: 4px;">${escapeHtml(s.desc)}</div>
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
              <td style="font-size: 11px; color: #6F6F68;">${escapeHtml(s.desc)}</td>
              <td style="text-align: right; font-weight: 600;">${formatNumber(s.value, 2)}</td>
              <td style="text-align: right; color: ${s.color}; font-weight: 600;">${total > 0 ? ((s.value / total) * 100).toFixed(1) : '0'}%</td>
            </tr>
          `).join('')}
          <tr style="border-top: 2px solid #D9D6CB; font-weight: 700;">
            <td colspan="2">Total</td>
            <td style="text-align: right;">${formatNumber(total, 2)}</td>
            <td style="text-align: right;">100%</td>
          </tr>
        </tbody>
      </table>

      ${(emissions.hospitality && emissions.hospitality > 0) ? `
      <div style="margin-top: 24px;">
        <h3 style="font-size: 14px; font-weight: 700; margin: 0 0 8px;">Hospitality service (within Scope 3, Category 1)</h3>
        <p style="font-size: 11px; color: #6F6F68; margin: 0 0 10px;">Meals, drinks and room-nights served, plus food and dry waste disposal.</p>
        <table class="data-table">
          <tbody>
            <tr><td>Food &amp; drink served</td><td style="text-align: right;">${formatNumber(emissions.hospitalityFood || 0, 2)}</td></tr>
            <tr><td>Room consumables</td><td style="text-align: right;">${formatNumber(emissions.hospitalitySupplies || 0, 2)}</td></tr>
            <tr><td>Waste (food &amp; dry)</td><td style="text-align: right;">${formatNumber(emissions.hospitalityWaste || 0, 2)}</td></tr>
            <tr style="border-top: 2px solid #D9D6CB; font-weight: 700;">
              <td>Total hospitality (tCO&#8322;e)</td>
              <td style="text-align: right;">${formatNumber(emissions.hospitality, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>` : ''}

      ${renderPageFooter(config, 2, false, undefined, theme)}
    </div>`;
}

function renderKeyFindingsPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  if (!data.keyFindings || data.keyFindings.length === 0) return '';

  const findings = data.keyFindings;

  const findingCards = findings.map((f) => {
    const isDecrease = f.direction === 'decrease';
    const directionIcon = isDecrease ? '&#9660;' : '&#9650;';
    const directionColour = isDecrease ? '#047857' : '#BE123C';
    const directionLabel = isDecrease ? 'Decrease' : 'Increase';

    const confidenceColour =
      f.confidence === 'high' ? '#047857' :
      f.confidence === 'medium' ? '#B45309' : '#6F6F68';

    return `
      <div style="background: #F2F1EA; border: 1px solid #D9D6CB; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <span style="font-size: 20px; color: ${directionColour}; line-height: 1;">${directionIcon}</span>
          <span style="font-size: 15px; font-weight: 600; color: #1A1B1D; flex: 1;">${escapeHtml(f.title)}</span>
        </div>
        <p style="font-size: 13px; color: #1A1B1D; line-height: 1.6; margin-bottom: 14px;">${escapeHtml(f.narrative)}</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 500; font-family: 'JetBrains Mono', monospace; background: #ECEAE3; color: #6F6F68; text-transform: uppercase; letter-spacing: 1px;">${escapeHtml(f.scope)}</span>
          <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; background: ${isDecrease ? '#F2F1EA' : '#F2F1EA'}; color: ${isDecrease ? '#047857' : '#BE123C'};">${directionLabel} ${Math.abs(f.magnitude_pct).toFixed(1)}%</span>
          <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 500; background: #ECEAE3; color: ${confidenceColour};">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${confidenceColour}; display: inline-block;"></span>
            ${escapeHtml(f.confidence)} confidence
          </span>
        </div>
      </div>`;
  }).join('');

  const keyFindingsNarrative = data.narratives?.sections?.['key-findings'];

  return `
    <div class="page light-page">
      ${renderSectionHeader('02', 'Key Findings', false, false, getBrandColor(config), theme)}

      ${(theme?.showNarratives !== false) && keyFindingsNarrative ? renderNarrativeBlock(keyFindingsNarrative) : ''}

      <div style="font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #6F6F68; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">CHANGE DRIVERS &amp; ANALYSIS</div>

      ${findingCards}

      ${renderPageFooter(config, 2, false, undefined, theme)}
    </div>`;
}

function renderTrendsPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  if (!data.emissionsTrends || data.emissionsTrends.length < 2) return '';

  const trends = data.emissionsTrends;
  const maxTotal = Math.max(...trends.map(t => t.total), 0.001);

  const trendRows = trends.map(t => {
    const yoyValue = t.yoyChange ? parseFloat(t.yoyChange) : NaN;
    const arrow = isNaN(yoyValue) ? '' : yoyValue < 0 ? '&#9660;' : yoyValue > 0 ? '&#9650;' : '&#9654;';
    const arrowColor = isNaN(yoyValue) ? '#6F6F68' : yoyValue < 0 ? '#047857' : yoyValue > 0 ? '#BE123C' : '#6F6F68';

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

  const trendsNarrative = data.narratives?.sections?.['trends'];

  return `
    <div class="page light-page">
      ${renderSectionHeader('03', 'Emissions Trends', false, false, getBrandColor(config), theme)}

      ${(theme?.showNarratives !== false) && trendsNarrative ? renderNarrativeBlock(trendsNarrative) : ''}

      <div style="font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #6F6F68; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">MULTI-YEAR COMPARISON</div>

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
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 16px; color: #1A1B1D;">Annual Total Emissions</div>
        ${trends.map(t => `
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
            <div style="width: 50px; font-size: 13px; font-weight: 600; color: #1A1B1D; text-align: right; flex-shrink: 0;">${t.year}</div>
            <div style="flex: 1; height: 28px; background: #D9D6CB; border-radius: 6px; overflow: hidden; display: flex;">
              <div style="height: 100%; width: ${(t.scope1 / maxTotal) * 100}%; background: ${SCOPE_COLOURS.scope1};"></div>
              <div style="height: 100%; width: ${(t.scope2 / maxTotal) * 100}%; background: ${SCOPE_COLOURS.scope2};"></div>
              <div style="height: 100%; width: ${(t.scope3 / maxTotal) * 100}%; background: ${SCOPE_COLOURS.scope3};"></div>
            </div>
            <div style="width: 80px; font-size: 12px; font-weight: 600; color: #1A1B1D; flex-shrink: 0; text-align: right;">${formatNumber(t.total, 1)}</div>
          </div>
        `).join('')}
      </div>

      <div style="display: flex; gap: 16px; font-size: 11px; color: #6F6F68;">
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

      ${renderPageFooter(config, 3, false, undefined, theme)}
    </div>`;
}

function renderProductsPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  if (!data.products || data.products.length === 0) return '';

  const avgImpact = data.products.reduce((sum, p) => sum + p.climateImpact, 0) / data.products.length;
  const maxImpact = Math.max(...data.products.map(p => p.climateImpact), 0.001);

  const productRows = data.products.slice(0, 15).map(p => `
    <tr>
      <td style="font-weight: 500;">${escapeHtml(p.name)}</td>
      <td style="font-size: 11px; color: #6F6F68;">${escapeHtml(p.functionalUnit)}</td>
      <td style="text-align: right; font-weight: 600;">${formatNumber(p.climateImpact, 4)}</td>
      <td style="width: 200px;">
        <div style="height: 12px; background: #D9D6CB; border-radius: 6px; overflow: hidden;">
          <div style="height: 100%; width: ${(p.climateImpact / maxImpact) * 100}%; background: ${p.climateImpact > avgImpact ? '#BF4B2A' : '#047857'}; border-radius: 6px;"></div>
        </div>
      </td>
    </tr>
  `).join('');

  const productsNarrative = data.narratives?.sections?.['product-footprints'];

  return `
    <div class="page light-page">
      ${renderSectionHeader('04', 'Product Impact', false, false, getBrandColor(config), theme)}

      ${(theme?.showNarratives !== false) && productsNarrative ? renderNarrativeBlock(productsNarrative) : ''}

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
        <div class="metric-card" style="text-align: center; border-left: 3px solid #047857;">
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

      ${data.products.length > 15 ? `<div style="font-size: 11px; color: #6F6F68; margin-top: 8px; font-style: italic;">Showing 15 of ${data.products.length} products</div>` : ''}

      ${renderPageFooter(config, 4, false, undefined, theme)}
    </div>`;
}

function renderVineyardsPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
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
      <td style="text-align: right; color: #047857;">${formatNumber(v.removalsPerHa, 1)}</td>
      <td style="text-align: center;">${v.vintages}</td>
    </tr>
  `).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('05', 'Viticulture & Land Stewardship', false, false, getBrandColor(config), theme)}

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
        <div class="metric-card" style="text-align: center; border-left: 3px solid #047857;">
          <div class="metric-label">Soil Carbon Removals</div>
          <div class="metric-value" style="font-size: 24px; color: #047857;">${formatNumber(totalRemovals, 0)}</div>
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

      <div style="margin-top: 20px; padding: 16px; background: #ECEAE3; border-radius: 8px; font-size: 11px; color: #6F6F68;">
        <strong style="color: #1A1B1D;">SBTi FLAG Compliance:</strong> Emissions and soil carbon removals are reported
        separately in accordance with SBTi Forest, Land and Agriculture (FLAG) Guidance v1.2. Removals are never netted
        against emissions. N&#8322;O calculations use IPCC 2019 Refinement Tier 1 methodology with climate zone disaggregation.
      </div>

      ${renderPageFooter(config, 5, false, undefined, theme)}
    </div>`;
}

function renderPeopleCulturePage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  const brandColor = getBrandColor(config);
  if (!data.peopleCulture) return '';
  const pc = data.peopleCulture;

  const pillars = [
    { label: 'Fair Work', score: pc.fairWorkScore, color: '#047857' },
    { label: 'Diversity & Inclusion', score: pc.diversityScore, color: '#2B46C0' },
    { label: 'Wellbeing', score: pc.wellbeingScore, color: '#6D28D9' },
    { label: 'Training & Development', score: pc.trainingScore, color: '#BF4B2A' },
  ];

  const maxScore = 100;

  const peopleCultureNarrative = data.narratives?.sections?.['people-culture'];

  return `
    <div class="page light-page">
      ${renderSectionHeader('05', 'People & Culture', false, false, brandColor, theme)}

      ${renderMaterialityCallout(config, 'people', data)}
      ${(theme?.showNarratives !== false) && peopleCultureNarrative ? renderNarrativeBlock(peopleCultureNarrative) : ''}

      <div style="display: flex; gap: 24px; margin-bottom: 28px;">
        <div style="flex: 1; background: ${theme?.pageDarkBackground ?? '#1A1B1D'}; border-radius: 16px; padding: 28px; color: white;">
          <div style="font-size: 12px; font-family: 'JetBrains Mono', monospace; color: ${brandColor}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Overall Score</div>
          <div style="font-size: 56px; font-family: ${theme?.headingFont ?? "'Space Grotesk', sans-serif"}; font-weight: 700; color: ${brandColor};">${pc.overallScore}<span style="font-size: 20px; color: ${theme?.mutedTextColor ?? '#6F6F68'};">/100</span></div>
          <div style="font-size: 12px; color: ${theme?.mutedTextColor ?? '#6F6F68'}; margin-top: 4px;">${pc.dataCompleteness.toFixed(0)}% data completeness</div>
        </div>
        <div style="flex: 1;">
          ${pillars.map(p => `
            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 12px; font-weight: 500; color: #1A1B1D;">${escapeHtml(p.label)}</span>
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
          <div class="metric-value" style="font-size: 24px; color: ${pc.livingWageCompliance >= 90 ? '#047857' : '#BF4B2A'};">${pc.livingWageCompliance.toFixed(0)}%</div>
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
          <div class="metric-value" style="font-size: 24px; color: ${pc.genderPayGapMean <= 5 ? '#047857' : '#BF4B2A'};">${pc.genderPayGapMean.toFixed(1)}%</div>
          <div class="metric-unit">mean gap</div>
        </div>` : ''}
      </div>

      ${renderPageFooter(config, 5, false, undefined, theme)}
    </div>`;
}

function renderGovernancePage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
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
    const statusColor = p.status === 'active' ? '#047857' : p.status === 'draft' ? '#B45309' : '#BE123C';
    return `
    <tr>
      <td style="font-weight: 500;">${escapeHtml(p.name)}</td>
      <td style="font-size: 11px; color: #6F6F68;">${escapeHtml(p.type)}</td>
      <td><span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: ${statusColor}20; color: ${statusColor};">${escapeHtml(p.status)}</span></td>
      <td>${p.isPublic ? '&#10003; Public' : 'Internal'}</td>
    </tr>`;
  }).join('');

  const governanceNarrative = data.narratives?.sections?.['governance'];

  return `
    <div class="page light-page">
      ${renderSectionHeader('06', 'Governance', false, false, getBrandColor(config), theme)}

      ${renderMaterialityCallout(config, 'governance', data)}
      ${(theme?.showNarratives !== false) && governanceNarrative ? renderNarrativeBlock(governanceNarrative) : ''}

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Board Size</div>
          <div class="metric-value" style="font-size: 24px;">${gov.boardDiversityMetrics.totalMembers}</div>
          <div class="metric-unit">members</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Female %</div>
          <div class="metric-value" style="font-size: 24px; color: #2B46C0;">${gov.boardDiversityMetrics.femalePercentage.toFixed(0)}%</div>
          <div class="metric-unit">board diversity</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Independent %</div>
          <div class="metric-value" style="font-size: 24px;">${gov.boardDiversityMetrics.independentPercentage.toFixed(0)}%</div>
          <div class="metric-unit">of directors</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Policy Score</div>
          <div class="metric-value" style="font-size: 24px; color: ${gov.policyCompleteness >= 75 ? '#047857' : '#BF4B2A'};">${gov.policyCompleteness.toFixed(0)}%</div>
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
      <div style="background: #F2F1EA; border: 1px solid #D9D6CB; border-radius: 12px; padding: 16px;">
        <div style="font-size: 11px; font-weight: 600; color: #1A1B1D; margin-bottom: 6px;">Mission Statement</div>
        <p style="font-size: 12px; color: #1A1B1D; line-height: 1.6; font-style: italic;">${escapeHtml(gov.missionStatement)}</p>
      </div>` : ''}

      ${renderPageFooter(config, 6, false, undefined, theme)}
    </div>`;
}

function renderCommunityImpactPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  const brandColor = getBrandColor(config);
  if (!data.communityImpact) return '';
  const ci = data.communityImpact;

  const pillarScores = [
    { label: 'Giving', score: ci.givingScore, color: '#047857' },
    { label: 'Local Impact', score: ci.localImpactScore, color: '#2B46C0' },
    { label: 'Volunteering', score: ci.volunteeringScore, color: '#6D28D9' },
    { label: 'Engagement', score: ci.engagementScore, color: '#BF4B2A' },
  ];

  const communityNarrative = data.narratives?.sections?.['community-impact'];

  return `
    <div class="page light-page">
      ${renderSectionHeader('07', 'Community Impact', false, false, brandColor, theme)}

      ${renderMaterialityCallout(config, 'community', data)}
      ${(theme?.showNarratives !== false) && communityNarrative ? renderNarrativeBlock(communityNarrative) : ''}

      <div style="display: flex; gap: 24px; margin-bottom: 24px;">
        <div style="flex: 1; background: ${theme?.pageDarkBackground ?? '#1A1B1D'}; border-radius: 16px; padding: 28px; color: white;">
          <div style="font-size: 12px; font-family: 'JetBrains Mono', monospace; color: ${brandColor}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Community Score</div>
          <div style="font-size: 56px; font-family: ${theme?.headingFont ?? "'Space Grotesk', sans-serif"}; font-weight: 700; color: ${brandColor};">${ci.overallScore}<span style="font-size: 20px; color: ${theme?.mutedTextColor ?? '#6F6F68'};">/100</span></div>
          <div style="font-size: 12px; color: ${theme?.mutedTextColor ?? '#6F6F68'}; margin-top: 4px;">${ci.dataCompleteness.toFixed(0)}% data completeness</div>
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

      ${ci.impactStories.length > 0 ? (() => {
        const storyAccents = [brandColor, '#047857', '#2B46C0', '#6D28D9'];
        return `
      <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 2px; color: #6F6F68; margin-bottom: 12px;">Impact Stories</div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px;">
        ${ci.impactStories.slice(0, 4).map((s, i) => {
          const accent = storyAccents[i % storyAccents.length];
          return `
          <div style="background: #F2F1EA; border: 1px solid #D9D6CB; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column;">
            ${s.photo ? `
            <div style="height: 110px; overflow: hidden;">
              <img src="${escapeHtml(s.photo)}" alt="${escapeHtml(s.title)}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>` : `
            <div style="height: 6px; background: ${accent};"></div>`}
            <div style="padding: 14px 16px; flex: 1;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 1px; background: ${accent}18; color: ${accent === brandColor ? '#205E40' : accent}; font-weight: 600; margin-bottom: 8px;">${escapeHtml(s.category)}</span>
              <div style="font-size: 13px; font-weight: 700; color: #1A1B1D; margin-bottom: 6px; line-height: 1.3;">${escapeHtml(s.title)}</div>
              <p style="font-size: 11px; color: #6F6F68; line-height: 1.55;">${escapeHtml(s.summary)}</p>
            </div>
          </div>`;
        }).join('')}
      </div>`;
      })() : ''}

      ${renderPageFooter(config, 7, false, undefined, theme)}
    </div>`;
}

function renderSupplyChainPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
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
        <td style="font-size: 11px; color: #6F6F68;">${info.suppliers.slice(0, 3).map(s => escapeHtml(s.name)).join(', ')}${info.count > 3 ? ` +${info.count - 3} more` : ''}</td>
      </tr>
    `).join('');

  const supplyChainNarrative = data.narratives?.sections?.['supply-chain'];

  return `
    <div class="page light-page">
      ${renderSectionHeader('08', 'Supply Chain', false, false, getBrandColor(config), theme)}

      ${renderMaterialityCallout(config, 'supply-chain', data)}
      ${(theme?.showNarratives !== false) && supplyChainNarrative ? renderNarrativeBlock(supplyChainNarrative) : ''}

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

      ${renderPageFooter(config, 8, false, undefined, theme)}
    </div>`;
}

function renderTargetsPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  const brandColor = getBrandColor(config);
  const commitments = data.governance?.climateCommitments || [];

  const targetsNarrative = data.narratives?.sections?.['targets'];

  return `
    <div class="page light-page">
      ${renderSectionHeader('09', 'Targets & Commitments', false, false, brandColor, theme)}

      ${(theme?.showNarratives !== false) && targetsNarrative ? renderNarrativeBlock(targetsNarrative) : ''}

      <div style="background: ${theme?.pageDarkBackground ?? '#1A1B1D'}; border-radius: 16px; padding: 28px; color: white; margin-bottom: 24px;">
        <div style="font-size: 12px; font-family: 'JetBrains Mono', monospace; color: ${brandColor}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Climate Commitments</div>
        ${commitments.length > 0 ? commitments.map((c, i) => `
          <div style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px; padding-bottom: 16px; ${i < commitments.length - 1 ? 'border-bottom: 1px solid rgba(242,241,234,0.1);' : ''}">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: ${brandColor}26; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <span style="font-size: 14px; font-weight: 700; color: ${brandColor};">${i + 1}</span>
            </div>
            <div style="font-size: 14px; color: #D9D6CB; line-height: 1.6;">${escapeHtml(c)}</div>
          </div>
        `).join('') : `
          <p style="font-size: 14px; color: #6F6F68;">No climate commitments have been recorded yet. Consider setting Science Based Targets or committing to a net-zero pathway.</p>
        `}
      </div>

      ${data.governance?.sdgCommitments && data.governance.sdgCommitments.length > 0 ? `
      <div style="background: #F2F1EA; border: 1px solid #D9D6CB; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 2px; color: #6F6F68; margin-bottom: 12px;">UN Sustainable Development Goals</div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${data.governance.sdgCommitments.map(sdg => `
            <div style="width: 48px; height: 48px; border-radius: 8px; background: #1A1B1D; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 18px; font-weight: 700; color: ${brandColor};">${sdg}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div style="background: #F2F1EA; border: 1px solid #D9D6CB; border-radius: 12px; padding: 20px;">
        <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 2px; color: #6F6F68; margin-bottom: 12px;">Emissions Trajectory</div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #6F6F68; margin-bottom: 4px;">Baseline Year</div>
            <div style="font-size: 20px; font-weight: 700; color: #1A1B1D;">${data.emissionsTrends.length > 0 ? data.emissionsTrends[0].year : config.reportYear}</div>
            <div style="font-size: 12px; color: #6F6F68;">${data.emissionsTrends.length > 0 ? formatNumber(data.emissionsTrends[0].total, 1) : formatNumber(data.emissions.total, 1)} tCO&#8322;e</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #6F6F68; margin-bottom: 4px;">Current Year</div>
            <div style="font-size: 20px; font-weight: 700; color: #1A1B1D;">${config.reportYear}</div>
            <div style="font-size: 12px; color: #6F6F68;">${formatNumber(data.emissions.total, 1)} tCO&#8322;e</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #6F6F68; margin-bottom: 4px;">Direction</div>
            ${data.emissionsTrends.length >= 2 ? (() => {
              const latest = data.emissionsTrends[data.emissionsTrends.length - 1];
              const yoy = latest.yoyChange ? parseFloat(latest.yoyChange) : NaN;
              const color = isNaN(yoy) ? '#6F6F68' : yoy < 0 ? '#047857' : '#BE123C';
              const label = isNaN(yoy) ? 'N/A' : yoy < 0 ? 'Decreasing' : 'Increasing';
              return `<div style="font-size: 20px; font-weight: 700; color: ${color};">${label}</div>
                <div style="font-size: 12px; color: #6F6F68;">${isNaN(yoy) ? '' : Math.abs(yoy).toFixed(1) + '% YoY'}</div>`;
            })() : `<div style="font-size: 20px; font-weight: 700; color: #6F6F68;">N/A</div><div style="font-size: 12px; color: #6F6F68;">Insufficient data</div>`}
          </div>
        </div>
      </div>

      ${renderPageFooter(config, 9, false, undefined, theme)}
    </div>`;
}

function renderMethodologyPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  const standardsRows = data.standards.map(s => {
    const statusColor = s.status === 'Compliant' || s.status === 'compliant' || s.status === 'Aligned' ? '#047857' : s.status === 'Partial' || s.status === 'partial' || s.status === 'Action Required' || s.status === 'In Progress' ? '#B45309' : '#6F6F68';
    return `
    <tr>
      <td style="font-weight: 500;">${escapeHtml(s.code)}</td>
      <td>${escapeHtml(s.name)}</td>
      <td><span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: ${statusColor}20; color: ${statusColor};">${escapeHtml(s.status)}</span></td>
      <td style="font-size: 11px; color: #6F6F68;">${escapeHtml(s.detail)}</td>
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
      ${renderSectionHeader('10', 'Methodology & Standards', false, false, getBrandColor(config), theme)}

      <div style="font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #6F6F68; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">REPORTING FRAMEWORK COMPLIANCE</div>

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
          <div class="metric-value" style="font-size: 24px; color: ${data.dataQuality.completeness >= 80 ? '#047857' : '#BF4B2A'};">${data.dataQuality.completeness.toFixed(0)}%</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Quality Tier</div>
          <div style="font-size: 14px; font-weight: 600; color: #1A1B1D; margin-top: 8px;">${escapeHtml(qualityTierLabels[data.dataQuality.qualityTier] || data.dataQuality.qualityTier)}</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Confidence</div>
          <div class="metric-value" style="font-size: 24px;">${data.dataQuality.confidenceScore.toFixed(0)}%</div>
        </div>
      </div>` : ''}

      <div style="background: #F2F1EA; border: 1px solid #D9D6CB; border-radius: 12px; padding: 20px;">
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 12px;">Data Sources</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; color: #1A1B1D;">
          <div style="padding: 8px 12px; background: #ECEAE3; border-radius: 8px;">
            <span style="font-weight: 600;">Emissions Data:</span> Direct measurement and utility records where available, supplemented with DEFRA emission factors
          </div>
          <div style="padding: 8px 12px; background: #ECEAE3; border-radius: 8px;">
            <span style="font-weight: 600;">Product LCA:</span> Calculated using ISO 14044/14067 methodology with ecoinvent and AGRIBALYSE databases
          </div>
          <div style="padding: 8px 12px; background: #ECEAE3; border-radius: 8px;">
            <span style="font-weight: 600;">Social Data:</span> Organisation records, HR systems, and self-reported metrics
          </div>
          <div style="padding: 8px 12px; background: #ECEAE3; border-radius: 8px;">
            <span style="font-weight: 600;">Reporting Period:</span> ${escapeHtml(formatDateRange(config.reportingPeriodStart, config.reportingPeriodEnd))}
          </div>
        </div>
      </div>

      ${renderPageFooter(config, 10, false, undefined, theme)}
    </div>`;
}

function renderClosingPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  const brandColor = getBrandColor(config);
  const headingFont = theme?.headingFont ?? "'Space Grotesk', sans-serif";
  const darkBg = theme?.pageDarkBackground ?? '#1A1B1D';
  return `
    <div class="page dark-page" style="justify-content: center; align-items: center; text-align: center; background: ${darkBg};">
      <div style="margin-bottom: 48px;">
        ${orgLogo(config, 56)}
      </div>

      <h1 style="font-size: 48px; font-family: ${headingFont}; font-weight: 300; color: white; margin-bottom: 16px;">Thank You</h1>
      <p style="font-size: 16px; color: #6F6F68; max-width: 400px; line-height: 1.8; margin-bottom: 48px;">
        This sustainability report was prepared for ${escapeHtml(data.organization.name)} covering the ${config.reportYear} reporting period.
      </p>

      <div style="border-top: 1px solid rgba(242,241,234,0.15); padding-top: 32px; max-width: 400px;">
        <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: ${brandColor}; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 16px;">Prepared By</div>
        <p style="font-size: 14px; color: #D9D6CB; margin-bottom: 4px;">${escapeHtml(data.organization.name)}</p>
        ${data.organization.industry_sector ? `<p style="font-size: 12px; color: #6F6F68; margin-bottom: 16px;">${escapeHtml(data.organization.industry_sector)}</p>` : ''}
        <p style="font-size: 12px; color: #6F6F68; margin-bottom: 4px;">Generated with alkatera</p>
        <p style="font-size: 11px; color: #6F6F68;">alkatera.com</p>
      </div>

      <div style="position: absolute; bottom: 48px; left: 48px; right: 48px; display: flex; justify-content: space-between; font-size: 9px; font-family: 'JetBrains Mono', monospace; color: rgba(242,241,234,0.2); text-transform: uppercase; letter-spacing: 3px;">
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
// CSRD GATING WARNING PAGE
// ============================================================================

/**
 * Rendered when CSRD is selected as a standard but the materiality assessment
 * has not been completed. Guides the user to complete it before generating
 * a fully compliant report.
 */
function renderCsrdGatingWarningPage(config: ReportConfig, theme?: ReportTheme): string {
  return `
    <div class="page light-page">
      ${renderSectionHeader('!', 'CSRD Compliance Action Required', false, false, getBrandColor(config), theme)}

      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 24px; text-align: center; padding: 0 48px;">
        <div style="width: 72px; height: 72px; background: #F2F1EA; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <div style="font-size: 36px;">&#9888;&#65039;</div>
        </div>

        <div>
          <h3 style="font-size: 22px; font-family: ${theme?.headingFont ?? "'Space Grotesk', sans-serif"}; font-weight: 700; color: #B45309; margin-bottom: 12px;">
            Double-Materiality Assessment Incomplete
          </h3>
          <p style="font-size: 14px; color: #6F6F68; line-height: 1.7; max-width: 480px;">
            You have selected the <strong>Corporate Sustainability Reporting Directive (CSRD)</strong> standard,
            which requires a completed double-materiality assessment as a prerequisite.
          </p>
        </div>

        <div style="background: #F2F1EA; border: 1px solid #B45309; border-radius: 12px; padding: 24px 32px; max-width: 520px; width: 100%; text-align: left;">
          <div style="font-size: 12px; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #B45309; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">
            Steps to achieve CSRD compliance:
          </div>
          ${[
            'Complete the double-materiality assessment in Reports &rarr; Materiality',
            'Score each topic for impact on people &amp; planet (1&ndash;5) and financial risk (1&ndash;5)',
            'Confirm your priority topics in Step 3 of the assessment wizard',
            'Regenerate this report once the assessment is marked complete',
          ].map((step, i) => `
            <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
              <div style="width: 22px; height: 22px; background: #B45309; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; flex-shrink: 0;">${i + 1}</div>
              <p style="font-size: 13px; color: #B45309; line-height: 1.5;">${step}</p>
            </div>
          `).join('')}
        </div>

        <p style="font-size: 11px; color: #6F6F68; font-family: 'JetBrains Mono', monospace;">
          ESRS 1 &sect;17 &mdash; Double materiality is the foundation of all CSRD disclosures.
          Without it, topic-specific disclosures cannot be scoped or reported.
        </p>
      </div>

      ${renderPageFooter(config, undefined, false, 'CSRD Compliance Notice', theme)}
    </div>`;
}

// ============================================================================
// ESRS DISCLOSURE INDEX PAGE
// ============================================================================

/**
 * Auto-generated ESRS disclosure index based on the completed materiality assessment.
 * Lists each material topic, its ESRS reference, and disclosure status.
 * Only rendered when CSRD is selected and materiality assessment is complete.
 */
function renderEsrsDisclosureIndexPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  const brandColor = getBrandColor(config);
  if (!data.materiality?.completed_at || !config.standards.includes('csrd')) return '';

  const materialTopics = data.materiality.topics.filter(t => t.status === 'material');
  const priorityIds = new Set(data.materiality.priority_topics);

  const categoryLabels: Record<string, string> = {
    environmental: 'Environmental',
    social: 'Social',
    governance: 'Governance',
  };

  const byCategory: Record<string, typeof materialTopics> = {};
  for (const t of materialTopics) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  }

  const sectionRows = Object.entries(byCategory).map(([cat, topics]) => {
    const header = `
      <tr style="background: #1A1B1D; color: white;">
        <td colspan="4" style="padding: 8px 12px; font-size: 11px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 2px;">${escapeHtml(categoryLabels[cat] || cat)}</td>
      </tr>`;
    const rows = topics.map(t => {
      const isPriority = priorityIds.has(t.id);
      return `
      <tr>
        <td style="width: 40%;">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${isPriority ? `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${brandColor}; flex-shrink: 0;"></span>` : '<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #D9D6CB; flex-shrink: 0;"></span>'}
            <span style="font-size: 12px; font-weight: ${isPriority ? '600' : '400'};">${escapeHtml(t.name)}</span>
          </div>
        </td>
        <td style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #6F6F68;">${t.esrsReference ? escapeHtml(t.esrsReference) : '&mdash;'}</td>
        <td style="font-size: 11px;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 10px; background: #F2F1EA; color: #047857; font-size: 10px; font-weight: 500;">Material</span>
          ${isPriority ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 10px; background: ${brandColor}20; color: #205E40; font-size: 10px; font-weight: 500; margin-left: 4px;">Priority</span>` : ''}
        </td>
        <td style="font-size: 11px; color: #6F6F68; max-width: 160px;">${t.rationale ? escapeHtml(t.rationale.substring(0, 80) + (t.rationale.length > 80 ? '...' : '')) : '&mdash;'}</td>
      </tr>`;
    }).join('');
    return header + rows;
  }).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('A', 'ESRS Disclosure Index', false, false, brandColor, theme)}

      <p style="font-size: 12px; color: #6F6F68; margin-bottom: 20px; line-height: 1.5;">
        This index lists all topics determined to be material through the double-materiality assessment
        conducted for the ${config.reportYear} reporting period, along with their applicable ESRS disclosures.
        Priority topics (&#9679;) appear first in all report sections.
      </p>

      <table class="data-table">
        <thead>
          <tr>
            <th>Topic</th>
            <th>ESRS Reference</th>
            <th>Status</th>
            <th>Rationale</th>
          </tr>
        </thead>
        <tbody>${sectionRows}</tbody>
      </table>

      <div style="margin-top: 20px; padding: 12px 16px; background: #ECEAE3; border-radius: 8px; font-size: 10px; color: #6F6F68; font-family: 'JetBrains Mono', monospace;">
        Assessment completed: ${new Date(data.materiality.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} &middot;
        ${materialTopics.length} material topic${materialTopics.length !== 1 ? 's' : ''} &middot;
        ${priorityIds.size} priority topic${priorityIds.size !== 1 ? 's' : ''}
      </div>

      ${renderPageFooter(config, undefined, false, 'ESRS Disclosure Index', theme)}
    </div>`;
}

// ============================================================================
// TRANSITION ROADMAP PAGE
// ============================================================================

const SCOPE_LABEL_MAP: Record<string, string> = {
  scope1: 'Scope 1',
  scope2: 'Scope 2',
  scope3: 'Scope 3',
  total:  'Total',
};

const SCOPE_COLOUR_MAP: Record<string, string> = {
  scope1: '#047857',
  scope2: '#2B46C0',
  scope3: '#BF4B2A',
  total:  '#6D28D9',
};

const MILESTONE_STATUS_COLOUR_MAP: Record<string, string> = {
  not_started: '#6F6F68',
  in_progress: '#B45309',
  complete:    '#047857',
};

const MILESTONE_STATUS_LABEL_MAP: Record<string, string> = {
  not_started: 'Planned',
  in_progress: 'In Progress',
  complete:    'Achieved',
};

/**
 * Renders the Transition Roadmap page: CSS-based timeline of milestones
 * plus a table of reduction targets.
 */
function renderTransitionRoadmapPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  const brandColor = getBrandColor(config);
  const tp = data.transitionPlan!;
  const currentYear = config.reportYear;

  // Sort milestones by date
  const milestones = [...(tp.milestones || [])].sort((a, b) => a.targetDate.localeCompare(b.targetDate));

  // Build milestone rows (max 10)
  const milestoneRows = milestones.slice(0, 10).map((m, i) => {
    const statusColour = MILESTONE_STATUS_COLOUR_MAP[m.status] || '#6F6F68';
    const statusLabel = MILESTONE_STATUS_LABEL_MAP[m.status] || m.status;
    const year = m.targetDate.split('-')[0] || '';
    const isLast = i === Math.min(milestones.length, 10) - 1;

    return `
      <div style="display: flex; align-items: flex-start; gap: 16px; position: relative; padding-bottom: ${isLast ? '0' : '20px'};">
        ${!isLast ? `<div style="position: absolute; left: 10px; top: 22px; bottom: 0; width: 2px; background: #D9D6CB;"></div>` : ''}
        <div style="width: 22px; height: 22px; border-radius: 50%; background: ${statusColour}20; border: 2px solid ${statusColour}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; z-index: 1;">
          ${m.status === 'complete' ? `<div style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColour};"></div>` : `<div style="width: 6px; height: 6px; border-radius: 50%; background: ${statusColour};"></div>`}
        </div>
        <div style="flex: 1;">
          <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px;">
            <span style="font-size: 13px; font-weight: 500; color: #1A1B1D;">${escapeHtml(m.title || 'Untitled milestone')}</span>
            <span style="font-size: 10px; font-family: 'JetBrains Mono', monospace; color: #6F6F68; flex-shrink: 0;">${escapeHtml(year)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; margin-top: 2px;">
            <span style="font-size: 10px; color: ${statusColour}; font-weight: 500;">${escapeHtml(statusLabel)}</span>
            ${m.emissionsImpactTco2e ? `<span style="font-size: 10px; color: #6F6F68;">${formatNumber(m.emissionsImpactTco2e, 1)} tCO2e expected</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  // Build targets table rows
  const targetRows = (tp.targets || []).map(t => {
    const colour = SCOPE_COLOUR_MAP[t.scope] || '#1A1B1D';
    const scopeLabel = SCOPE_LABEL_MAP[t.scope] || t.scope;
    const reductionPct = tp.baseline_emissions_tco2e
      ? ((tp.baseline_emissions_tco2e * (1 - t.reductionPct / 100))).toFixed(0)
      : null;
    const sbtiFlag = t.reductionPct >= 50;

    return `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${colour};"></div>
          <span>${escapeHtml(scopeLabel)}</span>
        </div>
      </td>
      <td>${tp.baseline_year}</td>
      <td>${t.targetYear}</td>
      <td style="font-weight: 600; color: ${colour};">-${t.reductionPct}%</td>
      <td>${reductionPct ? `${reductionPct} tCO2e` : (t.absoluteTargetTco2e ? `${formatNumber(t.absoluteTargetTco2e, 0)} tCO2e` : '&mdash;')}</td>
      <td>${sbtiFlag ? `<span style="font-size: 10px; background: ${brandColor}20; color: #205E40; padding: 2px 8px; border-radius: 10px; font-weight: 500;">SBTi</span>` : '&mdash;'}</td>
    </tr>`;
  }).join('');

  const baselineText = tp.baseline_emissions_tco2e
    ? `${formatNumber(tp.baseline_emissions_tco2e, 0)} tCO2e (${tp.baseline_year} baseline)`
    : `${tp.baseline_year} baseline`;

  return `
    <div class="page light-page">
      ${renderSectionHeader('T1', 'Transition Roadmap', false, false, brandColor, theme)}

      <div style="display: flex; gap: 32px;">
        <!-- Timeline (left) -->
        <div style="flex: 1;">
          <div style="font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #6F6F68; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">
            DECARBONISATION MILESTONES &middot; ${currentYear}&ndash;${Math.max(...(tp.targets || []).map(t => t.targetYear), currentYear + 10)}
          </div>

          ${milestones.length > 0 ? milestoneRows : `
          <div style="color: #6F6F68; font-size: 13px; padding: 24px 0;">No milestones defined.</div>
          `}
        </div>

        <!-- Targets (right) -->
        <div style="width: 300px; flex-shrink: 0;">
          <div style="font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #6F6F68; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">
            REDUCTION TARGETS
          </div>

          ${tp.targets && tp.targets.length > 0 ? `
          <table class="data-table" style="font-size: 11px;">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Base</th>
                <th>Year</th>
                <th>Reduction</th>
                <th>Target</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${targetRows}</tbody>
          </table>

          <div style="margin-top: 12px; font-size: 10px; color: #6F6F68;">
            Baseline: ${escapeHtml(baselineText)}
          </div>
          ` : `<div style="color: #6F6F68; font-size: 12px;">No targets set.</div>`}

          ${tp.sbti_aligned ? `
          <div style="margin-top: 16px; background: ${brandColor}15; border: 1px solid ${brandColor}40; border-radius: 8px; padding: 10px 12px;">
            <div style="font-size: 10px; font-weight: 600; color: #205E40; margin-bottom: 2px;">SBTi Aligned</div>
            <div style="font-size: 10px; color: #6F6F68;">Targets meet Science Based Targets initiative Corporate Standard for 1.5&deg;C alignment.</div>
          </div>` : ''}
        </div>
      </div>

      ${renderPageFooter(config, undefined, false, 'Transition Roadmap', theme)}
    </div>`;
}

// ============================================================================
// CLIMATE RISKS & OPPORTUNITIES PAGE
// ============================================================================

/**
 * Renders the Climate Risks & Opportunities page.
 * Two-column layout: risks (left), opportunities (right).
 */
function renderRisksOpportunitiesPage(config: ReportConfig, data: ReportData, theme?: ReportTheme): string {
  const ro = data.transitionPlan?.risks_and_opportunities || [];
  const risks = ro.filter(i => i.type === 'risk');
  const opportunities = ro.filter(i => i.type === 'opportunity');

  const LIKELIHOOD_COLOUR: Record<string, string> = {
    low: '#047857',
    medium: '#B45309',
    high: '#BE123C',
  };

  function renderRoItem(item: NonNullable<typeof ro>[0]): string {
    const isRisk = item.type === 'risk';
    const accentColour = isRisk ? '#BE123C20' : '#04785720';
    const borderColour = isRisk ? '#BE123C' : '#047857';
    const likelihoodColour = LIKELIHOOD_COLOUR[item.likelihood] || '#6F6F68';
    const impactColour = LIKELIHOOD_COLOUR[item.impact] || '#6F6F68';
    const timeLabels: Record<string, string> = { short: '1-3yr', medium: '3-10yr', long: '10yr+' };

    return `
      <div style="background: ${accentColour}; border-left: 3px solid ${borderColour}; border-radius: 0 8px 8px 0; padding: 12px 14px; margin-bottom: 10px;">
        <div style="font-size: 12px; font-weight: 600; color: #1A1B1D; margin-bottom: 4px;">${escapeHtml(item.title)}</div>
        <div style="font-size: 11px; color: #1A1B1D; line-height: 1.5; margin-bottom: 8px;">${escapeHtml(item.description)}</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 9px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 1px; color: ${likelihoodColour};">${escapeHtml(item.likelihood.toUpperCase())} likelihood</span>
          <span style="font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #6F6F68;">&middot;</span>
          <span style="font-size: 9px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 1px; color: ${impactColour};">${escapeHtml(item.impact.toUpperCase())} impact</span>
          <span style="font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #6F6F68;">&middot;</span>
          <span style="font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #6F6F68;">${escapeHtml(timeLabels[item.timeHorizon] || item.timeHorizon)}</span>
          ${item.category ? `<span style="font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #6F6F68; margin-left: 4px; text-transform: uppercase;">${escapeHtml(item.category)}</span>` : ''}
        </div>
      </div>`;
  }

  return `
    <div class="page light-page">
      ${renderSectionHeader('T2', 'Climate Risks & Opportunities', false, false, getBrandColor(config), theme)}

      <p style="font-size: 12px; color: #6F6F68; margin-bottom: 20px; line-height: 1.5;">
        The following risks and opportunities were identified through analysis of ${escapeHtml(data.organization?.name || 'the organisation')}'s
        emissions profile, transition targets, and material topics. Items marked AI-generated have been reviewed and approved by the reporting team.
      </p>

      <div style="display: flex; gap: 24px;">
        <div style="flex: 1;">
          <div style="font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #BE123C; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">
            RISKS (${risks.length})
          </div>
          ${risks.length > 0
            ? risks.map(renderRoItem).join('')
            : '<div style="color: #6F6F68; font-size: 12px;">No risks identified.</div>'}
        </div>

        <div style="flex: 1;">
          <div style="font-size: 9px; font-family: 'JetBrains Mono', monospace; color: #047857; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">
            OPPORTUNITIES (${opportunities.length})
          </div>
          ${opportunities.length > 0
            ? opportunities.map(renderRoItem).join('')
            : '<div style="color: #6F6F68; font-size: 12px;">No opportunities identified.</div>'}
        </div>
      </div>

      ${renderPageFooter(config, undefined, false, 'Climate Risks & Opportunities', theme)}
    </div>`;
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
  options: { screenMode?: boolean } = {},
): string {
  const screenMode = options.screenMode === true;
  const sections = new Set(config.sections);
  const tier = getStorytellingTier(config.audience);

  // Resolve the active theme based on config.template and config.orientation
  const theme = resolveTheme(config.template, config.orientation);
  const ds = getDensityStyles(theme);

  // Compute values used for section dividers
  const totalEmissions = data.emissions?.total ?? 0;
  const yoyChange = data.emissionsTrends?.length >= 2
    ? data.emissionsTrends[data.emissionsTrends.length - 1]?.yoyChange
    : null;
  const reductionTarget = data.transitionPlan?.targets?.[0]?.reductionPct;
  const emissionsDividerStat = totalEmissions > 0
    ? `${(totalEmissions / 1000).toFixed(1)}k`
    : '—';
  const emissionsDividerYoY = yoyChange
    ? ` — a ${parseFloat(yoyChange) < 0 ? Math.abs(parseFloat(yoyChange)).toFixed(1) + '% reduction' : parseFloat(yoyChange).toFixed(1) + '% increase'} year-on-year`
    : '';

  const pages = [
    // Cover — with optional hero photo
    renderCoverPage(config, data, theme),

    // Leadership message — storytelling full audiences only, gated by theme
    (theme.showLeadershipPage !== false) && tier === 'full'
      ? renderLeadershipPage(config, theme) : '',

    // Executive summary
    renderExecSummaryPage(config, data, theme),

    // Section divider: Emissions — storytelling audiences, gated by theme
    (theme.showSectionDividers !== false) && (tier === 'full' || tier === 'balanced') && totalEmissions > 0
      ? renderSectionDividerPage(
          config,
          emissionsDividerStat,
          `tCO\u2082e total emissions in ${config.reportYear}`,
          `Our carbon footprint is measured across all three GHG Protocol scopes${emissionsDividerYoY}. The following section presents the complete picture.`,
          'Our Carbon Footprint',
          theme,
        )
      : '',

    // Emissions sections
    renderEmissionsPage(config, data, theme),
    sections.has('key-findings') && data.keyFindings && data.keyFindings.length > 0
      ? renderKeyFindingsPage(config, data, theme) : '',
    sections.has('trends') && data.emissionsTrends && data.emissionsTrends.length >= 2
      ? renderTrendsPage(config, data, theme) : '',
    (sections.has('product-footprints') || sections.has('products')) && data.dataAvailability.hasProducts
      ? renderProductsPage(config, data, theme) : '',
    data.dataAvailability.hasVineyards && data.vineyards && data.vineyards.length > 0
      ? renderVineyardsPage(config, data, theme) : '',

    // People & governance sections
    (sections.has('people-culture') || sections.has('people')) && data.dataAvailability.hasPeopleCulture
      ? renderPeopleCulturePage(config, data, theme) : '',
    sections.has('governance') && data.dataAvailability.hasGovernance
      ? renderGovernancePage(config, data, theme) : '',
    (sections.has('community-impact') || sections.has('community')) && data.dataAvailability.hasCommunityImpact
      ? renderCommunityImpactPage(config, data, theme) : '',
    sections.has('supply-chain') && data.dataAvailability.hasSuppliers
      ? renderSupplyChainPage(config, data, theme) : '',

    // Section divider: Commitments — storytelling audiences, gated by theme
    (theme.showSectionDividers !== false) && (tier === 'full' || tier === 'balanced') && reductionTarget
      ? renderSectionDividerPage(
          config,
          `-${reductionTarget}%`,
          'absolute emission reduction target',
          `Our transition plan sets out the milestones, investments, and actions required to reach this goal. Progress is independently verified and reported annually.`,
          'Our Commitments',
          theme,
        )
      : '',

    // Strategy sections
    renderTargetsPage(config, data, theme),
    sections.has('transition-roadmap') && data.transitionPlan && data.transitionPlan.milestones.length > 0
      ? renderTransitionRoadmapPage(config, data, theme) : '',
    sections.has('risks-and-opportunities') && data.transitionPlan?.risks_and_opportunities?.length
      ? renderRisksOpportunitiesPage(config, data, theme) : '',

    // Technical sections
    renderMethodologyPage(config, data, theme),
    data.csrdGatingWarning ? renderCsrdGatingWarningPage(config, theme) : '',
    renderEsrsDisclosureIndexPage(config, data, theme),
    renderClosingPage(config, data, theme),
  ].filter(Boolean).join('\n');

  // Replace __PAGE_NUM__ placeholders with sequential page numbers.
  // The cover page has no page number, so the first __PAGE_NUM__ is page 1.
  let pageCounter = 0;
  const pagesWithNumbers = pages.replace(/__PAGE_NUM__/g, () => String(++pageCounter));

  const brandColor = getBrandColor(config);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(config.reportName)} - ${escapeHtml(data.organization.name)}</title>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${getThemeFontImport(theme)}" rel="stylesheet" />

  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --brand-color: ${brandColor};
    }

    body {
      font-family: ${theme.bodyFont};
      -webkit-font-smoothing: antialiased;
      background: #F2F1EA;
      color: ${theme.textColor};
      font-size: ${ds.bodySize}px;
    }

    @page { size: ${theme.orientation === 'landscape' ? 'A4 landscape' : 'A4'}; margin: 0; }

    ${screenMode ? `
    .page {
      max-width: 860px;
      margin: 0 auto 48px;
      position: relative;
      display: flex;
      flex-direction: column;
      padding: ${theme.pagePadding}px;
      overflow: visible;
      border-radius: 12px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.08);
    }
    /* In screen mode footers render in normal flow — no absolute overlap */
    .page-footer {
      position: static !important;
      padding: 24px 0 0 0 !important;
      background: transparent !important;
      margin-top: 32px;
    }
    ` : `
    .page {
      width: ${theme.pageWidth}px;
      height: ${theme.pageHeight}px;
      position: relative;
      display: flex;
      flex-direction: column;
      padding: ${theme.pagePadding}px;
      padding-bottom: ${theme.pagePadding * 2}px;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }

    .page:last-child { page-break-after: auto; break-after: auto; }
    `}

    .dark-page { background: ${theme.pageDarkBackground}; color: white; }
    .light-page { background: ${theme.pageBackground}; color: ${theme.textColor}; }

    .metric-card {
      background: #F2F1EA;
      border: 1px solid #D9D6CB;
      border-radius: 12px;
      padding: 20px;
    }

    .metric-label {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: ${theme.mutedTextColor};
      margin-bottom: 8px;
    }

    .metric-value {
      font-size: ${ds.headingSize}px;
      font-family: ${theme.headingFont};
      font-weight: 700;
      color: ${theme.textColor};
    }

    .metric-unit {
      font-size: 12px;
      color: ${theme.mutedTextColor};
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
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: ${theme.mutedTextColor};
      border-bottom: 2px solid #D9D6CB;
    }

    .data-table tbody td {
      padding: 10px 12px;
      border-bottom: 1px solid #ECEAE3;
      color: #1A1B1D;
    }

    .data-table tbody tr:nth-child(even) { background: #ECEAE3; }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .badge-low { background: #F2F1EA; color: #047857; }
    .badge-medium { background: #F2F1EA; color: #B45309; }
    .badge-high { background: #F2F1EA; color: #BE123C; }

    /* AI-generated narrative block */
    .narrative-block {
      background: #ECEAE3;
      border-left: 3px solid var(--brand-color, #205E40);
      border-radius: 0 8px 8px 0;
      padding: 16px 20px;
      margin-bottom: 20px;
    }

    .narrative-headline {
      font-size: 15px;
      font-weight: 600;
      color: #1A1B1D;
      line-height: 1.4;
      margin-bottom: 10px;
    }

    .narrative-context {
      font-size: 13px;
      color: #1A1B1D;
      line-height: 1.6;
      margin-bottom: 10px;
    }

    .narrative-next-step {
      font-size: 12px;
      font-style: italic;
      color: #6F6F68;
      margin-bottom: 0;
    }

    .narrative-confidence {
      font-size: 11px;
      color: #6F6F68;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #D9D6CB;
    }

    .narrative-footnote {
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      color: #6F6F68;
      margin-top: 8px;
    }

    @media print {
      body { background: #F2F1EA; }
      .page { box-shadow: none; margin: 0; border-radius: 0; }
    }

    ${screenMode ? `
    body { background: #ECEAE3; padding: 24px 16px; }
    .screen-nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #1A1B1D;
      color: white;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 32px;
      border-radius: 12px;
      max-width: 860px;
      margin-left: auto;
      margin-right: auto;
    }
    .screen-nav-title {
      font-size: 13px;
      font-weight: 600;
      color: white;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 300px;
    }
    .screen-nav-links {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .screen-nav-links a {
      font-size: 11px;
      color: #6F6F68;
      text-decoration: none;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .screen-nav-links a:hover { color: var(--brand-color, #205E40); }
    ` : ''}
  </style>
</head>
<body>
  ${screenMode ? `
  <nav class="screen-nav">
    <span class="screen-nav-title">${escapeHtml(config.reportName)}</span>
    <div class="screen-nav-links">
      <a href="#section-overview">Overview</a>
      ${config.sections.includes('scope-1-2-3') || config.sections.includes('ghg-inventory') ? '<a href="#section-emissions">Emissions</a>' : ''}
      ${config.sections.includes('people-culture') ? '<a href="#section-people">People</a>' : ''}
      ${config.sections.includes('governance') ? '<a href="#section-governance">Governance</a>' : ''}
      ${config.sections.includes('targets') ? '<a href="#section-targets">Targets</a>' : ''}
      ${config.sections.includes('transition-roadmap') ? '<a href="#section-transition">Transition</a>' : ''}
    </div>
  </nav>
  ` : ''}
  ${pagesWithNumbers}
</body>
</html>`;
}
