import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LinkRequest {
  activityDataPointId: string;
  lcaReportId: string;
}

/**
 * Link Supplier LCA Report to Activity Data Point
 *
 * This Edge Function implements the core "upgrade" mechanism that transforms
 * platform estimates into verified supplier data, creating the DQI Journey.
 *
 * Business Logic:
 * 1. Validates user has permission to modify the activity data point
 * 2. Validates the LCA report exists and belongs to user's organization
 * 3. Updates the activity data point:
 *    - source_type: 'platform_estimate' → 'linked_lca_report'
 *    - linked_lca_report_id: set to provided LCA report ID
 * 4. Automatic trigger creates immutable audit history entry
 *
 * The multi-player network effect is created because:
 * - Each supplier LCA can be linked to multiple data points
 * - Users see tangible DQI improvements when suppliers onboard
 * - Audit history makes quality journey visible and verifiable
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
    const { activityDataPointId, lcaReportId }: LinkRequest = await req.json();

    if (!activityDataPointId || !lcaReportId) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: activityDataPointId, lcaReportId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ========================================================================
    // STEP 1: Validate Activity Data Point Ownership
    // ========================================================================

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(
        JSON.stringify({ error: "User does not belong to an organization" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: activityDataPoint, error: dataPointError } = await supabase
      .from("activity_data")
      .select("id, organization_id, source_type, name")
      .eq("id", activityDataPointId)
      .single();

    if (dataPointError || !activityDataPoint) {
      return new Response(
        JSON.stringify({ error: "Activity data point not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (activityDataPoint.organization_id !== profile.organization_id) {
      return new Response(
        JSON.stringify({
          error: "Access denied: Data point does not belong to your organization",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ========================================================================
    // STEP 2: Validate LCA Report Exists and is Accessible
    // ========================================================================

    const { data: lcaReport, error: reportError } = await supabase
      .from("lca_reports")
      .select("id, organization_id, report_name, verification_status")
      .eq("id", lcaReportId)
      .single();

    if (reportError || !lcaReport) {
      return new Response(
        JSON.stringify({ error: "LCA report not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (lcaReport.organization_id !== profile.organization_id) {
      return new Response(
        JSON.stringify({
          error: "Access denied: LCA report does not belong to your organization",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ========================================================================
    // STEP 3: Perform the Upgrade (Atomic Operation)
    // ========================================================================

    console.log(
      `Upgrading activity data point ${activityDataPointId} from "${activityDataPoint.source_type}" to "linked_lca_report"`
    );
    console.log(`Linking to LCA report: ${lcaReport.report_name}`);

    const { data: updatedDataPoint, error: updateError } = await supabase
      .from("activity_data")
      .update({
        source_type: "linked_lca_report",
        linked_lca_report_id: lcaReportId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activityDataPointId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update activity data point:", updateError);
      throw new Error(`Failed to link LCA report: ${updateError.message}`);
    }

    // Note: The database trigger automatically creates the audit history entry
    // No manual insertion needed - the trigger handles immutable provenance logging

    console.log(`Successfully upgraded data point ${activityDataPointId} to Tier 1 quality`);

    // ========================================================================
    // STEP 4: Return Success Response
    // ========================================================================

    return new Response(
      JSON.stringify({
        success: true,
        message: "LCA report linked successfully",
        dataPoint: updatedDataPoint,
        upgrade: {
          from: activityDataPoint.source_type,
          to: "linked_lca_report",
          tierImprovement: "Tier 3 → Tier 1",
          linkedReport: {
            id: lcaReport.id,
            name: lcaReport.report_name,
            verificationStatus: lcaReport.verification_status,
          },
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in link-supplier-lca:", error);

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
