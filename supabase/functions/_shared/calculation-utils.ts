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
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profileData || !profileData.active_organization_id) {
    throw new Response(
      JSON.stringify({
        error: "No active organisation found for user",
        details: profileError?.message
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
