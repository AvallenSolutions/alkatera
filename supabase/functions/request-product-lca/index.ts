import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LCADefinition {
  organization_id: string;
  product_name: string;
  functional_unit: string;
  system_boundary: string;
}

interface LCAInput {
  label: string;
  value: number;
  unit: string;
  dqi: {
    reliability: number;
    temporal: number;
    geographical: number;
    technological: number;
    completeness: number;
  };
  evidenceUrl?: string;
  stage: string;
  category: string;
}

interface RequestPayload {
  lcaDefinition: LCADefinition;
  lcaInputs: LCAInput[];
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
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const payload: RequestPayload = await req.json();

    if (!payload.lcaDefinition || !payload.lcaInputs) {
      throw new Error("Missing required fields: lcaDefinition and lcaInputs");
    }

    const { lcaDefinition, lcaInputs } = payload;

    if (!lcaDefinition.organization_id || !lcaDefinition.product_name || !lcaDefinition.functional_unit || !lcaDefinition.system_boundary) {
      throw new Error("Missing required LCA definition fields");
    }

    if (!Array.isArray(lcaInputs) || lcaInputs.length === 0) {
      throw new Error("lcaInputs must be a non-empty array");
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", lcaDefinition.organization_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      throw new Error("User is not a member of the specified organization");
    }

    const { data: productLCA, error: lcaError } = await supabase
      .from("product_lcas")
      .insert({
        organization_id: lcaDefinition.organization_id,
        product_name: lcaDefinition.product_name,
        functional_unit: lcaDefinition.functional_unit,
        system_boundary: lcaDefinition.system_boundary,
        status: "draft",
      })
      .select("id")
      .single();

    if (lcaError || !productLCA) {
      console.error("Error creating product LCA:", lcaError);
      throw new Error("Failed to create product LCA record");
    }

    const { error: inputsError } = await supabase
      .from("product_lca_inputs")
      .insert({
        product_lca_id: productLCA.id,
        input_data: lcaInputs,
      });

    if (inputsError) {
      console.error("Error saving LCA inputs:", inputsError);
      await supabase.from("product_lcas").delete().eq("id", productLCA.id);
      throw new Error("Failed to save LCA inputs");
    }

    return new Response(
      JSON.stringify({
        success: true,
        lca_id: productLCA.id,
        message: "LCA draft saved successfully",
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error in request-product-lca:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
      }),
      {
        status: error.message === "Unauthorized" ? 401 : 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
