import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface IngestWaterDataRequest {
  facility_id?: string;
  water_source: string;
  quantity: number;
  unit: string;
  activity_date: string;
  water_type?: 'blue' | 'green' | 'grey';
  notes?: string;
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

    const {
      facility_id,
      water_source,
      quantity,
      unit,
      activity_date,
      water_type,
      notes
    }: IngestWaterDataRequest = await req.json();

    if (!water_source || quantity === undefined || !unit || !activity_date) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: water_source, quantity, unit, activity_date"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (typeof quantity !== "number" || isNaN(quantity) || quantity <= 0) {
      return new Response(
        JSON.stringify({ error: "Quantity must be a positive number" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const validUnits = ['litres', 'cubic meters', 'm3', 'gallons', 'ML', 'kL'];
    if (!validUnits.includes(unit)) {
      return new Response(
        JSON.stringify({
          error: `Invalid unit. Must be one of: ${validUnits.join(', ')}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (water_type && !['blue', 'green', 'grey'].includes(water_type)) {
      return new Response(
        JSON.stringify({
          error: "Invalid water_type. Must be one of: blue, green, grey"
        }),
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

    if (facility_id) {
      const { data: facilityData, error: facilityError } = await supabaseAdmin
        .from("facilities")
        .select("id, name")
        .eq("id", facility_id)
        .eq("organization_id", memberData.organization_id)
        .single();

      if (facilityError || !facilityData) {
        return new Response(
          JSON.stringify({ error: "Facility not found or does not belong to organization" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const activityName = facility_id
      ? `Water ${water_type || 'consumption'} - ${water_source}`
      : `${water_source} - Water ${water_type || 'consumption'}`;

    const metadata: any = {
      water_source,
    };

    if (water_type) {
      metadata.water_type = water_type;
    }

    if (facility_id) {
      metadata.facility_id = facility_id;
    }

    if (notes) {
      metadata.notes = notes;
    }

    const { data: activityData, error: insertError } = await supabaseAdmin
      .from("activity_data")
      .insert({
        organization_id: memberData.organization_id,
        user_id: user.id,
        name: activityName,
        category: 'Water',
        quantity,
        unit: unit.trim(),
        activity_date,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting water activity data:", insertError);
      return new Response(
        JSON.stringify({
          error: "Failed to insert water activity data",
          details: insertError.message
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
        data: activityData,
        message: "Water activity data ingested successfully"
      }),
      {
        status: 201,
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