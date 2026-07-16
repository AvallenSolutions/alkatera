/**
 * The confirmed-share rollup: "62% of your footprint is confirmed."
 *
 * A per-org number the forest, report gating and the Ask Queue prioritiser
 * will all read from later phases. v1 keeps this honest and cheap: three
 * areas (products, utilities, packaging), each a plain confirmed/total
 * ratio built from existing status/quality fields via the `lib/provenance`
 * mappers, weighted by a rough share of a typical drinks-industry
 * footprint. No new tables, no per-row provenance column — everything
 * here reads fields that already exist.
 *
 * Follows the head-count query style of `lib/desk/growth-score.ts`
 * (`gatherGrowthIngredients`): `gatherProvenanceIngredients` runs one
 * `Promise.all` of cheap counts, `computeConfirmedShare` (the pure part)
 * turns them into a score, and a failed query degrades an area to 0
 * confirmed rather than failing the whole rollup.
 */

export interface ProvenanceRollupIngredients {
  /** Total products in the org. */
  productsTotal: number;
  /**
   * Products with a completed PCF. Counted as distinct `product_id`s on
   * `product_carbon_footprints` rows with `status = 'completed'`
   * (`provenanceFromPcfStatus('completed') === 'confirmed'`). The
   * aggregator's supersede step (`product-lca-aggregator.ts`) marks a
   * product's previous completed row 'superseded' the moment a new one
   * completes, so at most one 'completed' row should exist per product;
   * if that supersede step ever fails non-fatally (logged, not thrown)
   * a product could double-count here. Rare and self-correcting on the
   * next recalculation, not worth a second query to guard against in v1.
   */
  productsConfirmed: number;
  /** facility_activity_entries in the trailing 12 months, org-scoped. */
  utilitiesTotal: number;
  /**
   * Of those, entries whose `data_provenance` maps to confirmed
   * (`'primary_supplier_verified'` or `'primary_measured_onsite'`).
   * `utility_data_entries` rows (`data_quality = 'actual'`) in the same
   * window, facility-scoped since that table has no `organization_id`
   * column, are folded into the same total/confirmed pair — the plan
   * names both tables as the utilities source and a user reading "confirmed
   * utilities" shouldn't need to know which table a bill landed in.
   */
  utilitiesConfirmed: number;
  /** product_materials rows with material_type = 'packaging', across the org's products. */
  packagingTotal: number;
  /**
   * Of those, rows with a user-accepted factor: `matched_source_name` set
   * and `ef_source_type` not `'proxy'` (a Rosa/wizard proxy is explicitly
   * a substitute, never confirmed — see `provenanceFromEfSourceType`).
   * This is a coarser test than the full mapper (it doesn't distinguish
   * "confirmed" from "drafted" the way `provenanceFromEfSourceType` does,
   * since that needs to know whether a human accepted the match, which
   * isn't stored per-row); v1 treats "has a real, non-proxy factor" as
   * confirmed enough for the rollup.
   */
  packagingConfirmed: number;
}

export type ProvenanceArea = 'products' | 'utilities' | 'packaging';

export interface ProvenanceRollup {
  /** 0-100, the three areas' confirmed shares weighted by PROVENANCE_AREA_WEIGHTS. */
  confirmedPct: number;
  /** 0-100 per area, unweighted — "how confirmed is just my utilities data." */
  byArea: Record<ProvenanceArea, number>;
}

/**
 * Rough footprint share per area for a typical drinks-industry org, used
 * to weight the rollup. Products (ingredients + process) dominate a
 * drinks LCA, packaging is real but smaller, utilities (Scope 1/2) sit
 * in between. Documented constants rather than a computed weighting
 * because no per-org impact split is cheap to compute for v1 — later
 * phases could replace these with the org's actual aggregated-impact
 * split once `computeConfirmedShare` has real callers to keep in sync.
 */
export const PROVENANCE_AREA_WEIGHTS: Record<ProvenanceArea, number> = {
  products: 50,
  utilities: 35,
  packaging: 15,
};

/** confirmed/total clamped to 0..1; an area with no records at all reads as 0% confirmed, not "not applicable". */
function share(confirmed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, confirmed) / total);
}

/**
 * Pure scorer: ingredients in, rollup out. An org with nothing in a given
 * area (e.g. a hospitality-only org with no packaged products) scores that
 * area at 0%, which drags down `confirmedPct` by up to that area's weight
 * even though the area may not really apply to them — a known v1
 * simplification called out here for whoever revisits this in Phase D.
 */
export function confirmedShareFromIngredients(i: ProvenanceRollupIngredients): ProvenanceRollup {
  const products = share(i.productsConfirmed, i.productsTotal);
  const utilities = share(i.utilitiesConfirmed, i.utilitiesTotal);
  const packaging = share(i.packagingConfirmed, i.packagingTotal);

  const weights = PROVENANCE_AREA_WEIGHTS;
  const totalWeight = weights.products + weights.utilities + weights.packaging;
  const weightedSum = products * weights.products + utilities * weights.utilities + packaging * weights.packaging;

  return {
    confirmedPct: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0,
    byArea: {
      products: Math.round(products * 100),
      utilities: Math.round(utilities * 100),
      packaging: Math.round(packaging * 100),
    },
  };
}

/** data_provenance_enum values that provenanceFromDataQuality maps to 'confirmed'. */
const CONFIRMED_DATA_PROVENANCE = ['primary_supplier_verified', 'primary_measured_onsite'] as const;

/** ISO date a year ago, for the trailing utilities window (matches growth-score.ts). */
function yearAgoISO(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Gather the ingredients: two id lists (products, facilities — needed to
 * scope `product_materials` and `utility_data_entries`, neither of which
 * carries `organization_id` directly) plus a handful of counts, all
 * org-scoped. Any failed query degrades that count to 0 rather than
 * failing the whole rollup.
 */
export async function gatherProvenanceIngredients(
  db: any,
  organizationId: string,
): Promise<ProvenanceRollupIngredients> {
  const count = async (table: string, refine?: (q: any) => any): Promise<number> => {
    let q = db.from(table).select('id', { count: 'exact', head: true });
    if (refine) q = refine(q);
    const { count: n, error } = await q;
    return error ? 0 : (n ?? 0);
  };

  const ids = async (table: string): Promise<string[]> => {
    const { data, error } = await db.from(table).select('id').eq('organization_id', organizationId);
    if (error || !data) return [];
    return (data as Array<{ id: string | number }>).map((r) => String(r.id));
  };

  const since = yearAgoISO();

  const [productIds, facilityIds, productsConfirmed, utilitiesActivityTotal, utilitiesActivityConfirmed] =
    await Promise.all([
      ids('products'),
      ids('facilities'),
      count('product_carbon_footprints', (q) =>
        q.eq('organization_id', organizationId).eq('status', 'completed').not('product_id', 'is', null),
      ),
      count('facility_activity_entries', (q) =>
        q.eq('organization_id', organizationId).gte('reporting_period_start', since),
      ),
      count('facility_activity_entries', (q) =>
        q
          .eq('organization_id', organizationId)
          .gte('reporting_period_start', since)
          .in('data_provenance', CONFIRMED_DATA_PROVENANCE as unknown as string[]),
      ),
    ]);

  const [utilityBillTotal, utilityBillConfirmed] =
    facilityIds.length > 0
      ? await Promise.all([
          count('utility_data_entries', (q) => q.in('facility_id', facilityIds).gte('reporting_period_start', since)),
          count('utility_data_entries', (q) =>
            q.in('facility_id', facilityIds).gte('reporting_period_start', since).eq('data_quality', 'actual'),
          ),
        ])
      : [0, 0];

  const [packagingTotal, packagingConfirmed] =
    productIds.length > 0
      ? await Promise.all([
          count('product_materials', (q) => q.in('product_id', productIds).eq('material_type', 'packaging')),
          count('product_materials', (q) =>
            q
              .in('product_id', productIds)
              .eq('material_type', 'packaging')
              .not('matched_source_name', 'is', null)
              .neq('ef_source_type', 'proxy'),
          ),
        ])
      : [0, 0];

  return {
    productsTotal: productIds.length,
    productsConfirmed,
    utilitiesTotal: utilitiesActivityTotal + utilityBillTotal,
    utilitiesConfirmed: utilitiesActivityConfirmed + utilityBillConfirmed,
    packagingTotal,
    packagingConfirmed,
  };
}

/**
 * Convenience wrapper: gather ingredients for an org, then score them.
 * This is the `computeConfirmedShare(db, organizationId)` entry point
 * other modules should call; `confirmedShareFromIngredients` above is the
 * pure, unit-tested half.
 */
export async function computeConfirmedShare(db: any, organizationId: string): Promise<ProvenanceRollup> {
  const ingredients = await gatherProvenanceIngredients(db, organizationId);
  return confirmedShareFromIngredients(ingredients);
}
