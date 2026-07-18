import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared data assembly for the sustainability report.
 *
 * One function feeds every consumer: the PDF pipeline (buildReportData), the
 * screen-mode HTML path (buildScreenReportHtml, which also serves share
 * links) and the Phase C narrative-draft route. Before this existed the PDF
 * and HTML paths carried two hand-copied, slightly drifted versions of the
 * same query block; the HTML path was missing hospitality emissions and key
 * findings entirely, and BOTH paths left `emissionsTrends` and `targets`
 * permanently empty, starving those sections' narratives.
 *
 * The passed client decides visibility: routes pass the caller's RLS-scoped
 * client, the Inngest pipeline passes the service-role client.
 */

export interface ReportConfigShape {
  reportName: string;
  reportYear: number;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  audience: string;
  standards: string[];
  sections: string[];
  isMultiYear: boolean;
  reportYears: number[];
  reportFramingStatement?: string;
  /** Audience-led style preset id (lib/pdf/templates/report-styles.ts). */
  style?: string;
  /** Review-step tone override ('confident' | 'measured' | 'technical'). */
  toneOverride?: string;
  /** Theme id from the wizard's style picker (lib/pdf/templates/themes.ts). */
  template?: string;
  orientation?: 'portrait' | 'landscape';
  /** User-defined running order of the selected sections; unset = the style's arc. */
  sectionOrder?: string[];
  /** Per-section data scopes (picked SKUs, trends year range). */
  sectionScopes?: {
    products?: { pcfIds: string[] };
    trends?: { fromYear: number; toYear: number };
  };
  branding: {
    logo: string | null;
    primaryColor: string;
    secondaryColor: string;
    heroImages?: string[];
    /** Named imagery slots; heroImages[0..2] remain legacy fallbacks. */
    images?: { cover?: string; divider1?: string; divider2?: string; people?: string };
    leadership?: { name?: string; title?: string; message?: string; photo?: string };
  };
}

const IMAGE_SLOT_KEYS = ['cover', 'divider1', 'divider2', 'people'] as const;

/** Defensive jsonb parsing: keep only string-valued known slots. */
export function normaliseImageSlots(raw: unknown): ReportConfigShape['branding']['images'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const key of IMAGE_SLOT_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'string' && value) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Defensive jsonb parsing: reject malformed or inverted scopes. */
export function normaliseSectionScopes(raw: unknown): ReportConfigShape['sectionScopes'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, any>;
  const out: NonNullable<ReportConfigShape['sectionScopes']> = {};
  const pcfIds = input.products?.pcfIds;
  if (Array.isArray(pcfIds)) {
    const ids = pcfIds.filter((id: unknown) => typeof id === 'string' && id);
    if (ids.length > 0) out.products = { pcfIds: ids };
  }
  const fromYear = input.trends?.fromYear;
  const toYear = input.trends?.toYear;
  if (Number.isFinite(fromYear) && Number.isFinite(toYear) && fromYear <= toYear) {
    out.trends = { fromYear, toYear };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function buildReportConfig(report: Record<string, any>): ReportConfigShape {
  // The wizard persists its full client config (incl. template/orientation,
  // hero images and the leadership block) into the `config` jsonb column;
  // the flat columns hold the queryable subset. Read both.
  const jsonConfig = (report.config ?? {}) as Record<string, any>;
  return {
    reportName: report.report_name,
    reportYear: report.report_year,
    reportingPeriodStart: report.reporting_period_start,
    reportingPeriodEnd: report.reporting_period_end,
    audience: report.audience || 'investors',
    standards: report.standards || [],
    sections: report.sections || [],
    isMultiYear: report.is_multi_year || false,
    reportYears: report.report_years || [],
    reportFramingStatement: report.report_framing_statement || undefined,
    style: jsonConfig.style || undefined,
    toneOverride: typeof jsonConfig.toneOverride === 'string' ? jsonConfig.toneOverride : undefined,
    template: jsonConfig.template || undefined,
    orientation: jsonConfig.orientation === 'landscape' ? 'landscape' : jsonConfig.orientation === 'portrait' ? 'portrait' : undefined,
    sectionOrder: Array.isArray(jsonConfig.sectionOrder)
      ? jsonConfig.sectionOrder.filter((s: unknown) => typeof s === 'string')
      : undefined,
    sectionScopes: normaliseSectionScopes(jsonConfig.sectionScopes),
    branding: {
      logo: report.logo_url || null,
      primaryColor: report.primary_color || '#205E40',
      secondaryColor: report.secondary_color || '#047857',
      heroImages: Array.isArray(jsonConfig.branding?.heroImages) ? jsonConfig.branding.heroImages : undefined,
      images: normaliseImageSlots(jsonConfig.branding?.images),
      leadership: jsonConfig.branding?.leadership || undefined,
    },
  };
}

export interface EmissionsTrendEntry {
  year: number;
  total: number;
  scope1: number;
  scope2: number;
  scope3: number;
  /** Percent change vs the previous listed year, 1dp; null for the first. */
  yoyChange: number | null;
}

/** Normalised target row for the targets section narrative. */
export interface NormalisedTarget {
  label: string;
  scope?: string;
  targetYear?: number | null;
  reductionPct?: number | null;
  status?: string;
  source: 'transition_plan' | 'sustainability_targets';
}

function scope3Total(breakdown: any): number {
  return typeof breakdown?.scope3 === 'object' && breakdown.scope3 !== null
    ? (breakdown.scope3.total ?? 0)
    : (breakdown?.scope3 ?? 0);
}

/**
 * Derive the multi-year emissions trend from corporate_reports rows.
 * Year selection precedence: an explicit trends scope (fromYear..toYear)
 * beats the multi-year reportYears selection, which beats the default
 * five-trailing-years window. Exported for unit testing.
 */
export function deriveEmissionsTrends(
  rows: Array<{ year: number; total_emissions: number | null; breakdown_json: any }>,
  config: Pick<ReportConfigShape, 'reportYear' | 'isMultiYear' | 'reportYears' | 'sectionScopes'>
): EmissionsTrendEntry[] {
  const trendScope = config.sectionScopes?.trends;
  const wantedYears = !trendScope && config.isMultiYear && config.reportYears.length > 0
    ? new Set(config.reportYears)
    : null;

  const entries = rows
    .filter(r => {
      if (trendScope) return r.year >= trendScope.fromYear && r.year <= trendScope.toYear;
      if (wantedYears) return wantedYears.has(r.year);
      return r.year <= config.reportYear && r.year > config.reportYear - 5;
    })
    .map(r => {
      const bj = r.breakdown_json as any;
      const total = bj?.total || r.total_emissions || 0;
      return {
        year: r.year,
        total,
        scope1: bj?.scope1 || 0,
        scope2: bj?.scope2 || 0,
        scope3: scope3Total(bj),
        yoyChange: null as number | null,
      };
    })
    .filter(e => e.total > 0)
    .sort((a, b) => a.year - b.year);

  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    if (prev.total > 0) {
      entries[i].yoyChange = Math.round(((entries[i].total - prev.total) / prev.total) * 1000) / 10;
    }
  }
  return entries;
}

/**
 * Normalise the union of transition-plan targets (jsonb) and
 * sustainability_targets rows. Exported for unit testing.
 */
export function normaliseTargets(
  planTargets: any[] | null | undefined,
  sustainabilityTargets: any[] | null | undefined
): NormalisedTarget[] {
  const out: NormalisedTarget[] = [];
  for (const t of planTargets || []) {
    if (!t) continue;
    out.push({
      label: t.scope
        ? `Reduce ${String(t.scope).replace(/_/g, ' ')} emissions by ${t.reductionPct ?? '?'}% by ${t.targetYear ?? '?'}`
        : 'Emission reduction target',
      scope: t.scope,
      targetYear: t.targetYear ?? null,
      reductionPct: t.reductionPct ?? null,
      source: 'transition_plan',
    });
  }
  for (const t of sustainabilityTargets || []) {
    if (!t) continue;
    const targetYear = t.target_date ? new Date(t.target_date).getFullYear() : null;
    out.push({
      label: t.metric_key
        ? `${String(t.metric_key).replace(/_/g, ' ')}: ${t.baseline_value ?? '?'} to ${t.target_value ?? '?'}${targetYear ? ` by ${targetYear}` : ''}`
        : 'Sustainability target',
      scope: t.scope ?? undefined,
      targetYear,
      reductionPct: null,
      status: t.status ?? undefined,
      source: 'sustainability_targets',
    });
  }
  return out;
}

/**
 * Assemble the full report data payload (live queries + key findings).
 * AI narratives are NOT generated here; callers either read them from the
 * data_snapshot store or run lib/reports/build-narratives over this output.
 */
export async function assembleReportData(
  supabase: SupabaseClient,
  report: Record<string, any>,
  opts: { skipKeyFindings?: boolean; forceKeyFindings?: boolean } = {}
): Promise<{ config: ReportConfigShape; reportData: Record<string, any> }> {
  const { data: org } = await supabase
    .from('organizations')
    .select('name, industry_sector, description')
    .eq('id', report.organization_id)
    .single();

  const config = buildReportConfig(report);

  const reportData: Record<string, any> = {
    organization: {
      name: org?.name || 'Organisation',
      industry_sector: org?.industry_sector,
      description: org?.description,
    },
    emissions: { scope1: 0, scope2: 0, scope3: 0, total: 0, year: config.reportYear },
    emissionsTrends: [] as EmissionsTrendEntry[],
    products: [] as any[],
    facilities: [] as any[],
    standards: [] as any[],
    dataAvailability: {
      hasOrganization: !!org,
      hasEmissions: false,
      hasProducts: false,
      hasFacilities: false,
    },
  };

  const year = config.reportYear;
  const orgId = report.organization_id;

  // Corporate emissions (reporting year)
  const { data: corpReport } = await supabase
    .from('corporate_reports')
    .select('total_emissions, breakdown_json')
    .eq('organization_id', orgId)
    .eq('year', year)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const bj = corpReport?.breakdown_json as any;
  const total = bj?.total || corpReport?.total_emissions || 0;
  if (corpReport && total > 0) {
    const s3obj = (typeof bj?.scope3 === 'object' && bj.scope3 !== null) ? bj.scope3 : {};
    reportData.emissions = {
      scope1: bj?.scope1 || 0,
      scope2: bj?.scope2 || 0,
      scope3: scope3Total(bj),
      total,
      year,
      hospitality: s3obj.hospitality ?? 0,
      hospitalityFood: s3obj.hospitality_food ?? 0,
      hospitalitySupplies: s3obj.hospitality_supplies ?? 0,
      hospitalityWaste: s3obj.hospitality_waste ?? 0,
    };
    reportData.dataAvailability.hasEmissions = true;
  }

  // Multi-year trend: one cheap query; feeds the trends section narrative and
  // the executive summary's year-on-year figure, both starved before.
  try {
    const { data: trendRows } = await supabase
      .from('corporate_reports')
      .select('year, total_emissions, breakdown_json')
      .eq('organization_id', orgId)
      .order('year', { ascending: true });
    if (trendRows && trendRows.length > 0) {
      reportData.emissionsTrends = deriveEmissionsTrends(trendRows, config);
    }
  } catch {
    // Non-fatal
  }

  // Products (optionally scoped to the user's picked footprints)
  if (config.sections.includes('product-footprints')) {
    let productsQuery = supabase
      .from('product_carbon_footprints')
      .select('id, products!product_lcas_product_id_fkey!inner(name), functional_unit, aggregated_impacts, status')
      .eq('organization_id', orgId)
      .eq('status', 'completed');
    const pcfIds = config.sectionScopes?.products?.pcfIds;
    if (pcfIds?.length) {
      productsQuery = productsQuery.in('id', pcfIds);
    }
    const { data: products } = await productsQuery;

    if (products && products.length > 0) {
      reportData.products = products.map((p: any) => ({
        name: p.products?.name || 'Unknown',
        functionalUnit: p.functional_unit || '1 unit',
        climateImpact: p.aggregated_impacts?.climate_change_gwp100 || 0,
      }));
      reportData.dataAvailability.hasProducts = true;
    }
  }

  // Materiality assessment (used for narrative context and CSRD gating)
  let materialityAssessment: { priority_topics: string[]; topics: any[]; completed_at: string | null } | null = null;
  try {
    const { data: matData } = await supabase
      .from('materiality_assessments')
      .select('topics, priority_topics, completed_at')
      .eq('organization_id', orgId)
      .eq('assessment_year', year)
      .maybeSingle();
    if (matData) materialityAssessment = matData as { priority_topics: string[]; topics: any[]; completed_at: string | null };
  } catch {
    // Non-fatal
  }

  const hasCsrd = config.standards.includes('csrd');
  const hasMaterialityComplete = !!materialityAssessment?.completed_at;
  if (hasCsrd && !hasMaterialityComplete) {
    reportData.csrdGatingWarning = true;
  }
  if (materialityAssessment) {
    reportData.materiality = materialityAssessment;
    reportData.materialityComplete = hasMaterialityComplete;
  }

  // Transition plan (Roadmap + R&O sections, and the targets narrative)
  const wantsTargets = config.sections.includes('targets');
  if (config.sections.includes('transition-roadmap') || config.sections.includes('risks-and-opportunities') || wantsTargets) {
    try {
      const { data: tpData } = await supabase
        .from('transition_plans')
        .select('plan_year, baseline_year, baseline_emissions_tco2e, targets, milestones, risks_and_opportunities, sbti_aligned, sbti_target_year')
        .eq('organization_id', orgId)
        .eq('plan_year', year)
        .maybeSingle();
      if (tpData) {
        reportData.transitionPlan = tpData as any;
      }
    } catch {
      // Non-fatal
    }
  }

  // Targets for the narrative (previously never populated)
  if (wantsTargets) {
    try {
      const { data: sustTargets } = await supabase
        .from('sustainability_targets')
        .select('metric_key, baseline_value, baseline_date, target_value, target_date, scope, status')
        .eq('organization_id', orgId);
      const targets = normaliseTargets(reportData.transitionPlan?.targets, sustTargets);
      if (targets.length > 0) reportData.targets = targets;
    } catch {
      // Non-fatal
    }
  }

  // Key findings (AI change-driver analysis; needs a previous year of data)
  if (config.sections.includes('key-findings') && !opts.skipKeyFindings) {
    try {
      const { calculateCorporateEmissions } = await import('@/lib/calculations/corporate-emissions');
      const { detectEmissionChanges } = await import('@/lib/calculations/emission-change-detection');
      const { generateKeyFindings } = await import('@/lib/claude/key-findings-assistant');

      const previousYear = year - 1;
      const [currentEmissions, previousEmissions] = await Promise.all([
        calculateCorporateEmissions(supabase, orgId, year),
        calculateCorporateEmissions(supabase, orgId, previousYear),
      ]);

      if (previousEmissions.hasData) {
        const { data: changeEvents } = await supabase
          .from('operational_change_events')
          .select('description, event_date, scope, category, impact_direction, estimated_impact_kgco2e')
          .eq('organization_id', orgId)
          .gte('event_date', `${previousYear}-01-01`)
          .lte('event_date', `${year}-12-31`);

        const utilityChanges = await detectEmissionChanges(supabase, orgId, year, previousYear);

        const result = await generateKeyFindings({
          organisationName: org?.name || 'Organisation',
          currentYear: year,
          previousYear,
          currentEmissions: {
            scope1: currentEmissions.breakdown.scope1,
            scope2: currentEmissions.breakdown.scope2,
            scope3Total: currentEmissions.breakdown.scope3.total,
            scope3Breakdown: { ...currentEmissions.breakdown.scope3 },
            total: currentEmissions.breakdown.total,
          },
          previousEmissions: {
            scope1: previousEmissions.breakdown.scope1,
            scope2: previousEmissions.breakdown.scope2,
            scope3Total: previousEmissions.breakdown.scope3.total,
            scope3Breakdown: { ...previousEmissions.breakdown.scope3 },
            total: previousEmissions.breakdown.total,
          },
          operationalChanges: changeEvents || [],
          utilityPatternChanges: utilityChanges.map((c) => ({
            description: c.description,
            scope: c.scope,
            category: c.category,
            magnitude_pct: c.magnitude_pct,
          })),
        }, opts.forceKeyFindings === true);

        if (result.findings.length > 0) {
          reportData.keyFindings = result.findings;
          reportData.dataAvailability.hasKeyFindings = true;
        }
      }
    } catch (err) {
      console.error('[assemble-report-data] Key findings generation failed (non-fatal):', err);
    }
  }

  return { config, reportData };
}
