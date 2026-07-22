/**
 * End-use scenarios: one core LCA, many journeys.
 *
 * A product sold into a bar and the same product sold into a supermarket share
 * everything up to the gate. Only the journey, the use phase and the bin
 * differ. This module holds the channel presets, the per-scenario computation
 * over a shared core, and the volume-weighted headline that keeps a product to
 * one declared number.
 *
 * See `tasks/lca-end-use-scenarios-plan.md`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DISTRIBUTION_SCENARIOS } from '../distribution-factors';
import { normaliseBoundary } from '../system-boundaries';
import {
  computeDownstreamStages,
  type DownstreamMaterial,
  type DownstreamStageResults,
} from './downstream-stages';

export type ScenarioChannel =
  | 'on_trade'
  | 'off_trade_retail'
  | 'dtc'
  | 'export'
  | 'custom';

export interface EndUseScenario {
  id: string;
  pcf_id: string;
  organization_id: string;
  name: string;
  channel: ScenarioChannel;
  is_primary: boolean;
  share_pct: number | null;
  distribution_config: any;
  use_phase_config: any;
  eol_config: any;
  product_loss_config: any;
  stage_results: ScenarioStageResults | null;
  computed_at: string | null;
  provenance: Record<string, unknown>;
}

export interface ScenarioStageResults {
  /** The scenario's own footprint per functional unit, core included. */
  total: number;
  /** Shared cradle-to-gate core BEFORE this scenario's loss multiplier. */
  core: number;
  lossMultiplier: number;
  distribution: number;
  usePhase: number;
  endOfLife: number;
  /**
   * This scenario's Scope 3 per unit. Carried separately because corporate
   * reporting consumes Scope 3, not the headline: facility Scope 1 and 2 are
   * already in the corporate inventory and must not be counted twice.
   *
   * Null when the PCF has no scope breakdown to recover it from.
   */
  scope3: number | null;
  /** Full downstream detail, for the dossier's per-section provenance. */
  detail: DownstreamStageResults;
}

// ─────────────────────────────────────────────────────────────────────────────
// Channel presets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What the platform assumes about a channel before the user tells it anything.
 * Every value seeded from a preset is `estimated` provenance and generates its
 * own ask; none of it is presented as fact.
 *
 * Distribution legs reuse `DISTRIBUTION_SCENARIOS` rather than inventing a
 * second set of distances, so there is one place to correct a journey.
 */
export const CHANNEL_PRESETS: Record<
  Exclude<ScenarioChannel, 'custom'>,
  {
    label: string;
    /** One line in the user's terms, shown when they pick the channel. */
    description: string;
    distributionPreset: keyof typeof DISTRIBUTION_SCENARIOS;
    /** Refrigeration split. On-trade chills nearly everything; retail less so. */
    retailFraction: number;
    /** Where the empty container goes. Commercial waste recycles more glass. */
    eolRegionHint: 'commercial' | 'household';
    /** Typical losses through this route (distribution / retail / consumer %). */
    loss: { distributionLossPercent: number; retailLossPercent: number; consumerWastePercent: number };
  }
> = {
  on_trade: {
    label: 'On-trade (bars and restaurants)',
    description: 'Sold and drunk on the premises, usually chilled behind a bar.',
    distributionPreset: 'local',
    retailFraction: 0.8,
    eolRegionHint: 'commercial',
    loss: { distributionLossPercent: 1, retailLossPercent: 2, consumerWastePercent: 1 },
  },
  off_trade_retail: {
    label: 'Retail (shops and supermarkets)',
    description: 'Sold through shops, taken home and drunk later.',
    distributionPreset: 'national',
    retailFraction: 0.5,
    eolRegionHint: 'household',
    loss: { distributionLossPercent: 2, retailLossPercent: 3, consumerWastePercent: 5 },
  },
  dtc: {
    label: 'Direct to customer',
    description: 'Shipped from you straight to the person drinking it.',
    distributionPreset: 'national',
    retailFraction: 0,
    eolRegionHint: 'household',
    loss: { distributionLossPercent: 3, retailLossPercent: 0, consumerWastePercent: 5 },
  },
  export: {
    label: 'Export',
    description: 'Shipped overseas, then distributed in the destination market.',
    distributionPreset: 'export_eu',
    retailFraction: 0.5,
    eolRegionHint: 'household',
    loss: { distributionLossPercent: 3, retailLossPercent: 3, consumerWastePercent: 5 },
  },
};

/**
 * Build the config bundle for a fresh scenario on a given channel. Everything
 * here is a starting guess the user corrects, never a claim.
 */
export function presetConfigsFor(
  channel: Exclude<ScenarioChannel, 'custom'>,
  base: { usePhaseConfig?: any; eolConfig?: any; productWeightKg?: number },
): Pick<EndUseScenario, 'distribution_config' | 'use_phase_config' | 'eol_config' | 'product_loss_config'> {
  const preset = CHANNEL_PRESETS[channel];
  const legs = DISTRIBUTION_SCENARIOS[preset.distributionPreset].legs.map((leg, i) => ({
    ...leg,
    id: `${channel}-leg-${i}`,
  }));

  return {
    distribution_config: {
      legs,
      productWeightKg: base.productWeightKg ?? 0,
    },
    // Carry the product's own use-phase facts (does it need chilling, is it
    // carbonated) and vary only what the channel actually changes.
    use_phase_config: base.usePhaseConfig
      ? { ...base.usePhaseConfig, retailFraction: preset.retailFraction }
      : null,
    // EoL region stays the study's; the channel hint informs the ask, not the
    // default, because guessing a waste regime is a bigger claim than guessing
    // a distance.
    eol_config: base.eolConfig ?? null,
    product_loss_config: preset.loss,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recover the shared cradle-to-gate core from a computed PCF.
 *
 * The stored stage totals already carry the primary scenario's loss multiplier
 * (lost units still bear their full upstream burden, ISO 14044), so dividing it
 * back out is what makes the core reusable by a scenario with different losses.
 * Verified exactly against the characterisation fixtures: for a 2/3/5% loss
 * profile the recovered core matches the cradle-to-gate total to the last bit.
 */
export function recoverCore(
  aggregatedImpacts: any,
  totalCarbonFootprint: number,
  primaryLossMultiplier: number,
): number {
  const stages = aggregatedImpacts?.breakdown?.by_lifecycle_stage ?? {};
  const downstream =
    Number(stages.distribution ?? 0) +
    Number(stages.use_phase ?? 0) +
    Number(stages.end_of_life ?? 0);
  const corePostLoss = Number(totalCarbonFootprint ?? 0) - downstream;
  return primaryLossMultiplier > 0 ? corePostLoss / primaryLossMultiplier : corePostLoss;
}

/**
 * Compute one scenario over a shared core.
 *
 * Cheap by construction: the core is already known, and the downstream
 * calculators are local arithmetic over factor tables. Running this for every
 * scenario on every recalculation costs milliseconds, which is what lets a
 * product carry as many channels as it genuinely sells through.
 */
export async function computeScenario(
  scenario: Pick<
    EndUseScenario,
    'distribution_config' | 'use_phase_config' | 'eol_config' | 'product_loss_config'
  >,
  core: number,
  context: {
    boundary: string;
    materials: DownstreamMaterial[];
    volumeLitres: number;
    /** Upstream Scope 3 per unit BEFORE any loss multiplier. Null skips scope3. */
    coreScope3?: number | null;
  },
): Promise<ScenarioStageResults> {
  const detail = await computeDownstreamStages({
    boundary: context.boundary,
    materials: context.materials,
    volumeLitres: context.volumeLitres,
    distributionConfig: scenario.distribution_config ?? undefined,
    usePhaseConfig: scenario.use_phase_config ?? undefined,
    eolConfig: scenario.eol_config ?? undefined,
    productLossConfig: scenario.product_loss_config ?? undefined,
  });

  // Same order of operations as the aggregator: inflate upstream for losses,
  // then add the downstream stages, which are already per-delivered-unit.
  const total =
    core * detail.lossMultiplier +
    detail.distribution.total +
    detail.usePhase.total +
    detail.endOfLife.total;

  // Scope 3 follows the same shape as the total: upstream scaled by losses,
  // then the downstream stages added. Every downstream stage is Scope 3
  // (GHG Protocol categories 4, 9, 11 and 12), so nothing here can land in
  // Scope 1 or 2.
  const downstreamTotal =
    detail.distribution.total + detail.usePhase.total + detail.endOfLife.total;
  const scope3 =
    context.coreScope3 == null
      ? null
      : context.coreScope3 * detail.lossMultiplier + downstreamTotal;

  return {
    total,
    core,
    lossMultiplier: detail.lossMultiplier,
    distribution: detail.distribution.total,
    usePhase: detail.usePhase.total,
    endOfLife: detail.endOfLife.total,
    scope3,
    detail,
  };
}

/**
 * Recompute every scenario attached to a PCF and persist the results.
 * Called at the end of a recalculation: one core, N cheap downstream passes.
 */
export async function recomputeScenariosForPcf(
  supabase: SupabaseClient,
  pcfId: string,
): Promise<{ computed: number; skipped: string | null }> {
  const { data: pcf } = await supabase
    .from('product_carbon_footprints')
    .select('id, product_id, system_boundary, lca_scope_type, aggregated_impacts, total_ghg_emissions, product_loss_config')
    .eq('id', pcfId)
    .maybeSingle();
  if (!pcf) return { computed: 0, skipped: 'pcf not found' };

  const { data: scenarios } = await supabase
    .from('pcf_end_use_scenarios')
    .select('*')
    .eq('pcf_id', pcfId);
  if (!scenarios || scenarios.length === 0) return { computed: 0, skipped: 'no scenarios' };

  const boundary = normaliseBoundary(
    (pcf as any).system_boundary || (pcf as any).lca_scope_type || 'cradle-to-gate',
  );

  const { data: materials } = await supabase
    .from('product_carbon_footprint_materials')
    .select('*')
    .eq('product_carbon_footprint_id', pcfId);

  const { data: product } = await supabase
    .from('products')
    .select('unit_size_value, unit_size_unit')
    .eq('id', (pcf as any).product_id)
    .maybeSingle();

  const volumeLitres = toLitres(product);

  // The core is recovered using the PRIMARY scenario's losses, because those
  // are the ones baked into the stored totals.
  const primary = (scenarios as EndUseScenario[]).find(s => s.is_primary) ?? (scenarios as EndUseScenario[])[0];
  const primaryDetail = await computeDownstreamStages({
    boundary,
    materials: (materials ?? []) as DownstreamMaterial[],
    volumeLitres,
    productLossConfig: primary?.product_loss_config ?? (pcf as any).product_loss_config ?? undefined,
  });
  const impacts = (pcf as any).aggregated_impacts;
  const core = recoverCore(
    impacts,
    Number((pcf as any).total_ghg_emissions ?? 0),
    primaryDetail.lossMultiplier,
  );

  // The same recovery, on the Scope 3 line. The stored figure is the primary
  // scenario's, so its downstream stages come off and its loss multiplier
  // divides out, leaving the upstream Scope 3 every scenario shares.
  const storedScope3 = impacts?.breakdown?.by_scope?.scope3;
  const coreScope3 =
    typeof storedScope3 === 'number'
      ? recoverCore(impacts, storedScope3, primaryDetail.lossMultiplier)
      : null;

  let computed = 0;
  const computedAt = new Date().toISOString();
  for (const scenario of scenarios as EndUseScenario[]) {
    const stageResults = await computeScenario(scenario, core, {
      boundary,
      materials: (materials ?? []) as DownstreamMaterial[],
      volumeLitres,
      coreScope3,
    });
    const { error } = await supabase
      .from('pcf_end_use_scenarios')
      .update({ stage_results: stageResults, computed_at: computedAt })
      .eq('id', scenario.id);
    if (!error) computed++;
  }

  return { computed, skipped: null };
}

function toLitres(product: { unit_size_value?: any; unit_size_unit?: any } | null): number {
  if (!product) return 0;
  const value = Number(product.unit_size_value || 0);
  const unit = String(product.unit_size_unit || 'ml').toLowerCase();
  return unit === 'l' ? value : value / 1000; // default assume ml, as the aggregator does
}

// ─────────────────────────────────────────────────────────────────────────────
// The headline number
// ─────────────────────────────────────────────────────────────────────────────

export interface HeadlineFootprint {
  /** The number to lead with. */
  value: number;
  /** How it was arrived at, so the UI never has to guess what to say. */
  basis: 'weighted' | 'primary' | 'single';
  /** Range across scenarios, shown whenever more than one exists. */
  min: number;
  max: number;
  /** True when shares are known for every scenario and sum to ~100%. */
  sharesComplete: boolean;
}

/**
 * One product, one declared number.
 *
 * With shares known, the volume-weighted mix is the most defensible single
 * figure a multi-channel product has, and it is what corporate Scope 3 should
 * consume. Without them we lead with the primary scenario and say so, rather
 * than silently averaging channels the product may barely sell through, or
 * quietly picking the flattering one.
 */
export function headlineFootprint(scenarios: EndUseScenario[]): HeadlineFootprint | null {
  const computed = scenarios.filter(s => s.stage_results?.total != null);
  if (computed.length === 0) return null;

  const totals = computed.map(s => Number(s.stage_results!.total));
  const min = Math.min(...totals);
  const max = Math.max(...totals);

  if (computed.length === 1) {
    return { value: totals[0], basis: 'single', min, max, sharesComplete: false };
  }

  const shares = computed.map(s => (s.share_pct == null ? null : Number(s.share_pct)));
  const sharesComplete =
    shares.every(v => v != null) &&
    Math.abs((shares as number[]).reduce((a, b) => a + b, 0) - 100) < 0.5;

  if (sharesComplete) {
    const weighted = computed.reduce(
      (sum, s) => sum + Number(s.stage_results!.total) * (Number(s.share_pct) / 100),
      0,
    );
    return { value: weighted, basis: 'weighted', min, max, sharesComplete: true };
  }

  const primary = computed.find(s => s.is_primary) ?? computed[0];
  return {
    value: Number(primary.stage_results!.total),
    basis: 'primary',
    min,
    max,
    sharesComplete: false,
  };
}

/**
 * The Scope 3 figure corporate reporting should consume for a product that
 * sells through several channels.
 *
 * Returns null unless the user has actually told us the mix. That is the whole
 * safety property: a corporate inventory must not silently move because the
 * platform started guessing at a sales split. Until the ask is answered the
 * caller keeps using the stored PCF figure, which is the primary scenario, and
 * nothing anywhere changes.
 */
export function weightedScope3PerUnit(scenarios: EndUseScenario[]): number | null {
  const computed = scenarios.filter((s) => s.stage_results?.scope3 != null);
  if (computed.length < 2) return null;

  const shares = computed.map((s) => (s.share_pct == null ? null : Number(s.share_pct)));
  if (shares.some((v) => v == null)) return null;
  if (Math.abs((shares as number[]).reduce((a, b) => a + b, 0) - 100) >= 0.5) return null;

  return computed.reduce(
    (sum, s) => sum + Number(s.stage_results!.scope3) * (Number(s.share_pct) / 100),
    0,
  );
}

/**
 * Weighted Scope 3 per unit for a whole organisation, keyed by product id.
 *
 * One query rather than one per product: the corporate roll-up runs in the
 * browser on the emissions tab, and this sits in its hot path.
 */
export async function weightedScope3ByProduct(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  const { data } = await supabase
    .from('pcf_end_use_scenarios')
    .select('pcf_id, share_pct, stage_results, is_primary, product_carbon_footprints!inner(product_id, status)')
    .eq('organization_id', organizationId);
  if (!data || data.length === 0) return result;

  const byPcf = new Map<string, any[]>();
  for (const row of data as any[]) {
    // Only the live footprint: a superseded version's routes describe a number
    // nobody is reporting any more.
    if (row.product_carbon_footprints?.status !== 'completed') continue;
    if (!byPcf.has(row.pcf_id)) byPcf.set(row.pcf_id, []);
    byPcf.get(row.pcf_id)!.push(row);
  }

  for (const rows of Array.from(byPcf.values())) {
    const weighted = weightedScope3PerUnit(rows as EndUseScenario[]);
    if (weighted == null) continue;
    const productId = rows[0]?.product_carbon_footprints?.product_id;
    if (productId != null) result.set(String(productId), weighted);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Versioning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carry scenarios onto a new PCF version.
 *
 * One active PCF per product and reference year, supersede never overwrite: a
 * new version would otherwise lose every channel the user has configured, and
 * their confirmations with it. Configs and provenance come across; results do
 * not, because they belong to the superseded core and will be recomputed.
 */
export async function carryScenariosForward(
  supabase: SupabaseClient,
  fromPcfId: string,
  toPcfId: string,
): Promise<number> {
  const { data: existing } = await supabase
    .from('pcf_end_use_scenarios')
    .select('id')
    .eq('pcf_id', toPcfId)
    .limit(1);
  if (existing && existing.length > 0) return 0; // already carried

  const { data: scenarios } = await supabase
    .from('pcf_end_use_scenarios')
    .select('*')
    .eq('pcf_id', fromPcfId);
  if (!scenarios || scenarios.length === 0) return 0;

  const rows = (scenarios as EndUseScenario[]).map(s => ({
    pcf_id: toPcfId,
    organization_id: s.organization_id,
    name: s.name,
    channel: s.channel,
    is_primary: s.is_primary,
    share_pct: s.share_pct,
    distribution_config: s.distribution_config,
    use_phase_config: s.use_phase_config,
    eol_config: s.eol_config,
    product_loss_config: s.product_loss_config,
    provenance: s.provenance,
    stage_results: null,
    computed_at: null,
  }));

  const { error } = await supabase.from('pcf_end_use_scenarios').insert(rows);
  return error ? 0 : rows.length;
}
