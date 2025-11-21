import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  product_id: number;
  lca_id: string;
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { product_id, lca_id }: RequestBody = await req.json();

    if (!product_id || !lca_id) {
      return new Response(
        JSON.stringify({ error: "product_id and lca_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if LCA already has materials
    const { data: existingMaterials, error: checkError } = await supabase
      .from("product_lca_materials")
      .select("id")
      .eq("product_lca_id", lca_id)
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (existingMaterials && existingMaterials.length > 0) {
      return new Response(
        JSON.stringify({ 
          message: "LCA already has materials, skipping copy",
          copied: 0 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch master materials from product_materials
    const { data: masterMaterials, error: fetchError } = await supabase
      .from("product_materials")
      .select("*")
      .eq("product_id", product_id);

    if (fetchError) {
      throw fetchError;
    }

    if (!masterMaterials || masterMaterials.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No master materials found for this product",
          copied: 0 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Copy materials to product_lca_materials
    const lcaMaterials = masterMaterials.map((material) => ({
      product_lca_id: lca_id,
      material_name: material.material_name,
      material_id: material.material_id,
      material_type: material.material_type,
      quantity: material.quantity,
      unit: material.unit,
      lca_stage_id: material.lca_stage_id,
      lca_sub_stage_id: material.lca_sub_stage_id,
      data_source: material.data_source,
      data_source_id: material.data_source_id,
      supplier_product_id: material.supplier_product_id,
      origin_country: material.origin_country,
      is_organic_certified: material.is_organic_certified,
    }));

    const { data: insertedMaterials, error: insertError } = await supabase
      .from("product_lca_materials")
      .insert(lcaMaterials)
      .select();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        message: "Materials copied successfully",
        copied: insertedMaterials?.length || 0,
        materials: insertedMaterials,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error copying materials:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
