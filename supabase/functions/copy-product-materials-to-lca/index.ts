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

    // Lookup impact factors for each material from staging or ecoinvent
    const lcaMaterials = await Promise.all(masterMaterials.map(async (material) => {
      let impactFactors = {
        impact_climate: null,
        impact_water: null,
        impact_land: null,
        impact_waste: null,
      };

      // Try to find impact factors from staging_emission_factors first
      const { data: stagingFactor } = await supabase
        .from("staging_emission_factors")
        .select("id, co2_factor, water_factor, land_factor, waste_factor")
        .ilike("name", material.material_name)
        .in("category", ["Ingredient", "Packaging"])
        .limit(1)
        .maybeSingle();

      let sourceId = material.data_source_id;

      if (stagingFactor) {
        // Normalize quantity to kg for calculation
        let quantityInKg = parseFloat(material.quantity);
        const unit = material.unit?.toLowerCase() || "kg";

        if (unit === "g" || unit === "grams") {
          quantityInKg = quantityInKg / 1000;
        } else if (unit === "ml" || unit === "millilitres") {
          quantityInKg = quantityInKg / 1000;
        }

        impactFactors = {
          impact_climate: quantityInKg * parseFloat(stagingFactor.co2_factor),
          impact_water: quantityInKg * parseFloat(stagingFactor.water_factor),
          impact_land: quantityInKg * parseFloat(stagingFactor.land_factor),
          impact_waste: quantityInKg * parseFloat(stagingFactor.waste_factor),
        };

        // Use staging factor ID as data_source_id if not already set
        if (!sourceId) {
          sourceId = stagingFactor.id;
        }
      } else {
        // Try ecoinvent proxies as fallback
        const { data: ecoinventProxy } = await supabase
          .from("ecoinvent_material_proxies")
          .select("id, impact_climate, impact_water, impact_land, impact_waste")
          .ilike("material_name", `%${material.material_name}%`)
          .limit(1)
          .maybeSingle();

        if (ecoinventProxy) {
          let quantityInKg = parseFloat(material.quantity);
          const unit = material.unit?.toLowerCase() || "kg";

          if (unit === "g" || unit === "grams") {
            quantityInKg = quantityInKg / 1000;
          } else if (unit === "ml" || unit === "millilitres") {
            quantityInKg = quantityInKg / 1000;
          }

          impactFactors = {
            impact_climate: quantityInKg * parseFloat(ecoinventProxy.impact_climate),
            impact_water: quantityInKg * parseFloat(ecoinventProxy.impact_water),
            impact_land: quantityInKg * parseFloat(ecoinventProxy.impact_land),
            impact_waste: quantityInKg * parseFloat(ecoinventProxy.impact_waste),
          };

          // Use ecoinvent proxy ID as data_source_id if not already set
          if (!sourceId) {
            sourceId = ecoinventProxy.id;
          }
        }
      }

      return {
        product_lca_id: lca_id,
        name: material.material_name,
        material_id: material.material_id,
        quantity: material.quantity,
        unit: material.unit,
        lca_stage_id: material.lca_stage_id,
        lca_sub_stage_id: material.lca_sub_stage_id,
        data_source: material.data_source,
        data_source_id: sourceId, // Use looked-up source ID
        supplier_product_id: material.supplier_product_id,
        origin_country: material.origin_country,
        is_organic_certified: material.is_organic_certified,
        packaging_category: material.packaging_category,
        ...impactFactors,
      };
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
