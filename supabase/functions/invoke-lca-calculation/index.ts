import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  convertUnits,
  calculateImpact,
  calculateDqiProfile,
  isBoundaryCompatible,
  generateGovernanceMetadata,
  type ActivityDataPoint,
} from "../_shared/lca-calculation-logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CalculationRequest {
  lca_id: string;
}

/**
 * Invoke LCA Calculation - Composable Calculation Engine
 *
 * This Edge Function orchestrates the complete LCA calculation process:
 *
 * 1. Fetch Root LCA Metadata
 *    - Retrieves system boundary, functional unit, target unit
 *    - Used for governance checks and unit standardization
 *
 * 2. Resolve Dependency Graph
 *    - Calls recursive PostgreSQL function
 *    - Flattens nested LCA reports into primitive data points
 *    - Enriches with provenance and system boundary metadata
 *
 * 3. Perform Governance Checks
 *    - MANDATORY: System boundary compatibility validation
 *    - DQI propagation using "weakest link" principle
 *    - Fails calculation if governance rules violated
 *
 * 4. Unit Standardization
 *    - Converts all quantities to target unit (e.g., kg CO2e)
 *    - Supports common GHG emission units
 *
 * 5. Aggregate & Calculate
 *    - Sums total emissions
 *    - Creates category-level breakdown
 *    - Generates final result with DQI profile
 *
 * 6. Create Immutable Log
 *    - Persists complete calculation to calculation_logs
 *    - Includes inputs, outputs, governance metadata, engine version
 *    - Enables complete reproducibility and audit trail
 *
 * Business Value:
 * - Enables recursive "LCAs of LCAs" for supply chain transparency
 * - Enforces ISO 14040/14044 compliance automatically
 * - Creates verifiable audit trail for regulatory reporting
 * - Supports composable multi-player network effects
 */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Authentication: Verify user is authenticated
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request payload
    const { lca_id }: CalculationRequest = await req.json();

    if (!lca_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: lca_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Calculation Engine v4.4] Starting calculation for LCA: ${lca_id}`);

    // ========================================================================
    // STEP 1: Fetch Root LCA Metadata for Governance Checks
    // ========================================================================

    const { data: rootLca, error: rootLcaError } = await supabase
      .from("lca_reports")
      .select("id, organization_id, report_name, system_boundary, functional_unit, target_unit")
      .eq("id", lca_id)
      .single();

    if (rootLcaError || !rootLca) {
      return new Response(
        JSON.stringify({ error: "LCA report not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user has access to this LCA's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.organization_id !== rootLca.organization_id) {
      return new Response(
        JSON.stringify({ error: "Access denied: LCA does not belong to your organization" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Root LCA: ${rootLca.report_name}`);
    console.log(`System Boundary: ${rootLca.system_boundary}`);
    console.log(`Target Unit: ${rootLca.target_unit}`);

    // ========================================================================
    // STEP 2: Resolve the Entire Dependency Graph
    // ========================================================================

    console.log("Resolving LCA dependency graph...");

    const { data: flattenedDataPoints, error: resolveError } = await supabase
      .rpc("resolve_lca_dependency_graph", { root_lca_id: lca_id });

    if (resolveError) {
      console.error("Failed to resolve dependency graph:", resolveError);
      throw new Error(`Dependency resolution failed: ${resolveError.message}`);
    }

    if (!flattenedDataPoints || flattenedDataPoints.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No activity data points found for this LCA",
          details: "The LCA report must have at least one data point to calculate",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Resolved ${flattenedDataPoints.length} data points from dependency graph`);

    // ========================================================================
    // STEP 3: Perform Mandatory Governance Checks & Unit Standardization
    // ========================================================================

    console.log("Performing governance checks...");

    const processedDataPoints: ActivityDataPoint[] = [];

    for (const dp of flattenedDataPoints) {
      // MANDATORY GOVERNANCE CHECK: System Boundary Compatibility
      if (!isBoundaryCompatible(dp.source_lca_system_boundary, rootLca.system_boundary)) {
        const errorMsg = `Calculation Failed: Incompatible system boundary. ` +
          `Linked report [${dp.source_lca_name}] (${dp.source_lca_system_boundary}) ` +
          `is not a valid input for a ${rootLca.system_boundary} calculation.`;

        console.error(errorMsg);

        // Log the failed calculation
        await supabase.from("calculation_logs").insert({
          lca_id: lca_id,
          organization_id: rootLca.organization_id,
          status: "failed",
          error_details: {
            message: errorMsg,
            type: "GovernanceError",
            incompatible_lca: {
              id: dp.source_lca_id,
              name: dp.source_lca_name,
              boundary: dp.source_lca_system_boundary,
            },
            root_lca: {
              id: rootLca.id,
              name: rootLca.report_name,
              boundary: rootLca.system_boundary,
            },
          },
          calculation_engine_version: "v4.4-composable-hardened",
          created_by: user.id,
        });

        return new Response(
          JSON.stringify({
            error: errorMsg,
            type: "GovernanceError",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Unit conversion to target unit
      const convertedValue = convertUnits(dp.quantity, dp.unit, rootLca.target_unit);

      processedDataPoints.push({
        ...dp,
        quantity: convertedValue,
        unit: rootLca.target_unit,
      });
    }

    console.log("✓ All governance checks passed");

    // ========================================================================
    // STEP 4: Aggregate & Calculate Final Result
    // ========================================================================

    console.log("Calculating total environmental impact...");

    const finalResult = await calculateImpact(processedDataPoints, rootLca.target_unit);

    console.log(`Total Emissions: ${finalResult.total_emissions} ${finalResult.unit}`);
    console.log(`DQI Profile: ${finalResult.dqi_profile}`);
    console.log(`Data Points Processed: ${finalResult.data_points_count}`);

    // Generate governance metadata
    const governanceMetadata = generateGovernanceMetadata(
      processedDataPoints,
      finalResult.dqi_profile
    );

    // ========================================================================
    // STEP 5: Persist Results & Create Immutable Calculation Log
    // ========================================================================

    console.log("Creating immutable calculation log...");

    const { data: log, error: logError } = await supabase
      .from("calculation_logs")
      .insert({
        lca_id: lca_id,
        organization_id: rootLca.organization_id,
        status: "success",
        result_payload: finalResult,
        inputs_payload: flattenedDataPoints,
        governance_metadata: governanceMetadata,
        calculation_engine_version: "v4.4-composable-hardened",
        created_by: user.id,
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create calculation log:", logError);
      throw new Error(`Logging failed: ${logError.message}`);
    }

    console.log(`✓ Calculation log created: ${log.id}`);

    // ========================================================================
    // STEP 6: Return Success Response
    // ========================================================================

    return new Response(
      JSON.stringify({
        success: true,
        log_id: log.id,
        result: finalResult,
        governance: governanceMetadata,
        message: "LCA calculation completed successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in invoke-lca-calculation:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
