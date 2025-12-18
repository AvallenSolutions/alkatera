import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// === GOVERNANCE: CALCULATION UTILITIES START ===
import { createClient } from "npm:@supabase/supabase-js@2";
import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2";

export interface LogPayload {
  userId: string;
  organisationId: string;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  emissionsFactorId: string;
  methodologyVersion: string;
  calculationFunctionName: string;
  dataProvenanceId: string;
}

export interface EnforceRLSResult {
  user: User;
  organisationId: string;
  supabaseClient: SupabaseClient;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  });
}

export async function enforceRLS(request: Request): Promise<EnforceRLSResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    throw new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    throw new Response(
      JSON.stringify({
        error: "Unauthorized",
        details: authError?.message
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: profileData, error: profileError } = await supabaseClient
    .from("profiles")
    .select("active_organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profileData || !profileData.active_organization_id) {
    throw new Response(
      JSON.stringify({
        error: "No active organisation found for user",
        details: profileError?.message,
        debug: {
          hasError: !!profileError,
          hasData: !!profileData,
          hasActiveOrg: !!profileData?.active_organization_id,
          userId: user.id
        }
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return {
    user,
    organisationId: profileData.active_organization_id,
    supabaseClient,
  };
}

export async function createLogEntry(
  supabaseClient: SupabaseClient,
  payload: LogPayload
): Promise<string> {
  const { data: calculationLog, error: logError } = await supabaseClient
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

  if (logError) {
    console.error("Error creating calculation log:", logError);
    throw new Response(
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

  return calculationLog.log_id;
}

export async function validateProvenance(
  supabaseClient: SupabaseClient,
  provenanceId: string,
  organisationId: string
): Promise<{ provenance_id: string; organization_id: string }> {
  const { data: provenanceData, error: provenanceError } = await supabaseClient
    .from("data_provenance_trail")
    .select("provenance_id, organization_id")
    .eq("provenance_id", provenanceId)
    .eq("organization_id", organisationId)
    .maybeSingle();

  if (provenanceError) {
    console.error("Error querying provenance:", provenanceError);
    throw new Response(
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
    throw new Response(
      JSON.stringify({
        error: "Invalid provenance_id: No matching evidence record found or access denied"
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return provenanceData;
}

export function createErrorResponse(
  error: unknown,
  statusCode = 500
): Response {
  console.error("Error:", error);

  if (error instanceof Response) {
    return error;
  }

  return new Response(
    JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error",
      details: error instanceof Error ? error.stack : String(error)
    }),
    {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

export function createSuccessResponse(data: Record<string, any>): Response {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

export function createOptionsResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export { corsHeaders };

// === GOVERNANCE: CALCULATION UTILITIES END ===

interface ActivityData {
  fuel_type: string;
  fuel_energy_kwh: number;
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
    return createOptionsResponse();
  }

  try {
    const { user, organisationId, supabaseClient } = await enforceRLS(req);

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

    if (typeof activity_data.fuel_energy_kwh !== "number" || activity_data.fuel_energy_kwh <= 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid input: activity_data.fuel_energy_kwh is required and must be a positive number"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await validateProvenance(supabaseClient, provenance_id, organisationId);

    const { data: emissionsFactor, error: factorError } = await supabaseClient
      .from("emissions_factors")
      .select("factor_id, value, name, unit, source, year_of_publication")
      .eq("category", "Scope 1")
      .eq("type", "Stationary Combustion - Energy")
      .eq("name", activity_data.fuel_type)
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
          error: `No Scope 1 Stationary Combustion emissions factor found for fuel type: ${activity_data.fuel_type}`,
          message: "Please ensure emissions factors are loaded for this fuel type or contact support"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emissions_tco2e = Number((
      (activity_data.fuel_energy_kwh * Number(emissionsFactor.value)) / 1000
    ).toFixed(6));

    const inputPayload = {
      provenance_id: provenance_id,
      fuel_type: activity_data.fuel_type,
      fuel_energy_kwh: activity_data.fuel_energy_kwh,
      emissions_factor_used: {
        factor_id: emissionsFactor.factor_id,
        name: emissionsFactor.name,
        value: emissionsFactor.value,
        unit: emissionsFactor.unit,
        source: emissionsFactor.source,
        year: emissionsFactor.year_of_publication,
      },
    };

    const outputData = {
      emissions_tco2e: emissions_tco2e,
      metadata: {
        factor_name: emissionsFactor.name,
        factor_value: emissionsFactor.value,
        factor_unit: emissionsFactor.unit,
        factor_source: emissionsFactor.source,
        factor_year: emissionsFactor.year_of_publication,
        methodology: "V2 Beverage Company GHG Protocol",
        engine_version: "1.0.0",
        calculation_type: "Scope 1: Stationary Combustion - Energy",
      },
    };

    const calculationLogId = await createLogEntry(supabaseClient, {
      userId: user.id,
      organisationId: organisationId,
      inputData: inputPayload,
      outputData: outputData,
      emissionsFactorId: emissionsFactor.factor_id,
      methodologyVersion: "V2 Beverage Company GHG Protocol",
      calculationFunctionName: "calculate-scope1-stationary-combustion-energy",
      dataProvenanceId: provenance_id,
    });

    return createSuccessResponse({
      emissions_tco2e: emissions_tco2e,
      calculation_log_id: calculationLogId,
      metadata: outputData.metadata,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
});
