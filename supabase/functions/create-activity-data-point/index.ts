import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateDataPointRequest {
  lcaReportId?: string;
  facilityId?: string;
  sourceType: "platform_estimate" | "user_provided" | "supplier_provided" | "linked_lca_report";
  dataPayload: {
    openLcaProcessId?: string;
    openLcaProcessName?: string;
    [key: string]: any;
  };
  name: string;
  category: string;
  quantity: number;
  unit: string;
  activityDate: string;
}

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

    const requestData: CreateDataPointRequest = await req.json();

    const {
      lcaReportId,
      facilityId,
      sourceType,
      dataPayload,
      name,
      category,
      quantity,
      unit,
      activityDate,
    } = requestData;

    if (!name || !category || quantity === undefined || !unit || !activityDate) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: name, category, quantity, unit, activityDate",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    if (lcaReportId) {
      const { data: report } = await supabase
        .from("lca_reports")
        .select("organization_id")
        .eq("id", lcaReportId)
        .single();

      if (!report || report.organization_id !== profile.organization_id) {
        return new Response(
          JSON.stringify({
            error: "Access denied: LCA report not found or does not belong to your organization",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (facilityId) {
      const { data: facility } = await supabase
        .from("facilities")
        .select("organization_id")
        .eq("id", facilityId)
        .single();

      if (!facility || facility.organization_id !== profile.organization_id) {
        return new Response(
          JSON.stringify({
            error: "Access denied: Facility not found or does not belong to your organization",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const activityDataRecord = {
      organization_id: profile.organization_id,
      user_id: user.id,
      name,
      category,
      quantity,
      unit,
      activity_date: activityDate,
      source_type: sourceType || "platform_estimate",
      data_payload: dataPayload || {},
      linked_lca_report_id: lcaReportId || null,
      created_at: new Date().toISOString(),
    };

    const { data: newDataPoint, error: insertError } = await supabase
      .from("activity_data")
      .insert(activityDataRecord)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        dataPoint: newDataPoint,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in create-activity-data-point:", error);

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
