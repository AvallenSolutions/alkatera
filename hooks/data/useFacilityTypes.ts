import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface FacilityType {
  id: string;
  name: string;
  created_at: string;
}

export function useFacilityTypes() {
  const [facilityTypes, setFacilityTypes] = useState<FacilityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchFacilityTypes = async () => {
      try {
        setIsLoading(true);
        setError(null);

      const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('facility_types')
          .select('*')
          .order('name', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        setFacilityTypes(data || []);
      } catch (err) {
        console.error('Error fetching facility types:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch facility types'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchFacilityTypes();
  }, []);

  return {
    facilityTypes,
    isLoading,
    error,
  };
}
