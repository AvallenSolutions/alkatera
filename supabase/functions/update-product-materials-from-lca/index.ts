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

    // Fetch current LCA materials
    const { data: lcaMaterials, error: fetchError } = await supabase
      .from("product_lca_materials")
      .select("*")
      .eq("product_lca_id", lca_id);

    if (fetchError) {
      throw fetchError;
    }

    if (!lcaMaterials || lcaMaterials.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: "No materials found in LCA to copy",
          updated: 0 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Delete existing master materials for this product
    const { error: deleteError } = await supabase
      .from("product_materials")
      .delete()
      .eq("product_id", product_id);

    if (deleteError) {
      throw deleteError;
    }

    // Insert new master materials from LCA
    const masterMaterials = lcaMaterials.map((material) => ({
      product_id: product_id,
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
      .from("product_materials")
      .insert(masterMaterials)
      .select();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        message: "Master materials updated successfully",
        updated: insertedMaterials?.length || 0,
        materials: insertedMaterials,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error updating master materials:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
