import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// === GOVERNANCE: CALCULATION UTILITIES START ===
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


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ActivityData {
  travel_type: string;
  spend: number;
  currency: string;
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

// Exchange rates (example - should be updated from live API in production)
const EXCHANGE_RATES: Record<string, number> = {
  "USD": 1.0,
  "EUR": 1.08,
  "GBP": 1.27,
  "JPY": 0.0067,
  "CAD": 0.74,
  "AUD": 0.65,
  "CHF": 1.13,
  "CNY": 0.14,
  "INR": 0.012,
  "BRL": 0.20,
};

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

    if (!activity_data.travel_type || typeof activity_data.travel_type !== "string") {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input: activity_data.travel_type is required and must be a string" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (typeof activity_data.spend !== "number" || activity_data.spend <= 0) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input: activity_data.spend is required and must be a positive number" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!activity_data.currency || typeof activity_data.currency !== "string") {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input: activity_data.currency is required and must be a string (e.g., 'USD', 'EUR', 'GBP')" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const currencyUpper = activity_data.currency.toUpperCase();
    if (!EXCHANGE_RATES[currencyUpper]) {
      return new Response(
        JSON.stringify({ 
          error: `Unsupported currency: ${activity_data.currency}. Supported currencies: ${Object.keys(EXCHANGE_RATES).join(", ")}` 
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
      .eq("category", "Scope 3")
      .eq("type", "Category 6 - Business Travel - Spend")
      .eq("name", activity_data.travel_type)
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
          error: `No Scope 3 Category 6 business travel emissions factor found for travel type: ${activity_data.travel_type}`,
          message: "Please ensure emissions factors are loaded for this travel type or contact support" 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Convert spend to USD (base currency for emission factors)
    const exchangeRate = EXCHANGE_RATES[currencyUpper];
    const normalised_spend_usd = activity_data.spend * exchangeRate;

    const emissions_tco2e = Number((
      (normalised_spend_usd * Number(emissionsFactor.value)) / 1000000
    ).toFixed(6));

    const inputPayload = {
      provenance_id: provenance_id,
      travel_type: activity_data.travel_type,
      spend: activity_data.spend,
      currency: currencyUpper,
      normalised_spend_usd: normalised_spend_usd,
      exchange_rate: exchangeRate,
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
          travel_type: emissionsFactor.name,
          factor_value: emissionsFactor.value,
          factor_unit: emissionsFactor.unit,
          factor_source: emissionsFactor.source,
          factor_year: emissionsFactor.year_of_publication,
          spend_original: activity_data.spend,
          currency_original: currencyUpper,
          spend_normalised_usd: normalised_spend_usd,
          exchange_rate_used: exchangeRate,
          methodology: "V2 Beverage Company GHG Protocol",
          engine_version: "1.0.0",
          calculation_type: "Scope 3: Category 6 - Business Travel - Spend",
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