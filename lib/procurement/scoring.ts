import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Confidence floor for scraped/derived findings before they're allowed
 * to surface on a procurement dashboard. Read from
 * `brand_directory.procurement_visibility_threshold` per brand; defaults
 * to 0.6 so anything we're not at least 60% confident about is hidden
 * from procurement views (but still visible on the distributor side
 * where the operator can decide).
 */
export interface ScopedBrandIds {
  procurementOrgId: string;
  directoryIds: string[];
}

/**
 * Load every brand_directory entry in a procurement org's scope, with
 * the per-brand visibility threshold. Used by dashboard queries to
 * filter `scraped_brand_data.confidence` against the right floor.
 *
 * Scope is determined by procurement_skus listings → which directory
 * entries are listed by linked distributors. Inactive procurement_skus
 * are excluded.
 */
export async function loadProcurementDirectoryScope(
  supabase: SupabaseClient,
  procurementOrgId: string,
): Promise<
  Array<{
    brand_directory_id: string;
    procurement_visibility_threshold: number;
  }>
> {
  const { data, error } = await supabase
    .from('procurement_skus')
    .select(
      `brand_directory_id, listing_status,
       brand_directory:brand_directory_id ( id, procurement_visibility_threshold )`,
    )
    .eq('procurement_org_id', procurementOrgId)
    .eq('listing_status', 'active');

  if (error) throw new Error(`loadProcurementDirectoryScope: ${error.message}`);

  type Row = {
    brand_directory_id: string;
    brand_directory: { id: string; procurement_visibility_threshold: number | null } | { id: string; procurement_visibility_threshold: number | null }[] | null;
  };
  const seen = new Set<string>();
  const out: Array<{ brand_directory_id: string; procurement_visibility_threshold: number }> = [];
  for (const row of (data ?? []) as Row[]) {
    if (seen.has(row.brand_directory_id)) continue;
    seen.add(row.brand_directory_id);
    const dirRaw = Array.isArray(row.brand_directory) ? row.brand_directory[0] : row.brand_directory;
    out.push({
      brand_directory_id: row.brand_directory_id,
      procurement_visibility_threshold: dirRaw?.procurement_visibility_threshold ?? 0.6,
    });
  }
  return out;
}

/**
 * Visibility filter applied to scraped_brand_data rows before they
 * reach the procurement dashboard. brand-verified and alkatera-live
 * data always passes; only lower-confidence sources are gated.
 */
export function isVisibleToProcurement(
  finding: { source_name: string | null; confidence: number | null },
  threshold: number,
): boolean {
  if (finding.source_name === 'brand_verified' || finding.source_name === 'alkatera_live') {
    return true;
  }
  return (finding.confidence ?? 0) >= threshold;
}
