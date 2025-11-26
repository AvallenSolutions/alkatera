import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  organization_id: string;
  reporting_period_start?: string;
  reporting_period_end?: string;
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

interface WaterMetric {
  metric_type: string;
  metric_value: number;
  metric_unit: string;
  activity_data_id: string;
  metadata?: any;
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
      organization_id,
      reporting_period_start,
      reporting_period_end
    }: RequestBody = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: memberData, error: memberError } = await supabaseClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .single();

    if (memberError || !memberData) {
      return new Response(
        JSON.stringify({ error: "User does not have access to this organization" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    let query = supabaseAdmin
      .from("activity_data")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("category", "Water");

    if (reporting_period_start) {
      query = query.gte("activity_date", reporting_period_start);
    }

    if (reporting_period_end) {
      query = query.lte("activity_date", reporting_period_end);
    }

    const { data: waterActivities, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching water activities:", fetchError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch water activity data",
          details: fetchError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!waterActivities || waterActivities.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No water activity data found for the specified period",
          metrics_calculated: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const inputDataSummary = {
      total_records: waterActivities.length,
      activity_ids: waterActivities.map((a: ActivityDataRecord) => a.id),
      date_range: {
        start: waterActivities.reduce((min: string, a: ActivityDataRecord) =>
          a.activity_date < min ? a.activity_date : min, waterActivities[0].activity_date),
        end: waterActivities.reduce((max: string, a: ActivityDataRecord) =>
          a.activity_date > max ? a.activity_date : max, waterActivities[0].activity_date)
      }
    };

    const totalWaterConsumption = waterActivities.reduce(
      (sum: number, activity: ActivityDataRecord) => {
        let normalizedQuantity = activity.quantity;
        const unitLower = activity.unit.toLowerCase();

        if (unitLower === 'm3' || unitLower === 'm³' || unitLower === 'cubic meters' || unitLower === 'cubic_meters') {
          normalizedQuantity = activity.quantity * 1000;
        } else if (unitLower === 'liters' || unitLower === 'litres' || unitLower === 'l') {
          normalizedQuantity = activity.quantity;
        } else if (unitLower === 'ml' || unitLower === 'milliliters' || unitLower === 'millilitres') {
          normalizedQuantity = activity.quantity / 1000;
        } else if (unitLower === 'kl' || unitLower === 'kiloliters' || unitLower === 'kilolitres') {
          normalizedQuantity = activity.quantity * 1000;
        } else if (unitLower === 'gallons') {
          normalizedQuantity = activity.quantity * 3.78541;
        } else {
          console.warn(`Unknown water unit: ${activity.unit}, treating as liters`);
          normalizedQuantity = activity.quantity;
        }

        return sum + normalizedQuantity;
      },
      0
    );

    const blueWaterRatio = 0.85;
    const greenWaterRatio = 0.10;
    const greyWaterRatio = 0.05;

    const blueWaterFootprint = totalWaterConsumption * blueWaterRatio;
    const greenWaterFootprint = totalWaterConsumption * greenWaterRatio;
    const greyWaterFootprint = totalWaterConsumption * greyWaterRatio;

    const { data: logData, error: logError } = await supabaseAdmin
      .from("calculation_logs")
      .insert({
        organization_id,
        user_id: user.id,
        input_data: inputDataSummary,
        output_value: totalWaterConsumption,
        output_unit: 'litres',
        methodology_version: '1.0.0',
        factor_ids_used: [],
        multiplication_proof: `Total Water Consumption Calculation:

Input Activities: ${waterActivities.length} records
Total Normalized Volume: ${totalWaterConsumption.toFixed(2)} litres

Water Footprint Breakdown:
- Blue Water (${(blueWaterRatio * 100)}%): ${blueWaterFootprint.toFixed(2)} litres
- Green Water (${(greenWaterRatio * 100)}%): ${greenWaterFootprint.toFixed(2)} litres
- Grey Water (${(greyWaterRatio * 100)}%): ${greyWaterFootprint.toFixed(2)} litres

Methodology: Water Footprint Assessment Manual v1.0
Calculation Date: ${new Date().toISOString()}`
      })
      .select()
      .single();

    if (logError || !logData) {
      console.error("Error creating calculation log:", logError);
      return new Response(
        JSON.stringify({
          error: "Failed to create calculation log",
          details: logError?.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const metricsToInsert: WaterMetric[] = [];

    waterActivities.forEach((activity: ActivityDataRecord) => {
      let normalizedQuantity = activity.quantity;
      const unitLower = activity.unit.toLowerCase();

      if (unitLower === 'm3' || unitLower === 'm³' || unitLower === 'cubic meters' || unitLower === 'cubic_meters') {
        normalizedQuantity = activity.quantity * 1000;
      } else if (unitLower === 'liters' || unitLower === 'litres' || unitLower === 'l') {
        normalizedQuantity = activity.quantity;
      } else if (unitLower === 'ml' || unitLower === 'milliliters' || unitLower === 'millilitres') {
        normalizedQuantity = activity.quantity / 1000;
      } else if (unitLower === 'kl' || unitLower === 'kiloliters' || unitLower === 'kilolitres') {
        normalizedQuantity = activity.quantity * 1000;
      } else if (unitLower === 'gallons') {
        normalizedQuantity = activity.quantity * 3.78541;
      } else {
        console.warn(`Unknown water unit: ${activity.unit}, treating as liters`);
        normalizedQuantity = activity.quantity;
      }

      metricsToInsert.push({
        metric_type: 'blue_water_footprint',
        metric_value: normalizedQuantity * blueWaterRatio,
        metric_unit: 'litres',
        activity_data_id: activity.id,
        metadata: {
          activity_name: activity.name,
          activity_date: activity.activity_date,
          original_quantity: activity.quantity,
          original_unit: activity.unit,
          allocation_ratio: blueWaterRatio
        }
      });

      metricsToInsert.push({
        metric_type: 'green_water_footprint',
        metric_value: normalizedQuantity * greenWaterRatio,
        metric_unit: 'litres',
        activity_data_id: activity.id,
        metadata: {
          activity_name: activity.name,
          activity_date: activity.activity_date,
          original_quantity: activity.quantity,
          original_unit: activity.unit,
          allocation_ratio: greenWaterRatio
        }
      });

      metricsToInsert.push({
        metric_type: 'grey_water_footprint',
        metric_value: normalizedQuantity * greyWaterRatio,
        metric_unit: 'litres',
        activity_data_id: activity.id,
        metadata: {
          activity_name: activity.name,
          activity_date: activity.activity_date,
          original_quantity: activity.quantity,
          original_unit: activity.unit,
          allocation_ratio: greyWaterRatio
        }
      });
    });

    const metricsForInsert = metricsToInsert.map(metric => ({
      organization_id,
      metric_type: metric.metric_type,
      metric_value: metric.metric_value,
      metric_unit: metric.metric_unit,
      activity_data_id: metric.activity_data_id,
      source_log_id: logData.log_id,
      reporting_period_start: reporting_period_start || null,
      reporting_period_end: reporting_period_end || null,
      metadata: metric.metadata
    }));

    const { data: metricsData, error: metricsError } = await supabaseAdmin
      .from("calculated_metrics")
      .insert(metricsForInsert)
      .select();

    if (metricsError) {
      console.error("Error inserting calculated metrics:", metricsError);
      return new Response(
        JSON.stringify({
          error: "Failed to insert calculated metrics",
          details: metricsError.message
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
        message: "Water footprint calculations completed successfully",
        summary: {
          activities_processed: waterActivities.length,
          metrics_created: metricsData?.length || 0,
          calculation_log_id: logData.log_id,
          total_water_consumption: {
            value: totalWaterConsumption,
            unit: 'litres'
          },
          water_footprint_breakdown: {
            blue_water: {
              value: blueWaterFootprint,
              unit: 'litres',
              percentage: blueWaterRatio * 100
            },
            green_water: {
              value: greenWaterFootprint,
              unit: 'litres',
              percentage: greenWaterRatio * 100
            },
            grey_water: {
              value: greyWaterFootprint,
              unit: 'litres',
              percentage: greyWaterRatio * 100
            }
          }
        }
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