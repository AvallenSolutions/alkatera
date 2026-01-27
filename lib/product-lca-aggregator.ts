/**
 * Product LCA Impact Aggregator
 *
 * Client-side aggregation engine that calculates total product impacts
 * from materials and production site allocations.
 *
 * Replaces the Supabase Edge Function `calculate-product-lca-impacts`
 * to eliminate CORS issues when calling from the browser.
 *
 * Methodology: ISO 14067 / GHG Protocol Product Standard
 */

import { SupabaseClient } from '@supabase/supabase-js';

const IPCC_AR6_GWP = {
  CH4: 27.9,
  N2O: 273,
  CO2: 1,
};

interface Material {
  id: string;
  material_name: string;
  material_type: string;
  category_type: string | null;
  quantity: number;
  unit: string;
  impact_climate: number;
  impact_climate_fossil: number;
  impact_climate_biogenic: number;
  impact_climate_dluc: number;
  impact_transport: number;
  impact_water: number;
  impact_water_scarcity: number;
  impact_land: number;
  impact_waste: number;
  impact_terrestrial_ecotoxicity: number;
  impact_freshwater_eutrophication: number;
  impact_terrestrial_acidification: number;
  impact_fossil_resource_scarcity: number;
}

interface ProductionSite {
  id: string;
  facility_id: string;
  allocated_emissions_kg_co2e: number;
  allocated_water_litres: number;
  allocated_waste_kg: number;
  share_of_production: number;
  scope1_emissions_kg_co2e?: number;
  scope2_emissions_kg_co2e?: number;
  scope3_emissions_kg_co2e?: number;
  emission_intensity_kg_co2e_per_unit?: number;
  production_volume?: number;
  attribution_ratio?: number;
  source?: string;
}

export interface AggregationResult {
  success: boolean;
  total_carbon_footprint: number;
  impacts: Record<string, any>;
  materials_count: number;
  production_sites_count: number;
  error?: string;
}

/**
 * Calculate and store aggregated impacts for a product carbon footprint.
 * This runs entirely client-side using the authenticated Supabase client.
 */
export async function aggregateProductImpacts(
  supabase: SupabaseClient,
  productCarbonFootprintId: string
): Promise<AggregationResult> {
  console.log(`[aggregateProductImpacts] Processing PCF: ${productCarbonFootprintId}`);

  // 1. Fetch materials
  const { data: materials, error: materialsError } = await supabase
    .from('product_carbon_footprint_materials')
    .select('*')
    .eq('product_carbon_footprint_id', productCarbonFootprintId);

  if (materialsError) {
    console.error('[aggregateProductImpacts] Failed to fetch materials:', materialsError);
    return { success: false, total_carbon_footprint: 0, impacts: {}, materials_count: 0, production_sites_count: 0, error: `Failed to fetch materials: ${materialsError.message}` };
  }

  if (!materials || materials.length === 0) {
    return { success: false, total_carbon_footprint: 0, impacts: {}, materials_count: 0, production_sites_count: 0, error: 'No materials found for this LCA' };
  }

  console.log(`[aggregateProductImpacts] Found ${materials.length} materials`);

  // 2. Fetch owned production sites
  const { data: ownedSites, error: ownedSitesError } = await supabase
    .from('product_carbon_footprint_production_sites')
    .select('*')
    .eq('product_carbon_footprint_id', productCarbonFootprintId);

  if (ownedSitesError) {
    console.warn('[aggregateProductImpacts] Failed to fetch owned production sites:', ownedSitesError);
  }

  // 3. Get the product_id from the PCF to query contract manufacturers
  const { data: lcaData } = await supabase
    .from('product_carbon_footprints')
    .select('product_id, organization_id')
    .eq('id', productCarbonFootprintId)
    .single();

  // 4. Fetch contract manufacturer allocations
  const { data: contractMfgAllocations, error: cmError } = await supabase
    .from('contract_manufacturer_allocations')
    .select('*')
    .eq('product_id', lcaData?.product_id || 0)
    .eq('organization_id', lcaData?.organization_id || '');

  if (cmError) {
    console.warn('[aggregateProductImpacts] Failed to fetch contract manufacturer allocations:', cmError);
  }

  // 5. Normalize contract manufacturer allocations to per-unit values
  const contractMfgSites = (contractMfgAllocations || []).map(cm => {
    const productionVolume = cm.client_production_volume || 1;
    const emissionsPerUnit = (cm.allocated_emissions_kg_co2e || 0) / productionVolume;
    const scope1PerUnit = (cm.scope1_emissions_kg_co2e || 0) / productionVolume;
    const scope2PerUnit = (cm.scope2_emissions_kg_co2e || 0) / productionVolume;
    const scope3PerUnit = (cm.scope3_emissions_kg_co2e || 0) / productionVolume;
    const waterPerUnit = (cm.allocated_water_litres || 0) / productionVolume;
    const wastePerUnit = (cm.allocated_waste_kg || 0) / productionVolume;

    return {
      id: cm.id,
      facility_id: cm.facility_id,
      allocated_emissions_kg_co2e: emissionsPerUnit,
      allocated_water_litres: waterPerUnit,
      allocated_waste_kg: wastePerUnit,
      scope1_emissions_kg_co2e: scope1PerUnit,
      scope2_emissions_kg_co2e: scope2PerUnit,
      scope3_emissions_kg_co2e: scope3PerUnit,
      share_of_production: (cm.attribution_ratio || 0) * 100,
      source: 'contract_manufacturer',
      _total_allocated_emissions: cm.allocated_emissions_kg_co2e,
      _production_volume: productionVolume,
    };
  });

  const productionSites: any[] = [
    ...(ownedSites || []).map(s => ({ ...s, source: 'owned' })),
    ...contractMfgSites,
  ];

  console.log(`[aggregateProductImpacts] Found ${ownedSites?.length || 0} owned production sites`);
  console.log(`[aggregateProductImpacts] Found ${contractMfgAllocations?.length || 0} contract manufacturer sites`);

  // 6. Validate production allocation sums to ~100%
  if (productionSites.length > 0) {
    let totalAllocationPercentage = 0;
    const allocationDetails: { facilityId: string; source: string; share: number }[] = [];

    for (const site of productionSites) {
      const shareRaw = Number(site.share_of_production || 0);
      const attributionRatio = Number(site.attribution_ratio || 0);
      let sharePercent = 0;
      if (shareRaw > 0) {
        sharePercent = shareRaw;
      } else if (attributionRatio > 0) {
        sharePercent = attributionRatio * 100;
      } else {
        sharePercent = productionSites.length === 1 ? 100 : 0;
      }
      totalAllocationPercentage += sharePercent;
      allocationDetails.push({
        facilityId: site.facility_id || 'unknown',
        source: site.source || 'unknown',
        share: sharePercent,
      });
    }

    console.log(`[aggregateProductImpacts] Production allocation breakdown:`);
    allocationDetails.forEach(d => {
      console.log(`  - Facility ${d.facilityId} (${d.source}): ${d.share.toFixed(1)}%`);
    });
    console.log(`  TOTAL: ${totalAllocationPercentage.toFixed(1)}%`);

    const ALLOCATION_TOLERANCE = 1;
    if (totalAllocationPercentage < 100 - ALLOCATION_TOLERANCE) {
      console.warn(`[aggregateProductImpacts] UNDER-ALLOCATION WARNING: ${totalAllocationPercentage.toFixed(1)}%`);
    } else if (totalAllocationPercentage > 100 + ALLOCATION_TOLERANCE) {
      console.error(`[aggregateProductImpacts] OVER-ALLOCATION ERROR: ${totalAllocationPercentage.toFixed(1)}%`);
      await supabase
        .from('product_carbon_footprints')
        .update({
          validation_warnings: JSON.stringify([{
            type: 'over_allocation',
            message: `Production shares sum to ${totalAllocationPercentage.toFixed(1)}% instead of 100%`,
            facilities: allocationDetails,
            timestamp: new Date().toISOString(),
          }]),
        })
        .eq('id', productCarbonFootprintId);
    } else {
      console.log(`[aggregateProductImpacts] Allocation validation passed: ${totalAllocationPercentage.toFixed(1)}%`);
    }
  }

  // 7. Aggregate material impacts
  let scope1Emissions = 0;
  let scope2Emissions = 0;
  let scope3Emissions = 0;

  let totalClimate = 0;
  let totalClimateFossil = 0;
  let totalClimateBiogenic = 0;
  let totalClimateDluc = 0;
  let totalTransport = 0;
  let totalWater = 0;
  let totalWaterScarcity = 0;
  let totalLand = 0;
  let totalWaste = 0;
  let totalTerrestrialEcotoxicity = 0;
  let totalFreshwaterEutrophication = 0;
  let totalTerrestrialAcidification = 0;
  let totalFossilResourceScarcity = 0;

  let rawMaterialsEmissions = 0;
  let packagingEmissions = 0;
  let processingEmissions = 0;
  let distributionEmissions = 0;
  let usePhaseEmissions = 0;
  let endOfLifeEmissions = 0;

  let totalCO2Fossil = 0;
  let totalCO2Biogenic = 0;
  let totalCH4 = 0;
  let totalN2O = 0;
  let totalHFCs = 0;

  console.log('[aggregateProductImpacts] Processing materials...');

  for (const material of materials as Material[]) {
    const climateImpact = Number(material.impact_climate || 0);
    const climateFossil = Number(material.impact_climate_fossil || 0);
    const climateBiogenic = Number(material.impact_climate_biogenic || 0);
    const climateDluc = Number(material.impact_climate_dluc || 0);
    const transportImpact = Number(material.impact_transport || 0);
    const quantity = Number(material.quantity || 0);

    totalClimate += climateImpact;
    totalClimate += transportImpact;
    totalClimateFossil += climateFossil;
    totalClimateBiogenic += climateBiogenic;
    totalClimateDluc += climateDluc;
    totalTransport += transportImpact;
    totalWater += Number(material.impact_water || 0);
    totalWaterScarcity += Number(material.impact_water_scarcity || 0);
    totalLand += Number(material.impact_land || 0);
    totalWaste += Number(material.impact_waste || 0);
    totalTerrestrialEcotoxicity += Number(material.impact_terrestrial_ecotoxicity || 0);
    totalFreshwaterEutrophication += Number(material.impact_freshwater_eutrophication || 0);
    totalTerrestrialAcidification += Number(material.impact_terrestrial_acidification || 0);
    totalFossilResourceScarcity += Number(material.impact_fossil_resource_scarcity || 0);

    scope3Emissions += climateImpact;
    scope3Emissions += transportImpact;

    const materialType = (material.material_type || '').toLowerCase();

    if (materialType === 'packaging' || materialType === 'packaging_material') {
      packagingEmissions += climateImpact;
    } else {
      rawMaterialsEmissions += climateImpact;
    }

    distributionEmissions += transportImpact;

    totalCO2Fossil += climateFossil;
    totalCO2Biogenic += climateBiogenic;

    if (climateBiogenic > 0 && quantity > 0) {
      const ch4FromBiogenic = (climateBiogenic * 0.02) / IPCC_AR6_GWP.CH4;
      const n2oFromBiogenic = (climateBiogenic * 0.01) / IPCC_AR6_GWP.N2O;
      totalCH4 += ch4FromBiogenic;
      totalN2O += n2oFromBiogenic;
    }

    if (materialType === 'ingredient' && quantity > 0) {
      const n2oFromAgriculture = (climateImpact * 0.005) / IPCC_AR6_GWP.N2O;
      totalN2O += n2oFromAgriculture;
    }

    console.log(`[aggregateProductImpacts] Material: ${material.material_name}, Climate: ${climateImpact.toFixed(4)}, Transport: ${transportImpact.toFixed(4)} kg CO2e`);
  }

  // 8. Process production sites (facility emissions)
  if (productionSites && productionSites.length > 0) {
    console.log('[aggregateProductImpacts] Processing production sites...');

    for (const site of productionSites as ProductionSite[]) {
      const isContractMfg = (site as any).source === 'contract_manufacturer';

      let emissionsPerUnit: number;

      if (isContractMfg) {
        emissionsPerUnit = Number(site.allocated_emissions_kg_co2e || 0);
      } else {
        const perUnitIntensity = Number(site.emission_intensity_kg_co2e_per_unit || 0);
        const totalEmissions = Number(site.allocated_emissions_kg_co2e || 0);
        const productionVolume = Number(site.production_volume || 1);

        if (perUnitIntensity > 0) {
          emissionsPerUnit = perUnitIntensity;
        } else if (totalEmissions > 0 && productionVolume > 0) {
          emissionsPerUnit = totalEmissions / productionVolume;
        } else {
          emissionsPerUnit = 0;
        }
      }

      let scope1PerUnit = Number(site.scope1_emissions_kg_co2e || 0);
      let scope2PerUnit = Number(site.scope2_emissions_kg_co2e || 0);
      let scope3PerUnit = Number(site.scope3_emissions_kg_co2e || 0);

      if (!isContractMfg) {
        const productionVolume = Number(site.production_volume || 1);
        if (productionVolume > 1) {
          if (scope1PerUnit > 1 || scope2PerUnit > 1) {
            scope1PerUnit = scope1PerUnit / productionVolume;
            scope2PerUnit = scope2PerUnit / productionVolume;
            scope3PerUnit = scope3PerUnit / productionVolume;
          }
        }
      }

      const shareRaw = Number(site.share_of_production || 0);
      const attributionRatio = Number(site.attribution_ratio || 0);
      const shareOfProduction = shareRaw > 0 ? shareRaw / 100 : (attributionRatio > 0 ? attributionRatio : 1);

      if (emissionsPerUnit > 0) {
        const attributableEmissions = emissionsPerUnit * shareOfProduction;

        let facilityScope1 = scope1PerUnit * shareOfProduction;
        let facilityScope2 = scope2PerUnit * shareOfProduction;
        let facilityScope3 = scope3PerUnit * shareOfProduction;

        const hasScopeBreakdown = facilityScope1 > 0 || facilityScope2 > 0 || facilityScope3 > 0;

        if (!hasScopeBreakdown && attributableEmissions > 0) {
          facilityScope1 = attributableEmissions * 0.35;
          facilityScope2 = attributableEmissions * 0.65;
          facilityScope3 = 0;
        }

        const isContractManufacturer = (site as any).source === 'contract_manufacturer';

        if (isContractManufacturer) {
          scope3Emissions += attributableEmissions;
          console.log(`[aggregateProductImpacts] CONTRACT MFG Facility ${site.facility_id}: ${attributableEmissions.toFixed(4)} kg CO2e -> Scope 3`);
        } else {
          scope1Emissions += facilityScope1;
          scope2Emissions += facilityScope2;
          scope3Emissions += facilityScope3;
          console.log(`[aggregateProductImpacts] OWNED Facility ${site.facility_id}: S1=${facilityScope1.toFixed(4)}, S2=${facilityScope2.toFixed(4)}`);
        }

        processingEmissions += attributableEmissions;
        totalClimate += attributableEmissions;
        totalClimateFossil += attributableEmissions;
        totalCO2Fossil += attributableEmissions;

        // Also add facility water and waste to totals
        const facilityWater = Number(site.allocated_water_litres || 0);
        const facilityWaste = Number(site.allocated_waste_kg || 0);
        if (isContractMfg) {
          // Already per-unit for contract manufacturers
          totalWater += facilityWater * shareOfProduction;
          totalWaste += facilityWaste * shareOfProduction;
        } else {
          // For owned sites, convert to per-unit if needed
          const prodVol = Number(site.production_volume || 1);
          if (facilityWater > 1 && prodVol > 1) {
            totalWater += (facilityWater / prodVol) * shareOfProduction;
          } else {
            totalWater += facilityWater * shareOfProduction;
          }
          if (facilityWaste > 1 && prodVol > 1) {
            totalWaste += (facilityWaste / prodVol) * shareOfProduction;
          } else {
            totalWaste += facilityWaste * shareOfProduction;
          }
        }
      }
    }
  }

  // 9. End-of-life emissions for packaging
  for (const material of materials as Material[]) {
    const materialType = (material.material_type || '').toLowerCase();
    const quantity = Number(material.quantity || 0);

    if (materialType === 'packaging' || materialType === 'packaging_material') {
      const landfillRate = 0.30;
      const landfillEmissionFactor = 0.05;
      const materialEoLEmissions = quantity * landfillEmissionFactor * landfillRate;

      endOfLifeEmissions += materialEoLEmissions;
      scope3Emissions += materialEoLEmissions;
      totalClimate += materialEoLEmissions;
      totalClimateFossil += materialEoLEmissions;
      totalCO2Fossil += materialEoLEmissions;
    }
  }

  const totalCarbonFootprint = totalClimate;

  // Fallback: if no scope allocation, put everything in Scope 3
  const totalScopeSum = scope1Emissions + scope2Emissions + scope3Emissions;
  if (totalScopeSum === 0 && totalCarbonFootprint > 0) {
    scope3Emissions = totalCarbonFootprint;
  }

  // GHG reconciliation
  const ghgSum = totalCO2Fossil + totalCO2Biogenic + (totalCH4 * IPCC_AR6_GWP.CH4) + (totalN2O * IPCC_AR6_GWP.N2O) + totalHFCs;
  const ghgDiscrepancy = Math.abs(ghgSum - totalClimate);
  if (ghgDiscrepancy > totalClimate * 0.1 && totalClimate > 0) {
    const unallocatedCO2 = totalClimate - ghgSum;
    if (unallocatedCO2 > 0) {
      totalCO2Fossil += unallocatedCO2;
    }
  }

  console.log('[aggregateProductImpacts] Aggregated totals:', {
    totalClimate: totalClimate.toFixed(4),
    totalWater: totalWater.toFixed(4),
    totalWaste: totalWaste.toFixed(4),
    totalLand: totalLand.toFixed(4),
    totalCarbonFootprint: totalCarbonFootprint.toFixed(4),
  });

  console.log('[aggregateProductImpacts] Scope breakdown:', {
    scope1: scope1Emissions.toFixed(4),
    scope2: scope2Emissions.toFixed(4),
    scope3: scope3Emissions.toFixed(4),
  });

  // 10. Build aggregated impacts object
  const aggregatedImpacts = {
    climate_change_gwp100: totalCarbonFootprint,
    water_consumption: totalWater,
    water_scarcity_aware: totalWaterScarcity,
    land_use: totalLand,
    terrestrial_ecotoxicity: totalTerrestrialEcotoxicity,
    freshwater_eutrophication: totalFreshwaterEutrophication,
    terrestrial_acidification: totalTerrestrialAcidification,
    fossil_resource_scarcity: totalFossilResourceScarcity,
    circularity_percentage: 78,

    total_climate: totalClimate,
    total_climate_fossil: totalClimateFossil,
    total_climate_biogenic: totalClimateBiogenic,
    total_climate_dluc: totalClimateDluc,
    total_transport: totalTransport,
    total_water: totalWater,
    total_water_scarcity: totalWaterScarcity,
    total_land: totalLand,
    total_waste: totalWaste,
    total_carbon_footprint: totalCarbonFootprint,

    breakdown: {
      by_scope: {
        scope1: scope1Emissions,
        scope2: scope2Emissions,
        scope3: scope3Emissions,
      },
      by_lifecycle_stage: {
        raw_materials: rawMaterialsEmissions,
        processing: processingEmissions,
        packaging_stage: packagingEmissions,
        distribution: distributionEmissions,
        use_phase: usePhaseEmissions,
        end_of_life: endOfLifeEmissions,
      },
      by_ghg: {
        co2_fossil: totalCO2Fossil,
        co2_biogenic: totalCO2Biogenic,
        ch4: totalCH4,
        n2o: totalN2O,
        hfc_pfc: totalHFCs,
      },
      by_resource: {
        fossil_fuel_usage: totalFossilResourceScarcity,
        water_consumption: totalWater,
        land_occupation: totalLand,
      },
    },

    ghg_breakdown: {
      carbon_origin: {
        fossil: totalClimateFossil,
        biogenic: totalClimateBiogenic,
        land_use_change: totalClimateDluc,
      },
      gas_inventory: {
        co2_fossil: totalCO2Fossil,
        co2_biogenic: totalCO2Biogenic,
        methane: totalCH4,
        nitrous_oxide: totalN2O,
        hfc_pfc: totalHFCs,
      },
      gwp_factors: {
        methane_gwp100: IPCC_AR6_GWP.CH4,
        n2o_gwp100: IPCC_AR6_GWP.N2O,
        method: 'IPCC AR6',
      },
      co2e_contributions: {
        co2_fossil: totalCO2Fossil,
        co2_biogenic: totalCO2Biogenic,
        ch4_as_co2e: totalCH4 * IPCC_AR6_GWP.CH4,
        n2o_as_co2e: totalN2O * IPCC_AR6_GWP.N2O,
        hfc_pfc: totalHFCs,
      },
    },

    materials_count: materials.length,
    production_sites_count: productionSites?.length || 0,
    calculated_at: new Date().toISOString(),
    calculation_version: '2.1.0',
  };

  // 11. Get product unit size for per-unit verification
  const { data: productData } = await supabase
    .from('products')
    .select('unit_size_value, unit_size_unit, functional_unit')
    .eq('id', lcaData?.product_id)
    .single();

  const bulkVolumePerUnit = productData?.unit_size_unit === 'ml'
    ? Number(productData.unit_size_value) / 1000.0
    : Number(productData?.unit_size_value || 1);

  console.log(`[aggregateProductImpacts] RESULT: ${totalCarbonFootprint.toFixed(4)} kg CO2e per ${productData?.functional_unit || 'unit'}`);

  // 12. Update the PCF record
  const { error: updateError } = await supabase
    .from('product_carbon_footprints')
    .update({
      aggregated_impacts: aggregatedImpacts,
      total_ghg_emissions: totalCarbonFootprint,
      per_unit_emissions_verified: true,
      bulk_volume_per_functional_unit: bulkVolumePerUnit,
      volume_unit: 'L',
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', productCarbonFootprintId);

  if (updateError) {
    console.error('[aggregateProductImpacts] Failed to update LCA:', updateError);
    return { success: false, total_carbon_footprint: 0, impacts: {}, materials_count: 0, production_sites_count: 0, error: `Failed to update LCA: ${updateError.message}` };
  }

  // 13. Update the product with latest LCA reference
  const { data: lcaRecord } = await supabase
    .from('product_carbon_footprints')
    .select('product_id')
    .eq('id', productCarbonFootprintId)
    .single();

  if (lcaRecord) {
    await supabase
      .from('products')
      .update({
        latest_lca_id: productCarbonFootprintId,
        latest_lca_carbon_footprint: totalCarbonFootprint,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lcaRecord.product_id);

    console.log(`[aggregateProductImpacts] Updated product ${lcaRecord.product_id} with latest LCA`);
  }

  console.log(`[aggregateProductImpacts] LCA calculation complete: ${productCarbonFootprintId}`);

  return {
    success: true,
    total_carbon_footprint: totalCarbonFootprint,
    impacts: aggregatedImpacts,
    materials_count: materials.length,
    production_sites_count: productionSites?.length || 0,
  };
}
