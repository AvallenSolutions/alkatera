// Standard Edge Functions import.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// The one and only Supabase client import for this file.
import { createClient, SupabaseClient, User } from "npm:@supabase/supabase-js@2";

// --- Shared Constants & Interfaces ---

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Main request payload structure
interface CalculationRequest {
  provenance_id: string;
  activity_data: {
    vehicle_type: string;
    fuel_type: string;
    distance_km: number;
  };
}

// Data structure for logging the calculation
interface LogPayload {
  userId: string;
  organisationId: string;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  emissionsFactorId: string;
  methodologyVersion: string;
}

// --- Governance & Utility Functions (The "Shared Library") ---

/**
 * Enforces Row-Level Security by validating the user's JWT.
 * Returns a user-scoped Supabase client on success.
 */
async function enforceRLS(request: Request): Promise<{ user: User; organisationId: string; supabaseClient: SupabaseClient }> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    throw createErrorResponse({ error: "Missing authorization header" }, 401);
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    }
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    throw createErrorResponse({ error: "Unauthorized", details: authError?.message }, 401);
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("active_organization_id")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.active_organization_id) {
    throw createErrorResponse({ error: "No active organisation found for user", details: profileError?.message }, 403);
  }

  return { user, organisationId: profile.active_organization_id, supabaseClient };
}

/**
 * Creates a detailed, auditable log of a calculation event.
 */
async function createLogEntry(supabase: SupabaseClient, payload: LogPayload): Promise<string> {
  const { data, error } = await supabase
    .from("calculation_logs")
    .insert({
      organization_id: payload.organisationId,
      user_id: payload.userId,
      input_data: payload.inputData,
      output_value: payload.outputData.emissions_tco2e,
      output_unit: "tCO2e",
      methodology_version: payload.methodologyVersion,
      factor_ids_used: [payload.emissionsFactorId],
    })
    .select("log_id")
    .single();

  if (error) {
    console.error("Failed to create calculation log:", error);
    throw createErrorResponse({ error: "Failed to write to calculation_logs", details: error.message }, 500);
  }
  return data.log_id;
}

// --- Standard HTTP Response Helpers ---

function createErrorResponse(error: any, statusCode = 500): Response {
  return new Response(JSON.stringify(error), { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function createSuccessResponse(data: Record<string, any>): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// --- Main Function Logic ---

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 1. SECURITY: Enforce RLS and get user context.
    const { user, organisationId, supabaseClient } = await enforceRLS(req);

    // 2. INPUT: Parse and validate the incoming request body.
    const { provenance_id, activity_data } = await req.json() as CalculationRequest;
    if (!provenance_id || !activity_data || typeof activity_data.distance_km !== 'number') {
        return createErrorResponse({ error: "Invalid payload structure" }, 400);
    }
    
    // 3. FETCH FACTOR: Find the correct emissions factor for the calculation.
    const { data: factor, error: factorError } = await supabaseClient
      .from("emissions_factors")
      .select("factor_id, value, name, unit, source, year_of_publication")
      .eq("category", "Scope 1")
      .eq("type", "Mobile Combustion - Distance")
      .eq("name", activity_data.vehicle_type)
      .order("year_of_publication", { ascending: false })
      .limit(1)
      .single();

    if (factorError) throw factorError;
    if (!factor) {
      return createErrorResponse({ error: `Emissions factor not found for vehicle: ${activity_data.vehicle_type}` }, 404);
    }

    // 4. CALCULATE: Perform the core business logic.
    const emissions_tco2e = activity_data.distance_km * factor.value;

    // 5. LOG (Glass Box Principle): Create an immutable audit trail of the calculation.
    const logId = await createLogEntry(supabaseClient, {
      userId: user.id,
      organisationId: organisationId,
      inputData: { provenance_id, ...activity_data },
      outputData: { emissions_tco2e },
      emissionsFactorId: factor.factor_id,
      methodologyVersion: "V2 Beverage Company GHG Protocol",
    });

    // 6. RESPOND: Return the result and the log ID for traceability.
    return createSuccessResponse({
      emissions_tco2e: parseFloat(emissions_tco2e.toFixed(6)),
      calculation_log_id: logId,
      metadata: {
        factor_used: {
          id: factor.factor_id,
          name: factor.name,
          value: factor.value,
          unit: factor.unit,
          source: factor.source,
          year: factor.year_of_publication,
        },
        engine_version: "1.0.0"
      },
    });

  } catch (error) {
    // Catch-all error handler.
    console.error("Unhandled error in function:", error);
    return createErrorResponse({ error: error.message }, error.status || 500);
  }
});