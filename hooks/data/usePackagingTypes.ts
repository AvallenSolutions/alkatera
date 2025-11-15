import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { PackagingType } from '@/lib/types/lca';

interface UsePackagingTypesResult {
  packagingTypes: PackagingType[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePackagingTypes(organizationId: string | undefined): UsePackagingTypesResult {
  const [packagingTypes, setPackagingTypes] = useState<PackagingType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPackagingTypes = async () => {
    if (!organizationId) {
      setPackagingTypes([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('packaging_types')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setPackagingTypes((data as PackagingType[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch packaging types';
      setError(new Error(errorMessage));
      console.error('Error fetching packaging types:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPackagingTypes();
  }, [organizationId]);

  return {
    packagingTypes,
    isLoading,
    error,
    refetch: fetchPackagingTypes,
  };
}
