import { useQuery } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

export interface ProductSpotlightItem {
  id: string;
  name: string;
  image_url: string | null;
  lca_status: 'completed' | 'in_progress' | 'estimate' | 'draft';
  co2e_per_unit: number | null;
  declared_unit: string | null;
}

/**
 * ── TanStack Query migration template ───────────────────────────────────────
 * This is the reference pattern for porting the ~99 hand-rolled data hooks to
 * the client query cache. The recipe:
 *
 *   1. Extract the fetch body verbatim into a module-level async `queryFn`
 *      (orgId in, mapped data out) — identical queries, so output is unchanged.
 *   2. useQuery({ queryKey: ['<resource>', orgId, ...params], queryFn,
 *      enabled: !!orgId, staleTime }). queryKey convention: resource name first,
 *      then the org id, then any other params (year, etc.).
 *   3. PRESERVE the hook's existing public return shape exactly (field names and
 *      types) so consumers don't change. Map react-query's {data,isLoading,error,
 *      refetch} back onto the legacy shape ({products,loading,error,refetch} here).
 *
 * Win: navigating away and back now serves from cache instantly (60s staleTime)
 * instead of refetching with a skeleton, and sibling mounts dedupe.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Fetch the product-spotlight items for an org: up to 20 most-recently-updated
 * products, enriched with their latest PCF status + per-unit CO₂e (non-fatal —
 * products still show if the PCF query fails). Body is unchanged from the
 * previous useState/useEffect implementation, so output is identical.
 */
async function fetchProductSpotlight(organizationId: string): Promise<ProductSpotlightItem[]> {
  const supabase = getSupabaseBrowserClient();

  // 1. Fetch up to 20 products ordered by updated_at DESC
  const { data: productData, error: productError } = await supabase
    .from('products')
    .select('id, name, product_image_url, updated_at')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (productError) throw productError;
  if (!productData || productData.length === 0) {
    return [];
  }

  const productIds = productData.map(p => p.id);

  // 2. Fetch PCFs for those products (non-fatal — products show even without PCF data)
  // Table uses: functional_unit (not declared_unit), individual total_ghg_* phase columns (not total_co2e)
  let pcfMap = new Map<string, { status: string; total_co2e: number; functional_unit: string | null }>();
  try {
    const { data: pcfData, error: pcfError } = await supabase
      .from('product_carbon_footprints')
      .select('id, product_id, functional_unit, status, updated_at, total_ghg_raw_materials, total_ghg_processing, total_ghg_packaging, total_ghg_transport, total_ghg_use, total_ghg_end_of_life')
      .eq('organization_id', organizationId)
      .in('product_id', productIds);

    if (!pcfError && pcfData) {
      // Deduplicate: latest PCF per product_id (by updated_at)
      const latestPcfMap = new Map<string, (typeof pcfData)[0]>();
      for (const pcf of pcfData) {
        const existing = latestPcfMap.get(pcf.product_id);
        if (!existing || new Date(pcf.updated_at) > new Date(existing.updated_at)) {
          latestPcfMap.set(pcf.product_id, pcf);
        }
      }
      // Sum phase columns for total CO₂e
      latestPcfMap.forEach((pcf, productId) => {
        const total = (pcf.total_ghg_raw_materials || 0)
          + (pcf.total_ghg_processing || 0)
          + (pcf.total_ghg_packaging || 0)
          + (pcf.total_ghg_transport || 0)
          + (pcf.total_ghg_use || 0)
          + (pcf.total_ghg_end_of_life || 0);
        pcfMap.set(productId, {
          status: pcf.status,
          total_co2e: total,
          functional_unit: pcf.functional_unit,
        });
      });
    }
  } catch {
    // PCF query failed — continue without PCF data
  }

  // 3. Map to ProductSpotlightItem
  return productData.map(product => {
    const pcf = pcfMap.get(product.id);
    let lcaStatus: ProductSpotlightItem['lca_status'] = 'draft';
    if (pcf) {
      if (pcf.status === 'completed') lcaStatus = 'completed';
      else if (pcf.status === 'pending') lcaStatus = 'in_progress';
      else if (pcf.status === 'estimate') lcaStatus = 'estimate';
    }

    // Surface CO₂e for estimates too — the whole point of the day-one
    // estimate is to give the user (and Rosa) a number to work with.
    const showCo2e = lcaStatus === 'completed' || lcaStatus === 'estimate';

    return {
      id: product.id,
      name: product.name,
      image_url: product.product_image_url ?? null,
      lca_status: lcaStatus,
      co2e_per_unit: showCo2e && pcf?.total_co2e
        ? Math.round(pcf.total_co2e * 100) / 100
        : null,
      declared_unit: pcf?.functional_unit ?? null,
    };
  });
}

export function useProductSpotlight() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data, isLoading, error, refetch } = useQuery<ProductSpotlightItem[]>({
    queryKey: ['product-spotlight', orgId],
    queryFn: () => fetchProductSpotlight(orgId as string),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  // Preserve the original public shape so consumers (ProductSpotlight.tsx) and
  // the realtime refresh wiring need no changes. isLoading is false when the
  // query is disabled (no org), matching the old "no org → loading false".
  return {
    products: data ?? [],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch products') : null,
    refetch,
  };
}
