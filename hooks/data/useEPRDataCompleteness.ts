import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';
import { toast } from 'sonner';
import { assessDataCompleteness } from '@/lib/epr/validation';
import type { EPRDataCompletenessResult } from '@/lib/epr/types';

interface UseEPRDataCompletenessResult {
  completeness: EPRDataCompletenessResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useEPRDataCompleteness(): UseEPRDataCompletenessResult {
  const { currentOrganization } = useOrganization();
  const [completeness, setCompleteness] = useState<EPRDataCompletenessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompleteness = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('product_materials')
        .select(`
          id,
          product_id,
          material_name,
          packaging_category,
          net_weight_g,
          epr_packaging_activity,
          epr_packaging_level,
          epr_uk_nation,
          epr_ram_rating,
          epr_is_household,
          epr_is_drinks_container,
          epr_material_type,
          products!inner(id, name, organization_id)
        `)
        .eq('products.organization_id', currentOrganization.id);

      if (fetchError) throw fetchError;

      const items = (data || []).map((row: any) => ({
        id: row.id,
        product_id: row.product_id,
        product_name: row.products?.name || `Product #${row.product_id}`,
        material_name: row.material_name,
        packaging_category: row.packaging_category,
        net_weight_g: row.net_weight_g,
        epr_packaging_activity: row.epr_packaging_activity,
        epr_packaging_level: row.epr_packaging_level,
        epr_uk_nation: row.epr_uk_nation,
        epr_ram_rating: row.epr_ram_rating,
        epr_is_household: row.epr_is_household,
        epr_is_drinks_container: row.epr_is_drinks_container,
        epr_material_type: row.epr_material_type,
      }));

      setCompleteness(assessDataCompleteness(items));
    } catch (err: any) {
      console.error('Error assessing EPR data completeness:', err);
      const message = err.message || 'Failed to assess data completeness';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchCompleteness();
  }, [fetchCompleteness]);

  return {
    completeness,
    loading,
    error,
    refresh: fetchCompleteness,
  };
}
