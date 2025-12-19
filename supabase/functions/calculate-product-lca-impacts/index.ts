import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AggregatedImpacts {
  total_climate: number;
  total_climate_fossil: number;
  total_climate_biogenic: number;
  total_climate_dluc: number;
  total_transport: number;
  total_water: number;
  total_water_scarcity: number;
  total_land: number;
  total_waste: number;
  total_terrestrial_ecotoxicity: number;
  total_freshwater_eutrophication: number;
  total_terrestrial_acidification: number;
  total_fossil_resource_scarcity: number;
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

    const impacts: AggregatedImpacts = {
      total_climate: 0,
      total_climate_fossil: 0,
      total_climate_biogenic: 0,
      total_climate_dluc: 0,
      total_transport: 0,
      total_water: 0,
      total_water_scarcity: 0,
      total_land: 0,
      total_waste: 0,
      total_terrestrial_ecotoxicity: 0,
      total_freshwater_eutrophication: 0,
      total_terrestrial_acidification: 0,
      total_fossil_resource_scarcity: 0,
    };

    for (const material of materials) {
      impacts.total_climate += Number(material.impact_climate || 0);
      impacts.total_climate_fossil += Number(material.impact_climate_fossil || 0);
      impacts.total_climate_biogenic += Number(material.impact_climate_biogenic || 0);
      impacts.total_climate_dluc += Number(material.impact_climate_dluc || 0);
      impacts.total_transport += Number(material.impact_transport || 0);
      impacts.total_water += Number(material.impact_water || 0);
      impacts.total_water_scarcity += Number(material.impact_water_scarcity || 0);
      impacts.total_land += Number(material.impact_land || 0);
      impacts.total_waste += Number(material.impact_waste || 0);
      impacts.total_terrestrial_ecotoxicity += Number(material.impact_terrestrial_ecotoxicity || 0);
      impacts.total_freshwater_eutrophication += Number(material.impact_freshwater_eutrophication || 0);
      impacts.total_terrestrial_acidification += Number(material.impact_terrestrial_acidification || 0);
      impacts.total_fossil_resource_scarcity += Number(material.impact_fossil_resource_scarcity || 0);
    }

    const totalCarbonFootprint = impacts.total_climate + impacts.total_transport;

    console.log(`[calculate-product-lca-impacts] Aggregated impacts:`, {
      materials: impacts.total_climate.toFixed(4),
      transport: impacts.total_transport.toFixed(4),
      total: totalCarbonFootprint.toFixed(4),
    });

    const { error: updateError } = await supabaseClient
      .from("product_lcas")
      .update({
        total_carbon_footprint: totalCarbonFootprint,
        total_climate: impacts.total_climate,
        total_climate_fossil: impacts.total_climate_fossil,
        total_climate_biogenic: impacts.total_climate_biogenic,
        total_climate_dluc: impacts.total_climate_dluc,
        total_transport: impacts.total_transport,
        total_water: impacts.total_water,
        total_water_scarcity: impacts.total_water_scarcity,
        total_land: impacts.total_land,
        total_waste: impacts.total_waste,
        total_terrestrial_ecotoxicity: impacts.total_terrestrial_ecotoxicity,
        total_freshwater_eutrophication: impacts.total_freshwater_eutrophication,
        total_terrestrial_acidification: impacts.total_terrestrial_acidification,
        total_fossil_resource_scarcity: impacts.total_fossil_resource_scarcity,
        status: "completed",
        calculated_at: new Date().toISOString(),
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

    const { data: product, error: productError } = await supabaseClient
      .from("product_lcas")
      .select("product_id")
      .eq("id", product_lca_id)
      .single();

    if (!productError && product) {
      await supabaseClient
        .from("products")
        .update({
          latest_lca_id: product_lca_id,
          latest_lca_carbon_footprint: totalCarbonFootprint,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.product_id);

      console.log(`[calculate-product-lca-impacts] Updated product ${product.product_id} with latest LCA`);
    }

    console.log(`[calculate-product-lca-impacts] ✓ LCA calculation complete: ${product_lca_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        lca_id: product_lca_id,
        total_carbon_footprint: totalCarbonFootprint,
        impacts: {
          materials: impacts.total_climate,
          transport: impacts.total_transport,
          water: impacts.total_water,
          land: impacts.total_land,
          waste: impacts.total_waste,
        },
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