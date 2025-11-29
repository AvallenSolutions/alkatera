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

export interface MaterialBreakdownItem {
  name: string;
  quantity: number;
  unit: string;
  climate: number;
  source: string;
}

export interface GHGBreakdown {
  carbon_origin: {
    fossil: number;
    biogenic: number;
    land_use_change: number;
  };
  gas_inventory: {
    co2_fossil: number;
    co2_biogenic: number;
    methane: number;
    nitrous_oxide: number;
    hfc_pfc: number;
  };
  gwp_factors: {
    methane_gwp100: number;
    n2o_gwp100: number;
    method: string;
  };
}

export function useCompanyMetrics() {
  const { currentOrganization } = useOrganization();
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [scopeBreakdown, setScopeBreakdown] = useState<ScopeBreakdown | null>(null);
  const [facilityWaterRisks, setFacilityWaterRisks] = useState<FacilityWaterRisk[]>([]);
  const [materialFlows, setMaterialFlows] = useState<MaterialFlow[]>([]);
  const [natureMetrics, setNatureMetrics] = useState<NatureMetrics | null>(null);
  const [materialBreakdown, setMaterialBreakdown] = useState<MaterialBreakdownItem[]>([]);
  const [ghgBreakdown, setGhgBreakdown] = useState<GHGBreakdown | null>(null);
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

      // Fetch material and GHG breakdown
      await fetchMaterialAndGHGBreakdown();

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
        .from('ghg_emissions')
        .select('category_id, total_emissions, ghg_categories(scope)')
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      const breakdown: ScopeBreakdown = {
        scope1: 0,
        scope2: 0,
        scope3: 0,
      };

      emissions?.forEach((emission: any) => {
        const scope = emission.ghg_categories?.scope;
        const value = emission.total_emissions || 0;

        if (scope === 1) breakdown.scope1 += value;
        else if (scope === 2) breakdown.scope2 += value;
        else if (scope === 3) breakdown.scope3 += value;
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
        .select('id, name, location_country_code, address_lat, address_lng')
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
          latitude: facility.address_lat ? parseFloat(facility.address_lat) : undefined,
          longitude: facility.address_lng ? parseFloat(facility.address_lng) : undefined,
        };
      }) || [];

      setFacilityWaterRisks(risks);
    } catch (err) {
      console.error('Error fetching facility water risks:', err);
    }
  }

  async function fetchMaterialAndGHGBreakdown() {
    try {
      if (!currentOrganization?.id) return;

      // Fetch materials from all completed LCAs
      const { data: materials, error } = await supabase
        .from('product_lca_materials')
        .select('name, quantity, unit, impact_climate, impact_water, impact_land, impact_waste, impact_source, packaging_category, product_lcas!inner(status, organization_id)')
        .eq('product_lcas.organization_id', currentOrganization.id)
        .eq('product_lcas.status', 'completed')
        .not('impact_climate', 'is', null);

      if (error) throw error;

      if (!materials || materials.length === 0) {
        return;
      }

      // Aggregate materials by name
      const materialMap = new Map<string, MaterialBreakdownItem>();

      materials.forEach((material: any) => {
        const name = material.name || 'Unknown Material';
        const existing = materialMap.get(name);

        if (existing) {
          existing.quantity += Number(material.quantity) || 0;
          existing.climate += Number(material.impact_climate) || 0;
        } else {
          materialMap.set(name, {
            name: name,
            quantity: Number(material.quantity) || 0,
            unit: material.unit || 'kg',
            climate: Number(material.impact_climate) || 0,
            source: material.impact_source || 'secondary_modelled',
          });
        }
      });

      // Convert map to array and sort by climate impact
      const aggregatedMaterials = Array.from(materialMap.values())
        .sort((a, b) => b.climate - a.climate);

      setMaterialBreakdown(aggregatedMaterials);

      // Calculate GHG breakdown (simplified - assumes mostly fossil CO2)
      const totalClimate = aggregatedMaterials.reduce((sum, m) => sum + m.climate, 0);

      if (totalClimate > 0) {
        // Simple estimation: 90% fossil CO2, 8% biogenic, 2% other gases
        const co2Fossil = totalClimate * 0.90;
        const co2Biogenic = totalClimate * 0.08;
        const methaneEquiv = totalClimate * 0.015 / 27.9; // Convert back to CH4 mass
        const n2oEquiv = totalClimate * 0.005 / 273; // Convert back to N2O mass

        setGhgBreakdown({
          carbon_origin: {
            fossil: co2Fossil,
            biogenic: co2Biogenic,
            land_use_change: totalClimate * 0.02,
          },
          gas_inventory: {
            co2_fossil: co2Fossil,
            co2_biogenic: co2Biogenic,
            methane: methaneEquiv,
            nitrous_oxide: n2oEquiv,
            hfc_pfc: 0,
          },
          gwp_factors: {
            methane_gwp100: 27.9,
            n2o_gwp100: 273,
            method: 'IPCC AR6',
          },
        });
      }
    } catch (err) {
      console.error('Error fetching material and GHG breakdown:', err);
    }
  }

  return {
    metrics,
    scopeBreakdown,
    facilityWaterRisks,
    materialFlows,
    materialBreakdown,
    ghgBreakdown,
    natureMetrics,
    loading,
    error,
    refetch: fetchCompanyMetrics,
  };
}
