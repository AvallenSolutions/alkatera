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
import {
  UTILITY_EMISSION_FACTORS,
  normaliseEnergyToKwh,
  normaliseToCubicMetres,
} from '@/lib/calculations/utility-factors';
import {
  countryToLiveRegion,
  getCountryAverageGridCarbon,
} from '@/lib/calculations/grid-carbon-fallback';

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
  // Trailing-365-day sum from utility_data_entries (Scope 1 combustion +
  // Scope 2 grid electricity), mirroring exactly how /api/pulse/facility-impact
  // rolls up the monthly chart. Keeping these two paths aligned means the
  // headline KPI and the drill-down can never disagree.
  //
  // For electricity we use the facility's country-average grid factor (live
  // grid intensity is only meaningful at monthly granularity, not across a
  // 365-day window). For combustion we use the DEFRA 2024 factors in
  // lib/calculations/utility-factors.ts.
  //
  // The table exposes organization_id indirectly via facilities; we resolve
  // it with an explicit facility→country lookup instead of a PostgREST embed
  // so we avoid the ambiguous-join pitfall we hit in an earlier revision.
  const { data: facilities } = await supabase
    .from('facilities')
    .select('id, location_country_code, address_country')
    .eq('organization_id', orgId);

  const facilityIds = (facilities ?? []).map((f: any) => f.id as string);
  const facilityCountry = new Map<string, string | null>();
  for (const f of facilities ?? []) {
    facilityCountry.set(
      (f as any).id as string,
      ((f as any).location_country_code ?? (f as any).address_country ?? null) as string | null,
    );
  }

  let totalCo2eKg = 0;
  if (facilityIds.length > 0) {
    const { data: utilityRows, error: utilityErr } = await supabase
      .from('utility_data_entries')
      .select('facility_id, utility_type, quantity, unit, reporting_period_start')
      .in('facility_id', facilityIds)
      .gte('reporting_period_start', windowStart)
      .lte('reporting_period_start', snapshotDate);

    if (utilityErr) {
      console.error(`[Pulse snapshots] utility query failed for org ${orgId}:`, utilityErr.message);
    }

    for (const u of (utilityRows ?? []) as Array<{
      facility_id: string;
      utility_type: string;
      quantity: number;
      unit: string;
    }>) {
      const quantity = Number(u.quantity) || 0;
      if (u.utility_type === 'electricity_grid') {
        const kwh = normaliseEnergyToKwh(quantity, u.unit);
        const country = facilityCountry.get(u.facility_id) ?? null;
        const factor = getCountryAverageGridCarbon(country).intensity; // g CO2e / kWh
        totalCo2eKg += (kwh * factor) / 1000; // g → kg
      } else {
        const meta = UTILITY_EMISSION_FACTORS[u.utility_type];
        if (!meta) continue; // unknown utility types contribute 0
        totalCo2eKg += quantity * meta.factor; // already kg CO2e/native-unit
      }
    }
  }
  // countryToLiveRegion is currently unused here (the annual KPI doesn't
  // need live-grid seasonality) but we import it from the same module so
  // this file stays aligned with the monthly widget's call surface.
  void countryToLiveRegion;

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
