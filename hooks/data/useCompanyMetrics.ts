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

export interface LifecycleStageBreakdown {
  stage_name: string;
  sub_stage_name: string | null;
  total_impact: number;
  percentage: number;
  material_count: number;
  top_contributors: { name: string; impact: number }[];
}

export interface FacilityEmissionsBreakdown {
  facility_id: string;
  facility_name: string;
  location_city: string;
  location_country_code: string;
  total_emissions: number;
  percentage: number;
  production_volume: number;
  share_of_production: number;
  facility_intensity: number;
  scope1_emissions: number;
  scope2_emissions: number;
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
  const [lifecycleStageBreakdown, setLifecycleStageBreakdown] = useState<LifecycleStageBreakdown[]>([]);
  const [facilityEmissionsBreakdown, setFacilityEmissionsBreakdown] = useState<FacilityEmissionsBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[useCompanyMetrics] useEffect triggered, org:', currentOrganization?.id);
    if (!currentOrganization?.id) {
      console.log('[useCompanyMetrics] No org, returning early');
      setLoading(false);
      return;
    }

    console.log('[useCompanyMetrics] Calling fetchCompanyMetrics');
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

      console.log('[useCompanyMetrics] About to fetch breakdown data...');

      // Fetch scope breakdown (from calculated emissions)
      try {
        console.log('[useCompanyMetrics] Calling fetchScopeBreakdown...');
        await fetchScopeBreakdown();
        console.log('[useCompanyMetrics] fetchScopeBreakdown completed');
      } catch (err) {
        console.error('[useCompanyMetrics] fetchScopeBreakdown failed:', err);
      }

      // Fetch facility water risks
      try {
        console.log('[useCompanyMetrics] Calling fetchFacilityWaterRisks...');
        await fetchFacilityWaterRisks();
        console.log('[useCompanyMetrics] fetchFacilityWaterRisks completed');
      } catch (err) {
        console.error('[useCompanyMetrics] fetchFacilityWaterRisks failed:', err);
      }

      // Fetch material and GHG breakdown
      try {
        console.log('[useCompanyMetrics] Calling fetchMaterialAndGHGBreakdown...');
        await fetchMaterialAndGHGBreakdown();
        console.log('[useCompanyMetrics] fetchMaterialAndGHGBreakdown completed');
      } catch (err) {
        console.error('[useCompanyMetrics] fetchMaterialAndGHGBreakdown failed:', err);
      }

      // Fetch facility emissions breakdown
      try {
        await fetchFacilityEmissions();
      } catch (err) {
        console.error('[useCompanyMetrics] fetchFacilityEmissions failed:', err);
      }

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
      console.log('[Carbon Debug] Starting fetchMaterialAndGHGBreakdown for org:', currentOrganization?.id);

      if (!currentOrganization?.id) {
        console.log('[Carbon Debug] No organization ID, skipping fetch');
        return;
      }

      // Fetch materials from all completed LCAs with lifecycle stage information
      const { data: materials, error } = await supabase
        .from('product_lca_materials')
        .select(`
          name,
          quantity,
          unit,
          impact_climate,
          impact_water,
          impact_land,
          impact_waste,
          impact_source,
          packaging_category,
          lca_sub_stage_id,
          lca_sub_stages (
            id,
            name,
            lca_stage_id
          ),
          product_lcas!inner(status, organization_id)
        `)
        .eq('product_lcas.organization_id', currentOrganization.id)
        .eq('product_lcas.status', 'completed')
        .not('impact_climate', 'is', null);

      if (error) {
        console.error('[Carbon Debug] Query error:', error);
        throw error;
      }

      console.log('[Carbon Debug] Query returned:', materials?.length || 0, 'materials');

      if (!materials || materials.length === 0) {
        console.log('[Carbon Debug] No materials found - breakdown will be empty');
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

      const totalClimate = aggregatedMaterials.reduce((sum, m) => sum + m.climate, 0);

      console.log('[Carbon Debug] Aggregated into', aggregatedMaterials.length, 'unique materials');
      console.log('[Carbon Debug] Total climate impact:', totalClimate.toFixed(3), 'kg CO2eq');
      console.log('[Carbon Debug] Top 3 contributors:', aggregatedMaterials.slice(0, 3).map(m => `${m.name}: ${m.climate.toFixed(3)}`));

      console.log('[Carbon Debug] About to call setMaterialBreakdown with', aggregatedMaterials.length, 'items');
      setMaterialBreakdown(aggregatedMaterials);
      console.log('[Carbon Debug] setMaterialBreakdown called');

      // Fetch lifecycle stages mapping
      const { data: lifecycleStages } = await supabase
        .from('lca_life_cycle_stages')
        .select('id, name');

      const stageIdToName = new Map<number, string>();
      lifecycleStages?.forEach((stage: any) => {
        stageIdToName.set(stage.id, stage.name);
      });

      // Calculate lifecycle stage breakdown
      const stageMap = new Map<string, {
        total_impact: number;
        material_count: number;
        materials: { name: string; impact: number }[];
      }>();

      materials.forEach((material: any) => {
        const impact = Number(material.impact_climate) || 0;
        const lca_stage_id = material.lca_sub_stages?.lca_stage_id;
        const stageName = lca_stage_id ? (stageIdToName.get(lca_stage_id) || 'Unclassified') : 'Unclassified';

        if (!stageMap.has(stageName)) {
          stageMap.set(stageName, {
            total_impact: 0,
            material_count: 0,
            materials: []
          });
        }

        const stage = stageMap.get(stageName)!;
        stage.total_impact += impact;
        stage.material_count += 1;
        stage.materials.push({ name: material.name || 'Unknown', impact });
      });

      const stageBreakdown: LifecycleStageBreakdown[] = Array.from(stageMap.entries()).map(([stage_name, data]) => {
        // Sort materials by impact and get top 3
        const topContributors = data.materials
          .sort((a, b) => b.impact - a.impact)
          .slice(0, 3);

        return {
          stage_name,
          sub_stage_name: null,
          total_impact: data.total_impact,
          percentage: totalClimate > 0 ? (data.total_impact / totalClimate) * 100 : 0,
          material_count: data.material_count,
          top_contributors: topContributors
        };
      }).sort((a, b) => b.total_impact - a.total_impact);

      console.log('[Carbon Debug] Lifecycle stage breakdown:', stageBreakdown.map(s => `${s.stage_name}: ${s.total_impact.toFixed(3)} (${s.percentage.toFixed(1)}%)`));

      setLifecycleStageBreakdown(stageBreakdown);

      // Calculate accurate GHG breakdown based on material types
      if (totalClimate > 0) {
        let fossilCO2 = 0;
        let biogenicCO2 = 0;
        let landUseChange = 0;
        let methaneTotal = 0;
        let nitrousOxideTotal = 0;

        materials.forEach((material: any) => {
          const impact = Number(material.impact_climate) || 0;
          const name = (material.name || '').toLowerCase();
          const category = (material.packaging_category || '').toLowerCase();

          // Categorise by material type for accurate GHG split
          if (category === 'glass' || name.includes('glass')) {
            // Glass: 100% fossil CO2 from fuel combustion
            fossilCO2 += impact;
          } else if (category === 'plastic' || category === 'pet' || category === 'hdpe' || name.includes('plastic') || name.includes('pet')) {
            // Plastics: 100% fossil CO2 from petrochemicals
            fossilCO2 += impact;
          } else if (category === 'metal' || category === 'aluminium' || name.includes('aluminium') || name.includes('cap')) {
            // Metals: 100% fossil CO2 from smelting
            fossilCO2 += impact;
          } else if (name.includes('sugar') || name.includes('glucose') || name.includes('fructose')) {
            // Sugar: mostly biogenic from photosynthesis
            biogenicCO2 += impact * 0.85;
            fossilCO2 += impact * 0.10; // processing energy
            nitrousOxideTotal += (impact * 0.05) / 273; // N2O from fertiliser
          } else if (name.includes('fruit') || name.includes('apple') || name.includes('lemon') || name.includes('elderflower') || name.includes('juice')) {
            // Fruit ingredients: mostly biogenic
            biogenicCO2 += impact * 0.80;
            fossilCO2 += impact * 0.10; // processing
            landUseChange += impact * 0.08; // land conversion
            nitrousOxideTotal += (impact * 0.02) / 273; // fertiliser
          } else if (category === 'paper' || category === 'cardboard' || name.includes('label') || name.includes('cardboard')) {
            // Paper/cardboard: mostly biogenic from wood
            biogenicCO2 += impact * 0.70;
            fossilCO2 += impact * 0.25; // processing energy
            landUseChange += impact * 0.05;
          } else if (name.includes('water')) {
            // Water: minimal, mostly fossil from transport/treatment
            fossilCO2 += impact * 0.90;
            methaneTotal += (impact * 0.10) / 27.9;
          } else if (name.includes('transport') || name.includes('freight') || name.includes('logistics')) {
            // Transport: diesel/petrol combustion
            fossilCO2 += impact * 0.95;
            methaneTotal += (impact * 0.03) / 27.9;
            nitrousOxideTotal += (impact * 0.02) / 273;
          } else {
            // Unknown/generic: use conservative estimate
            fossilCO2 += impact * 0.70;
            biogenicCO2 += impact * 0.20;
            landUseChange += impact * 0.05;
            methaneTotal += (impact * 0.03) / 27.9;
            nitrousOxideTotal += (impact * 0.02) / 273;
          }
        });

        const ghgData = {
          carbon_origin: {
            fossil: fossilCO2,
            biogenic: biogenicCO2,
            land_use_change: landUseChange,
          },
          gas_inventory: {
            co2_fossil: fossilCO2,
            co2_biogenic: biogenicCO2,
            methane: methaneTotal,
            nitrous_oxide: nitrousOxideTotal,
            hfc_pfc: 0,
          },
          gwp_factors: {
            methane_gwp100: 27.9,
            n2o_gwp100: 273,
            method: 'IPCC AR6',
          },
        };

        console.log('[Carbon Debug] Accurate GHG breakdown calculated:', {
          fossil: fossilCO2.toFixed(3),
          biogenic: biogenicCO2.toFixed(3),
          luc: landUseChange.toFixed(3),
          ch4_kg: methaneTotal.toFixed(6),
          n2o_kg: nitrousOxideTotal.toFixed(6),
          total_check: (fossilCO2 + biogenicCO2 + landUseChange + (methaneTotal * 27.9) + (nitrousOxideTotal * 273)).toFixed(3)
        });

        console.log('[Carbon Debug] About to call setGhgBreakdown with data');
        setGhgBreakdown(ghgData);
        console.log('[Carbon Debug] setGhgBreakdown called');
      }

      console.log('[Carbon Debug] fetchMaterialAndGHGBreakdown completed successfully');
    } catch (err) {
      console.error('[Carbon Debug] Error fetching material and GHG breakdown:', err);
      console.error('[Carbon Debug] Error details:', { orgId: currentOrganization?.id, error: err });
    }
  }

  async function fetchFacilityEmissions() {
    try {
      console.log('[Carbon Debug] Starting fetchFacilityEmissions for org:', currentOrganization?.id);

      if (!currentOrganization?.id) {
        console.log('[Carbon Debug] No organization ID, skipping facility fetch');
        return;
      }

      // Fetch facility emissions from production sites linked to completed LCAs
      const { data: productionSites, error } = await supabase
        .from('product_lca_production_sites')
        .select(`
          facility_id,
          production_volume,
          share_of_production,
          facility_intensity,
          attributable_emissions_per_unit,
          facilities (
            id,
            name,
            location_city,
            location_country_code
          ),
          product_lcas!inner(status, organization_id)
        `)
        .eq('product_lcas.organization_id', currentOrganization.id)
        .eq('product_lcas.status', 'completed');

      if (error) {
        console.error('[Carbon Debug] Facility query error:', error);
        throw error;
      }

      console.log('[Carbon Debug] Facility query returned:', productionSites?.length || 0, 'production sites');

      if (!productionSites || productionSites.length === 0) {
        console.log('[Carbon Debug] No facility production data found');
        return;
      }

      // Aggregate by facility
      const facilityMap = new Map<string, {
        facility_name: string;
        location_city: string;
        location_country_code: string;
        total_emissions: number;
        production_volume: number;
        facility_intensity: number;
        site_count: number;
      }>();

      productionSites.forEach((site: any) => {
        if (!site.facilities) return;

        const facilityId = site.facility_id;
        const emissions = (site.attributable_emissions_per_unit || 0) * (site.production_volume || 0);

        if (!facilityMap.has(facilityId)) {
          facilityMap.set(facilityId, {
            facility_name: site.facilities.name,
            location_city: site.facilities.location_city,
            location_country_code: site.facilities.location_country_code,
            total_emissions: 0,
            production_volume: 0,
            facility_intensity: site.facility_intensity || 0,
            site_count: 0,
          });
        }

        const facility = facilityMap.get(facilityId)!;
        facility.total_emissions += emissions;
        facility.production_volume += Number(site.production_volume) || 0;
        facility.site_count += 1;
      });

      const totalEmissions = Array.from(facilityMap.values()).reduce((sum, f) => sum + f.total_emissions, 0);

      const facilityBreakdown: FacilityEmissionsBreakdown[] = Array.from(facilityMap.entries()).map(([facility_id, data]) => ({
        facility_id,
        facility_name: data.facility_name,
        location_city: data.location_city,
        location_country_code: data.location_country_code,
        total_emissions: data.total_emissions,
        percentage: totalEmissions > 0 ? (data.total_emissions / totalEmissions) * 100 : 0,
        production_volume: data.production_volume,
        share_of_production: 0, // Would need total production to calculate
        facility_intensity: data.facility_intensity,
        scope1_emissions: data.total_emissions * 0.3, // Estimate: 30% scope 1, 70% scope 2
        scope2_emissions: data.total_emissions * 0.7,
      })).sort((a, b) => b.total_emissions - a.total_emissions);

      console.log('[Carbon Debug] Facility breakdown:', facilityBreakdown.map(f => `${f.facility_name}: ${f.total_emissions.toFixed(3)} kg CO2eq`));

      setFacilityEmissionsBreakdown(facilityBreakdown);
    } catch (err) {
      console.error('[Carbon Debug] Error fetching facility emissions:', err);
      console.error('[Carbon Debug] Error details:', { orgId: currentOrganization?.id, error: err });
    }
  }

  return {
    metrics,
    scopeBreakdown,
    facilityWaterRisks,
    materialFlows,
    materialBreakdown,
    ghgBreakdown,
    lifecycleStageBreakdown,
    facilityEmissionsBreakdown,
    natureMetrics,
    loading,
    error,
    refetch: fetchCompanyMetrics,
  };
}
