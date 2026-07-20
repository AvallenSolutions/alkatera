/**
 * Ask generation — tasks/data-revolution-plan.md, Pillar 3, "Make
 * agent_exceptions real" + "Impact prioritisation".
 *
 * Three families of pure generators (organisation data in, AskCandidate[]
 * out — each independently unit-tested), a DB-gathering wrapper for each,
 * and `sweepAsks`, the idempotent entry point wired into the footprint
 * agent's daily run (app/api/agents/footprint/run/route.ts).
 *
 *   1. Draft gaps — a value exists but nobody has looked at it: a proxy
 *      material factor, an unconfirmed hospitality recipe, an estimated
 *      utility entry.
 *   2. Plausibility flags — reuses the existing, already-unit-tested
 *      checkers (lib/validation/production-run-sanity.ts,
 *      lib/constants/packaging-weight-ranges.ts) rather than duplicating
 *      their thresholds.
 *   3. Growth-band gaps — undone lib/desk/growth-score.ts signals, carried
 *      through with their signal id so other surfaces can dedupe against
 *      them (see components/studio/room-setup-panel.tsx).
 *
 * Idempotency: every candidate carries a stable `dedupe_key`
 * (lib/asks/types.ts) unique per (organization_id, kind='ask') via the
 * partial index added by migration 20260717120000_agent_exceptions_ask_kind.sql
 * (full SQL posted in the phase report). `sweepAsks` also auto-resolves any
 * open ask whose dedupe_key no longer appears in a fresh generation pass —
 * the underlying gap closed some other way (the user answered it on the
 * record's own page, not through the queue) — so the queue never goes
 * stale.
 */

import type { GrowthBandKey, GrowthIngredients, GrowthSignal } from '@/lib/desk/growth-score';
import { computeGrowthSignals, gatherGrowthIngredients } from '@/lib/desk/growth-score';
import { checkRunIntensity, type RunIntensityInput } from '@/lib/validation/production-run-sanity';
import { checkPackagingWeight } from '@/lib/constants/packaging-weight-ranges';
import {
  gatherMaterialImpactContexts,
  gatherOrgTotalEmissionsKg,
  materialImpactShare,
  activityImpactShare,
  priorityScore,
  type MaterialImpactContext,
} from './impact';
import type { AskCandidate, AskPayload, AskType } from './types';
import { isUntouchedDistributionDefault } from '@/lib/lca/dossier';
import { boundaryNeedsDistribution } from '@/lib/system-boundaries';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function fmtQty(n: number, unit?: string | null): string {
  const val = Math.abs(n) >= 100 ? Math.round(n).toLocaleString() : round(n).toString();
  return unit ? `${val} ${unit}` : val;
}

function prettify(key: string | null | undefined): string {
  if (!key) return '';
  return key.replace(/^(utility_|activity_)/, '').replace(/_/g, ' ');
}

function makeAsk(
  askType: AskType,
  title: string,
  question: string,
  rest: Omit<AskPayload, 'ask_type' | 'question' | 'priority_score' | 'impact_share'> & { impactShare: number | null },
): AskCandidate {
  const { impactShare, ...payloadRest } = rest;
  return {
    title,
    payload: {
      ask_type: askType,
      question,
      impact_share: impactShare,
      priority_score: priorityScore(askType, impactShare),
      ...payloadRest,
    },
  };
}

// ---------------------------------------------------------------------------
// 1a. Draft gap — proxy materials (product_materials.ef_source_type='proxy')
// ---------------------------------------------------------------------------

export interface ProxyMaterialRow {
  id: string;
  productId: string;
  productName: string;
  materialName: string;
  quantity: number;
  unit: string | null;
}

export function generateDraftGapMaterialAsks(
  rows: ProxyMaterialRow[],
  impactByProduct: Map<string, MaterialImpactContext>,
): AskCandidate[] {
  return rows.map((row) => {
    const ctx = impactByProduct.get(row.productId) ?? null;
    const impactShare = materialImpactShare(row.materialName, ctx);
    return makeAsk(
      'draft_gap_material',
      `Confirm ${row.materialName} in ${row.productName}`,
      `We used a general estimate for ${row.materialName} in ${row.productName} — no exact supplier factor yet. ` +
        `Is ${fmtQty(row.quantity, row.unit)} the right amount per unit?`,
      {
        answer_shape: 'confirm_value',
        current_value: row.quantity,
        unit: row.unit,
        target: { table: 'product_materials', id: row.id, field: 'match_status' },
        dedupe_key: `material:${row.id}`,
        href: `/products/${row.productId}/recipe`,
        product_name: row.productName,
        facility_name: null,
        impactShare,
      },
    );
  });
}

// ---------------------------------------------------------------------------
// 1b. Draft gap — hospitality recipe quantities still placeholders
// ---------------------------------------------------------------------------

export interface HospitalityMealRow {
  id: string;
  productId: string;
  productName: string;
}

export function generateHospitalityQuantityAsks(rows: HospitalityMealRow[]): AskCandidate[] {
  return rows.map((row) =>
    makeAsk(
      'draft_gap_hospitality_quantities',
      `Confirm quantities for ${row.productName}`,
      `${row.productName}'s recipe still has the quantities we filled in when it was imported. Are they right as they stand?`,
      {
        answer_shape: 'yes_no',
        current_value: null,
        unit: null,
        target: { table: 'hospitality_meal_meta', id: row.id, field: 'quantities_status' },
        dedupe_key: `hospitality_meta:${row.id}`,
        href: `/products/${row.productId}/recipe`,
        product_name: row.productName,
        facility_name: null,
        impactShare: null, // recipe-level, no per-material breakdown to divide by
      },
    ),
  );
}

// ---------------------------------------------------------------------------
// 1c. Draft gap — estimated utility / activity entries awaiting confirm
// ---------------------------------------------------------------------------

export interface EstimatedActivityRow {
  id: string;
  table: 'facility_activity_entries' | 'utility_data_entries';
  facilityId: string;
  facilityName: string;
  category: string;
  quantity: number;
  unit: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  emissionsKg: number | null;
}

export function generateDraftGapUtilityAsks(
  rows: EstimatedActivityRow[],
  orgTotalEmissionsKg: number | null,
): AskCandidate[] {
  return rows.map((row) => {
    const impactShare = activityImpactShare(row.emissionsKg, orgTotalEmissionsKg);
    const period = row.periodStart ? ` (${row.periodStart}${row.periodEnd && row.periodEnd !== row.periodStart ? ` to ${row.periodEnd}` : ''})` : '';
    const categoryLabel = prettify(row.category);
    const field = row.table === 'facility_activity_entries' ? 'data_provenance' : 'data_quality';
    return makeAsk(
      'draft_gap_utility',
      `Confirm ${categoryLabel} at ${row.facilityName}`,
      `${row.facilityName}'s ${categoryLabel}${period} was estimated at ${fmtQty(row.quantity, row.unit)}. Is that about right, or do you have the real figure?`,
      {
        answer_shape: 'choice',
        options: [
          { value: 'about_right', label: 'About right' },
          { value: 'have_real_figure', label: "I've got the real figure" },
        ],
        current_value: row.quantity,
        unit: row.unit,
        target: { table: row.table, id: row.id, field },
        dedupe_key: `${row.table}:${row.id}`,
        href: '/data/scope-1-2/',
        product_name: null,
        facility_name: row.facilityName,
        impactShare,
      },
    );
  });
}

// ---------------------------------------------------------------------------
// 2a. Plausibility — production run resource intensity
// ---------------------------------------------------------------------------

export interface ProductionRunRow {
  id: string;
  productId: string;
  productName: string;
  productionDate: string;
  productionVolume: number;
  productionVolumeUnit: string;
  electricityKwh: number | null;
  waterM3: number | null;
}

export function generatePlausibilityProductionRunAsks(rows: ProductionRunRow[]): AskCandidate[] {
  const out: AskCandidate[] = [];
  for (const row of rows) {
    const input: RunIntensityInput = {
      productionVolume: row.productionVolume,
      productionVolumeUnit: row.productionVolumeUnit,
      electricityKwh: row.electricityKwh,
      waterM3: row.waterM3,
    };
    const warnings = checkRunIntensity(input);
    if (warnings.length === 0) continue;
    // One ask per flagged run, not per warning — the fix (the production
    // volume) is the same regardless of which resource looked implausible.
    const worst = warnings[0];
    out.push(
      makeAsk(
        'plausibility_production_run',
        `Check the ${row.productName} run on ${row.productionDate}`,
        worst.message,
        {
          answer_shape: 'number',
          current_value: row.productionVolume,
          unit: row.productionVolumeUnit,
          target: { table: 'production_run_resource_data', id: row.id, field: 'production_volume' },
          dedupe_key: `prrd:${row.id}`,
          href: `/products/${row.productId}`,
          product_name: row.productName,
          facility_name: null,
          impactShare: null, // a data-entry error flag, not a footprint share
        },
      ),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2b. Plausibility — packaging weight
// ---------------------------------------------------------------------------

export interface PackagingWeightRow {
  id: string;
  productId: string;
  productName: string;
  materialName: string;
  packagingCategory: string | null;
  containerSizeMl: number | null;
  netWeightG: number | null;
}

export function generatePlausibilityPackagingAsks(rows: PackagingWeightRow[]): AskCandidate[] {
  const out: AskCandidate[] = [];
  for (const row of rows) {
    if (row.netWeightG == null) continue;
    const result = checkPackagingWeight({
      packagingCategory: row.packagingCategory,
      materialName: row.materialName,
      containerSizeMl: row.containerSizeMl,
      weightG: row.netWeightG,
    });
    if (result.level !== 'warning') continue;
    out.push(
      makeAsk(
        'plausibility_packaging_weight',
        `Check the weight of ${row.materialName} in ${row.productName}`,
        result.message || `The weight entered for ${row.materialName} looks unusual.`,
        {
          answer_shape: 'number',
          current_value: row.netWeightG,
          unit: 'g',
          target: { table: 'product_materials', id: row.id, field: 'net_weight_g' },
          dedupe_key: `material_weight:${row.id}`,
          href: `/products/${row.productId}/recipe`,
          product_name: row.productName,
          facility_name: null,
          impactShare: null,
        },
      ),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. Growth-band gaps
// ---------------------------------------------------------------------------

export function generateGrowthSignalAsks(signals: Record<GrowthBandKey, GrowthSignal[]>): AskCandidate[] {
  const out: AskCandidate[] = [];
  for (const band of Object.keys(signals) as GrowthBandKey[]) {
    for (const signal of signals[band]) {
      if (signal.done) continue;
      out.push(
        makeAsk('growth_signal', signal.label, signal.label, {
          answer_shape: 'link',
          current_value: null,
          unit: null,
          target: null,
          dedupe_key: `growth_signal:${signal.id}`,
          href: signal.href,
          growth_signal_id: signal.id,
          product_name: null,
          facility_name: null,
          impactShare: null,
        }),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Dossier gaps — the two questions an LCA cannot answer for itself
//
// Both of these were steps in the compliance wizard, asked in ISO vocabulary
// at a point where the user had no way to know what the words meant, and both
// passed validation with an untouched default. They belong here instead: one
// plain question at a time, ordered by what it is worth.
// ---------------------------------------------------------------------------

export interface DossierBoundaryRow {
  pcfId: string;
  productId: string;
  productName: string;
  systemBoundary: string | null;
}

/** The three answers, in the words someone selling drinks would use. */
export const BOUNDARY_CHOICES = [
  { value: 'cradle-to-gate', label: 'Up to my factory gate' },
  { value: 'cradle-to-shelf', label: 'Up to the shelf it sells from' },
  { value: 'cradle-to-grave', label: 'All the way to the bin' },
];

export function generateDossierBoundaryAsks(rows: DossierBoundaryRow[]): AskCandidate[] {
  return rows.map((row) =>
    makeAsk(
      'dossier_boundary',
      `How far should ${row.productName}'s footprint go?`,
      `We have assumed ${row.productName}'s footprint should stop at your factory gate. ` +
        `Counting the journey to your customers, and what happens to the packaging afterwards, ` +
        `usually makes the number bigger but truer. How far should it go?`,
      {
        answer_shape: 'choice',
        options: BOUNDARY_CHOICES,
        current_value: row.systemBoundary,
        unit: null,
        target: {
          table: 'product_carbon_footprints',
          id: row.pcfId,
          field: 'system_boundary',
        },
        dedupe_key: `dossier_boundary:${row.pcfId}`,
        href: `/products/${row.productId}/dossier`,
        product_name: row.productName,
        facility_name: null,
        // Not computable: the whole point is that we do not yet know how much
        // of this product's footprint is being left out.
        impactShare: null,
      },
    ),
  );
}

export interface DossierDistributionRow {
  pcfId: string;
  productId: string;
  productName: string;
  /** Share of this product's footprint the distribution stage currently carries. */
  impactShare: number | null;
}

export function generateDossierDistributionAsks(
  rows: DossierDistributionRow[],
): AskCandidate[] {
  return rows.map((row) =>
    makeAsk(
      'dossier_gap_distribution',
      `How far does ${row.productName} travel to customers?`,
      `${row.productName}'s footprint currently assumes a 50 km delivery by lorry, which is our ` +
        `standard starting point rather than anything about your business. ` +
        `Roughly how far does it actually travel to reach your customers?`,
      {
        answer_shape: 'number',
        current_value: 50,
        unit: 'km',
        target: {
          table: 'product_carbon_footprints',
          id: row.pcfId,
          field: 'distribution_config',
        },
        dedupe_key: `dossier_distribution:${row.pcfId}`,
        href: `/products/${row.productId}/dossier`,
        product_name: row.productName,
        facility_name: null,
        impactShare: row.impactShare,
      },
    ),
  );
}

// ---------------------------------------------------------------------------
// Gather — one round trip per source, org-scoped. Any failed query degrades
// that source to an empty list rather than failing the whole sweep.
// ---------------------------------------------------------------------------

export interface AskIngredients {
  proxyMaterials: ProxyMaterialRow[];
  hospitalityMeals: HospitalityMealRow[];
  estimatedActivity: EstimatedActivityRow[];
  flaggedRuns: ProductionRunRow[];
  flaggedPackaging: PackagingWeightRow[];
  growthSignals: Record<GrowthBandKey, GrowthSignal[]>;
  impactByProduct: Map<string, MaterialImpactContext>;
  orgTotalEmissionsKg: number | null;
  dossierBoundaries: DossierBoundaryRow[];
  dossierDistributions: DossierDistributionRow[];
}

/** Confirmed data_provenance values on facility_activity_entries — everything else is a draft-gap candidate. */
const CONFIRMED_ACTIVITY_PROVENANCE = ['primary_supplier_verified', 'primary_measured_onsite'];

export async function gatherAskIngredients(db: any, organizationId: string): Promise<AskIngredients> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceIso = since.toISOString().slice(0, 10);

  const [
    productsRes,
    hospitalityMetaRes,
    activityRes,
    utilityBillsRes,
    runsRes,
    growthIngredients,
    impactByProduct,
    orgTotalEmissionsKg,
  ] = await Promise.all([
    db.from('products').select('id, name').eq('organization_id', organizationId),
    db
      .from('hospitality_meal_meta')
      .select('id, product_id')
      .eq('organization_id', organizationId)
      .eq('quantities_status', 'unconfirmed'),
    db
      .from('facility_activity_entries')
      .select('id, facility_id, activity_category, quantity, unit, reporting_period_start, reporting_period_end, data_provenance, calculated_emissions_kg_co2e')
      .eq('organization_id', organizationId)
      .gte('reporting_period_start', sinceIso)
      .not('data_provenance', 'in', `(${CONFIRMED_ACTIVITY_PROVENANCE.join(',')})`)
      .limit(200),
    db
      .from('facilities')
      .select('id, name, utility_data_entries!inner(id, utility_type, quantity, unit, reporting_period_start, reporting_period_end, data_quality)')
      .eq('organization_id', organizationId)
      .eq('utility_data_entries.data_quality', 'estimated')
      .gte('utility_data_entries.reporting_period_start', sinceIso)
      .limit(100),
    db
      .from('production_run_resource_data')
      .select('id, product_id, production_date, production_volume, production_volume_unit, electricity_total_kwh, electricity_computed_kwh, water_intake_m3, verification_status')
      .eq('organization_id', organizationId)
      // 'unverified' only: once an ask is answered (lib/asks/apply.ts sets
      // 'self_declared' either way — correcting the number or confirming it
      // as-is), never re-flag the same run — otherwise a confirmed-but-
      // genuinely-unusual figure would re-trigger the ask every sweep.
      .eq('verification_status', 'unverified')
      .order('production_date', { ascending: false })
      .limit(100),
    gatherGrowthIngredients(db, organizationId),
    gatherMaterialImpactContexts(db, organizationId),
    gatherOrgTotalEmissionsKg(db, organizationId),
  ]);

  const productNameById = new Map<string, string>((productsRes.data ?? []).map((p: any) => [String(p.id), p.name]));
  const facilityNameById = new Map<string, string>();

  // Proxy materials: needs product ids first (facility-less), scoped via products.
  const productIds = Array.from(productNameById.keys());
  const materialsRes =
    productIds.length > 0
      ? await db
          .from('product_materials')
          .select('id, product_id, material_name, quantity, unit, ef_source_type, match_status')
          .in('product_id', productIds)
          .eq('ef_source_type', 'proxy')
          // NULL-inclusive "not verified": a plain .neq() drops NULL rows
          // (NULL <> 'verified' is NULL, not true in SQL), which would
          // silently exclude every material that's never had match_status
          // set at all — the common case for older rows.
          .or('match_status.is.null,match_status.neq.verified')
          .limit(300)
      : { data: [] as any[] };

  const packagingRes =
    productIds.length > 0
      ? await db
          .from('product_materials')
          .select('id, product_id, material_name, net_weight_g, packaging_category, container_size_ml, match_status')
          .in('product_id', productIds)
          .eq('material_type', 'packaging')
          .not('net_weight_g', 'is', null)
          // Same loop-guard as production runs (and same NULL-inclusive
          // pattern as the proxy-materials query above): once answered,
          // apply.ts sets match_status='verified' regardless of outcome, so
          // exclude it here rather than re-flag a figure already confirmed.
          .or('match_status.is.null,match_status.neq.verified')
          .limit(300)
      : { data: [] as any[] };

  const proxyMaterials: ProxyMaterialRow[] = (materialsRes.data ?? []).map((m: any) => ({
    id: String(m.id),
    productId: String(m.product_id),
    productName: productNameById.get(String(m.product_id)) || 'a product',
    materialName: m.material_name,
    quantity: Number(m.quantity || 0),
    unit: m.unit,
  }));

  const hospitalityMeals: HospitalityMealRow[] = (hospitalityMetaRes.data ?? []).map((r: any) => ({
    id: String(r.id),
    productId: String(r.product_id),
    productName: productNameById.get(String(r.product_id)) || 'a menu item',
  }));

  const activityFacilityIds = Array.from(new Set((activityRes.data ?? []).map((r: any) => r.facility_id).filter(Boolean)));
  if (activityFacilityIds.length > 0) {
    const { data: facs } = await db.from('facilities').select('id, name').in('id', activityFacilityIds);
    for (const f of facs ?? []) facilityNameById.set(String((f as any).id), (f as any).name);
  }

  const estimatedActivity: EstimatedActivityRow[] = [
    ...(activityRes.data ?? []).map((r: any) => ({
      id: String(r.id),
      table: 'facility_activity_entries' as const,
      facilityId: String(r.facility_id),
      facilityName: facilityNameById.get(String(r.facility_id)) || 'a facility',
      category: r.activity_category,
      quantity: Number(r.quantity || 0),
      unit: r.unit,
      periodStart: r.reporting_period_start,
      periodEnd: r.reporting_period_end,
      emissionsKg: r.calculated_emissions_kg_co2e != null ? Number(r.calculated_emissions_kg_co2e) : null,
    })),
    ...((utilityBillsRes.data ?? []) as any[]).flatMap((facility: any) =>
      (facility.utility_data_entries ?? []).map((u: any) => ({
        id: String(u.id),
        table: 'utility_data_entries' as const,
        facilityId: String(facility.id),
        facilityName: facility.name,
        category: u.utility_type,
        quantity: Number(u.quantity || 0),
        unit: u.unit,
        periodStart: u.reporting_period_start,
        periodEnd: u.reporting_period_end,
        emissionsKg: null, // not stored per-row on utility_data_entries
      })),
    ),
  ];

  const flaggedRuns: ProductionRunRow[] = (runsRes.data ?? []).map((r: any) => ({
    id: String(r.id),
    productId: String(r.product_id),
    productName: productNameById.get(String(r.product_id)) || 'a production run',
    productionDate: r.production_date,
    productionVolume: Number(r.production_volume || 0),
    productionVolumeUnit: r.production_volume_unit,
    electricityKwh: r.electricity_total_kwh != null ? Number(r.electricity_total_kwh) : r.electricity_computed_kwh != null ? Number(r.electricity_computed_kwh) : null,
    waterM3: r.water_intake_m3 != null ? Number(r.water_intake_m3) : null,
  }));

  const flaggedPackaging: PackagingWeightRow[] = (packagingRes.data ?? []).map((m: any) => ({
    id: String(m.id),
    productId: String(m.product_id),
    productName: productNameById.get(String(m.product_id)) || 'a product',
    materialName: m.material_name,
    packagingCategory: m.packaging_category,
    containerSizeMl: m.container_size_ml != null ? Number(m.container_size_ml) : null,
    netWeightG: m.net_weight_g != null ? Number(m.net_weight_g) : null,
  }));

  return {
    proxyMaterials,
    hospitalityMeals,
    estimatedActivity,
    flaggedRuns,
    flaggedPackaging,
    growthSignals: computeGrowthSignals(growthIngredients as GrowthIngredients),
    impactByProduct,
    orgTotalEmissionsKg,
    ...(await gatherDossierGaps(db, organizationId, productNameById)),
  };
}

/**
 * The active footprints still resting on something we assumed rather than
 * something anyone told us: a boundary we proposed, or the 50 km delivery leg
 * the wizard injected on mount.
 *
 * Only 'completed' footprints are swept. A draft is mid-edit and asking about
 * it would be interrupting, not helping.
 */
async function gatherDossierGaps(
  db: any,
  organizationId: string,
  productNameById: Map<string, string>,
): Promise<{
  dossierBoundaries: DossierBoundaryRow[];
  dossierDistributions: DossierDistributionRow[];
}> {
  const empty = { dossierBoundaries: [], dossierDistributions: [] };
  try {
    const { data } = await db
      .from('product_carbon_footprints')
      .select(
        'id, product_id, system_boundary, boundary_source, distribution_config, aggregated_impacts',
      )
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .limit(300);

    if (!data) return empty;

    const boundaries: DossierBoundaryRow[] = [];
    const distributions: DossierDistributionRow[] = [];

    for (const pcf of data as any[]) {
      const productId = String(pcf.product_id);
      const productName = productNameById.get(productId);
      if (!productName) continue;

      if (pcf.boundary_source === 'defaulted') {
        boundaries.push({
          pcfId: pcf.id,
          productId,
          productName,
          systemBoundary: pcf.system_boundary ?? null,
        });
      }

      // Only worth asking when distribution is actually in scope: a
      // gate-only footprint legitimately does not count it.
      const inScope = pcf.system_boundary
        ? boundaryNeedsDistribution(pcf.system_boundary)
        : false;
      if (inScope && isUntouchedDistributionDefault(pcf.distribution_config?.legs)) {
        const stages = pcf.aggregated_impacts?.breakdown?.by_lifecycle_stage ?? {};
        const total = pcf.aggregated_impacts?.climate_change_gwp100;
        const dist = stages.distribution;
        distributions.push({
          pcfId: pcf.id,
          productId,
          productName,
          impactShare:
            typeof dist === 'number' && typeof total === 'number' && total > 0
              ? dist / total
              : null,
        });
      }
    }

    return { dossierBoundaries: boundaries, dossierDistributions: distributions };
  } catch {
    // One failed source degrades to empty rather than failing the sweep.
    return empty;
  }
}

/** All generators run over one AskIngredients bundle. */
export function generateAllAsks(ingredients: AskIngredients): AskCandidate[] {
  return [
    ...generateDraftGapMaterialAsks(ingredients.proxyMaterials, ingredients.impactByProduct),
    ...generateHospitalityQuantityAsks(ingredients.hospitalityMeals),
    ...generateDraftGapUtilityAsks(ingredients.estimatedActivity, ingredients.orgTotalEmissionsKg),
    ...generatePlausibilityProductionRunAsks(ingredients.flaggedRuns),
    ...generatePlausibilityPackagingAsks(ingredients.flaggedPackaging),
    ...generateGrowthSignalAsks(ingredients.growthSignals),
    ...generateDossierBoundaryAsks(ingredients.dossierBoundaries),
    ...generateDossierDistributionAsks(ingredients.dossierDistributions),
  ];
}

// ---------------------------------------------------------------------------
// Sweep — idempotent insert + stale auto-resolve. Wired into the footprint
// agent's daily run (app/api/agents/footprint/run/route.ts).
// ---------------------------------------------------------------------------

export interface AskSweepResult {
  candidatesGenerated: number;
  created: number;
  autoResolved: number;
  errors: string[];
}

export async function sweepAsks(db: any, organizationId: string): Promise<AskSweepResult> {
  const errors: string[] = [];
  let ingredients: AskIngredients;
  try {
    ingredients = await gatherAskIngredients(db, organizationId);
  } catch (err: any) {
    return { candidatesGenerated: 0, created: 0, autoResolved: 0, errors: [err?.message || 'gather failed'] };
  }

  const candidates = generateAllAsks(ingredients);
  const freshKeys = new Set(candidates.map((c) => c.payload.dedupe_key));

  const { data: existingOpen, error: existingErr } = await db
    .from('agent_exceptions')
    .select('id, payload')
    .eq('organization_id', organizationId)
    .eq('kind', 'ask')
    .eq('status', 'open');
  if (existingErr) errors.push(`existing-open query: ${existingErr.message}`);

  const existingKeys = new Set<string>();
  const staleIds: string[] = [];
  for (const row of existingOpen ?? []) {
    const key = (row as any).payload?.dedupe_key;
    if (typeof key !== 'string') continue;
    existingKeys.add(key);
    if (!freshKeys.has(key)) staleIds.push((row as any).id);
  }

  let autoResolved = 0;
  if (staleIds.length > 0) {
    const { error: resolveErr, count } = await db
      .from('agent_exceptions')
      .update({
        status: 'approved',
        applied_to: { table: null, autoResolved: true, reason: 'Underlying gap no longer applies.' },
      })
      .in('id', staleIds)
      .select('id', { count: 'exact', head: false });
    if (resolveErr) errors.push(`auto-resolve: ${resolveErr.message}`);
    else autoResolved = count ?? staleIds.length;
  }

  const toInsert = candidates
    .filter((c) => !existingKeys.has(c.payload.dedupe_key))
    .map((c) => ({
      organization_id: organizationId,
      kind: 'ask',
      source: 'agent_run',
      source_ref: { askDedupeKey: c.payload.dedupe_key, sweptAt: new Date().toISOString() },
      payload: c.payload,
      title: c.title,
      summary: c.payload.question,
      confidence: null,
      status: 'open' as const,
    }));

  let created = 0;
  if (toInsert.length > 0) {
    const { data: inserted, error: insertErr } = await db.from('agent_exceptions').insert(toInsert).select('id');
    if (!insertErr) {
      created = inserted?.length ?? toInsert.length;
    } else if (insertErr.code === '23505') {
      // Race with a concurrent sweep — retry one at a time, same pattern as
      // insertExceptionsIdempotent in app/api/agents/footprint/run/route.ts.
      for (const row of toInsert) {
        const { error: rowErr } = await db.from('agent_exceptions').insert(row);
        if (!rowErr) created += 1;
        else if (rowErr.code !== '23505') errors.push(rowErr.message);
      }
    } else {
      errors.push(`insert: ${insertErr.message}`);
    }
  }

  return { candidatesGenerated: candidates.length, created, autoResolved, errors };
}
