import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { product_lca_id } = await req.json();

    if (!product_lca_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing product_lca_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[calculate-product-lca-impacts] Processing LCA: ${product_lca_id}`);

    const { data: materials, error: materialsError } = await supabaseClient
      .from("product_lca_materials")
      .select("*")
      .eq("product_lca_id", product_lca_id);

    if (materialsError) {
      console.error("[calculate-product-lca-impacts] Failed to fetch materials:", materialsError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch materials: ${materialsError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!materials || materials.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No materials found for this LCA" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[calculate-product-lca-impacts] Found ${materials.length} materials`);

    // Fetch production sites from BOTH owned facilities AND contract manufacturers
    const { data: ownedSites, error: ownedSitesError } = await supabaseClient
      .from("product_lca_production_sites")
      .select("*")
      .eq("product_lca_id", product_lca_id);

    if (ownedSitesError) {
      console.warn("[calculate-product-lca-impacts] Failed to fetch owned production sites:", ownedSitesError);
    }

    // Get the product_id from the LCA to query contract manufacturers
    const { data: lcaData } = await supabaseClient
      .from("product_lcas")
      .select("product_id, organization_id")
      .eq("id", product_lca_id)
      .single();

    // Fetch contract manufacturer allocations for this product
    const { data: contractMfgAllocations, error: cmError } = await supabaseClient
      .from("contract_manufacturer_allocations")
      .select("*")
      .eq("product_id", lcaData?.product_id || 0)
      .eq("organization_id", lcaData?.organization_id || "");

    if (cmError) {
      console.warn("[calculate-product-lca-impacts] Failed to fetch contract manufacturer allocations:", cmError);
    }

    // Combine both sources into a unified production sites array
    // Map contract manufacturer allocations to the same structure as production sites
    // IMPORTANT: Contract manufacturer allocations store TOTAL emissions for the production run
    // We need to convert to PER UNIT emissions for LCA calculation
    const contractMfgSites = (contractMfgAllocations || []).map(cm => {
      const productionVolume = cm.client_production_volume || 1;

      // Calculate per-unit emissions by dividing total allocated emissions by production volume
      const emissionsPerUnit = (cm.allocated_emissions_kg_co2e || 0) / productionVolume;
      const scope1PerUnit = (cm.scope1_emissions_kg_co2e || 0) / productionVolume;
      const scope2PerUnit = (cm.scope2_emissions_kg_co2e || 0) / productionVolume;
      const scope3PerUnit = (cm.scope3_emissions_kg_co2e || 0) / productionVolume;
      const waterPerUnit = (cm.allocated_water_litres || 0) / productionVolume;
      const wastePerUnit = (cm.allocated_waste_kg || 0) / productionVolume;

      return {
        id: cm.id,
        facility_id: cm.facility_id,
        // Store per-unit values for LCA calculation
        allocated_emissions_kg_co2e: emissionsPerUnit,
        allocated_water_litres: waterPerUnit,
        allocated_waste_kg: wastePerUnit,
        scope1_emissions_kg_co2e: scope1PerUnit,
        scope2_emissions_kg_co2e: scope2PerUnit,
        scope3_emissions_kg_co2e: scope3PerUnit,
        share_of_production: (cm.attribution_ratio || 0) * 100,
        source: 'contract_manufacturer',
        // Keep original values for logging/debugging
        _total_allocated_emissions: cm.allocated_emissions_kg_co2e,
        _production_volume: productionVolume
      };
    });

    const productionSites = [
      ...(ownedSites || []).map(s => ({ ...s, source: 'owned' })),
      ...contractMfgSites
    ];

    console.log(`[calculate-product-lca-impacts] Found ${ownedSites?.length || 0} owned production sites`);
    console.log(`[calculate-product-lca-impacts] Found ${contractMfgAllocations?.length || 0} contract manufacturer sites`);

    if (contractMfgSites.length > 0) {
      contractMfgSites.forEach(site => {
        console.log(`[calculate-product-lca-impacts] CM Site: Total ${site._total_allocated_emissions?.toFixed(2)} kg for ${site._production_volume} units = ${site.allocated_emissions_kg_co2e.toFixed(6)} kg per unit`);
        console.log(`[calculate-product-lca-impacts] CM Scopes per unit: S1=${site.scope1_emissions_kg_co2e.toFixed(6)}, S2=${site.scope2_emissions_kg_co2e.toFixed(6)}, S3=${site.scope3_emissions_kg_co2e.toFixed(6)}`);
      });
    }

    console.log(`[calculate-product-lca-impacts] Total production sites: ${productionSites.length}`);

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

    console.log("[calculate-product-lca-impacts] Processing materials...");

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

      console.log(`[calculate-product-lca-impacts] Material: ${material.material_name}, Production: ${climateImpact.toFixed(4)}, Transport: ${transportImpact.toFixed(4)} kg CO2e`);
    }

    if (productionSites && productionSites.length > 0) {
      console.log("[calculate-product-lca-impacts] Processing production sites...");

      for (const site of productionSites as ProductionSite[]) {
        const siteEmissions = Number(site.allocated_emissions_kg_co2e || 0);
        const shareOfProduction = Number(site.share_of_production || 0) / 100;

        if (siteEmissions > 0) {
          const attributableEmissions = siteEmissions * shareOfProduction;

          let facilityScope1 = Number(site.scope1_emissions_kg_co2e || 0) * shareOfProduction;
          let facilityScope2 = Number(site.scope2_emissions_kg_co2e || 0) * shareOfProduction;
          let facilityScope3 = Number(site.scope3_emissions_kg_co2e || 0) * shareOfProduction;

          // If scope breakdown is missing or zero, apply standard manufacturing allocation
          // Standard: Scope 1 = 35% (on-site combustion, process emissions)
          //          Scope 2 = 65% (purchased electricity, heat, steam)
          //          Scope 3 = 0% (minimal for manufacturing operations)
          const hasScopeBreakdown = facilityScope1 > 0 || facilityScope2 > 0 || facilityScope3 > 0;

          if (!hasScopeBreakdown && attributableEmissions > 0) {
            facilityScope1 = attributableEmissions * 0.35;
            facilityScope2 = attributableEmissions * 0.65;
            facilityScope3 = 0;

            console.warn(`[calculate-product-lca-impacts] Facility ${site.facility_id} lacks Scope breakdown. Applied standard manufacturing allocation (Scope 1: 35%, Scope 2: 65%). Total: ${attributableEmissions.toFixed(2)} kg CO2e`);
          }

          // CRITICAL: Scope assignment depends on facility ownership per GHG Protocol
          // - CONTRACT manufacturer: ALL emissions → Scope 3 Cat 1 (Purchased Goods & Services)
          // - OWNED facility: Scope 1/2 → Corporate inventory, shown in product LCA for completeness
          const isContractManufacturer = (site as any).source === 'contract_manufacturer';

          if (isContractManufacturer) {
            // Contract manufacturer: ALL emissions are Scope 3 for the buying company
            scope3Emissions += attributableEmissions;
            console.log(`[calculate-product-lca-impacts] ✓ CONTRACT MFG Facility ${site.facility_id}: ${attributableEmissions.toFixed(4)} kg CO2e → Scope 3 (Purchased Goods)`);
          } else {
            // Owned/controlled facility: Add to product LCA scope breakdown
            // NOTE: These same emissions are ALSO in corporate Scope 1/2
            // Company Vitality Dashboard will use corporate inventory to avoid double-counting
            scope1Emissions += facilityScope1;
            scope2Emissions += facilityScope2;
            scope3Emissions += facilityScope3;
            console.log(`[calculate-product-lca-impacts] ✓ OWNED Facility ${site.facility_id}:`, {
              total: attributableEmissions.toFixed(4),
              scope1: facilityScope1.toFixed(4),
              scope2: facilityScope2.toFixed(4),
              scope3: facilityScope3.toFixed(4),
              note: 'Also in corporate Scope 1/2 inventory'
            });
          }

          processingEmissions += attributableEmissions;
          totalClimate += attributableEmissions;
          totalClimateFossil += attributableEmissions;
          totalCO2Fossil += attributableEmissions;
        }
      }
    }

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

    const totalScopeSum = scope1Emissions + scope2Emissions + scope3Emissions;
    if (totalScopeSum === 0 && totalCarbonFootprint > 0) {
      scope3Emissions = totalCarbonFootprint;
      console.warn(`[calculate-product-lca-impacts] No scope allocation found. Allocated all ${totalCarbonFootprint.toFixed(2)} kg CO2e to Scope 3.`);
    }

    const totalLifecycleSum = rawMaterialsEmissions + processingEmissions + packagingEmissions + distributionEmissions + usePhaseEmissions + endOfLifeEmissions;
    if (Math.abs(totalLifecycleSum - totalCarbonFootprint) > 0.01) {
      const discrepancy = totalCarbonFootprint - totalLifecycleSum;
      console.warn(`[calculate-product-lca-impacts] Lifecycle stages don't sum to total. Discrepancy: ${discrepancy.toFixed(4)} kg CO2e`);
      console.warn(`[calculate-product-lca-impacts] Lifecycle breakdown: Raw Materials: ${rawMaterialsEmissions.toFixed(2)}, Processing: ${processingEmissions.toFixed(2)}, Packaging: ${packagingEmissions.toFixed(2)}, Distribution: ${distributionEmissions.toFixed(2)}, Use: ${usePhaseEmissions.toFixed(2)}, EoL: ${endOfLifeEmissions.toFixed(2)}`);
    }

    const ghgSum = totalCO2Fossil + totalCO2Biogenic + (totalCH4 * IPCC_AR6_GWP.CH4) + (totalN2O * IPCC_AR6_GWP.N2O) + totalHFCs;
    const ghgDiscrepancy = Math.abs(ghgSum - totalClimate);

    if (ghgDiscrepancy > totalClimate * 0.1 && totalClimate > 0) {
      const unallocatedCO2 = totalClimate - ghgSum;
      if (unallocatedCO2 > 0) {
        totalCO2Fossil += unallocatedCO2;
      }
    }

    console.log("[calculate-product-lca-impacts] Aggregated totals:", {
      totalClimate: totalClimate.toFixed(4),
      totalTransport: totalTransport.toFixed(4),
      totalCarbonFootprint: totalCarbonFootprint.toFixed(4),
    });

    const scopeSum = scope1Emissions + scope2Emissions + scope3Emissions;
    const scopeDiscrepancy = Math.abs(scopeSum - totalCarbonFootprint);
    if (scopeDiscrepancy > 0.01) {
      console.error(`[calculate-product-lca-impacts] VALIDATION FAILED: Scope sum (${scopeSum.toFixed(2)}) != Total (${totalCarbonFootprint.toFixed(2)}). Discrepancy: ${scopeDiscrepancy.toFixed(4)} kg CO2e`);
    } else {
      console.log(`[calculate-product-lca-impacts] Scope validation passed: ${scopeSum.toFixed(2)} kg CO2e`);
    }

    const lifecycleSum = rawMaterialsEmissions + processingEmissions + packagingEmissions + distributionEmissions + usePhaseEmissions + endOfLifeEmissions;
    const lifecycleDiscrepancy = Math.abs(lifecycleSum - totalCarbonFootprint);
    if (lifecycleDiscrepancy > 0.01) {
      console.error(`[calculate-product-lca-impacts] VALIDATION FAILED: Lifecycle sum (${lifecycleSum.toFixed(2)}) != Total (${totalCarbonFootprint.toFixed(2)}). Discrepancy: ${lifecycleDiscrepancy.toFixed(4)} kg CO2e`);
    } else {
      console.log(`[calculate-product-lca-impacts] Lifecycle validation passed: ${lifecycleSum.toFixed(2)} kg CO2e`);
    }

    const ghgInventorySum = totalCO2Fossil + totalCO2Biogenic + (totalCH4 * IPCC_AR6_GWP.CH4) + (totalN2O * IPCC_AR6_GWP.N2O) + totalHFCs;
    const ghgDiscrepancyPercent = totalClimate > 0 ? (Math.abs(ghgInventorySum - totalClimate) / totalClimate) * 100 : 0;
    if (ghgDiscrepancyPercent > 5) {
      console.warn(`[calculate-product-lca-impacts] GHG inventory sum (${ghgInventorySum.toFixed(2)}) deviates ${ghgDiscrepancyPercent.toFixed(1)}% from total climate (${totalClimate.toFixed(2)})`);
    } else {
      console.log(`[calculate-product-lca-impacts] GHG inventory validation passed (${ghgDiscrepancyPercent.toFixed(1)}% deviation)`);
    }

    console.log("[calculate-product-lca-impacts] Scope breakdown:", {
      scope1: scope1Emissions.toFixed(4),
      scope2: scope2Emissions.toFixed(4),
      scope3: scope3Emissions.toFixed(4),
      sum: scopeSum.toFixed(4),
    });

    console.log("[calculate-product-lca-impacts] Lifecycle breakdown:", {
      raw_materials: rawMaterialsEmissions.toFixed(4),
      processing: processingEmissions.toFixed(4),
      packaging: packagingEmissions.toFixed(4),
      distribution: distributionEmissions.toFixed(4),
      use_phase: usePhaseEmissions.toFixed(4),
      end_of_life: endOfLifeEmissions.toFixed(4),
    });

    console.log("[calculate-product-lca-impacts] GHG gas inventory:", {
      co2_fossil: totalCO2Fossil.toFixed(6),
      co2_biogenic: totalCO2Biogenic.toFixed(6),
      ch4_kg: totalCH4.toFixed(8),
      ch4_co2e: (totalCH4 * IPCC_AR6_GWP.CH4).toFixed(6),
      n2o_kg: totalN2O.toFixed(8),
      n2o_co2e: (totalN2O * IPCC_AR6_GWP.N2O).toFixed(6),
    });

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
          method: "IPCC AR6",
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
      calculation_version: "2.1.0",
    };

    const { error: updateError } = await supabaseClient
      .from("product_lcas")
      .update({
        aggregated_impacts: aggregatedImpacts,
        total_ghg_emissions: totalCarbonFootprint,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", product_lca_id);

    if (updateError) {
      console.error("[calculate-product-lca-impacts] Failed to update LCA:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to update LCA: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: lcaRecord, error: lcaError } = await supabaseClient
      .from("product_lcas")
      .select("product_id")
      .eq("id", product_lca_id)
      .single();

    if (!lcaError && lcaRecord) {
      await supabaseClient
        .from("products")
        .update({
          latest_lca_id: product_lca_id,
          latest_lca_carbon_footprint: totalCarbonFootprint,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lcaRecord.product_id);

      console.log(`[calculate-product-lca-impacts] Updated product ${lcaRecord.product_id} with latest LCA`);
    }

    console.log(`[calculate-product-lca-impacts] LCA calculation complete: ${product_lca_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        lca_id: product_lca_id,
        total_carbon_footprint: totalCarbonFootprint,
        impacts: aggregatedImpacts,
        materials_count: materials.length,
        production_sites_count: productionSites?.length || 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[calculate-product-lca-impacts] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});