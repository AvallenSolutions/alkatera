import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

export interface ImpactMetrics {
  climate_change_gwp100: number;
  water_consumption: number;
  water_scarcity_aware: number;
  land_use: number;
  terrestrial_ecotoxicity: number;
  freshwater_eutrophication: number;
  terrestrial_acidification: number;
  fossil_resource_scarcity: number;
}

export interface TopContributor {
  name: string;
  value: number;
  percentage: number;
  category: string;
}

export interface CompanyMetrics {
  total_impacts: ImpactMetrics;
  climate_top_contributor: TopContributor | null;
  water_risk_level: 'high' | 'medium' | 'low';
  circularity_percentage: number;
  land_footprint_total: number;
  total_products_assessed: number;
  csrd_compliant_percentage: number;
  last_updated: string | null;
}

export interface ScopeBreakdown {
  scope1: number;
  scope2: number;
  scope3: number;
}

export interface FacilityWaterRisk {
  facility_id: string;
  facility_name: string;
  location_country_code: string;
  water_scarcity_aware: number;
  risk_level: 'high' | 'medium' | 'low';
  latitude?: number;
  longitude?: number;
}

export interface MaterialFlow {
  material_type: string;
  input_mass: number;
  output_mass: number;
  waste_mass: number;
  recycled_mass: number;
}

export interface NatureMetrics {
  land_use: number;
  terrestrial_ecotoxicity: number;
  freshwater_eutrophication: number;
  terrestrial_acidification: number;
}

export function useCompanyMetrics() {
  const { currentOrganization } = useOrganization();
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [scopeBreakdown, setScopeBreakdown] = useState<ScopeBreakdown | null>(null);
  const [facilityWaterRisks, setFacilityWaterRisks] = useState<FacilityWaterRisk[]>([]);
  const [materialFlows, setMaterialFlows] = useState<MaterialFlow[]>([]);
  const [natureMetrics, setNatureMetrics] = useState<NatureMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    fetchCompanyMetrics();
  }, [currentOrganization?.id]);

  async function fetchCompanyMetrics() {
    try {
      setLoading(true);
      setError(null);

      if (!currentOrganization?.id) {
        throw new Error('No organization selected');
      }

      // Fetch all product LCAs with their aggregated impacts
      const { data: lcas, error: lcaError } = await supabase
        .from('product_lcas')
        .select('id, product_name, aggregated_impacts, csrd_compliant, updated_at')
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'completed')
        .not('aggregated_impacts', 'is', null);

      if (lcaError) throw lcaError;

      if (!lcas || lcas.length === 0) {
        setMetrics({
          total_impacts: {
            climate_change_gwp100: 0,
            water_consumption: 0,
            water_scarcity_aware: 0,
            land_use: 0,
            terrestrial_ecotoxicity: 0,
            freshwater_eutrophication: 0,
            terrestrial_acidification: 0,
            fossil_resource_scarcity: 0,
          },
          climate_top_contributor: null,
          water_risk_level: 'low',
          circularity_percentage: 0,
          land_footprint_total: 0,
          total_products_assessed: 0,
          csrd_compliant_percentage: 0,
          last_updated: null,
        });
        setLoading(false);
        return;
      }

      // Aggregate all impacts across products
      const totalImpacts: ImpactMetrics = {
        climate_change_gwp100: 0,
        water_consumption: 0,
        water_scarcity_aware: 0,
        land_use: 0,
        terrestrial_ecotoxicity: 0,
        freshwater_eutrophication: 0,
        terrestrial_acidification: 0,
        fossil_resource_scarcity: 0,
      };

      let csrdCompliantCount = 0;
      const productContributions: { name: string; value: number }[] = [];

      lcas.forEach((lca) => {
        const impacts = lca.aggregated_impacts as ImpactMetrics;
        if (impacts) {
          totalImpacts.climate_change_gwp100 += impacts.climate_change_gwp100 || 0;
          totalImpacts.water_consumption += impacts.water_consumption || 0;
          totalImpacts.water_scarcity_aware += impacts.water_scarcity_aware || 0;
          totalImpacts.land_use += impacts.land_use || 0;
          totalImpacts.terrestrial_ecotoxicity += impacts.terrestrial_ecotoxicity || 0;
          totalImpacts.freshwater_eutrophication += impacts.freshwater_eutrophication || 0;
          totalImpacts.terrestrial_acidification += impacts.terrestrial_acidification || 0;
          totalImpacts.fossil_resource_scarcity += impacts.fossil_resource_scarcity || 0;

          productContributions.push({
            name: lca.product_name || 'Unknown Product',
            value: impacts.climate_change_gwp100 || 0,
          });
        }

        if (lca.csrd_compliant) {
          csrdCompliantCount++;
        }
      });

      // Find top climate contributor
      const topContributor = productContributions.length > 0
        ? productContributions.reduce((max, current) =>
            current.value > max.value ? current : max
          )
        : null;

      const topContributorData: TopContributor | null = topContributor
        ? {
            name: topContributor.name,
            value: topContributor.value,
            percentage: totalImpacts.climate_change_gwp100 > 0
              ? (topContributor.value / totalImpacts.climate_change_gwp100) * 100
              : 0,
            category: 'Product',
          }
        : null;

      // Calculate water risk level (based on AWARE scarcity)
      const avgWaterScarcity = totalImpacts.water_consumption > 0
        ? totalImpacts.water_scarcity_aware / totalImpacts.water_consumption
        : 0;

      let waterRiskLevel: 'high' | 'medium' | 'low' = 'low';
      if (avgWaterScarcity > 40) waterRiskLevel = 'high';
      else if (avgWaterScarcity > 20) waterRiskLevel = 'medium';

      // Calculate circularity (placeholder - based on fossil resource scarcity as proxy)
      const circularityPercentage = totalImpacts.fossil_resource_scarcity > 0
        ? Math.max(0, 100 - (totalImpacts.fossil_resource_scarcity / lcas.length) * 2)
        : 0;

      const csrdCompliantPercentage = lcas.length > 0
        ? (csrdCompliantCount / lcas.length) * 100
        : 0;

      const latestUpdate = lcas.reduce((latest, lca) => {
        const lcaDate = new Date(lca.updated_at);
        return !latest || lcaDate > new Date(latest) ? lca.updated_at : latest;
      }, null as string | null);

      setMetrics({
        total_impacts: totalImpacts,
        climate_top_contributor: topContributorData,
        water_risk_level: waterRiskLevel,
        circularity_percentage: Math.round(circularityPercentage),
        land_footprint_total: totalImpacts.land_use,
        total_products_assessed: lcas.length,
        csrd_compliant_percentage: Math.round(csrdCompliantPercentage),
        last_updated: latestUpdate,
      });

      // Fetch scope breakdown (from calculated emissions)
      await fetchScopeBreakdown();

      // Fetch facility water risks
      await fetchFacilityWaterRisks();

      // Set nature metrics
      setNatureMetrics({
        land_use: totalImpacts.land_use,
        terrestrial_ecotoxicity: totalImpacts.terrestrial_ecotoxicity,
        freshwater_eutrophication: totalImpacts.freshwater_eutrophication,
        terrestrial_acidification: totalImpacts.terrestrial_acidification,
      });

      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching company metrics:', err);
      setError(err.message || 'Failed to fetch company metrics');
      setLoading(false);
    }
  }

  async function fetchScopeBreakdown() {
    try {
      if (!currentOrganization?.id) return;

      const { data: emissions, error } = await supabase
        .from('calculated_emissions')
        .select('scope, co2e_kg')
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      const breakdown: ScopeBreakdown = {
        scope1: 0,
        scope2: 0,
        scope3: 0,
      };

      emissions?.forEach((emission) => {
        const scope = emission.scope?.toLowerCase();
        const value = emission.co2e_kg || 0;

        if (scope === 'scope 1') breakdown.scope1 += value;
        else if (scope === 'scope 2') breakdown.scope2 += value;
        else if (scope === 'scope 3') breakdown.scope3 += value;
      });

      setScopeBreakdown(breakdown);
    } catch (err) {
      console.error('Error fetching scope breakdown:', err);
    }
  }

  async function fetchFacilityWaterRisks() {
    try {
      if (!currentOrganization?.id) return;

      const { data: facilities, error } = await supabase
        .from('facilities')
        .select('id, name, location_country_code, latitude, longitude')
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      // Calculate water scarcity risk per facility based on location
      const AWARE_THRESHOLDS = { high: 40, medium: 20 };
      const AWARE_FACTORS: Record<string, number> = {
        ES: 54.8, PT: 42.1, IT: 38.5, GR: 35.2, SA: 95.7, AE: 89.4,
        GB: 8.2, IE: 5.3, NO: 3.1, SE: 4.2, FI: 3.8,
        GLOBAL: 20.5,
      };

      const risks: FacilityWaterRisk[] = facilities?.map((facility) => {
        const countryCode = facility.location_country_code?.toUpperCase();
        const awareFactor = AWARE_FACTORS[countryCode || 'GLOBAL'] || AWARE_FACTORS.GLOBAL;

        let riskLevel: 'high' | 'medium' | 'low' = 'low';
        if (awareFactor > AWARE_THRESHOLDS.high) riskLevel = 'high';
        else if (awareFactor > AWARE_THRESHOLDS.medium) riskLevel = 'medium';

        return {
          facility_id: facility.id,
          facility_name: facility.name || 'Unknown Facility',
          location_country_code: countryCode || 'GLOBAL',
          water_scarcity_aware: awareFactor,
          risk_level: riskLevel,
          latitude: facility.latitude,
          longitude: facility.longitude,
        };
      }) || [];

      setFacilityWaterRisks(risks);
    } catch (err) {
      console.error('Error fetching facility water risks:', err);
    }
  }

  return {
    metrics,
    scopeBreakdown,
    facilityWaterRisks,
    materialFlows,
    natureMetrics,
    loading,
    error,
    refetch: fetchCompanyMetrics,
  };
}
