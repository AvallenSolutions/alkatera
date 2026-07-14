import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared LCA staleness comparison, used by the product staleness endpoint AND
 * the PDF generator so the two can never diverge.
 *
 * The client-side calculator writes the PCF snapshot once; every input that
 * feeds it (recipe, packaging, maturation, facility utility data, and — for a
 * multipack — its component products) can change afterwards via smart-upload
 * ingest, bulk imports or admin edits without refreshing the stored numbers.
 * This compares those inputs' latest updated_at against the snapshot time.
 *
 * Cheap: a handful of indexed `order by updated_at limit 1` reads, no recompute.
 */
export interface LcaStalenessResult {
  stale: boolean;
  reasons: string[];
}

export async function computeLcaStaleness(
  supabase: SupabaseClient,
  productId: number,
  snapshotTimeMs: number,
  opts: { isMultipack?: boolean } = {},
): Promise<LcaStalenessResult> {
  const reasons: string[] = [];
  const isNewer = (ts: string | null | undefined, label: string) => {
    if (ts && new Date(ts).getTime() > snapshotTimeMs) reasons.push(label);
  };

  const { data: mat } = await supabase
    .from('product_materials')
    .select('updated_at')
    .eq('product_id', productId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  isNewer(mat?.updated_at, 'the recipe or packaging');

  const { data: maturation } = await supabase
    .from('maturation_profiles')
    .select('updated_at')
    .eq('product_id', productId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  isNewer(maturation?.updated_at, 'the maturation profile');

  const { data: allocations } = await supabase
    .from('facility_product_allocation_matrix')
    .select('facility_id')
    .eq('product_id', productId);
  const facilityIds = Array.from(new Set((allocations || []).map((a: any) => a.facility_id).filter(Boolean)));
  if (facilityIds.length > 0) {
    const { data: util } = await supabase
      .from('utility_data_entries')
      .select('updated_at')
      .in('facility_id', facilityIds)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    isNewer(util?.updated_at, 'facility energy or utility data');
  }

  if (opts.isMultipack) {
    const { data: comps } = await supabase
      .from('multipack_components')
      .select('component_product_id')
      .eq('multipack_product_id', productId);
    const componentIds = (comps || []).map((c: any) => c.component_product_id).filter(Boolean);
    if (componentIds.length > 0) {
      const { data: compPcf } = await supabase
        .from('product_carbon_footprints')
        .select('created_at')
        .in('product_id', componentIds)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      isNewer(compPcf?.created_at, 'a product inside this multipack');
    }
  }

  return { stale: reasons.length > 0, reasons };
}
