import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateFacilityRequest {
  action: "create";
  name: string;
  location?: string;
  facility_type_id?: string;
}

interface UpdateFacilityRequest {
  action: "update";
  facility_id: string;
  name?: string;
  location?: string;
  facility_type_id?: string;
}

interface DeleteFacilityRequest {
  action: "delete";
  facility_id: string;
}

type ManageFacilityRequest = CreateFacilityRequest | UpdateFacilityRequest | DeleteFacilityRequest;

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

    const requestData: ManageFacilityRequest = await req.json();
    const { action } = requestData;

    if (!action || !["create", "update", "delete"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be 'create', 'update', or 'delete'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data: memberData, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("id", user.id)
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

    if (action === "create") {
      const { name, location, facility_type_id } = requestData as CreateFacilityRequest;

      if (!name || name.trim() === "") {
        return new Response(
          JSON.stringify({ error: "Facility name is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: facilityData, error: insertError } = await supabaseAdmin
        .from("facilities")
        .insert({
          organization_id: organizationId,
          name: name.trim(),
          location: location?.trim() || null,
          facility_type_id: facility_type_id || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error creating facility:", insertError);
        return new Response(
          JSON.stringify({
            error: "Failed to create facility",
            details: insertError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: facilityData,
          message: "Facility created successfully",
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "update") {
      const { facility_id, name, location, facility_type_id } = requestData as UpdateFacilityRequest;

      if (!facility_id) {
        return new Response(
          JSON.stringify({ error: "facility_id is required for update" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: existingFacility, error: fetchError } = await supabaseAdmin
        .from("facilities")
        .select("id, name")
        .eq("id", facility_id)
        .eq("organization_id", organizationId)
        .single();

      if (fetchError || !existingFacility) {
        return new Response(
          JSON.stringify({ error: "Facility not found or does not belong to your organization" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) {
        if (name.trim() === "") {
          return new Response(
            JSON.stringify({ error: "Facility name cannot be empty" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        updateData.name = name.trim();
      }

      if (location !== undefined) {
        updateData.location = location.trim() || null;
      }

      if (facility_type_id !== undefined) {
        updateData.facility_type_id = facility_type_id || null;
      }

      const { data: updatedFacility, error: updateError } = await supabaseAdmin
        .from("facilities")
        .update(updateData)
        .eq("id", facility_id)
        .eq("organization_id", organizationId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating facility:", updateError);
        return new Response(
          JSON.stringify({
            error: "Failed to update facility",
            details: updateError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: updatedFacility,
          message: "Facility updated successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "delete") {
      const { facility_id } = requestData as DeleteFacilityRequest;

      if (!facility_id) {
        return new Response(
          JSON.stringify({ error: "facility_id is required for delete" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: existingFacility, error: fetchError } = await supabaseAdmin
        .from("facilities")
        .select("id, name")
        .eq("id", facility_id)
        .eq("organization_id", organizationId)
        .single();

      if (fetchError || !existingFacility) {
        return new Response(
          JSON.stringify({ error: "Facility not found or does not belong to your organization" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from("facilities")
        .delete()
        .eq("id", facility_id)
        .eq("organization_id", organizationId);

      if (deleteError) {
        console.error("Error deleting facility:", deleteError);
        return new Response(
          JSON.stringify({
            error: "Failed to delete facility",
            details: deleteError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Facility deleted successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
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