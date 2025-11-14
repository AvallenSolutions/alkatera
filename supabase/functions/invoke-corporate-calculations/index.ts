import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvokePayload {
  facility_id: string;
  reporting_period: {
    start: string;
    end: string;
  };
}

interface ActivityDataRecord {
  id: string;
  quantity: number;
  unit: string;
  emission_source_id: string;
  emission_source_name: string;
  emission_factor_id: string;
  emission_factor_value: number;
  emission_factor_unit: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  let logId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const executionEnvironment = Deno.env.get("EXECUTION_ENVIRONMENT") || "unknown";

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

    const payload: InvokePayload = await req.json();

    if (!payload.facility_id || !payload.reporting_period) {
      throw new Error("Missing required fields: facility_id and reporting_period");
    }

    const { facility_id, reporting_period } = payload;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(facility_id)) {
      throw new Error("Invalid UUID format for facility_id");
    }

    if (!reporting_period.start || !reporting_period.end) {
      throw new Error("Reporting period must include start and end dates");
    }

    const { data: facility, error: facilityError } = await supabase
      .from("facilities")
      .select("id, organization_id, name")
      .eq("id", facility_id)
      .single();

    if (facilityError || !facility) {
      throw new Error("Facility not found");
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", facility.organization_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      throw new Error("User is not a member of the facility's organization");
    }

    const { data: existingCalc } = await supabase
      .from("facility_emissions_aggregated")
      .select("id")
      .eq("facility_id", facility_id)
      .eq("reporting_period_start", reporting_period.start)
      .eq("reporting_period_end", reporting_period.end)
      .maybeSingle();

    if (existingCalc) {
      throw new Error("Calculation already exists for this facility and reporting period");
    }

    const inputData = {
      facility_id,
      reporting_period,
      user_id: user.id,
      organization_id: facility.organization_id,
    };

    const { data: calcLog, error: logError } = await supabase
      .from("calculation_logs")
      .insert({
        organization_id: facility.organization_id,
        user_id: user.id,
        input_data: inputData,
        output_value: 0,
        output_unit: "kg CO₂e",
        methodology_version: "Corporate Calculation Engine v1.0",
        factor_ids_used: [],
      })
      .select("log_id")
      .single();

    if (logError || !calcLog) {
      console.error("Failed to create calculation log:", logError);
    } else {
      logId = calcLog.log_id;
    }

    const { data: activityData, error: activityError } = await supabase
      .from("facility_activity_data")
      .select(`
        id,
        quantity,
        unit,
        emission_source_id,
        emissions_factors!facility_activity_data_emission_source_id_fkey (
          factor_id,
          name,
          value,
          unit
        )
      `)
      .eq("facility_id", facility_id)
      .gte("reporting_period_start", reporting_period.start)
      .lte("reporting_period_end", reporting_period.end);

    if (activityError) {
      throw new Error(`Failed to fetch activity data: ${activityError.message}`);
    }

    if (!activityData || activityData.length === 0) {
      throw new Error("No activity data found for this facility and reporting period");
    }

    let totalEmissions = 0;
    const disaggregatedSummary: Record<string, number> = {};
    const activityDataIds: string[] = [];
    const emissionFactorIds: string[] = [];

    for (const record of activityData) {
      if (!record.emissions_factors) {
        console.warn(`No emission factor found for activity data ${record.id}`);
        continue;
      }

      const emissionFactor = Array.isArray(record.emissions_factors)
        ? record.emissions_factors[0]
        : record.emissions_factors;

      if (!emissionFactor) {
        console.warn(`Invalid emission factor for activity data ${record.id}`);
        continue;
      }

      const calculatedEmission = record.quantity * emissionFactor.value;
      totalEmissions += calculatedEmission;

      if (!disaggregatedSummary[emissionFactor.name]) {
        disaggregatedSummary[emissionFactor.name] = 0;
      }
      disaggregatedSummary[emissionFactor.name] += calculatedEmission;

      activityDataIds.push(record.id);
      emissionFactorIds.push(emissionFactor.factor_id);

      await supabase.from("calculated_emissions").insert({
        organization_id: facility.organization_id,
        activity_data_id: record.id,
        emissions_factor_id: emissionFactor.factor_id,
        calculated_value_co2e: calculatedEmission,
      });
    }

    const resultsPayload = {
      disaggregated_summary: disaggregatedSummary,
      activity_data_ids: activityDataIds,
      emission_factor_ids: [...new Set(emissionFactorIds)],
    };

    const { data: aggregatedResult, error: aggregatedError } = await supabase
      .from("facility_emissions_aggregated")
      .insert({
        facility_id,
        organization_id: facility.organization_id,
        reporting_period_start: reporting_period.start,
        reporting_period_end: reporting_period.end,
        total_co2e: totalEmissions,
        unit: "kg CO₂e",
        results_payload: resultsPayload,
        calculated_by: user.id,
      })
      .select("id")
      .single();

    if (aggregatedError || !aggregatedResult) {
      throw new Error(`Failed to save aggregated results: ${aggregatedError?.message}`);
    }

    const calculationDuration = Date.now() - startTime;

    if (logId) {
      await supabase
        .from("calculation_logs")
        .update({
          output_value: totalEmissions,
          factor_ids_used: [...new Set(emissionFactorIds)],
          calculation_id: aggregatedResult.id,
        })
        .eq("log_id", logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Corporate emissions calculation completed successfully",
        calculation_id: aggregatedResult.id,
        total_co2e: totalEmissions,
        unit: "kg CO₂e",
        disaggregated_summary: disaggregatedSummary,
        activity_records_processed: activityData.length,
        calculation_duration_ms: calculationDuration,
        environment: executionEnvironment,
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
    console.error("Error in invoke-corporate-calculations:", error);

    const calculationDuration = Date.now() - startTime;
    const executionEnvironment = Deno.env.get("EXECUTION_ENVIRONMENT") || "unknown";

    if (logId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from("calculation_logs")
          .update({
            output_value: 0,
          })
          .eq("log_id", logId);
      } catch (logError) {
        console.error("Failed to update error log:", logError);
      }
    }

    const statusCode = error.message === "Unauthorized" ? 401 :
                       error.message.includes("already exists") ? 409 : 400;

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
        environment: executionEnvironment,
      }),
      {
        status: statusCode,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
