/**
 * Impact prioritisation for the Ask Queue (tasks/data-revolution-plan.md,
 * Pillar 3, "Impact prioritisation"): "ten minutes of answers always buys
 * maximum accuracy."
 *
 * Two computable shares (pure, unit-tested) plus a fallback-tier system for
 * everything else, mirroring `lib/provenance/rollup.ts`'s
 * gather-then-score split: the *Share functions are pure math, the gather
 * helpers below do the one round trip each needs.
 */

import type { AskType } from './types';

/**
 * A product's material breakdown, as stored on the latest calculated PCF's
 * `aggregated_impacts.by_material` (product-lca-aggregator.ts). Keyed by
 * name, not material id — product_materials rows don't persist their own
 * impact, so name-matching is the best available link between an ask's
 * target row and a computed share.
 */
export interface MaterialImpactContext {
  byMaterial: Array<{ name: string; climate: number }>;
  /** Sum of all by_material climate values (or total_ghg_emissions) — the denominator. */
  totalClimateKg: number;
}

/**
 * Share of a product's footprint one named material represents, matched
 * case-insensitively against the PCF's by_material breakdown. Returns null
 * when there's no completed/estimated PCF to compare against, the total is
 * zero or negative, or the name matches nothing — all "not computable",
 * never a false zero.
 */
export function materialImpactShare(materialName: string, ctx: MaterialImpactContext | null): number | null {
  if (!ctx || ctx.totalClimateKg <= 0) return null;
  const needle = (materialName || '').trim().toLowerCase();
  if (!needle) return null;
  const matched = ctx.byMaterial.filter((m) => (m.name || '').trim().toLowerCase() === needle);
  if (matched.length === 0) return null;
  const sum = matched.reduce((acc, m) => acc + Math.max(0, m.climate), 0);
  if (sum <= 0) return null;
  return Math.min(1, sum / ctx.totalClimateKg);
}

/**
 * Share of the org's trailing-12-month emissions one activity entry
 * represents. Returns null when either figure is missing/non-positive —
 * an entry with no calculated_emissions_kg_co2e (utility_data_entries has
 * no stored per-row co2e; the figure is derived at report time) simply
 * isn't computable in v1, not zero.
 */
export function activityImpactShare(entryEmissionsKg: number | null, orgTotalEmissionsKg: number | null): number | null {
  if (entryEmissionsKg == null || orgTotalEmissionsKg == null) return null;
  if (!(entryEmissionsKg > 0) || !(orgTotalEmissionsKg > 0)) return null;
  return Math.min(1, entryEmissionsKg / orgTotalEmissionsKg);
}

/**
 * Fallback ordering tier per ask_type when no real share is computable —
 * lower number sorts first (more urgent). Plausibility flags are gross
 * data-entry errors that can distort a whole calculation, so they rank
 * above draft gaps; growth-band gaps are navigational setup nudges, not
 * data-accuracy fixes, so they rank last.
 */
export const FALLBACK_IMPACT_TIER: Record<AskType, number> = {
  plausibility_production_run: 1,
  plausibility_packaging_weight: 1,
  // How far the footprint follows the product decides whether whole stages are
  // counted at all, so an assumed boundary can be wrong by more than any single
  // figure inside it. It ranks with the plausibility flags for that reason.
  dossier_boundary: 1,
  draft_gap_material: 2,
  dossier_gap_distribution: 2,
  // The sales split changes which number the product leads with, but every
  // route is already computed and shown, so nothing is missing without it.
  // It ranks below the gaps where a figure is genuinely absent.
  dossier_sales_split: 3,
  draft_gap_utility: 3,
  draft_gap_hospitality_quantities: 4,
  growth_signal: 5,
};

/**
 * The single number the queue orders by. Computable shares (0..1) always
 * outrank fallback-tier asks (mapped to a small negative band so they never
 * collide with a real share) — within the fallback band, a lower tier
 * (more urgent ask_type) sorts closer to zero, i.e. still ahead of a less
 * urgent fallback ask. Pure and total.
 */
export function priorityScore(askType: AskType, impactShare: number | null): number {
  if (impactShare != null) return impactShare;
  const tier = FALLBACK_IMPACT_TIER[askType] ?? 9;
  // Tiers 1..9 map to -0.01..-0.09 — always below any real 0..1 share,
  // and ordered correctly amongst themselves (tier 1 = -0.01, closest to 0).
  return -(tier / 100);
}

/** Sort candidates highest priority_score first — the queue's default order. */
export function sortByPriority<T extends { payload: { priority_score: number } }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.payload.priority_score - a.payload.priority_score);
}

// ---------------------------------------------------------------------------
// Gather helpers — one round trip each, org-scoped.
// ---------------------------------------------------------------------------

/**
 * Builds a productId -> MaterialImpactContext map from each product's most
 * recent PCF that has aggregated_impacts (status 'completed' or 'estimate',
 * preferring 'completed'). Products with no calculable PCF simply have no
 * entry, so materialImpactShare degrades to null for their materials.
 */
export async function gatherMaterialImpactContexts(
  db: any,
  organizationId: string,
): Promise<Map<string, MaterialImpactContext>> {
  const { data, error } = await db
    .from('product_carbon_footprints')
    .select('product_id, status, total_ghg_emissions, aggregated_impacts, updated_at')
    .eq('organization_id', organizationId)
    .in('status', ['completed', 'estimate'])
    .not('product_id', 'is', null)
    .order('updated_at', { ascending: false });

  const out = new Map<string, MaterialImpactContext>();
  if (error || !data) return out;

  for (const row of data as any[]) {
    const productId = String(row.product_id);
    // First row wins per product (most recent, and 'completed' rows exist
    // independently of 'estimate' ones so a later 'estimate' can't clobber
    // an already-seen 'completed' since we never revisit a product id).
    if (out.has(productId)) continue;
    const byMaterialRaw = row.aggregated_impacts?.by_material;
    const byMaterial: Array<{ name: string; climate: number }> = Array.isArray(byMaterialRaw)
      ? byMaterialRaw.map((m: any) => ({ name: String(m.name || ''), climate: Number(m.climate || 0) }))
      : [];
    const totalFromMaterials = byMaterial.reduce((acc, m) => acc + Math.max(0, m.climate), 0);
    const totalClimateKg = totalFromMaterials > 0 ? totalFromMaterials : Number(row.total_ghg_emissions || 0);
    if (byMaterial.length === 0 || totalClimateKg <= 0) continue;
    out.set(productId, { byMaterial, totalClimateKg });
  }
  return out;
}

/** Latest `total_co2e` metric_snapshots value (trailing 12m scope 1+2), or null before the first Pulse cron run. */
export async function gatherOrgTotalEmissionsKg(db: any, organizationId: string): Promise<number | null> {
  const { data, error } = await db
    .from('metric_snapshots')
    .select('value')
    .eq('organization_id', organizationId)
    .eq('metric_key', 'total_co2e')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const value = Number((data as any).value);
  return Number.isFinite(value) && value > 0 ? value : null;
}
