import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ActivityData {
  vehicle_type: string;
  fuel_type: string;
  distance_km: number;
}

interface CalculationRequest {
  provenance_id: string;
  activity_data: ActivityData;
}

interface EmissionsFactor {
  factor_id: string;
  value: number;
  name: string;
  unit: string;
  source: string;
  year_of_publication: number;
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
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let requestBody: CalculationRequest;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { provenance_id, activity_data } = requestBody;

    if (!provenance_id || typeof provenance_id !== "string") {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input: provenance_id is required and must be a UUID string" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!activity_data || typeof activity_data !== "object") {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input: activity_data is required and must be an object" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!activity_data.vehicle_type || typeof activity_data.vehicle_type !== "string") {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input: activity_data.vehicle_type is required and must be a string" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!activity_data.fuel_type || typeof activity_data.fuel_type !== "string") {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input: activity_data.fuel_type is required and must be a string" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (typeof activity_data.distance_km !== "number" || activity_data.distance_km <= 0) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input: activity_data.distance_km is required and must be a positive number" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: provenanceData, error: provenanceError } = await supabaseClient
      .from("data_provenance_trail")
      .select("provenance_id, organization_id")
      .eq("provenance_id", provenance_id)
      .maybeSingle();

    if (provenanceError) {
      console.error("Error querying provenance:", provenanceError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to validate provenance_id",
          details: provenanceError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!provenanceData) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid provenance_id: No matching evidence record found or access denied" 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: emissionsFactor, error: factorError } = await supabaseClient
      .from("emissions_factors")
      .select("factor_id, value, name, unit, source, year_of_publication")
      .eq("category", "Scope 1")
      .eq("type", "Mobile Combustion - Distance")
      .eq("name", activity_data.vehicle_type)
      .order("year_of_publication", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (factorError) {
      console.error("Error querying emissions factor:", factorError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to query emissions factors",
          details: factorError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!emissionsFactor) {
      return new Response(
        JSON.stringify({ 
          error: `No Scope 1 Mobile Combustion emissions factor found for vehicle type: ${activity_data.vehicle_type}`,
          message: "Please ensure emissions factors are loaded for this vehicle type or contact support" 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emissions_tco2e = Number((
      activity_data.distance_km * Number(emissionsFactor.value)
    ).toFixed(6));

    const inputPayload = {
      provenance_id: provenance_id,
      vehicle_type: activity_data.vehicle_type,
      fuel_type: activity_data.fuel_type,
      distance_km: activity_data.distance_km,
      emissions_factor_used: {
        factor_id: emissionsFactor.factor_id,
        name: emissionsFactor.name,
        value: emissionsFactor.value,
        unit: emissionsFactor.unit,
        source: emissionsFactor.source,
        year: emissionsFactor.year_of_publication,
      },
    };

    const { data: calculationLog, error: logError } = await supabaseClient
      .from("calculation_logs")
      .insert({
        organization_id: provenanceData.organization_id,
        user_id: user.id,
        input_data: inputPayload,
        output_value: emissions_tco2e,
        output_unit: "tCO2e",
        methodology_version: "V2 Beverage Company GHG Protocol",
        factor_ids_used: [emissionsFactor.factor_id],
      })
      .select("log_id")
      .single();

    if (logError) {
      console.error("Error creating calculation log:", logError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to create calculation log",
          details: logError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        emissions_tco2e: emissions_tco2e,
        calculation_log_id: calculationLog.log_id,
        metadata: {
          factor_name: emissionsFactor.name,
          factor_value: emissionsFactor.value,
          factor_unit: emissionsFactor.unit,
          factor_source: emissionsFactor.source,
          factor_year: emissionsFactor.year_of_publication,
          methodology: "V2 Beverage Company GHG Protocol",
          engine_version: "1.0.0",
          calculation_type: "Scope 1: Mobile Combustion",
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});