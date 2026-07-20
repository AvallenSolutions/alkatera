import {
  REFERENCE_YEAR,
  replaceRows,
  upsert,
  type SeedCtx,
} from './shared';
import {
  TOPIC_LIBRARY,
  getTopPriorityTopics,
  type MaterialityTopic,
} from '@/lib/materiality/topic-library';
import type {
  ReductionTarget,
  RiskOpportunity,
  TransitionMilestone,
} from '@/lib/transition-plan/types';

/**
 * Reporting demo data for alkatera Drinks Co.
 *
 * Fills the seven /reports routes, which are otherwise completely empty:
 * the hub, the builder, company footprint, sustainability, historical,
 * materiality and transition plan.
 *
 * Two deliberate constraints run through this file:
 *
 *  1. NO ROW POINTS AT A STORAGE OBJECT. The seeder cannot upload files, so
 *     generated_reports.document_url and historical_imports.storage_object_path
 *     are both left null. Both consuming UIs guard on null (the Download button
 *     is simply not rendered, and the historical page never selects the path at
 *     all), so the cards render correctly rather than 404ing on click. This is
 *     the opposite of the evidence_documents pattern in programme.ts.
 *
 *  2. THE SUSTAINABILITY HUB READS new Date().getFullYear(). Materiality and
 *     transition plan are looked up with .maybeSingle() on an EXACT year match,
 *     so they are seeded for the CURRENT year, not REFERENCE_YEAR, or the tabs
 *     come back empty. The finalised company footprints use REFERENCE_YEAR and
 *     earlier, because those are the years with complete activity data.
 *
 * Tables deliberately not seeded: report_reviews and report_shares. Neither has
 * a migration in supabase/migrations/ on this branch, so seeding them would work
 * locally and then fail in production.
 */

/** The year the app itself considers "now" when it loads the reporting hub. */
function currentYear(): number {
  return new Date().getFullYear();
}

// ---------------------------------------------------------------------------
// Company footprint (corporate_reports)
// ---------------------------------------------------------------------------

interface AnnualFootprint {
  scope1: number;
  scope2: number;
  fleetScope1: number;
  products: number;
  usePhase: number;
  overheads: number;
  xeroBaseline: number;
  businessTravelFleet: number;
}

/**
 * Hand-modelled annual footprints in tonnes CO2e, keyed by how many years
 * before REFERENCE_YEAR they sit.
 *
 * Scope 1 + 2 for REFERENCE_YEAR - 1 deliberately sums to 429.0 t, because
 * programme.ts seeds the SBTi near-term target with a 429,000 kg baseline dated
 * 31 December of that year. Keeping the two in step means the targets page and
 * the company footprint page tell the same story rather than contradicting each
 * other. Scope 3 dominates at roughly 85% of the total, which is what a real
 * drinks producer looks like once packaging and agriculture are counted.
 */
const ANNUAL_FOOTPRINTS: Record<number, AnnualFootprint> = {
  2: { scope1: 244.6, scope2: 219.8, fleetScope1: 24.1, products: 2140.5, usePhase: 186.4, overheads: 214.8, xeroBaseline: 168.2, businessTravelFleet: 31.6 },
  1: { scope1: 231.2, scope2: 197.8, fleetScope1: 22.4, products: 2038.7, usePhase: 178.9, overheads: 201.4, xeroBaseline: 159.7, businessTravelFleet: 29.4 },
  0: { scope1: 214.5, scope2: 158.3, fleetScope1: 19.8, products: 1904.2, usePhase: 171.2, overheads: 188.6, xeroBaseline: 148.3, businessTravelFleet: 26.8 },
};

/** Part-year profile for the open reporting year, at roughly 55% of a full year. */
const DRAFT_FOOTPRINT: AnnualFootprint = {
  scope1: 118.7, scope2: 74.9, fleetScope1: 10.6,
  products: 1012.4, usePhase: 88.6, overheads: 97.2, xeroBaseline: 76.4, businessTravelFleet: 13.9,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Build the breakdown_json blob in the shape the scope-1-2 page writes and the
 * company footprint page reads back: scope names rather than GHG Protocol
 * category numbers, all values in tonnes CO2e.
 */
function buildBreakdown(f: AnnualFootprint, calculatedAt: string) {
  const scope3Total = round1(f.products + f.usePhase + f.overheads + f.xeroBaseline + f.businessTravelFleet);
  const total = round1(f.scope1 + f.scope2 + scope3Total);
  return {
    breakdown: {
      scope1: f.scope1,
      scope2: f.scope2,
      fleet: { scope1: f.fleetScope1, scope2: 0, scope3: f.businessTravelFleet },
      scope3: {
        products: f.products,
        use_phase: f.usePhase,
        products_breakdown: [],
        overheads: f.overheads,
        xero_baseline: f.xeroBaseline,
        business_travel_fleet: f.businessTravelFleet,
        total: scope3Total,
      },
      total,
      calculated_at: calculatedAt,
    },
    total,
  };
}

/**
 * Finalised footprints for the closed years plus a Draft for the year in
 * progress. The company footprint page lists every row ordered by year, so
 * three closed years give it a real year-on-year trend to draw, and the Draft
 * demonstrates the in-progress state.
 *
 * Upserted on the (organization_id, year) unique key rather than deleted and
 * reinserted, because corporate_reports cascades to corporate_overheads and
 * spend_import_batches and we must not take those with us.
 */
async function seedCompanyFootprints(ctx: SeedCtx): Promise<void> {
  const now = currentYear();

  // Only treat a year as closed once it genuinely is, so the seed still makes
  // sense if it is run in a later calendar year.
  const closedOffsets = [2, 1, 0].filter((offset) => REFERENCE_YEAR - offset < now);

  const rows = closedOffsets.map((offset) => {
    const year = REFERENCE_YEAR - offset;
    const { breakdown, total } = buildBreakdown(ANNUAL_FOOTPRINTS[offset], `${year + 1}-01-31T09:00:00.000Z`);
    return {
      organization_id: ctx.orgId,
      year,
      status: 'Finalized',
      total_emissions: total,
      breakdown_json: breakdown,
      finalized_at: `${year + 1}-01-31T09:00:00.000Z`,
      // Capital goods is the one screened-out category we can defend: the
      // bottling line is third-party and the sites are leased.
      not_applicable_categories: ['capital_goods'],
    };
  });

  const { breakdown: draftBreakdown, total: draftTotal } = buildBreakdown(DRAFT_FOOTPRINT, `${now}-07-01T09:00:00.000Z`);
  rows.push({
    organization_id: ctx.orgId,
    year: now,
    status: 'Draft',
    total_emissions: draftTotal,
    breakdown_json: draftBreakdown,
    finalized_at: null as unknown as string,
    not_applicable_categories: [],
  });

  await upsert(ctx, 'corporate_reports', rows, 'organization_id,year');
  ctx.report.companyFootprints = `${rows.length} corporate reports (${closedOffsets.length} finalised + ${now} draft)`;
}

// ---------------------------------------------------------------------------
// Report builder output (generated_reports)
// ---------------------------------------------------------------------------

/** Stable ids so re-running converges and the version link stays intact. */
const REPORT_IDS = {
  annualPriorV1: 'b0a40001-0000-4000-8000-000000000001',
  annualPriorV2: 'b0a40001-0000-4000-8000-000000000002',
  annualLatest: 'b0a40001-0000-4000-8000-000000000003',
  tradeCustomer: 'b0a40001-0000-4000-8000-000000000004',
};

interface GeneratedReportSeed {
  id: string;
  year: number;
  name: string;
  audience: 'investors' | 'regulators' | 'customers' | 'internal' | 'supply-chain' | 'technical';
  outputFormat: 'docx' | 'xlsx' | 'pptx' | 'pdf' | 'html';
  standards: string[];
  sections: string[];
  framing: string;
  version: number;
  isLatest: boolean;
  parentId?: string;
  changelog?: string;
}

/**
 * Section and standard ids are drawn only from the sets that have a label in
 * types/report-builder.ts. Three section ids (flag-removals, transition-roadmap,
 * risks-and-opportunities) exist in AVAILABLE_SECTIONS but have no SECTION_LABELS
 * entry, so they render as blank chips. They are avoided here.
 */
const GENERATED_REPORTS: GeneratedReportSeed[] = [
  {
    id: REPORT_IDS.annualPriorV1,
    year: REFERENCE_YEAR - 1,
    name: `Annual Sustainability Report ${REFERENCE_YEAR - 1}`,
    audience: 'investors',
    outputFormat: 'pdf',
    standards: ['csrd', 'tcfd'],
    sections: ['executive-summary', 'company-overview', 'scope-1-2-3', 'key-findings', 'trends', 'targets', 'governance'],
    framing: 'First full-year disclosure against our science-based target, written for our investors and lenders.',
    version: 1,
    isLatest: false,
  },
  {
    id: REPORT_IDS.annualPriorV2,
    year: REFERENCE_YEAR - 1,
    name: `Annual Sustainability Report ${REFERENCE_YEAR - 1}`,
    audience: 'investors',
    outputFormat: 'pdf',
    standards: ['csrd', 'tcfd'],
    sections: ['executive-summary', 'company-overview', 'scope-1-2-3', 'ghg-inventory', 'key-findings', 'trends', 'targets', 'governance', 'methodology'],
    framing: 'First full-year disclosure against our science-based target, written for our investors and lenders.',
    version: 2,
    isLatest: true,
    parentId: REPORT_IDS.annualPriorV1,
    changelog: 'Restated Scope 3 purchased goods after the glass supplier provided primary data, and added the full GHG inventory and methodology sections.',
  },
  {
    id: REPORT_IDS.annualLatest,
    year: REFERENCE_YEAR,
    name: `Annual Sustainability Report ${REFERENCE_YEAR}`,
    audience: 'investors',
    outputFormat: 'pdf',
    standards: ['csrd', 'tcfd', 'iso-14064'],
    sections: ['executive-summary', 'company-overview', 'scope-1-2-3', 'ghg-inventory', 'product-footprints', 'supply-chain', 'key-findings', 'trends', 'targets', 'governance', 'methodology', 'appendix'],
    framing: 'Second year of reporting, showing a 9% cut in Scope 1 and 2 and the first product footprints across the core range.',
    version: 1,
    isLatest: true,
  },
  {
    id: REPORT_IDS.tradeCustomer,
    year: REFERENCE_YEAR,
    name: `Trade Customer Carbon Summary ${REFERENCE_YEAR}`,
    audience: 'supply-chain',
    outputFormat: 'pptx',
    standards: ['iso-14067', 'gri'],
    sections: ['executive-summary', 'product-footprints', 'supply-chain', 'facilities', 'key-findings'],
    framing: 'Cradle-to-gate product footprints prepared for on-trade and grocery buyers running supplier scorecards.',
    version: 1,
    isLatest: true,
  },
];

function generatedReportRow(ctx: SeedCtx, s: GeneratedReportSeed): Record<string, unknown> {
  const periodStart = `${s.year}-01-01`;
  const periodEnd = `${s.year}-12-31`;
  return {
    id: s.id,
    organization_id: ctx.orgId,
    created_by: ctx.ownerUserId,
    report_name: s.name,
    report_year: s.year,
    reporting_period_start: periodStart,
    reporting_period_end: periodEnd,
    audience: s.audience,
    output_format: s.outputFormat,
    standards: s.standards,
    sections: s.sections,
    status: 'completed',
    // config is written wholesale by the builder but never read back, so it is
    // mirrored from the flat columns purely so the row looks authentic.
    config: {
      reportName: s.name,
      reportYear: s.year,
      reportingPeriodStart: periodStart,
      reportingPeriodEnd: periodEnd,
      audience: s.audience,
      outputFormat: s.outputFormat,
      standards: s.standards,
      sections: s.sections,
      branding: { logo: null, primaryColor: '#2563eb', secondaryColor: '#10b981' },
      isMultiYear: false,
      reportYears: [s.year],
    },
    logo_url: null,
    primary_color: '#2563eb',
    secondary_color: '#10b981',
    // No PDF was ever produced by the seeder, so there is nothing to link to.
    // The hub hides the Download button when this is null; Investor Summary and
    // Regulatory Index still work, because they render live from corporate_reports.
    document_url: null,
    data_snapshot: null,
    error_message: null,
    is_multi_year: false,
    report_years: [s.year],
    parent_report_id: s.parentId ?? null,
    version: s.version,
    is_latest: s.isLatest,
    changelog: s.changelog ?? null,
    report_framing_statement: s.framing,
    generated_at: `${s.year + 1}-02-14T11:20:00.000Z`,
    downloaded_at: null,
  };
}

/**
 * Finished builder output, including a superseded v1 so the version history
 * panel has something to show.
 *
 * Insert order matters: parent_report_id is a self-FK and is not deferrable, so
 * the v1 row has to land before the v2 row that points at it. The delete is a
 * single statement covering both, which is safe because referential integrity
 * is only checked at the end of the statement.
 */
async function seedGeneratedReports(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  const { error: delErr } = await svc.from('generated_reports').delete().eq('organization_id', orgId);
  if (delErr) throw new Error(`generated_reports (clear): ${delErr.message}`);

  const parents = GENERATED_REPORTS.filter((s) => !s.parentId).map((s) => generatedReportRow(ctx, s));
  const children = GENERATED_REPORTS.filter((s) => s.parentId).map((s) => generatedReportRow(ctx, s));

  const { error: parentErr } = await svc.from('generated_reports').insert(parents);
  if (parentErr) throw new Error(`generated_reports (insert): ${parentErr.message}`);
  if (children.length) {
    const { error: childErr } = await svc.from('generated_reports').insert(children);
    if (childErr) throw new Error(`generated_reports (insert versions): ${childErr.message}`);
  }

  const listed = GENERATED_REPORTS.filter((s) => s.isLatest).length;
  ctx.report.generatedReports = `${GENERATED_REPORTS.length} generated reports (${listed} listed + 1 superseded version); no document_url, so no Download button`;
  ctx.warnings.push(
    'generated_reports: document_url is null on every seeded report because the seeder cannot upload a PDF. The hub hides the Download button; Investor Summary and Regulatory Index still generate live.',
  );
}

// ---------------------------------------------------------------------------
// Materiality assessment (materiality_assessments)
// ---------------------------------------------------------------------------

/**
 * Topics this drinks producer has judged material, as
 * id -> [impactScore, financialScore, rationale]. Both scores are 1 to 5,
 * matching the sliders on the setup page and the matrix plot.
 */
const MATERIAL_TOPICS: Record<string, [number, number, string]> = {
  'climate-mitigation': [5, 5, 'Scope 3 is roughly 85% of the footprint, and buyers now ask for a carbon figure on every tender.'],
  packaging: [5, 5, 'Glass is the single largest material hotspot across the range, so packaging choices move the footprint more than anything else we control.'],
  'water-resources': [5, 4, 'Distilling, brewing and CIP are all water-intensive, and the South West sites sit in an area of moderate water stress.'],
  'sustainable-sourcing': [4, 5, 'Grapes, apples, barley and botanicals drive both our agricultural emissions and our exposure to poor harvests.'],
  'energy-management': [4, 4, 'Thermal energy for distillation and brewing is the bulk of Scope 1, and the biggest lever we own outright.'],
  'circular-economy': [4, 4, 'Refill, lightweighting and the paper bottle pilot are the clearest routes to cutting packaging impact.'],
  'climate-adaptation': [4, 4, 'Vineyard and orchard yields are already showing weather volatility, which feeds straight through to cost of goods.'],
  'consumer-health': [4, 4, 'Responsible drinking is a licence-to-operate issue for any alcohol producer, and drives the no and low range.'],
  biodiversity: [4, 3, 'The vineyard and orchard are working landscapes where hedgerow and pollinator habitat can be measurably improved.'],
  'transport-logistics': [3, 4, 'Distribution to on-trade and export customers is a visible Scope 3 category that customers ask about.'],
  'waste-management': [4, 3, 'Spent grain, pomace and lees are large by-product streams; diverting them from landfill is straightforward and visible.'],
  'land-use': [4, 3, 'Own-farmed land gives us direct control over soil carbon and land management practice.'],
  'supply-chain-transparency': [3, 4, 'Primary supplier data is what moves our Scope 3 from spend-based estimates to something defensible.'],
  'responsible-marketing': [3, 4, 'Alcohol marketing is tightly regulated, and green claims are now policed just as hard.'],
  'health-safety': [3, 4, 'Hot liquids, pressurised vessels and forklifts make site safety a standing board item.'],
  'fair-wages': [3, 3, 'Paying the real Living Wage across seasonal harvest labour is a stated commitment.'],
  'sustainability-governance': [3, 4, 'Board-level ownership of the transition plan is what makes the targets credible to investors.'],
  'regulatory-compliance': [3, 4, 'EPR, deposit return schemes and CSRD readiness all land on this business within the plan period.'],
  'sbti-targets': [3, 3, 'The near-term science-based target is the spine of the whole programme.'],
  'bcorp-certification': [3, 3, 'B Corp certification is in progress and is the framework the wider team recognises.'],
};

/** Topics screened out entirely, with a reason the assessment can defend. */
const NOT_MATERIAL_TOPICS: Record<string, string> = {
  'indigenous-rights': 'No operations or sourcing in territories where indigenous land rights are engaged.',
};

/**
 * A completed double-materiality assessment for the current year.
 *
 * The whole 37-topic library is written back, exactly as the setup page does,
 * so the matrix and the category filters have a full population to work with.
 * Unrated topics are marked as monitoring rather than left blank, because a
 * completed assessment with unscored topics reads as half-finished.
 *
 * priority_topics is derived with the app's own getTopPriorityTopics helper so
 * the ordering matches what a real run through the wizard would produce, and
 * every id is guaranteed to resolve back to a topic in the topics array.
 */
async function seedMateriality(ctx: SeedCtx): Promise<void> {
  const year = currentYear();

  const topics: MaterialityTopic[] = TOPIC_LIBRARY.map((base) => {
    const material = MATERIAL_TOPICS[base.id];
    if (material) {
      const [impactScore, financialScore, rationale] = material;
      return { ...base, status: 'material' as const, impactScore, financialScore, rationale };
    }
    const notMaterial = NOT_MATERIAL_TOPICS[base.id];
    if (notMaterial) {
      return { ...base, status: 'not_material' as const, impactScore: 1, financialScore: 1, rationale: notMaterial };
    }
    return {
      ...base,
      status: 'monitoring' as const,
      impactScore: 2,
      financialScore: 2,
      rationale: 'Reviewed and kept under watch; not currently material enough to carry a target.',
    };
  });

  const priorityTopics = getTopPriorityTopics(topics, 8).map((t) => t.id);

  await upsert(
    ctx,
    'materiality_assessments',
    [
      {
        organization_id: ctx.orgId,
        assessment_year: year,
        topics,
        priority_topics: priorityTopics,
        // Non-null completed_at is what flips the hub into its "complete" state
        // and unlocks the ESRS index in the PDF.
        completed_at: `${year}-03-28T16:00:00.000Z`,
        created_by: ctx.ownerUserId,
        updated_at: `${year}-03-28T16:00:00.000Z`,
      },
    ],
    'organization_id,assessment_year',
  );

  const materialCount = topics.filter((t) => t.status === 'material').length;
  ctx.report.materiality = `${year} assessment: ${topics.length} topics scored (${materialCount} material) + ${priorityTopics.length} priority topics`;
}

// ---------------------------------------------------------------------------
// Transition plan (transition_plans)
// ---------------------------------------------------------------------------

/**
 * Reduction targets stated against the baseline year. The headline is a 42%
 * cut by 2030, which is the same commitment programme.ts writes into
 * sustainability_targets, so the two pages agree.
 */
function buildTargets(): ReductionTarget[] {
  return [
    { id: 'tgt-total-2030', scope: 'total', targetYear: 2030, reductionPct: 42, absoluteTargetTco2e: 1761.5, notes: 'Near-term science-based target, 1.5C aligned, covering all three scopes.' },
    { id: 'tgt-scope1-2030', scope: 'scope1', targetYear: 2030, reductionPct: 45, absoluteTargetTco2e: 127.2, notes: 'Delivered by heat pumps at the brewery and HVO in the distillery boilers.' },
    { id: 'tgt-scope2-2030', scope: 'scope2', targetYear: 2030, reductionPct: 90, absoluteTargetTco2e: 19.8, notes: 'Market-based Scope 2 all but eliminated by the REGO-backed tariff and on-site solar.' },
    { id: 'tgt-scope3-2030', scope: 'scope3', targetYear: 2030, reductionPct: 30, absoluteTargetTco2e: 1825.7, notes: 'Driven by glass lightweighting, the paper bottle roll-out and supplier engagement.' },
    { id: 'tgt-total-2040', scope: 'total', targetYear: 2040, reductionPct: 90, notes: 'Long-term net-zero target, with residual emissions addressed by permanent removals.' },
  ];
}

/**
 * Milestones deliberately mirror the reduction_initiatives programme.ts seeds,
 * so a demo can move between the targets page and the transition plan without
 * the two contradicting each other. linkedEventId is left unset because it is
 * a real FK into operational_change_events.
 */
function buildMilestones(baselineYear: number): TransitionMilestone[] {
  return [
    { id: 'ms-rego', title: 'All owned sites on a REGO-backed renewable tariff', targetDate: `${baselineYear + 1}-04-01`, status: 'complete', scopeReference: 'scope2', emissionsImpactTco2e: 5.2, notes: 'Completed ahead of schedule; market-based Scope 2 now close to zero.' },
    { id: 'ms-waste-ad', title: 'Spent grain and pomace fully diverted to anaerobic digestion', targetDate: `${baselineYear + 2}-09-30`, status: 'in_progress', scopeReference: 'scope3', emissionsImpactTco2e: 1.4, notes: 'Brewery and cidery contracts signed; distillery draff still to move.' },
    { id: 'ms-glass', title: 'Lightweight wine and spirits glass from 530g to 420g', targetDate: `${baselineYear + 3}-03-31`, status: 'in_progress', scopeReference: 'scope3', emissionsImpactTco2e: 3.1, notes: 'Two of five SKUs converted; mould tooling ordered for the rest.' },
    { id: 'ms-heat-pumps', title: 'Air-source heat pumps replace the brewery gas boiler', targetDate: `${baselineYear + 3}-10-31`, status: 'in_progress', scopeReference: 'scope1', emissionsImpactTco2e: 6.8, notes: 'Planning granted; installation scheduled for the winter shutdown.' },
    { id: 'ms-hvo', title: 'Distillery boilers switched from fossil fuel to HVO', targetDate: `${baselineYear + 4}-06-30`, status: 'not_started', scopeReference: 'scope1', emissionsImpactTco2e: 4.2, notes: 'Awaiting board approval of the fuel supply contract.' },
    { id: 'ms-solar', title: '250 kWp rooftop solar array at the brewery', targetDate: `${baselineYear + 4}-09-30`, status: 'not_started', scopeReference: 'scope2', emissionsImpactTco2e: 3.6, notes: 'Capex case submitted; expected to self-generate about 20% of site electricity.' },
    { id: 'ms-supplier-data', title: 'Primary emissions data from the top 10 suppliers by spend', targetDate: `${baselineYear + 4}-12-31`, status: 'in_progress', scopeReference: 'scope3', emissionsImpactTco2e: 0, notes: 'Seven of ten suppliers have returned data; improves accuracy rather than cutting emissions.' },
    { id: 'ms-paper-bottle', title: 'Paper bottle extended across the full Calvados line', targetDate: `${baselineYear + 5}-06-30`, status: 'not_started', scopeReference: 'scope3', emissionsImpactTco2e: 0.9, notes: 'Pilot SKU is live; roll-out depends on retailer acceptance.' },
  ];
}

/**
 * Climate risks and opportunities. aiGenerated is false throughout because
 * these are seeded, not produced by the assistant, and the UI badges the
 * difference.
 */
const RISKS_AND_OPPORTUNITIES: RiskOpportunity[] = [
  { id: 'ro-harvest', type: 'risk', category: 'physical', title: 'Harvest volatility in the vineyard and orchard', description: 'Warmer, wetter springs and later frosts are already shifting yields year to year, exposing cost of goods and forcing spot purchases of fruit at short notice.', likelihood: 'high', impact: 'high', timeHorizon: 'short', aiGenerated: false },
  { id: 'ro-water', type: 'risk', category: 'physical', title: 'Water availability at the South West sites', description: 'Abstraction limits during dry summers could constrain distillation and cleaning schedules at peak production.', likelihood: 'medium', impact: 'high', timeHorizon: 'medium', aiGenerated: false },
  { id: 'ro-epr', type: 'risk', category: 'regulatory', title: 'Packaging EPR and deposit return scheme costs', description: 'Extended producer responsibility fees are modulated by material and recyclability, so a glass-heavy range carries a rising cost that lightweighting only partly offsets.', likelihood: 'high', impact: 'medium', timeHorizon: 'short', aiGenerated: false },
  { id: 'ro-greenwash', type: 'risk', category: 'reputational', title: 'Scrutiny of environmental claims on pack', description: 'Regulators and campaigners are testing drinks claims closely; an unsubstantiated on-pack claim would damage trade relationships as well as the brand.', likelihood: 'medium', impact: 'medium', timeHorizon: 'short', aiGenerated: false },
  { id: 'ro-carbon-price', type: 'risk', category: 'financial', title: 'Carbon price exposure through the supply chain', description: 'Glass and aluminium are energy-intensive and sit inside carbon border and trading schemes, so supplier prices track the carbon price rather than input costs alone.', likelihood: 'medium', impact: 'medium', timeHorizon: 'medium', aiGenerated: false },
  { id: 'ro-listings', type: 'opportunity', category: 'transition', title: 'Verified product footprints unlock retail listings', description: 'Grocery and on-trade buyers increasingly score suppliers on carbon data. Cradle-to-gate footprints across the core range turn a compliance chore into a commercial advantage.', likelihood: 'high', impact: 'high', timeHorizon: 'short', aiGenerated: false },
  { id: 'ro-lowweight', type: 'opportunity', category: 'transition', title: 'Lightweight and paper packaging cuts cost as well as carbon', description: 'Lighter glass reduces both embodied emissions and freight cost per case, so the packaging programme pays back on two lines at once.', likelihood: 'high', impact: 'medium', timeHorizon: 'medium', aiGenerated: false },
  { id: 'ro-nolo', type: 'opportunity', category: 'transition', title: 'Growth in the no and low alcohol category', description: 'Lower-ABV products need less distillation energy per litre and meet shifting consumer demand, improving both margin and footprint intensity.', likelihood: 'medium', impact: 'medium', timeHorizon: 'medium', aiGenerated: false },
];

/**
 * The transition plan for the current year.
 *
 * The hub only shows the plan as complete when targets, milestones AND
 * risks_and_opportunities are all non-empty, so all three are populated.
 * baseline_emissions_tco2e is taken from the same model as the corporate report
 * for the baseline year, which keeps the two pages consistent.
 */
async function seedTransitionPlan(ctx: SeedCtx): Promise<void> {
  const year = currentYear();
  const baselineYear = REFERENCE_YEAR - 1;
  const { total: baselineTotal } = buildBreakdown(ANNUAL_FOOTPRINTS[1], `${baselineYear + 1}-01-31T09:00:00.000Z`);

  const targets = buildTargets();
  const milestones = buildMilestones(baselineYear);

  await upsert(
    ctx,
    'transition_plans',
    [
      {
        organization_id: ctx.orgId,
        plan_year: year,
        baseline_year: baselineYear,
        baseline_emissions_tco2e: baselineTotal,
        targets,
        milestones,
        risks_and_opportunities: RISKS_AND_OPPORTUNITIES,
        sbti_aligned: true,
        sbti_target_year: 2030,
        created_by: ctx.ownerUserId,
        updated_at: `${year}-04-11T10:30:00.000Z`,
      },
    ],
    'organization_id,plan_year',
  );

  ctx.report.transitionPlan = `${year} plan vs ${baselineYear} baseline (${baselineTotal} tCO2e): ${targets.length} targets, ${milestones.length} milestones, ${RISKS_AND_OPPORTUNITIES.length} risks/opportunities`;
}

// ---------------------------------------------------------------------------
// Historical imports (historical_imports)
// ---------------------------------------------------------------------------

/**
 * Pre-platform reporting, extracted from documents the customer already had.
 *
 * These years sit deliberately BEFORE the earliest corporate_reports year, so
 * imported and measured figures never describe the same year with different
 * numbers. That is also how the fallback helper is meant to be used: it fills
 * gaps where operational data does not exist and badges the result as imported,
 * rather than competing with measured data. The result is one continuous story:
 * imported for the first two years, measured from REFERENCE_YEAR - 2 onwards.
 *
 * The historical page renders six metrics from a sustainability_report using
 * truthy checks, so every one of them is deliberately non-zero: a genuine zero
 * would be silently dropped and the card would look empty.
 *
 * storage_object_path is null. The page never selects it and offers no
 * download, so there is nothing to 404, and null is what the ingest route
 * itself writes for a manually entered import.
 */
async function seedHistoricalImports(ctx: SeedCtx): Promise<void> {
  const firstReportYear = REFERENCE_YEAR - 4;
  const secondReportYear = REFERENCE_YEAR - 3;

  const rows = [
    {
      organization_id: ctx.orgId,
      kind: 'sustainability_report',
      reporting_year: firstReportYear,
      source_document_name: `alkatera-drinks-co-sustainability-report-${firstReportYear}.pdf`,
      storage_object_path: null,
      created_by: ctx.ownerUserId,
      extracted_data: {
        reporting_year: firstReportYear,
        organization_name: 'alkatera Drinks Co',
        scope1_tco2e: 268.4,
        scope2_tco2e_market: 241.6,
        scope2_tco2e_location: 262.9,
        scope3_tco2e: 2894.7,
        water_m3: 34800,
        waste_tonnes: 71.2,
        waste_diversion_rate_pct: 64,
        headcount: 44,
        revenue_gbp: 8940000,
        certifications_held: ['ISO 14001'],
        targets: [{ metric: 'Scope 1+2', year: 2030, percent_reduction: 40 }],
      },
    },
    {
      organization_id: ctx.orgId,
      kind: 'sustainability_report',
      reporting_year: secondReportYear,
      source_document_name: `alkatera-drinks-co-sustainability-report-${secondReportYear}.pdf`,
      storage_object_path: null,
      created_by: ctx.ownerUserId,
      extracted_data: {
        reporting_year: secondReportYear,
        organization_name: 'alkatera Drinks Co',
        // Trends continuously into the earliest measured year (REFERENCE_YEAR - 2),
        // so the imported-to-measured handover does not show as a step change.
        scope1_tco2e: 256.8,
        scope2_tco2e_market: 231.2,
        scope2_tco2e_location: 249.6,
        scope3_tco2e: 2831.4,
        water_m3: 33150,
        waste_tonnes: 68.5,
        waste_diversion_rate_pct: 71,
        headcount: 48,
        revenue_gbp: 9720000,
        certifications_held: ['ISO 14001'],
        targets: [{ metric: 'Scope 1+2', year: 2030, percent_reduction: 42 }],
      },
    },
    {
      organization_id: ctx.orgId,
      kind: 'lca_report',
      reporting_year: secondReportYear,
      source_document_name: `bath-gin-700ml-lca-${secondReportYear}.pdf`,
      storage_object_path: null,
      created_by: ctx.ownerUserId,
      extracted_data: {
        product_name: 'Bath Gin 700ml',
        functional_unit: '1 x 700ml bottle, delivered to the retail distribution centre',
        reference_year: secondReportYear,
        system_boundary: 'cradle-to-gate',
        total_gwp_kgco2e: 1.42,
        stage_breakdown: { raw_materials: 0.61, processing: 0.22, packaging: 0.44, transport: 0.11, use: 0.0, eol: 0.04 },
        water_footprint_l: 18.5,
        methodology: 'ISO 14067:2018, third-party reviewed',
      },
    },
  ];

  await replaceRows(ctx, 'historical_imports', { organization_id: ctx.orgId }, rows);
  ctx.report.historicalImports = `${rows.length} historical imports (2 sustainability reports + 1 product LCA), no storage files referenced`;
}

// ---------------------------------------------------------------------------
// LCA wizard templates (lca_report_templates)
// ---------------------------------------------------------------------------

/**
 * Reusable LCA wizard configurations, so a demo starting a new product LCA is
 * offered a sensible template instead of a blank compliance wizard.
 *
 * settings is a partial LcaWizardSettings and is applied as a spread over the
 * wizard's initial form data, so omitting the boundary-specific config blocks
 * (distribution, use phase, end of life, product loss) is safe. It is typed
 * loosely here rather than importing LcaWizardSettings, because that type
 * resolves through a 'use client' component and this module runs server-side.
 *
 * Only one template may carry is_org_default: a partial unique index and a
 * BEFORE INSERT trigger both enforce one default per organisation.
 */
async function seedLcaTemplates(ctx: SeedCtx): Promise<void> {
  const rows = [
    {
      organization_id: ctx.orgId,
      name: 'Standard cradle-to-gate (spirits & wine)',
      description: 'House default for the core range: cradle-to-gate, internal review, UK grid factors.',
      is_org_default: true,
      created_by: ctx.ownerUserId,
      settings: {
        intendedApplication: 'Internal decarbonisation planning and customer carbon disclosure.',
        reasonsForStudy: 'Identify emissions hotspots across ingredients, packaging and production, and answer trade customer data requests.',
        intendedAudience: ['Internal management', 'Customers'],
        isComparativeAssertion: false,
        systemBoundary: 'cradle-to-gate',
        cutoffCriteria: 'Flows below 1% of total mass or 1% of total impact excluded; cumulative exclusions kept under 5%.',
        assumptions: [
          'UK national grid average electricity factors applied where no supplier-specific factor exists.',
          'Transport distances estimated from supplier postcodes to the receiving site.',
          'Packaging assumed to be delivered on standard pallets with reusable dunnage.',
        ],
        dataQuality: {
          temporal_coverage: `${REFERENCE_YEAR} calendar year`,
          geographic_coverage: 'United Kingdom, with European packaging supply',
          technological_coverage: 'Current production technology at the winery, distillery and brewery',
          precision: 'medium',
          completeness: 85,
        },
        criticalReviewType: 'internal',
        criticalReviewJustification: 'Reviewed by the internal sustainability lead. No comparative assertion is disclosed to the public, so an external panel is not required under ISO 14044.',
        referenceYear: REFERENCE_YEAR,
      },
    },
    {
      organization_id: ctx.orgId,
      name: 'Full cradle-to-grave (externally reviewed)',
      description: 'For claims that go public: full life cycle including use and end of life, with external critical review.',
      is_org_default: false,
      created_by: ctx.ownerUserId,
      settings: {
        intendedApplication: 'Public-facing product carbon claims and retailer sustainability scorecards.',
        reasonsForStudy: 'Support an externally communicated footprint covering the complete life cycle, including chilling at point of consumption and end-of-life packaging treatment.',
        intendedAudience: ['Customers', 'Regulators', 'General public'],
        isComparativeAssertion: false,
        systemBoundary: 'cradle-to-grave',
        cutoffCriteria: 'Flows below 1% of total mass or impact excluded; cumulative exclusions kept under 5% and documented in the appendix.',
        assumptions: [
          'Use phase assumes chilled serving for 60% of volume, based on category consumption research.',
          'End-of-life treatment follows current UK national recycling rates by material.',
          'Consumer transport allocated on a per-basket basis rather than per-product.',
        ],
        dataQuality: {
          temporal_coverage: `${REFERENCE_YEAR} calendar year`,
          geographic_coverage: 'United Kingdom market',
          technological_coverage: 'Current production technology and current UK waste infrastructure',
          precision: 'high',
          completeness: 92,
        },
        criticalReviewType: 'external',
        criticalReviewJustification: 'Results are communicated publicly, so an independent external reviewer is engaged in line with ISO 14044 Section 6.',
        referenceYear: REFERENCE_YEAR,
      },
    },
  ];

  await replaceRows(ctx, 'lca_report_templates', { organization_id: ctx.orgId }, rows);
  ctx.report.lcaTemplates = `${rows.length} LCA wizard templates (1 org default)`;
}

// ---------------------------------------------------------------------------

/**
 * Seed everything behind the /reports section: the hub, builder, company
 * footprint, sustainability, historical, materiality and transition plan.
 */
export async function seedReports(ctx: SeedCtx): Promise<void> {
  await seedCompanyFootprints(ctx);
  await seedGeneratedReports(ctx);
  await seedMateriality(ctx);
  await seedTransitionPlan(ctx);
  await seedHistoricalImports(ctx);
  await seedLcaTemplates(ctx);
}
