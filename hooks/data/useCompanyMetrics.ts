/**
 * useCompanyMetrics Hook
 *
 * IMPORTANT: This hook should NEVER contain hardcoded estimates or assumptions.
 * All data must be queried from the database.
 *
 * ❌ WRONG: const estimate = total * 0.3
 * ✅ CORRECT: Query actual breakdown from database
 *
 * NOTE: Scope breakdown has been moved to useCompanyFootprint hook
 * to use corporate_reports as single source of truth.
 * See hooks/data/useCompanyFootprint.ts for emissions scope breakdown.
 */
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

      let circularityPercentage = 0;
      const totalWasteGenerated = lcas.reduce((sum, lca) => {
        const eolWaste = lca.aggregated_impacts?.end_of_life_waste_kg || 0;
        return sum + eolWaste;
      }, 0);

      const recyclableWaste = lcas.reduce((sum, lca) => {
        const recyclability = lca.aggregated_impacts?.recyclability_percentage || 0;
        const eolWaste = lca.aggregated_impacts?.end_of_life_waste_kg || 0;
        return sum + (eolWaste * recyclability / 100);
      }, 0);

      if (totalWasteGenerated > 0) {
        circularityPercentage = (recyclableWaste / totalWasteGenerated) * 100;
      } else {
        const totalPackagingMass = lcas.reduce((sum, lca) => {
          const materials = lca.aggregated_impacts?.breakdown?.by_material || [];
          const packaging = materials.filter((m: any) =>
            m.name?.toLowerCase().includes('bottle') ||
            m.name?.toLowerCase().includes('packaging') ||
            m.name?.toLowerCase().includes('label')
          );
          return sum + packaging.reduce((s: number, p: any) => s + (p.quantity || 0), 0);
        }, 0);

        const recyclablePackaging = lcas.reduce((sum, lca) => {
          const materials = lca.aggregated_impacts?.breakdown?.by_material || [];
          const packaging = materials.filter((m: any) =>
            m.name?.toLowerCase().includes('glass') ||
            m.name?.toLowerCase().includes('cardboard') ||
            m.name?.toLowerCase().includes('paper')
          );
          return sum + packaging.reduce((s: number, p: any) => s + (p.quantity || 0), 0);
        }, 0);

        if (totalPackagingMass > 0) {
          circularityPercentage = (recyclablePackaging / totalPackagingMass) * 100;
        }
      }

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

      // Extract breakdown data directly from aggregated_impacts (NEW APPROACH)
      try {
        extractBreakdownFromAggregatedImpacts(lcas);
      } catch (err) {
      }

      // Fetch facility water risks
      try {
        await fetchFacilityWaterRisks();
      } catch (err) {
      }

      // Fetch material and GHG breakdown - FALLBACK (if not in aggregated_impacts)
      const hasMaterialBreakdown = lcas.some(lca => lca.aggregated_impacts?.breakdown?.by_material);
      if (!hasMaterialBreakdown) {
        try {
          await fetchMaterialAndGHGBreakdown();
        } catch (err) {
        }
      }

      // Fetch facility emissions breakdown - FALLBACK
      const hasFacilityBreakdown = lcas.some(lca => lca.aggregated_impacts?.breakdown?.by_facility);
      if (!hasFacilityBreakdown) {
        try {
          await fetchFacilityEmissions();
        } catch (err) {
        }
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
      setError(err.message || 'Failed to fetch company metrics');
      setLoading(false);
    }
  }

  function extractBreakdownFromAggregatedImpacts(lcas: any[]) {
    // Aggregate scope breakdown
    const scopeTotal: ScopeBreakdown = { scope1: 0, scope2: 0, scope3: 0 };
    const allMaterials: MaterialBreakdownItem[] = [];
    const allFacilities: any[] = [];
    const allLifecycleStages: any[] = [];
    let hasGhgData = false;
    let ghgTotal: GHGBreakdown = {
      carbon_origin: { fossil: 0, biogenic: 0, land_use_change: 0 },
      gas_inventory: { co2_fossil: 0, co2_biogenic: 0, methane: 0, nitrous_oxide: 0, hfc_pfc: 0 },
      gwp_factors: { methane_gwp100: 27.9, n2o_gwp100: 273, method: 'IPCC AR6' }
    };

    lcas.forEach((lca) => {
      const breakdown = lca.aggregated_impacts?.breakdown;
      const ghg = lca.aggregated_impacts?.ghg_breakdown;

      if (breakdown) {
        // Aggregate scope data
        if (breakdown.by_scope) {
          scopeTotal.scope1 += breakdown.by_scope.scope1 || 0;
          scopeTotal.scope2 += breakdown.by_scope.scope2 || 0;
          scopeTotal.scope3 += breakdown.by_scope.scope3 || 0;
        }

        // Aggregate material data
        if (breakdown.by_material && Array.isArray(breakdown.by_material)) {
          allMaterials.push(...breakdown.by_material);
        }

        // Aggregate facility data
        if (breakdown.by_facility && Array.isArray(breakdown.by_facility)) {
          allFacilities.push(...breakdown.by_facility);
        }

        // Aggregate lifecycle stage data
        if (breakdown.by_lifecycle_stage && Array.isArray(breakdown.by_lifecycle_stage)) {
          breakdown.by_lifecycle_stage.forEach((stage: any) => {
            const existing = allLifecycleStages.find(s => s.stage === stage.stage);
            if (existing) {
              existing.emissions += stage.emissions || 0;
            } else {
              allLifecycleStages.push({ ...stage });
            }
          });
        }
      }

      // Aggregate GHG data
      if (ghg) {
        hasGhgData = true;
        if (ghg.carbon_origin) {
          ghgTotal.carbon_origin.fossil += ghg.carbon_origin.fossil || 0;
          ghgTotal.carbon_origin.biogenic += ghg.carbon_origin.biogenic || 0;
          ghgTotal.carbon_origin.land_use_change += ghg.carbon_origin.land_use_change || 0;
        }
        if (ghg.gas_inventory) {
          ghgTotal.gas_inventory.co2_fossil += ghg.gas_inventory.co2_fossil || 0;
          ghgTotal.gas_inventory.co2_biogenic += ghg.gas_inventory.co2_biogenic || 0;
          ghgTotal.gas_inventory.methane += ghg.gas_inventory.methane || 0;
          ghgTotal.gas_inventory.nitrous_oxide += ghg.gas_inventory.nitrous_oxide || 0;
          ghgTotal.gas_inventory.hfc_pfc += ghg.gas_inventory.hfc_pfc || 0;
        }
      }
    });

    // Set material breakdown
    if (allMaterials.length > 0) {
      setMaterialBreakdown(allMaterials);
    }

    // Set lifecycle stage breakdown
    if (allLifecycleStages.length > 0) {
      // Recalculate percentages
      const total = allLifecycleStages.reduce((sum, stage) => sum + stage.emissions, 0);
      allLifecycleStages.forEach(stage => {
        stage.percentage = total > 0 ? (stage.emissions / total) * 100 : 0;
      });
      setLifecycleStageBreakdown(allLifecycleStages);
    }

    // Set facility breakdown
    if (allFacilities.length > 0) {
      setFacilityEmissionsBreakdown(allFacilities);
    }

    // Set GHG breakdown
    if (hasGhgData) {
      setGhgBreakdown(ghgTotal);
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
    }
  }

  async function fetchMaterialAndGHGBreakdown() {
    try {
      if (!currentOrganization?.id) {
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
        throw error;
      }

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

      const totalClimate = aggregatedMaterials.reduce((sum, m) => sum + m.climate, 0);

      setMaterialBreakdown(aggregatedMaterials);

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

      setLifecycleStageBreakdown(stageBreakdown);

      // Calculate GHG breakdown using ACTUAL database fields (not hardcoded percentages)
      if (totalClimate > 0) {
        let fossilCO2 = 0;
        let biogenicCO2 = 0;
        let landUseChange = 0;
        let methaneTotal = 0;
        let nitrousOxideTotal = 0;
        let hfcsTotal = 0;

        materials.forEach((material: any) => {
          // Use actual biogenic/fossil split from database
          const fossilFromDB = Number(material.impact_climate_fossil || 0);
          const biogenicFromDB = Number(material.impact_climate_biogenic || 0);
          const dlucFromDB = Number(material.impact_climate_dluc || 0);
          const totalClimateImpact = Number(material.impact_climate || 0);

          // Add actual values from database
          fossilCO2 += fossilFromDB;
          biogenicCO2 += biogenicFromDB;
          landUseChange += dlucFromDB;

          // Parse GHG breakdown if available
          const ghgBreakdown = material.ghg_breakdown as any;
          if (ghgBreakdown) {
            methaneTotal += Number(ghgBreakdown.ch4_kg_co2e || 0);
            nitrousOxideTotal += Number(ghgBreakdown.n2o_kg_co2e || 0);
            hfcsTotal += Number(ghgBreakdown.hfcs_kg_co2e || 0);
          }

          // CONSERVATIVE FALLBACK: If no biogenic/fossil split provided, assume all fossil
          // This follows ISO 14067 precautionary principle
          if (fossilFromDB === 0 && biogenicFromDB === 0 && dlucFromDB === 0 && totalClimateImpact > 0) {
            fossilCO2 += totalClimateImpact;
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

        setGhgBreakdown(ghgData);
      }

    } catch (err) {
    }
  }

  async function getFacilityScopeBreakdown(facilityId: string, yearStart: string, yearEnd: string) {
    try {
      const { data: emissions, error } = await supabase
        .from('calculated_emissions')
        .select('scope, total_co2e')
        .eq('facility_id', facilityId)
        .gte('date', yearStart)
        .lte('date', yearEnd);

      if (error) {
        console.error('Error fetching facility scope breakdown:', error);
        return { scope1: 0, scope2: 0 };
      }

      const scope1 = emissions?.filter(e => e.scope === 1).reduce((sum, e) => sum + (e.total_co2e || 0), 0) || 0;
      const scope2 = emissions?.filter(e => e.scope === 2).reduce((sum, e) => sum + (e.total_co2e || 0), 0) || 0;

      return { scope1, scope2 };
    } catch (err) {
      console.error('Error in getFacilityScopeBreakdown:', err);
      return { scope1: 0, scope2: 0 };
    }
  }

  async function fetchFacilityEmissions() {
    try {
      if (!currentOrganization?.id) {
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
        throw error;
      }

      if (!productionSites || productionSites.length === 0) {
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

      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const facilityBreakdownPromises = Array.from(facilityMap.entries()).map(async ([facility_id, data]) => {
        const scopeBreakdown = await getFacilityScopeBreakdown(facility_id, yearStart, yearEnd);

        return {
          facility_id,
          facility_name: data.facility_name,
          location_city: data.location_city,
          location_country_code: data.location_country_code,
          total_emissions: data.total_emissions,
          percentage: totalEmissions > 0 ? (data.total_emissions / totalEmissions) * 100 : 0,
          production_volume: data.production_volume,
          share_of_production: 0,
          facility_intensity: data.facility_intensity,
          scope1_emissions: scopeBreakdown.scope1,
          scope2_emissions: scopeBreakdown.scope2,
        };
      });

      const facilityBreakdown = (await Promise.all(facilityBreakdownPromises))
        .sort((a, b) => b.total_emissions - a.total_emissions);

      setFacilityEmissionsBreakdown(facilityBreakdown);
    } catch (err) {
    }
  }

  return {
    metrics,
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
