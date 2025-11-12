import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateCalculationLogRequest {
  calculationId: string;
}

interface CalculatedEmission {
  id: string;
  organization_id: string;
  activity_data_id: string;
  emissions_factor_id: string;
  calculated_value_co2e: number;
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
    const authHeader = req.headers.get("Authorization")!;

    // Create client to verify user authentication
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

    // Verify user is authenticated
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

    // Parse request body
    const { calculationId }: CreateCalculationLogRequest = await req.json();

    if (!calculationId) {
      return new Response(
        JSON.stringify({ error: "calculationId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    // Step 2: Query calculated_emissions table to fetch the full record
    const { data: calculationRecord, error: fetchError } = await supabaseAdmin
      .from("calculated_emissions")
      .select("id, organization_id, activity_data_id, emissions_factor_id, calculated_value_co2e")
      .eq("id", calculationId)
      .single();

    if (fetchError || !calculationRecord) {
      console.error("Error fetching calculation record:", fetchError);
      return new Response(
        JSON.stringify({ 
          error: "Calculation record not found", 
          details: fetchError?.message || "No record found with the provided calculationId" 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const calculation = calculationRecord as CalculatedEmission;

    // Step 3: Construct the cryptographic proof string
    // Format: organization_id-activity_data_id-emissions_factor_id-calculated_value_co2e
    const multiplicationProof = [
      calculation.organization_id,
      calculation.activity_data_id,
      calculation.emissions_factor_id,
      calculation.calculated_value_co2e.toString(),
    ].join("-");

    // Get user's organization_id to ensure they have access
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (memberError || !memberData) {
      return new Response(
        JSON.stringify({ error: "User is not a member of any organization" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the calculation belongs to the user's organization
    if (calculation.organization_id !== memberData.organization_id) {
      return new Response(
        JSON.stringify({ error: "Access denied: Calculation belongs to a different organization" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 4: Insert a new record into the calculation_logs table
    // Note: The calculation_logs table requires several fields from the original schema.
    // For this V1 implementation, we'll provide minimal required data.
    const { data: logRecord, error: insertError } = await supabaseAdmin
      .from("calculation_logs")
      .insert({
        organization_id: calculation.organization_id,
        user_id: user.id,
        calculation_id: calculation.id,
        multiplication_proof: multiplicationProof,
        // Required fields from the original schema
        input_data: {
          activity_data_id: calculation.activity_data_id,
          emissions_factor_id: calculation.emissions_factor_id,
        },
        output_value: calculation.calculated_value_co2e,
        output_unit: "kgCO2e",
        methodology_version: "v1.0",
        factor_ids_used: [calculation.emissions_factor_id],
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting calculation log:", insertError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to create calculation log", 
          details: insertError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 5: Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Calculation log created successfully",
        data: {
          log_id: logRecord.log_id,
          calculation_id: calculation.id,
          multiplication_proof: multiplicationProof,
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
        details: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
