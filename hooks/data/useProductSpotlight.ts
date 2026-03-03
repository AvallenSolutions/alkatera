import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

export interface ProductSpotlightItem {
  id: string;
  name: string;
  image_url: string | null;
  lca_status: 'completed' | 'in_progress' | 'draft';
  co2e_per_unit: number | null;
  declared_unit: string | null;
}

export function useProductSpotlight() {
  const { currentOrganization } = useOrganization();
  const [products, setProducts] = useState<ProductSpotlightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();

      // 1. Fetch up to 20 products ordered by updated_at DESC
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, product_image_url, updated_at')
        .eq('organization_id', currentOrganization.id)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (productError) throw productError;
      if (!productData || productData.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const productIds = productData.map(p => p.id);

      // 2. Fetch PCFs for those products (non-fatal — products show even without PCF data)
      // Table uses: functional_unit (not declared_unit), individual total_ghg_* phase columns (not total_co2e)
      let pcfMap = new Map<string, { status: string; total_co2e: number; functional_unit: string | null }>();
      try {
        const { data: pcfData, error: pcfError } = await supabase
          .from('product_carbon_footprints')
          .select('id, product_id, functional_unit, status, updated_at, total_ghg_raw_materials, total_ghg_processing, total_ghg_packaging, total_ghg_transport, total_ghg_use, total_ghg_end_of_life')
          .eq('organization_id', currentOrganization.id)
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
      const items: ProductSpotlightItem[] = productData.map(product => {
        const pcf = pcfMap.get(product.id);
        let lcaStatus: ProductSpotlightItem['lca_status'] = 'draft';
        if (pcf) {
          if (pcf.status === 'completed') lcaStatus = 'completed';
          else if (pcf.status === 'pending') lcaStatus = 'in_progress';
        }

        return {
          id: product.id,
          name: product.name,
          image_url: product.product_image_url ?? null,
          lca_status: lcaStatus,
          co2e_per_unit: lcaStatus === 'completed' && pcf?.total_co2e
            ? Math.round(pcf.total_co2e * 100) / 100
            : null,
          declared_unit: pcf?.functional_unit ?? null,
        };
      });

      setProducts(items);
    } catch (err) {
      console.error('Error fetching product spotlight:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error };
}
