'use client';

import { useState, useEffect, useCallback } from 'react';
import { calculateOrchardImpacts } from '@/lib/orchard-calculator';
import type {
  Orchard,
  OrchardGrowingProfile,
  HarvestImpactSummary,
  OrchardCalculatorInput,
} from '@/lib/types/orchard';

interface UseOrchardDashboardResult {
  orchard: Orchard | null;
  profiles: OrchardGrowingProfile[];
  harvestImpacts: HarvestImpactSummary[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useOrchardDashboard(orchardId: string): UseOrchardDashboardResult {
  const [orchard, setOrchard] = useState<Orchard | null>(null);
  const [profiles, setProfiles] = useState<OrchardGrowingProfile[]>([]);
  const [harvestImpacts, setHarvestImpacts] = useState<HarvestImpactSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!orchardId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [orchardRes, profilesRes] = await Promise.all([
        fetch('/api/orchards'),
        fetch(`/api/orchards/${orchardId}/growing-profile`),
      ]);

      if (!orchardRes.ok) throw new Error('Failed to load orchard');
      const { data: orchards } = await orchardRes.json();
      const found = (orchards as Orchard[]).find((o) => o.id === orchardId) ?? null;
      setOrchard(found);

      if (!found) {
        setError('Orchard not found');
        setIsLoading(false);
        return;
      }

      let profileList: OrchardGrowingProfile[] = [];
      if (profilesRes.ok) {
        const { data } = await profilesRes.json();
        profileList = Array.isArray(data) ? data : data ? [data] : [];
      }
      setProfiles(profileList);

      const impacts: HarvestImpactSummary[] = profileList.map((profile) => {
        const input: OrchardCalculatorInput = {
          orchard_type: found.orchard_type,
          climate_zone: found.climate_zone as 'wet' | 'dry' | 'temperate',
          certification: found.certification as any,
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
          fruit_yield_tonnes: profile.fruit_yield_tonnes,
          soil_carbon_override_kg_co2e_per_ha: profile.soil_carbon_override_kg_co2e_per_ha,
          transport_distance_km: profile.transport_distance_km,
          transport_mode: profile.transport_mode,
          previous_land_use_type: found.previous_land_use_type as any,
          land_conversion_year: found.land_conversion_year,
          harvest_year: profile.harvest_year,
        };

        const result = calculateOrchardImpacts(input);
        const isComplete = profile.area_ha > 0 && profile.fruit_yield_tonnes > 0;
        const areaHa = profile.area_ha || 1;

        return {
          harvest_year: profile.harvest_year,
          profile_id: profile.id,
          is_complete: isComplete,
          is_draft: profile.is_draft ?? false,
          impacts: result,
          emissions_per_ha: result.total_emissions / areaHa,
          water_per_ha: result.water_m3 / areaHa,
          removals_per_ha: result.total_removals / areaHa,
          yield_tonnes_per_ha: profile.fruit_yield_tonnes / areaHa,
        };
      });

      impacts.sort((a, b) => a.harvest_year - b.harvest_year);
      setHarvestImpacts(impacts);
    } catch (err: any) {
      setError(err.message || 'Failed to load orchard data');
    } finally {
      setIsLoading(false);
    }
  }, [orchardId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    orchard,
    profiles,
    harvestImpacts,
    isLoading,
    error,
    refetch: fetchData,
  };
}
