import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPayload {
  product_id: number;
  facility_id: string;
  total_production_volume: number;
  product_production_volume: number;
}

interface FacilityEmissionsData {
  total_co2e: number;
  results_payload: {
    total_water_usage?: number;
    total_waste_generated?: number;
  };
}

interface AllocatedImpacts {
  co2e_per_unit: number;
  water_per_unit: number;
  waste_per_unit: number;
  allocation_ratio: number;
  total_production_volume: number;
  product_production_volume: number;
  facility_name: string;
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const {
      product_id,
      facility_id,
      total_production_volume,
      product_production_volume,
    }: RequestPayload = await req.json();

    if (
      !product_id ||
      !facility_id ||
      !total_production_volume ||
      !product_production_volume
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (product_production_volume > total_production_volume) {
      return new Response(
        JSON.stringify({
          error: "Product production volume cannot exceed total facility production volume",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: facilityData, error: facilityError } = await supabase
      .from("facilities")
      .select("name, organization_id")
      .eq("id", facility_id)
      .single();

    if (facilityError || !facilityData) {
      return new Response(
        JSON.stringify({ error: "Facility not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: emissionsData, error: emissionsError } = await supabase
      .from("facility_emissions_aggregated")
      .select("total_co2e, results_payload")
      .eq("facility_id", facility_id)
      .order("reporting_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (emissionsError) {
      return new Response(
        JSON.stringify({ error: "Error fetching emissions data", details: emissionsError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!emissionsData) {
      return new Response(
        JSON.stringify({
          error: "No emissions data found for this facility. Please ensure facility data has been calculated."
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const allocationRatio = product_production_volume / total_production_volume;

    const totalCO2e = Number(emissionsData.total_co2e) || 0;

    // Extract water and waste from results_payload (they may be nested in different structures)
    const payload = emissionsData.results_payload || {};
    let totalWater = 0;
    let totalWaste = 0;

    // Try different paths where water/waste might be stored
    if (payload.total_water_consumption?.value) {
      totalWater = Number(payload.total_water_consumption.value) || 0;
    } else if (payload.total_water_usage) {
      totalWater = Number(payload.total_water_usage) || 0;
    }

    if (payload.total_waste_generated?.value) {
      totalWaste = Number(payload.total_waste_generated.value) || 0;
    } else if (payload.total_waste_generated) {
      totalWaste = Number(payload.total_waste_generated) || 0;
    }

    const allocatedCO2e = totalCO2e * allocationRatio;
    const allocatedWater = totalWater * allocationRatio;
    const allocatedWaste = totalWaste * allocationRatio;

    const co2ePerUnit = allocatedCO2e / product_production_volume;
    const waterPerUnit = allocatedWater / product_production_volume;
    const wastePerUnit = allocatedWaste / product_production_volume;

    const allocatedImpacts: AllocatedImpacts = {
      co2e_per_unit: co2ePerUnit,
      water_per_unit: waterPerUnit,
      waste_per_unit: wastePerUnit,
      allocation_ratio: allocationRatio,
      total_production_volume,
      product_production_volume,
      facility_name: facilityData.name,
    };

    const allocationPercentage = (allocationRatio * 100).toFixed(2);
    const provenanceNote = `Impacts allocated from '${facilityData.name}' facility data, based on a ${allocationPercentage}% share of its total annual production volume.`;

    const { error: updateError } = await supabase
      .from("products")
      .update({
        core_operations_data: allocatedImpacts,
        core_operations_facility_id: facility_id,
        core_operations_provenance: provenanceNote,
        core_operations_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Error saving allocation data", details: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        allocated_impacts: allocatedImpacts,
        provenance: provenanceNote,
        calculation_details: {
          facility_name: facilityData.name,
          total_co2e: totalCO2e,
          total_co2e_unit: 'kg CO2e',
          total_water: totalWater,
          total_water_unit: 'litres',
          total_waste: totalWaste,
          total_waste_unit: 'kg',
          allocation_ratio: allocationRatio,
          allocation_percentage: (allocationRatio * 100).toFixed(2),
          allocated_co2e: allocatedCO2e,
          allocated_water: allocatedWater,
          allocated_waste: allocatedWaste,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in allocate-facility-impacts:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
