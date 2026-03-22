'use client';

import { useState, useEffect, useCallback } from 'react';
import { calculateViticultureImpacts } from '@/lib/viticulture-calculator';
import type {
  Vineyard,
  VineyardGrowingProfile,
  VintageImpactSummary,
  ViticultureImpactResult,
} from '@/lib/types/viticulture';

interface UseVineyardDashboardResult {
  vineyard: Vineyard | null;
  profiles: VineyardGrowingProfile[];
  vintageImpacts: VintageImpactSummary[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useVineyardDashboard(vineyardId: string): UseVineyardDashboardResult {
  const [vineyard, setVineyard] = useState<Vineyard | null>(null);
  const [profiles, setProfiles] = useState<VineyardGrowingProfile[]>([]);
  const [vintageImpacts, setVintageImpacts] = useState<VintageImpactSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!vineyardId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch vineyard details and profiles in parallel
      const [vineyardRes, profilesRes] = await Promise.all([
        fetch('/api/vineyards'),
        fetch(`/api/vineyards/${vineyardId}/growing-profile`),
      ]);

      if (!vineyardRes.ok) throw new Error('Failed to load vineyard');
      const { data: vineyards } = await vineyardRes.json();
      const found = (vineyards as Vineyard[]).find((v) => v.id === vineyardId) ?? null;
      setVineyard(found);

      if (!found) {
        setError('Vineyard not found');
        setIsLoading(false);
        return;
      }

      let profileList: VineyardGrowingProfile[] = [];
      if (profilesRes.ok) {
        const { data } = await profilesRes.json();
        // API returns an array when no vintage_year param is given, or a single profile
        profileList = Array.isArray(data) ? data : data ? [data] : [];
      }
      setProfiles(profileList);

      // Calculate impacts for each profile
      const impacts: VintageImpactSummary[] = profileList.map((profile) => {
        const result = calculateViticultureImpacts({
          climate_zone: found.climate_zone,
          certification: found.certification,
          location_country_code: found.location_country_code,
          area_ha: profile.area_ha,
          soil_management: profile.soil_management,
          pruning_residue_returned: profile.pruning_residue_returned,
          fertiliser_type: profile.fertiliser_type,
          fertiliser_quantity_kg: profile.fertiliser_quantity_kg,
          fertiliser_n_content_percent: profile.fertiliser_n_content_percent,
          uses_pesticides: profile.uses_pesticides,
          pesticide_applications_per_year: profile.pesticide_applications_per_year,
          pesticide_type: profile.pesticide_type,
          uses_herbicides: profile.uses_herbicides,
          herbicide_applications_per_year: profile.herbicide_applications_per_year,
          herbicide_type: profile.herbicide_type,
          diesel_litres_per_year: profile.diesel_litres_per_year,
          petrol_litres_per_year: profile.petrol_litres_per_year,
          is_irrigated: profile.is_irrigated,
          water_m3_per_ha: profile.water_m3_per_ha,
          irrigation_energy_source: profile.irrigation_energy_source,
          grape_yield_tonnes: profile.grape_yield_tonnes,
          soil_carbon_override_kg_co2e_per_ha: profile.soil_carbon_override_kg_co2e_per_ha,
        });

        const isComplete = profile.area_ha > 0 && profile.grape_yield_tonnes > 0;
        const areaHa = profile.area_ha || 1;

        return {
          vintage_year: profile.vintage_year,
          profile_id: profile.id,
          is_complete: isComplete,
          impacts: result,
          emissions_per_ha: result.total_emissions / areaHa,
          water_per_ha: result.water_m3 / areaHa,
          removals_per_ha: result.total_removals / areaHa,
          yield_tonnes_per_ha: profile.grape_yield_tonnes / areaHa,
        };
      });

      // Sort by vintage year ascending
      impacts.sort((a, b) => a.vintage_year - b.vintage_year);
      setVintageImpacts(impacts);
    } catch (err: any) {
      setError(err.message || 'Failed to load vineyard data');
    } finally {
      setIsLoading(false);
    }
  }, [vineyardId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    vineyard,
    profiles,
    vintageImpacts,
    isLoading,
    error,
    refetch: fetchData,
  };
}
