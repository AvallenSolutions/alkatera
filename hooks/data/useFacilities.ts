import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface Facility {
  id: string;
  name: string;
  location: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  facility_type_id: string | null;
  facility_type?: { name: string } | null;
  data_source_type: 'internal' | 'supplier_managed';
  supplier_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export function useFacilities(organizationId?: string) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFacilities = useCallback(async () => {
    if (!organizationId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('facilities')
        .select(`
          *,
          facility_type:facility_types(name)
        `)
        .eq('organization_id', organizationId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFacilities(data || []);
    } catch (err) {
      console.error('Error fetching facilities:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch facilities'));
      setFacilities([]);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  return { facilities, isLoading, error, refetch: fetchFacilities };
}
