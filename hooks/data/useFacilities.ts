import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface Facility {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  facility_type_id: string | null;
  facility_type_name?: string | null;
  data_source_type: 'internal' | 'supplier_managed';
  supplier_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface FacilityDetails extends Facility {
  activity_data?: any[];
}

export interface CreateFacilityData {
  name: string;
  facility_type: string;
  address?: string;
  city?: string;
  country: string;
  data_source_type: 'internal' | 'supplier_managed';
  supplier_id?: string;
}

export function useFacilities() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getFacilities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_all_facilities_list');

      if (error) throw error;

      setFacilities(data || []);
    } catch (err) {
      console.error('Error fetching facilities:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch facilities'));
      setFacilities([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getFacilityById = useCallback(async (facilityId: string): Promise<FacilityDetails | null> => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_facility_details', {
        p_facility_id: facilityId,
      });

      if (error) throw error;

      return data as FacilityDetails;
    } catch (err) {
      console.error('Error fetching facility details:', err);
      throw err;
    }
  }, []);

  const createFacility = useCallback(async (facilityData: CreateFacilityData) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('create_facility', {
        p_name: facilityData.name,
        p_facility_type: facilityData.facility_type,
        p_address: facilityData.address || null,
        p_city: facilityData.city || null,
        p_country: facilityData.country,
        p_data_source_type: facilityData.data_source_type,
        p_supplier_id: facilityData.supplier_id || null,
      });

      if (error) throw error;

      await getFacilities();

      return data;
    } catch (err) {
      console.error('Error creating facility:', err);
      throw err;
    }
  }, [getFacilities]);

  useEffect(() => {
    getFacilities();
  }, [getFacilities]);

  return {
    facilities,
    isLoading,
    error,
    getFacilities,
    getFacilityById,
    createFacility,
  };
}
