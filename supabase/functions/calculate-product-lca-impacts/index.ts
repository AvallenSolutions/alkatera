import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    let ingredientClimate = 0;
    let packagingClimate = 0;

    for (const material of materials) {
      const climateImpact = Number(material.impact_climate || 0);
      const transportImpact = Number(material.impact_transport || 0);

      totalClimate += climateImpact;
      totalClimateFossil += Number(material.impact_climate_fossil || 0);
      totalClimateBiogenic += Number(material.impact_climate_biogenic || 0);
      totalClimateDluc += Number(material.impact_climate_dluc || 0);
      totalTransport += transportImpact;
      totalWater += Number(material.impact_water || 0);
      totalWaterScarcity += Number(material.impact_water_scarcity || 0);
      totalLand += Number(material.impact_land || 0);
      totalWaste += Number(material.impact_waste || 0);
      totalTerrestrialEcotoxicity += Number(material.impact_terrestrial_ecotoxicity || 0);
      totalFreshwaterEutrophication += Number(material.impact_freshwater_eutrophication || 0);
      totalTerrestrialAcidification += Number(material.impact_terrestrial_acidification || 0);
      totalFossilResourceScarcity += Number(material.impact_fossil_resource_scarcity || 0);

      if (material.material_type === 'PACKAGING_MATERIAL') {
        packagingClimate += climateImpact + transportImpact;
      } else {
        ingredientClimate += climateImpact + transportImpact;
      }
    }

    const totalCarbonFootprint = totalClimate + totalTransport;

    console.log(`[calculate-product-lca-impacts] Aggregated impacts:`, {
      materials: totalClimate.toFixed(4),
      transport: totalTransport.toFixed(4),
      total: totalCarbonFootprint.toFixed(4),
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
          scope1: 0,
          scope2: 0,
          scope3: totalCarbonFootprint,
        },
        by_lifecycle_stage: {
          raw_materials: ingredientClimate,
          processing: 0,
          packaging_stage: packagingClimate,
          distribution: totalTransport,
          use_phase: 0,
          end_of_life: 0,
        },
        by_ghg: {
          co2_fossil: totalClimateFossil,
          co2_biogenic: totalClimateBiogenic,
          ch4: 0,
          n2o: 0,
        },
      },

      materials_count: materials.length,
      calculated_at: new Date().toISOString(),
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
