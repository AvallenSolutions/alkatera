/**
 * Pulse — Snapshot writer.
 *
 * Computes daily org-level KPIs and upserts them to metric_snapshots.
 *
 * Design notes
 * ============
 * - Phase 1 keeps metric math intentionally simple and source-of-truth-clean:
 *   trailing 365-day sums from canonical tables (calculated_emissions,
 *   facility_activity_entries) plus a cumulative LCA count.
 * - Heavier calc-layer functions in lib/calculations/ require a richer per-org
 *   client context than is practical to invoke server-side from a cron. Future
 *   phases will lift those into pure server-callable helpers and replace the
 *   queries below for fuller parity with the legacy dashboard.
 * - All writes happen through the service role client so RLS does not block.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { METRIC_DEFINITIONS, type MetricKey } from './metric-keys';
import { normaliseToCubicMetres, normaliseToKg } from '@/lib/calculations/utility-factors';
import { calculateCorporateEmissions } from '@/lib/calculations/corporate-emissions';
import { calculateDiversionRate, isCircularTreatment } from '@/lib/calculations/waste-circularity';
import { aggregateImpacts, type PcfRowForAggregator } from '@/lib/vitality/environmental';

export interface SnapshotRow {
  organization_id: string;
  metric_key: MetricKey;
  snapshot_date: string; // YYYY-MM-DD
  value: number;
  unit: string;
  scope?: string | null;
  dimensions?: Record<string, unknown>;
}

/** ISO date string (YYYY-MM-DD), no timezone shift. */
function toDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns a date N days before `date`, as YYYY-MM-DD. */
function daysBefore(date: Date, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - days);
  return toDateString(d);
}

/**
 * Compute one day's snapshots for one organisation.
 *
 * `asOfDate` defines the right edge of trailing-window aggregations.
 * For example, `total_co2e` sums emissions in the 365 days ending at `asOfDate`.
 */
export async function computeOrgSnapshots(
  supabase: SupabaseClient,
  orgId: string,
  asOfDate: Date,
): Promise<SnapshotRow[]> {
  const snapshotDate = toDateString(asOfDate);
  const windowStart = daysBefore(asOfDate, 365);

  const rows: SnapshotRow[] = [];

  // ── 1. total_co2e ────────────────────────────────────────────────────────
  // Full corporate emissions for the calendar year containing `asOfDate`,
  // computed via the single-source-of-truth `calculateCorporateEmissions`
  // (the same function that drives the Company Emissions page hero number
  // at /data/scope-1-2/). This snapshot value matches what the user sees
  // on that page — earlier revisions of this writer only counted utility
  // entries, which under-reported orgs whose footprint sits in Scope 3,
  // fleet, refrigerants, or Xero-derived spend.
  //
  // Semantic note: the snapshot is now "year-to-date corporate emissions
  // for the year of asOfDate" rather than "trailing 365 days". All
  // downstream readers (Rosa Progress Tracker, board pack, ISSB, CSRD,
  // carbon budgets, scenario sensitivity) want this number to track the
  // headline footprint, so the change benefits every consumer.
  let totalCo2eKg = 0;
  try {
    const result = await calculateCorporateEmissions(
      supabase,
      orgId,
      asOfDate.getUTCFullYear(),
    );
    totalCo2eKg = result.breakdown.total;
  } catch (err) {
    console.error(`[Pulse snapshots] calculateCorporateEmissions failed for org ${orgId}:`, err);
  }

  rows.push({
    organization_id: orgId,
    metric_key: 'total_co2e',
    snapshot_date: snapshotDate,
    value: round(totalCo2eKg, 3),
    unit: METRIC_DEFINITIONS.total_co2e.unit,
  });

  // ── 2. water_consumption ────────────────────────────────────────────────
  // Trailing-365-day operational water intake, summed across
  // facility_activity_entries where activity_category = 'water_intake'.
  // The table exposes organization_id directly so no facilities join is
  // needed. Quantities are normalised to m³ via shared helpers.
  const { data: waterRows, error: waterErr } = await supabase
    .from('facility_activity_entries')
    .select('quantity, unit, reporting_period_start')
    .eq('organization_id', orgId)
    .eq('activity_category', 'water_intake')
    .gte('reporting_period_start', windowStart)
    .lte('reporting_period_start', snapshotDate);

  if (waterErr) {
    console.error(`[Pulse snapshots] water query failed for org ${orgId}:`, waterErr.message);
  }

  const totalWater = (waterRows ?? []).reduce(
    (sum: number, row: any) => sum + normaliseToCubicMetres(Number(row.quantity) || 0, row.unit as string),
    0,
  );
  rows.push({
    organization_id: orgId,
    metric_key: 'water_consumption',
    snapshot_date: snapshotDate,
    value: round(totalWater, 3),
    unit: METRIC_DEFINITIONS.water_consumption.unit,
  });

  // ── 3. products_assessed ────────────────────────────────────────────────
  // Count of DISTINCT products that have at least one completed LCA as-of
  // `snapshotDate`. Products can have multiple completed PCF rows (the
  // product_carbon_footprints table is versioned via parent_lca_id +
  // lca_version), so counting rows would overstate coverage — and can push
  // the denominator-based lca_completeness_pct above 100% when a product
  // has more completed versions than there are unassessed products.
  //
  // We pull the product_ids and dedupe in memory. PostgREST has no native
  // COUNT DISTINCT, and a raw RPC feels heavy for a few hundred rows.
  const { data: completedPcfs } = await supabase
    .from('product_carbon_footprints')
    .select('product_id')
    .eq('organization_id', orgId)
    .eq('status', 'completed')
    .lte('updated_at', `${snapshotDate}T23:59:59Z`);

  const assessedProductIds = new Set<string>();
  for (const p of completedPcfs ?? []) {
    const id = (p as any).product_id as string | null;
    if (id) assessedProductIds.add(id);
  }
  const completedCount = assessedProductIds.size;

  rows.push({
    organization_id: orgId,
    metric_key: 'products_assessed',
    snapshot_date: snapshotDate,
    value: completedCount,
    unit: METRIC_DEFINITIONS.products_assessed.unit,
  });

  // ── 4. lca_completeness_pct ─────────────────────────────────────────────
  // Distinct assessed products ÷ total products that existed as-of
  // `snapshotDate` × 100. Clamped at 100 as a belt-and-braces guard in
  // case an assessed product has since been soft-deleted from `products`
  // but its PCF row remains (rare, but possible during data migrations).
  const productsQuery = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .lte('created_at', `${snapshotDate}T23:59:59Z`);

  const totalProducts = productsQuery.count ?? 0;
  const rawPct = totalProducts > 0 ? (completedCount / totalProducts) * 100 : 0;
  const completenessPct = Math.min(100, rawPct);
  rows.push({
    organization_id: orgId,
    metric_key: 'lca_completeness_pct',
    snapshot_date: snapshotDate,
    value: round(completenessPct, 1),
    unit: METRIC_DEFINITIONS.lca_completeness_pct.unit,
  });

  // ── 5. waste_diversion_rate ─────────────────────────────────────────────
  // Trailing-365-day share of waste kept out of disposal: circular (reuse,
  // recycling, composting, AD) mass ÷ total waste mass × 100. Classification
  // reuses the EU waste-hierarchy logic in lib/calculations/waste-circularity.
  // A row is only written when there is waste data — an org with no waste
  // entries should read as "no data", not a misleading 0% diverted.
  const { data: wasteRows, error: wasteErr } = await supabase
    .from('facility_activity_entries')
    .select('quantity, unit, waste_treatment_method')
    .eq('organization_id', orgId)
    .in('activity_category', ['waste_general', 'waste_hazardous', 'waste_recycling'])
    .gte('reporting_period_start', windowStart)
    .lte('reporting_period_start', snapshotDate);

  if (wasteErr) {
    console.error(`[Pulse snapshots] waste query failed for org ${orgId}:`, wasteErr.message);
  }

  let circularWasteKg = 0;
  let totalWasteKg = 0;
  for (const row of wasteRows ?? []) {
    const kg = normaliseToKg(Number((row as any).quantity) || 0, (row as any).unit as string);
    totalWasteKg += kg;
    if (isCircularTreatment(((row as any).waste_treatment_method as string) || 'other')) {
      circularWasteKg += kg;
    }
  }
  if (totalWasteKg > 0) {
    rows.push({
      organization_id: orgId,
      metric_key: 'waste_diversion_rate',
      snapshot_date: snapshotDate,
      value: round(calculateDiversionRate(circularWasteKg, totalWasteKg), 1),
      unit: METRIC_DEFINITIONS.waste_diversion_rate.unit,
    });
  }

  // ── 6. land_use ─────────────────────────────────────────────────────────
  // Org-level embedded land use (m²·yr) across products with a completed LCA.
  // aggregated_impacts.land_use is per functional unit, so it's scaled by the
  // product's annual_production_volume (a single, server-friendly volume
  // source; the richer multi-source resolution in useCompanyMetrics isn't
  // needed for a trajectory, which cares about consistent change over time).
  // aggregateImpacts treats a missing/zero volume as 1 unit. Skipped when
  // there is no completed-LCA land-use data.
  const { data: landPcfs, error: landErr } = await supabase
    .from('product_carbon_footprints')
    .select('id, product_id, status, aggregated_impacts')
    .eq('organization_id', orgId)
    .eq('status', 'completed');

  if (landErr) {
    console.error(`[Pulse snapshots] land-use query failed for org ${orgId}:`, landErr.message);
  }

  const landProductIds = Array.from(
    new Set((landPcfs ?? []).map((r: any) => r.product_id).filter(Boolean) as string[]),
  );
  const volumeByProduct = new Map<string, number>();
  if (landProductIds.length > 0) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, annual_production_volume')
      .in('id', landProductIds);
    for (const p of prods ?? []) {
      volumeByProduct.set((p as any).id, Number((p as any).annual_production_volume) || 0);
    }
  }

  const landRows: PcfRowForAggregator[] = (landPcfs ?? []).map((r: any) => ({
    id: r.id,
    product_id: r.product_id,
    status: r.status,
    aggregated_impacts: r.aggregated_impacts,
    production_volume: r.product_id ? volumeByProduct.get(r.product_id) ?? null : null,
  }));

  const landUseM2a = aggregateImpacts(landRows).land_use;
  if (landUseM2a > 0) {
    rows.push({
      organization_id: orgId,
      metric_key: 'land_use',
      snapshot_date: snapshotDate,
      value: round(landUseM2a, 1),
      unit: METRIC_DEFINITIONS.land_use.unit,
    });
  }

  return rows;
}

/**
 * Upsert snapshot rows. The unique key is (organization_id, metric_key,
 * snapshot_date) — same-day reruns are idempotent.
 */
export async function writeSnapshots(
  supabase: SupabaseClient,
  rows: SnapshotRow[],
): Promise<{ written: number; error: string | null }> {
  if (rows.length === 0) return { written: 0, error: null };

  const { error } = await supabase
    .from('metric_snapshots')
    .upsert(rows, { onConflict: 'organization_id,metric_key,snapshot_date' });

  if (error) {
    return { written: 0, error: error.message };
  }
  return { written: rows.length, error: null };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
