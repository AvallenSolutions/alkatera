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

    // CRITICAL: Aggregate emissions and update facility_emissions_aggregated
    // This enables facility intensity calculation for Product LCA allocation
    console.log("Aggregating emissions for facility intensity calculation...");

    try {
      // Sum up all calculated emissions for this organization
      const totalEmissions = calculationResults.reduce((sum, result) => sum + result.calculated_value_co2e, 0);
      console.log(`Total emissions calculated: ${totalEmissions.toFixed(2)} kg CO₂e from ${calculationResults.length} activities`);

      // Calculate scope breakdown from the calculation results
      const scope1Total = calculationResults
        .filter((_, idx) => activityData[idx]?.category === 'Scope 1')
        .reduce((sum, result) => sum + result.calculated_value_co2e, 0);

      const scope2Total = calculationResults
        .filter((_, idx) => activityData[idx]?.category === 'Scope 2')
        .reduce((sum, result) => sum + result.calculated_value_co2e, 0);

      console.log(`Scope breakdown - Scope 1: ${scope1Total.toFixed(2)} kg CO₂e, Scope 2: ${scope2Total.toFixed(2)} kg CO₂e`);

      // Query existing facility_emissions_aggregated records that need updating
      // These are records with production volume (update ALL records, not just those with zero emissions)
      const { data: facilityRecords, error: queryError } = await supabaseAdmin
        .from('facility_emissions_aggregated')
        .select('id, facility_id, reporting_period_start, reporting_period_end, total_production_volume')
        .eq('organization_id', organization_id)
        .eq('data_source_type', 'Primary')
        .not('total_production_volume', 'is', null); // Must have production volume

      if (queryError) {
        console.warn('Warning: Could not query facility_emissions_aggregated:', queryError);
      } else if (facilityRecords && facilityRecords.length > 0) {
        console.log(`Found ${facilityRecords.length} facility record(s) awaiting emissions calculation`);

        // For simplicity, update each record with the total calculated emissions
        // In a real scenario with multiple facilities, you'd need more sophisticated allocation
        for (const record of facilityRecords) {
          console.log(`Updating facility_emissions_aggregated record ${record.id} for facility ${record.facility_id}`);

          const { error: updateError } = await supabaseAdmin
            .from('facility_emissions_aggregated')
            .update({
              total_co2e: totalEmissions,
              results_payload: {
                method: 'primary_verified_bills',
                activity_count: calculationResults.length,
                status: 'calculated',
                calculation_date: new Date().toISOString(),
                scope_breakdown: {
                  scope1: scope1Total,
                  scope2: scope2Total,
                },
              },
            })
            .eq('id', record.id);

          if (updateError) {
            console.error(`Warning: Failed to update facility_emissions_aggregated record ${record.id}:`, updateError);
          } else {
            console.log(`Successfully updated facility_emissions_aggregated record ${record.id} with ${totalEmissions.toFixed(2)} kg CO₂e`);
          }
        }
      } else {
        console.log('No facility_emissions_aggregated records found with production volume data.');
      }
    } catch (aggError) {
      console.error('Error during facility emissions aggregation:', aggError);
      // Don't fail the entire function if aggregation fails
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Scope 1 & 2 emissions calculated successfully",
        calculations_performed: calculationResults.length,
        logs_created: insertedRecords.length,
        unmatched_activities: unmatchedActivities.length > 0 ? unmatchedActivities : undefined,
        details: {
          total_activities_processed: activityData.length,
          matched: calculationResults.length,
          unmatched: unmatchedActivities.length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in invoke-scope1-2-calculations:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});