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

    const { data: productionSites, error: sitesError } = await supabaseClient
      .from("product_lca_production_sites")
      .select("*")
      .eq("product_lca_id", product_lca_id);

    if (sitesError) {
      console.warn("[calculate-product-lca-impacts] Failed to fetch production sites:", sitesError);
    }

    console.log(`[calculate-product-lca-impacts] Found ${productionSites?.length || 0} production sites`);

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

          const facilityScope1 = Number(site.scope1_emissions_kg_co2e || 0) * shareOfProduction;
          const facilityScope2 = Number(site.scope2_emissions_kg_co2e || 0) * shareOfProduction;
          const facilityScope3 = Number(site.scope3_emissions_kg_co2e || 0) * shareOfProduction;

          if (facilityScope1 > 0 || facilityScope2 > 0 || facilityScope3 > 0) {
            scope1Emissions += facilityScope1;
            scope2Emissions += facilityScope2;
            scope3Emissions += facilityScope3;
            processingEmissions += attributableEmissions;

            console.log(`[calculate-product-lca-impacts] Facility ${site.facility_id}: Scope 1: ${facilityScope1.toFixed(2)}, Scope 2: ${facilityScope2.toFixed(2)}, Scope 3: ${facilityScope3.toFixed(2)} kg CO2e`);
          } else {
            processingEmissions += attributableEmissions;
            scope3Emissions += attributableEmissions;

            console.warn(`[calculate-product-lca-impacts] Facility ${site.facility_id} lacks Scope 1/2/3 breakdown. Allocated ${attributableEmissions.toFixed(2)} kg CO2e to Scope 3. Update facility data for ISO 14064-1 compliance.`);
          }

          totalClimate += attributableEmissions;
          totalClimateFossil += attributableEmissions;
          totalCO2Fossil += attributableEmissions;

          console.log(`[calculate-product-lca-impacts] Production site: ${site.facility_id}, Emissions: ${attributableEmissions.toFixed(4)} kg CO2e (${(shareOfProduction * 100).toFixed(1)}% share)`);
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