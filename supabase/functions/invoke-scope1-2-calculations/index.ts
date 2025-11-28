import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  organization_id: string;
}

interface ActivityDataRecord {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  activity_date: string;
}

interface EmissionsFactorRecord {
  factor_id: string;
  name: string;
  value: number;
  unit: string;
  type: string;
  region: string;
  geographic_scope: string;
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

    // Parse request body
    const { organization_id }: RequestBody = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user is a member of the requested organization
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data: memberData, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .single();

    if (memberError || !memberData) {
      return new Response(
        JSON.stringify({ error: "User is not a member of the specified organization" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Query activity_data for Scope 1 and 2 records that haven't been processed yet
    // We need to find activity records that don't have a corresponding calculated_emissions entry
    const { data: unprocessedActivities, error: activityError } = await supabaseAdmin
      .from("activity_data")
      .select(`
        id,
        organization_id,
        name,
        category,
        quantity,
        unit,
        activity_date
      `)
      .eq("organization_id", organization_id)
      .in("category", ["Scope 1", "Scope 2"])
      .is("calculated_emissions.id", null)
      .order("activity_date", { ascending: false });

    if (activityError) {
      console.error("Error fetching unprocessed activity data:", activityError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch activity data", 
          details: activityError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Filter out already-processed activities by checking calculated_emissions
    let activityData: ActivityDataRecord[] = [];
    
    if (unprocessedActivities && unprocessedActivities.length > 0) {
      // Get all activity IDs
      const activityIds = unprocessedActivities.map((a: any) => a.id);
      
      // Check which ones already have calculations
      const { data: existingCalculations } = await supabaseAdmin
        .from("calculated_emissions")
        .select("activity_data_id")
        .in("activity_data_id", activityIds);
      
      const processedIds = new Set(
        (existingCalculations || []).map((c: any) => c.activity_data_id)
      );
      
      // Filter to only unprocessed activities
      activityData = unprocessedActivities.filter(
        (activity: any) => !processedIds.has(activity.id)
      ) as ActivityDataRecord[];
    }

    if (!activityData || activityData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No unprocessed Scope 1 or Scope 2 activity data found",
          calculations_performed: 0,
          logs_created: 0
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
      .select("factor_id, name, value, unit, type, region, geographic_scope");

    if (factorsError) {
      console.error("Error fetching emissions factors:", factorsError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch emissions factors", 
          details: factorsError.message 
        }),
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

    // Perform calculations by matching activity data with emissions factors
    const calculationResults: CalculationResult[] = [];
    const unmatchedActivities: string[] = [];

    for (const activity of activityData) {
      // Match by unit (and optionally by type/region if available in activity data)
      // For V1, we'll use unit matching as the primary criterion
      const matchingFactor = (emissionsFactors as EmissionsFactorRecord[]).find(
        (factor) => factor.unit.toLowerCase() === activity.unit.toLowerCase()
      );

      if (matchingFactor) {
        // Calculate emissions: quantity × emissions_factor_value
        const calculatedValue = activity.quantity * matchingFactor.value;

        calculationResults.push({
          organization_id: activity.organization_id,
          activity_data_id: activity.id,
          emissions_factor_id: matchingFactor.factor_id,
          calculated_value_co2e: calculatedValue,
        });
      } else {
        unmatchedActivities.push(
          `Activity "${activity.name}" (${activity.category}, unit: ${activity.unit})`
        );
      }
    }

    if (calculationResults.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No activities could be matched with emissions factors",
          unmatched_activities: unmatchedActivities.length,
          details: {
            total_unprocessed: activityData.length,
            matched: 0,
            unmatched: unmatchedActivities.length,
            unmatched_list: unmatchedActivities,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Bulk insert calculation results and retrieve the created records
    const { data: insertedRecords, error: insertError } = await supabaseAdmin
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

    if (!insertedRecords || insertedRecords.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No calculation records were created",
          details: "Insert operation returned no records"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create calculation logs for each inserted record
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

    // CRITICAL: Aggregate emissions by facility and update facility_emissions_aggregated
    // This enables facility intensity calculation for Product LCA allocation
    console.log("Aggregating emissions by facility...");

    // Query utility data entries to get facility context and reporting periods
    const activityIds = insertedRecords.map(r => r.id);
    const { data: utilityData, error: utilityError } = await supabaseAdmin
      .from('utility_data_entries')
      .select('id, facility_id, reporting_period_start, reporting_period_end')
      .in('id', activityIds);

    if (utilityError) {
      console.warn('Warning: Could not query utility data for aggregation:', utilityError);
    } else if (utilityData && utilityData.length > 0) {
      // Group calculated emissions by facility and reporting period
      const facilitiesMap = new Map<string, {
        facility_id: string;
        reporting_period_start: string;
        reporting_period_end: string;
        total_co2e: number;
        activity_count: number;
      }>();

      for (const utility of utilityData) {
        const key = `${utility.facility_id}-${utility.reporting_period_start}-${utility.reporting_period_end}`;

        // Find the corresponding calculation result
        const calcResult = calculationResults.find(r => {
          const activity = activityData.find(a => a.id === r.activity_data_id);
          return activity?.name === utility.id; // Match by utility entry ID
        });

        if (!calcResult) continue;

        if (!facilitiesMap.has(key)) {
          facilitiesMap.set(key, {
            facility_id: utility.facility_id,
            reporting_period_start: utility.reporting_period_start,
            reporting_period_end: utility.reporting_period_end,
            total_co2e: 0,
            activity_count: 0,
          });
        }

        const facilityData = facilitiesMap.get(key)!;
        facilityData.total_co2e += calcResult.calculated_value_co2e;
        facilityData.activity_count += 1;
      }

      // Update facility_emissions_aggregated records with calculated emissions
      for (const [key, facilityData] of facilitiesMap) {
        console.log(`Updating facility_emissions_aggregated for facility ${facilityData.facility_id}, period ${facilityData.reporting_period_start} to ${facilityData.reporting_period_end}`);

        const { error: updateError } = await supabaseAdmin
          .from('facility_emissions_aggregated')
          .update({
            total_co2e: facilityData.total_co2e,
            results_payload: {
              method: 'primary_verified_bills',
              activity_count: facilityData.activity_count,
              status: 'calculated',
              calculation_date: new Date().toISOString(),
            },
          })
          .eq('facility_id', facilityData.facility_id)
          .eq('reporting_period_start', facilityData.reporting_period_start)
          .eq('reporting_period_end', facilityData.reporting_period_end);

        if (updateError) {
          console.error(`Warning: Failed to update facility_emissions_aggregated for facility ${facilityData.facility_id}:`, updateError);
          // Don't fail the entire calculation, just log the warning
        } else {
          console.log(`✓ Updated facility_emissions_aggregated: ${facilityData.total_co2e.toFixed(2)} kg CO₂e for ${facilityData.activity_count} activities`);
        }
      }

      console.log(`Aggregated emissions for ${facilitiesMap.size} facility period(s)`);
    }

    // Prepare summary message
    let message = `Successfully calculated Scope 1 & 2 emissions for ${calculationResults.length} activity record(s) and created ${insertedRecords.length} cryptographic log(s).`;

    if (unmatchedActivities.length > 0) {
      message += ` ${unmatchedActivities.length} activity record(s) could not be matched to emissions factors.`;
    }

    if (facilitiesMap.size > 0) {
      message += ` Aggregated emissions for ${facilitiesMap.size} facility reporting period(s).`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message,
        calculations_performed: calculationResults.length,
        logs_created: insertedRecords.length,
        facilities_aggregated: facilitiesMap.size,
        unmatched_activities: unmatchedActivities.length,
        details: {
          total_unprocessed: activityData.length,
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
