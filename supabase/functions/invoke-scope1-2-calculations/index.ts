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
  facility_id?: string;
  fuel_type?: string;
  reporting_period_start?: string;
  reporting_period_end?: string;
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

// DEFRA Energy Emission Factor record structure
interface DefraEnergyFactorRecord {
  id: string;
  fuel_type: string;
  fuel_type_display: string;
  factor_year: number;
  co2e_factor: number;
  factor_unit: string;
  scope: string;
}

// Utility type to DEFRA fuel type mapping
const UTILITY_TO_FUEL_TYPE: Record<string, string> = {
  'electricity_grid': 'grid_electricity',
  'heat_steam_purchased': 'heat_steam',
  'natural_gas': 'natural_gas_kwh',
  'natural_gas_m3': 'natural_gas_m3',
  'lpg': 'lpg_litre',
  'diesel_stationary': 'diesel_stationary',
  'heavy_fuel_oil': 'heavy_fuel_oil',
  'biomass_solid': 'biomass_wood_chips',
  'refrigerant_leakage': 'refrigerant_r410a',
  'diesel_mobile': 'diesel_stationary',
  'petrol_mobile': 'petrol',
};

// Normalize unit strings to match DEFRA factor units
function normalizeUnit(unit: string): string {
  const lowerUnit = unit.toLowerCase();

  // Volume units
  if (['litres', 'liters', 'l', 'ltr'].includes(lowerUnit)) return 'litre';
  if (['m³', 'm3', 'cubic metres', 'cubic meters'].includes(lowerUnit)) return 'm3';

  // Energy units - preserve case for kWh
  if (['kwh', 'kilowatt-hours', 'kilowatt hours'].includes(lowerUnit)) return 'kWh';
  if (['mwh', 'megawatt-hours'].includes(lowerUnit)) return 'MWh';

  // Mass units
  if (['kg', 'kilograms', 'kilogram', 'kgs'].includes(lowerUnit)) return 'kg';
  if (['tonnes', 'tonne', 'metric tons', 'metric ton'].includes(lowerUnit)) return 'tonne';

  return lowerUnit;
}

// Get the appropriate DEFRA factor year based on reporting period
function getDefraFactorYear(reportingPeriodEnd: string, availableYears: number[]): number {
  const periodYear = new Date(reportingPeriodEnd).getFullYear();

  // Find the closest available year that is <= period year
  const validYears = availableYears.filter(y => y <= periodYear);
  if (validYears.length > 0) {
    return Math.max(...validYears);
  }

  // Fallback to earliest available year
  return Math.min(...availableYears);
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

    // Check organization membership
    const { data: memberData } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    // If not a member, check advisor access
    let hasAccess = !!memberData;
    if (!hasAccess) {
      const { data: advisorData } = await supabaseAdmin
        .from("advisor_organization_access")
        .select("id")
        .eq("advisor_user_id", user.id)
        .eq("organization_id", organization_id)
        .eq("is_active", true)
        .maybeSingle();
      hasAccess = !!advisorData;
    }

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "User does not have access to the specified organization" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Query activity_data for Scope 1 and 2 records that haven't been processed yet
    // We need to find activity records that don't have a corresponding calculated_emissions entry
    // Now includes facility_id, fuel_type, and reporting period for proper aggregation
    const { data: unprocessedActivities, error: activityError } = await supabaseAdmin
      .from("activity_data")
      .select(`
        id,
        organization_id,
        name,
        category,
        quantity,
        unit,
        activity_date,
        facility_id,
        fuel_type,
        reporting_period_start,
        reporting_period_end
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

    // Determine the reporting period for DEFRA year selection
    // Use the most recent activity's reporting period, or fall back to activity_date
    const sampleActivity = activityData[0];
    const reportingPeriodEnd = sampleActivity.reporting_period_end || sampleActivity.activity_date;

    // Fetch available DEFRA factor years
    const { data: availableYearsData } = await supabaseAdmin
      .from("defra_energy_emission_factors")
      .select("factor_year")
      .order("factor_year", { ascending: false });

    const availableYears = [...new Set((availableYearsData || []).map((r: any) => r.factor_year))];
    const targetFactorYear = getDefraFactorYear(reportingPeriodEnd, availableYears);
    // Fetch DEFRA energy emission factors for the appropriate year
    const { data: defraFactors, error: factorsError } = await supabaseAdmin
      .from("defra_energy_emission_factors")
      .select("id, fuel_type, fuel_type_display, factor_year, co2e_factor, factor_unit, scope")
      .eq("factor_year", targetFactorYear);

    if (factorsError) {
      console.error("Error fetching DEFRA emission factors:", factorsError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch DEFRA emission factors",
          details: factorsError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Also fetch legacy emissions_factors as fallback
    const { data: legacyFactors } = await supabaseAdmin
      .from("emissions_factors")
      .select("factor_id, name, value, unit, type, region, geographic_scope");

    const emissionsFactors = legacyFactors || [];

    if ((!defraFactors || defraFactors.length === 0) && emissionsFactors.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No emissions factors found in database",
          message: "Please ensure DEFRA emission factors are loaded before running calculations"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    // Perform calculations by matching activity data with emissions factors
    // Priority: 1) Match by fuel_type from DEFRA, 2) Match by normalized unit from DEFRA, 3) Fallback to legacy factors
    const calculationResults: CalculationResult[] = [];
    const unmatchedActivities: string[] = [];

    for (const activity of activityData) {
      let matchingFactor: { id: string; value: number } | null = null;
      const normalizedUnit = normalizeUnit(activity.unit);

      // First, try to match using fuel_type from activity data
      if (activity.fuel_type && defraFactors) {
        const defraMatch = (defraFactors as DefraEnergyFactorRecord[]).find(
          (factor) => factor.fuel_type === activity.fuel_type
        );
        if (defraMatch) {
          matchingFactor = { id: defraMatch.id, value: defraMatch.co2e_factor };
        }
      }

      // Second, try to derive fuel_type from activity name/type and match
      if (!matchingFactor && defraFactors) {
        // Extract utility type from activity name (e.g., "Natural Gas - 2024-01-01 to 2024-12-31")
        const activityNameLower = activity.name.toLowerCase();
        let derivedFuelType: string | undefined;

        for (const [utilityType, fuelType] of Object.entries(UTILITY_TO_FUEL_TYPE)) {
          const utilityLabel = utilityType.replace(/_/g, ' ');
          if (activityNameLower.includes(utilityLabel) || activityNameLower.includes(utilityType)) {
            derivedFuelType = fuelType;
            break;
          }
        }

        // Also check common fuel type keywords
        if (!derivedFuelType) {
          if (activityNameLower.includes('natural gas')) derivedFuelType = normalizedUnit === 'm3' ? 'natural_gas_m3' : 'natural_gas_kwh';
          else if (activityNameLower.includes('electricity')) derivedFuelType = 'grid_electricity';
          else if (activityNameLower.includes('diesel')) derivedFuelType = 'diesel_stationary';
          else if (activityNameLower.includes('lpg') || activityNameLower.includes('propane')) derivedFuelType = 'lpg_litre';
          else if (activityNameLower.includes('petrol') || activityNameLower.includes('gasoline')) derivedFuelType = 'petrol';
          else if (activityNameLower.includes('heat') || activityNameLower.includes('steam')) derivedFuelType = 'heat_steam';
          else if (activityNameLower.includes('heavy fuel')) derivedFuelType = 'heavy_fuel_oil';
        }

        if (derivedFuelType) {
          const defraMatch = (defraFactors as DefraEnergyFactorRecord[]).find(
            (factor) => factor.fuel_type === derivedFuelType
          );
          if (defraMatch) {
            matchingFactor = { id: defraMatch.id, value: defraMatch.co2e_factor };
          }
        }
      }

      // Third, try matching by normalized unit from DEFRA factors
      if (!matchingFactor && defraFactors) {
        const defraMatch = (defraFactors as DefraEnergyFactorRecord[]).find(
          (factor) => normalizeUnit(factor.factor_unit) === normalizedUnit
        );
        if (defraMatch) {
          matchingFactor = { id: defraMatch.id, value: defraMatch.co2e_factor };
        }
      }

      // Fallback: try legacy emissions_factors table
      if (!matchingFactor && emissionsFactors.length > 0) {
        const legacyMatch = (emissionsFactors as EmissionsFactorRecord[]).find(
          (factor) => normalizeUnit(factor.unit) === normalizedUnit
        );
        if (legacyMatch) {
          matchingFactor = { id: legacyMatch.factor_id, value: legacyMatch.value };
        }
      }

      if (matchingFactor) {
        // Calculate emissions: quantity × emissions_factor_value
        const calculatedValue = activity.quantity * matchingFactor.value;

        calculationResults.push({
          organization_id: activity.organization_id,
          activity_data_id: activity.id,
          emissions_factor_id: matchingFactor.id,
          calculated_value_co2e: calculatedValue,
        });
      } else {
        unmatchedActivities.push(
          `Activity "${activity.name}" (${activity.category}, unit: ${activity.unit}, normalized: ${normalizedUnit})`
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
    // Now properly aggregates per-facility using facility_id
    try {
      // Group calculation results by facility_id
      const facilityEmissions: Record<string, {
        total: number;
        scope1: number;
        scope2: number;
        count: number;
        reportingPeriodStart?: string;
        reportingPeriodEnd?: string;
      }> = {};

      calculationResults.forEach((result, idx) => {
        const activity = activityData[idx];
        const facilityId = activity?.facility_id || 'unknown';

        if (!facilityEmissions[facilityId]) {
          facilityEmissions[facilityId] = {
            total: 0,
            scope1: 0,
            scope2: 0,
            count: 0,
            reportingPeriodStart: activity?.reporting_period_start,
            reportingPeriodEnd: activity?.reporting_period_end,
          };
        }

        facilityEmissions[facilityId].total += result.calculated_value_co2e;
        facilityEmissions[facilityId].count += 1;

        if (activity?.category === 'Scope 1') {
          facilityEmissions[facilityId].scope1 += result.calculated_value_co2e;
        } else {
          facilityEmissions[facilityId].scope2 += result.calculated_value_co2e;
        }
      });
      // Calculate org-wide totals for logging
      const totalEmissions = calculationResults.reduce((sum, result) => sum + result.calculated_value_co2e, 0);
      // Query existing facility_emissions_aggregated records that need updating
      const { data: facilityRecords, error: queryError } = await supabaseAdmin
        .from('facility_emissions_aggregated')
        .select('id, facility_id, reporting_period_start, reporting_period_end, total_production_volume')
        .eq('organization_id', organization_id)
        .eq('data_source_type', 'Primary')
        .not('total_production_volume', 'is', null);

      if (queryError) {
        console.warn('Warning: Could not query facility_emissions_aggregated:', queryError);
      } else if (facilityRecords && facilityRecords.length > 0) {
        for (const record of facilityRecords) {
          // Get emissions for this specific facility, or fall back to org total if no facility_id tracking
          const facilityData = facilityEmissions[record.facility_id] || facilityEmissions['unknown'];
          const emissionsToApply = facilityData?.total || totalEmissions;
          const scope1 = facilityData?.scope1 || calculationResults.filter((_, idx) => activityData[idx]?.category === 'Scope 1').reduce((sum, result) => sum + result.calculated_value_co2e, 0);
          const scope2 = facilityData?.scope2 || calculationResults.filter((_, idx) => activityData[idx]?.category === 'Scope 2').reduce((sum, result) => sum + result.calculated_value_co2e, 0);
          const activityCount = facilityData?.count || calculationResults.length;
          const { error: updateError } = await supabaseAdmin
            .from('facility_emissions_aggregated')
            .update({
              total_co2e: emissionsToApply,
              results_payload: {
                method: 'primary_verified_bills',
                activity_count: activityCount,
                status: 'calculated',
                calculation_date: new Date().toISOString(),
                defra_factor_year: targetFactorYear, // Store the DEFRA year used
                scope_breakdown: {
                  scope1: scope1,
                  scope2: scope2,
                },
              },
            })
            .eq('id', record.id);

          if (updateError) {
            console.error(`Warning: Failed to update facility_emissions_aggregated record ${record.id}:`, updateError);
          } else {
          }
        }
      } else {
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