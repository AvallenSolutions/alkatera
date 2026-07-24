/**
 * Phase 1 of the internal-benchmarks plan: capture the right metric.
 *
 * `metric_snapshots` holds absolutes and completeness — total_co2e,
 * products_assessed, lca_completeness_pct. None of them is a benchmark. What a
 * benchmark needs is a per-litre intensity keyed by category, system boundary
 * and pack format, and that is derivable from the completed PCFs we already
 * store, which makes it the cheapest of the three gaps to close.
 *
 * This module turns one completed PCF into one snapshot row, and states out
 * loud why it refused when it refuses. A silent skip in a cohort builder is
 * how a benchmark quietly becomes a benchmark of something else.
 *
 * No user-visible change ships from this file. It fills the table; the ladder
 * in `./ladder.ts` decides whether anything is scored against it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normaliseBoundary,
  type SystemBoundary,
} from '@/lib/system-boundaries';
import { getGroupForCategory } from '@/lib/industry-benchmarks';
import { unitSizeToLitres } from '@/lib/vitality/environmental';
import { isHospitalityKind } from '@/lib/hospitality/constants';
import { packFormatToken, type PackFormatMaterialRow } from './pack-format';

/** The only metric this table carries today. Kept as a constant, not a literal. */
export const INTENSITY_METRIC_KEY = 'co2e_per_litre';
export const INTENSITY_UNIT = 'kg CO2e/L';

/**
 * Plausibility band for a drinks per-litre footprint, in kg CO2e per litre.
 *
 * Real products run from about 0.1 (bottled water in PET) to about 5 (aged
 * spirits in heavy glass). Anything outside this band is a unit error or a
 * broken calculation, and a single one of them drags a p50 in a cohort of
 * eight. It is excluded and reported, never silently clamped.
 */
const MIN_PLAUSIBLE_KG_PER_L = 0.01;
const MAX_PLAUSIBLE_KG_PER_L = 100;

export interface ProductIntensitySnapshotRow {
  organization_id: string;
  product_id: number;
  pcf_id: string;
  metric_key: string;
  snapshot_date: string;
  value: number;
  unit: string;
  category_group: string | null;
  product_category: string | null;
  system_boundary: SystemBoundary;
  pack_format: string | null;
  dimensions: Record<string, unknown>;
}

/** Why a completed PCF did not produce a cohort row. */
export type IntensitySkipReason =
  | 'not_completed'
  | 'no_product'
  | 'hospitality'
  | 'multipack'
  | 'no_footprint'
  | 'no_volume'
  | 'unrecognised_boundary'
  | 'implausible_value';

export interface IntensityOutcome {
  row: ProductIntensitySnapshotRow | null;
  skipped: IntensitySkipReason | null;
}

/** The PCF fields this module reads. */
export interface PcfForIntensity {
  id: string;
  organization_id: string;
  product_id: number | string | null;
  status: string | null;
  system_boundary: string | null;
  lca_scope_type: string | null;
  boundary_source?: string | null;
  reference_year?: number | null;
  aggregated_impacts: { climate_change_gwp100?: number | string | null } | null;
}

/** The product fields this module reads. */
export interface ProductForIntensity {
  id: number | string;
  product_category: string | null;
  product_kind: string | null;
  unit_size_value: number | string | null;
  unit_size_unit: string | null;
  is_multipack: boolean | null;
}

/**
 * A boundary we can stand behind, or null.
 *
 * `normaliseBoundary` exists to stop unrecognised values silently degrading a
 * wider study to cradle-to-gate behaviour, and it does that by falling back.
 * A fallback is exactly wrong here: writing an assumed 'cradle-to-gate' onto a
 * row whose boundary we could not read would put a cradle-to-grave figure into
 * a cradle-to-gate cohort, which is the precise failure this whole benchmark
 * exists to avoid. Asking twice with different fallbacks tells the two apart
 * without duplicating the vocabulary.
 */
export function strictBoundary(raw: string | null | undefined): SystemBoundary | null {
  const a = normaliseBoundary(raw, 'cradle-to-gate');
  const b = normaliseBoundary(raw, 'cradle-to-grave');
  return a === b ? a : null;
}

/**
 * Litres of liquid behind one functional unit.
 *
 * Read from the product's declared unit size rather than the PCF's
 * `bulk_volume_per_functional_unit`, which is written by a branch that treats
 * centilitres as litres — a 70 cl bottle stored as 70 litres would land a gin
 * at 0.05 kg/l and sit in the cohort looking like the best product on the
 * platform. `unitSizeToLitres` handles ml, cl and l properly and is already
 * the shared converter.
 */
function litresPerUnit(product: ProductForIntensity): number | null {
  const litres = unitSizeToLitres(
    typeof product.unit_size_value === 'string'
      ? parseFloat(product.unit_size_value)
      : product.unit_size_value,
    product.unit_size_unit,
  );
  return litres !== null && litres > 0 ? litres : null;
}

/** ISO date (YYYY-MM-DD) in UTC, matching the Pulse snapshot writer. */
export function toDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * One completed PCF → one cohort row, or a stated reason why not.
 *
 * Pure: the caller supplies the PCF, its product and the product's packaging
 * rows, so this is testable without a database and reusable by both the
 * on-completion write and the daily sweep.
 */
export function buildIntensitySnapshot(
  pcf: PcfForIntensity,
  product: ProductForIntensity | null,
  packagingRows: PackFormatMaterialRow[],
  asOfDate: Date,
): IntensityOutcome {
  const skip = (reason: IntensitySkipReason): IntensityOutcome => ({ row: null, skipped: reason });

  if (pcf.status !== 'completed') return skip('not_completed');
  if (!product || pcf.product_id === null || pcf.product_id === undefined) return skip('no_product');

  // Meals, drinks and rooms are PCF rows but are not drinks products; they
  // have no per-litre meaning and would distort every category they touched.
  if (isHospitalityKind(product.product_kind)) return skip('hospitality');

  // A multipack's per-litre figure is real, but its container is a case, not a
  // bottle. Putting a six-pack in the `glass-bottle` bucket adds transit
  // packaging to one side of the comparison only, so the cohort is single
  // sellable units and the exclusion is deliberate.
  if (product.is_multipack) return skip('multipack');

  const perUnitRaw = pcf.aggregated_impacts?.climate_change_gwp100;
  const perUnit = typeof perUnitRaw === 'string' ? parseFloat(perUnitRaw) : perUnitRaw;
  if (perUnit === null || perUnit === undefined || !Number.isFinite(perUnit) || perUnit <= 0) {
    return skip('no_footprint');
  }

  const litres = litresPerUnit(product);
  if (litres === null) return skip('no_volume');

  const boundary = strictBoundary(pcf.system_boundary ?? pcf.lca_scope_type);
  if (!boundary) return skip('unrecognised_boundary');

  const value = perUnit / litres;
  if (value < MIN_PLAUSIBLE_KG_PER_L || value > MAX_PLAUSIBLE_KG_PER_L) {
    return skip('implausible_value');
  }

  return {
    row: {
      organization_id: pcf.organization_id,
      product_id: Number(pcf.product_id),
      pcf_id: pcf.id,
      metric_key: INTENSITY_METRIC_KEY,
      snapshot_date: toDateString(asOfDate),
      value: Math.round(value * 1e6) / 1e6,
      unit: INTENSITY_UNIT,
      category_group: getGroupForCategory(product.product_category),
      product_category: product.product_category,
      system_boundary: boundary,
      pack_format: packFormatToken(packagingRows),
      dimensions: {
        fill_volume_l: litres,
        reference_year: pcf.reference_year ?? null,
        // A boundary the platform proposed is not a boundary somebody chose.
        // It does not change the bucket, but it belongs on the row: if step 5
        // finds a bucket diverging from the literature, the first question is
        // how much of it rests on assumed boundaries.
        boundary_source: pcf.boundary_source ?? null,
      },
    },
    skipped: null,
  };
}

export interface IntensitySweepResult {
  written: number;
  skipped: Record<string, number>;
  error: string | null;
}

const EMPTY_SKIPS = (): Record<string, number> => ({});

function countSkip(skips: Record<string, number>, reason: IntensitySkipReason): void {
  skips[reason] = (skips[reason] ?? 0) + 1;
}

/**
 * Build and write intensity rows for every active completed PCF in one
 * organisation. Used by the daily sweep and by the backfill; both want exactly
 * this, and running it daily is what keeps the view's 365-day window from
 * emptying under products nobody happens to recalculate.
 */
export async function snapshotOrgProductIntensity(
  supabase: SupabaseClient,
  orgId: string,
  asOfDate: Date,
): Promise<IntensitySweepResult> {
  const skips = EMPTY_SKIPS();

  const { data: pcfs, error: pcfError } = await supabase
    .from('product_carbon_footprints')
    .select(
      'id, organization_id, product_id, status, system_boundary, lca_scope_type, boundary_source, reference_year, aggregated_impacts',
    )
    .eq('organization_id', orgId)
    .eq('status', 'completed');

  if (pcfError) return { written: 0, skipped: skips, error: pcfError.message };
  if (!pcfs || pcfs.length === 0) return { written: 0, skipped: skips, error: null };

  const productIds = Array.from(
    new Set(
      (pcfs as PcfForIntensity[])
        .map((p) => p.product_id)
        .filter((id): id is number | string => id !== null && id !== undefined),
    ),
  );
  if (productIds.length === 0) return { written: 0, skipped: skips, error: null };

  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id, product_category, product_kind, unit_size_value, unit_size_unit, is_multipack')
    .in('id', productIds);
  if (productError) return { written: 0, skipped: skips, error: productError.message };

  const productById = new Map<string, ProductForIntensity>();
  for (const p of (products ?? []) as ProductForIntensity[]) {
    productById.set(String(p.id), p);
  }

  const { data: materials, error: materialError } = await supabase
    .from('product_materials')
    .select(
      'product_id, material_name, material_type, packaging_category, packaging_material_class, container_format, container_material, net_weight_g',
    )
    .in('product_id', productIds);
  if (materialError) return { written: 0, skipped: skips, error: materialError.message };

  const materialsByProduct = new Map<string, PackFormatMaterialRow[]>();
  for (const m of (materials ?? []) as Array<PackFormatMaterialRow & { product_id: number | string }>) {
    const key = String(m.product_id);
    const list = materialsByProduct.get(key) ?? [];
    list.push(m);
    materialsByProduct.set(key, list);
  }

  // One PCF per product: `uniq_active_pcf_per_product_year` allows several
  // completed rows across reference years, and the cohort wants the current
  // footprint, not one per year of history. Newest reference year wins.
  const bestByProduct = new Map<string, PcfForIntensity>();
  for (const pcf of pcfs as PcfForIntensity[]) {
    const key = String(pcf.product_id ?? '');
    if (!key) continue;
    const incumbent = bestByProduct.get(key);
    if (!incumbent || (pcf.reference_year ?? 0) > (incumbent.reference_year ?? 0)) {
      bestByProduct.set(key, pcf);
    }
  }

  const rows: ProductIntensitySnapshotRow[] = [];
  for (const [productKey, pcf] of Array.from(bestByProduct.entries())) {
    const outcome = buildIntensitySnapshot(
      pcf,
      productById.get(productKey) ?? null,
      materialsByProduct.get(productKey) ?? [],
      asOfDate,
    );
    if (outcome.row) rows.push(outcome.row);
    else if (outcome.skipped) countSkip(skips, outcome.skipped);
  }

  if (rows.length === 0) return { written: 0, skipped: skips, error: null };

  const { error: writeError } = await supabase
    .from('product_intensity_snapshots')
    .upsert(rows, { onConflict: 'product_id,metric_key,snapshot_date' });

  if (writeError) return { written: 0, skipped: skips, error: writeError.message };
  return { written: rows.length, skipped: skips, error: null };
}

/**
 * Write the cohort row for one PCF that has just reached `completed`.
 *
 * Called from the recalculation job so a fresh footprint joins the cohort the
 * moment it exists rather than waiting for tomorrow's sweep. Never throws: a
 * benchmark row failing to write must not fail somebody's LCA.
 */
export async function snapshotSingleProductIntensity(
  supabase: SupabaseClient,
  pcfId: string,
  asOfDate: Date = new Date(),
): Promise<IntensityOutcome & { error: string | null }> {
  try {
    const { data: pcf, error: pcfError } = await supabase
      .from('product_carbon_footprints')
      .select(
        'id, organization_id, product_id, status, system_boundary, lca_scope_type, boundary_source, reference_year, aggregated_impacts',
      )
      .eq('id', pcfId)
      .maybeSingle();

    if (pcfError) return { row: null, skipped: null, error: pcfError.message };
    if (!pcf) return { row: null, skipped: 'no_product', error: null };

    const typed = pcf as PcfForIntensity;
    if (typed.product_id === null || typed.product_id === undefined) {
      return { row: null, skipped: 'no_product', error: null };
    }

    const [{ data: product }, { data: materials }] = await Promise.all([
      supabase
        .from('products')
        .select('id, product_category, product_kind, unit_size_value, unit_size_unit, is_multipack')
        .eq('id', typed.product_id)
        .maybeSingle(),
      supabase
        .from('product_materials')
        .select(
          'material_name, material_type, packaging_category, packaging_material_class, container_format, container_material, net_weight_g',
        )
        .eq('product_id', typed.product_id),
    ]);

    const outcome = buildIntensitySnapshot(
      typed,
      (product as ProductForIntensity | null) ?? null,
      (materials ?? []) as PackFormatMaterialRow[],
      asOfDate,
    );

    if (!outcome.row) return { ...outcome, error: null };

    const { error: writeError } = await supabase
      .from('product_intensity_snapshots')
      .upsert([outcome.row], { onConflict: 'product_id,metric_key,snapshot_date' });

    return { ...outcome, error: writeError?.message ?? null };
  } catch (err: unknown) {
    return {
      row: null,
      skipped: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
