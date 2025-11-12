import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ActivityDataRecord {
  id: string;
  organization_id: string;
  quantity: number;
  unit: string;
  name: string;
  category: string;
}

interface EmissionsFactorRecord {
  factor_id: string;
  name: string;
  value: number;
  unit: string;
  source: string;
}

interface CalculationResult {
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

    // Get user's organization_id
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

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

    const organizationId = memberData.organization_id;

    // Fetch all activity data for the organization
    const { data: activityData, error: activityError } = await supabaseAdmin
      .from("activity_data")
      .select("id, organization_id, quantity, unit, name, category")
      .eq("organization_id", organizationId);

    if (activityError) {
      console.error("Error fetching activity data:", activityError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch activity data", details: activityError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!activityData || activityData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No activity data found for calculation",
          calculations_performed: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch all emissions factors
    const { data: emissionsFactors, error: factorsError } = await supabaseAdmin
      .from("emissions_factors")
      .select("factor_id, name, value, unit, source");

    if (factorsError) {
      console.error("Error fetching emissions factors:", factorsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch emissions factors", details: factorsError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!emissionsFactors || emissionsFactors.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No emissions factors found in database",
          message: "Please ensure emissions factors are loaded before running calculations"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Perform calculations
    const calculationResults: CalculationResult[] = [];
    const unmatchedActivities: string[] = [];

    for (const activity of activityData as ActivityDataRecord[]) {
      // Find matching emissions factor by unit
      const matchingFactor = (emissionsFactors as EmissionsFactorRecord[]).find(
        (factor) => factor.unit.toLowerCase() === activity.unit.toLowerCase()
      );

      if (matchingFactor) {
        // Calculate emissions: quantity * emissions_factor_value
        const calculatedValue = activity.quantity * matchingFactor.value;

        calculationResults.push({
          organization_id: activity.organization_id,
          activity_data_id: activity.id,
          emissions_factor_id: matchingFactor.factor_id,
          calculated_value_co2e: calculatedValue,
        });
      } else {
        unmatchedActivities.push(
          `Activity "${activity.name}" (unit: ${activity.unit})`
        );
      }
    }

    // Bulk insert calculation results and retrieve the created records
    let insertedRecords: any[] = [];
    if (calculationResults.length > 0) {
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from("calculated_emissions")
        .insert(calculationResults)
        .select("id");

      if (insertError) {
        console.error("Error inserting calculated emissions:", insertError);
        return new Response(
          JSON.stringify({
            error: "Failed to save calculation results",
            details: insertError.message
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      insertedRecords = insertedData || [];
    }

    // Create calculation logs for each inserted record
    if (insertedRecords.length > 0) {
      const createLogUrl = `${supabaseUrl}/functions/v1/create-calculation-log`;

      for (let i = 0; i < insertedRecords.length; i++) {
        const record = insertedRecords[i];

        try {
          const logResponse = await fetch(createLogUrl, {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              calculationId: record.id,
            }),
          });

          if (!logResponse.ok) {
            const errorData = await logResponse.json();
            console.error(`Failed to create log for calculation ${record.id}:`, errorData);
            return new Response(
              JSON.stringify({
                error: "Calculation succeeded but logging failed",
                details: `Failed to create cryptographic log for calculation record ${record.id}. Error: ${errorData.error || "Unknown error"}`,
                calculations_saved: insertedRecords.length,
                failed_at_log_index: i + 1,
              }),
              {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          const logResult = await logResponse.json();
          console.log(`Successfully created log for calculation ${record.id}:`, logResult);
        } catch (logError) {
          console.error(`Exception while creating log for calculation ${record.id}:`, logError);
          return new Response(
            JSON.stringify({
              error: "Calculation succeeded but logging failed",
              details: `Exception while creating cryptographic log for calculation record ${record.id}. Error: ${logError instanceof Error ? logError.message : "Unknown error"}`,
              calculations_saved: insertedRecords.length,
              failed_at_log_index: i + 1,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // Prepare summary message
    let message = `Successfully calculated emissions for ${calculationResults.length} activity record(s) and created ${insertedRecords.length} cryptographic log(s).`;

    if (unmatchedActivities.length > 0) {
      message += ` ${unmatchedActivities.length} activity record(s) could not be matched to emissions factors.`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message,
        calculations_performed: calculationResults.length,
        logs_created: insertedRecords.length,
        unmatched_activities: unmatchedActivities.length,
        details: {
          total_activities: activityData.length,
          matched: calculationResults.length,
          unmatched: unmatchedActivities.length,
          unmatched_list: unmatchedActivities,
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
