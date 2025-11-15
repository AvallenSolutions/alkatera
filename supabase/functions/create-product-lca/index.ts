import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProductDetails {
  product_name: string;
  product_description: string;
  product_image_url: string;
  functional_unit: string;
  system_boundary: string;
}

interface Material {
  material_id: string;
  material_type: "ingredient" | "packaging";
  quantity: number;
  unit: string;
  country_of_origin: string;
  is_organic: boolean;
  is_regenerative: boolean;
  lca_sub_stage_id: number;
}

interface RequestPayload {
  productDetails: ProductDetails;
  materials: Material[];
  organization_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload: RequestPayload = await req.json();

    if (!payload.productDetails || !payload.materials || !payload.organization_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: productDetails, materials, or organization_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { productDetails, materials, organization_id } = payload;

    if (!productDetails.product_name || !productDetails.functional_unit) {
      return new Response(
        JSON.stringify({ error: "Product name and functional unit are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!Array.isArray(materials) || materials.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one material is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: membershipData, error: membershipError } = await supabaseClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userData.user.id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (membershipError || !membershipData) {
      return new Response(
        JSON.stringify({ error: "User is not a member of this organization" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: lcaData, error: lcaError } = await supabaseClient
      .from("product_lcas")
      .insert({
        organization_id: organization_id,
        product_name: productDetails.product_name,
        product_description: productDetails.product_description || null,
        product_image_url: productDetails.product_image_url || null,
        functional_unit: productDetails.functional_unit,
        system_boundary: productDetails.system_boundary || "Cradle to gate",
        status: "draft",
      })
      .select()
      .single();

    if (lcaError) {
      console.error("Error creating LCA:", lcaError);
      return new Response(
        JSON.stringify({ error: `Failed to create LCA: ${lcaError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!lcaData) {
      return new Response(
        JSON.stringify({ error: "No data returned from LCA creation" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const productLcaId = lcaData.id;

    const materialsToInsert = materials.map((material) => ({
      product_lca_id: productLcaId,
      material_id: material.material_id,
      material_type: material.material_type,
      quantity: material.quantity,
      unit: material.unit || null,
      country_of_origin: material.country_of_origin || null,
      is_organic: material.is_organic || false,
      is_regenerative: material.is_regenerative || false,
      lca_sub_stage_id: material.lca_sub_stage_id,
    }));

    const { error: materialsError } = await supabaseClient
      .from("product_lca_materials")
      .insert(materialsToInsert);

    if (materialsError) {
      console.error("Error inserting materials:", materialsError);

      await supabaseClient
        .from("product_lcas")
        .delete()
        .eq("id", productLcaId);

      return new Response(
        JSON.stringify({ error: `Failed to add materials: ${materialsError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        lca_id: productLcaId,
        message: "Product LCA created successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
