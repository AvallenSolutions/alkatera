import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type DataProvenance = 
  | 'primary_supplier_verified'
  | 'primary_measured_onsite'
  | 'secondary_modelled_industry_average'
  | 'secondary_calculated_allocation';

type AllocationBasis = 
  | 'physical_mass'
  | 'volume_proportion'
  | 'production_volume_ratio'
  | 'none';

type ActivityCategory = 
  | 'utility_electricity'
  | 'utility_gas'
  | 'utility_fuel'
  | 'utility_other'
  | 'water_intake'
  | 'water_discharge'
  | 'water_recycled'
  | 'waste_general'
  | 'waste_hazardous'
  | 'waste_recycling';

interface RequestPayload {
  facility_id: string;
  organization_id: string;
  activity_category: ActivityCategory;
  activity_date: string;
  reporting_period_start: string;
  reporting_period_end: string;
  quantity: number;
  unit: string;
  data_provenance?: DataProvenance;
  allocation_basis?: AllocationBasis;
  brand_volume_reported?: number;
  total_facility_volume_reported?: number;
  water_source_type?: string;
  water_classification?: string;
  wastewater_treatment_method?: string;
  water_recycling_rate_percent?: number;
  water_stress_area_flag?: boolean;
  waste_category?: string;
  waste_treatment_method?: string;
  waste_recovery_percentage?: number;
  hazard_classification?: string;
  disposal_facility_type?: string;
  source_facility_id?: string;
  source_attestation_url?: string;
  supplier_submission_id?: string;
  notes?: string;
  reporting_session_id?: string;
}

function calculateConfidenceScore(provenance: DataProvenance): number {
  switch (provenance) {
    case 'primary_supplier_verified': return 95;
    case 'primary_measured_onsite': return 90;
    case 'secondary_calculated_allocation': return 70;
    case 'secondary_modelled_industry_average': return 50;
    default: return 30;
  }
}

function validatePhysicalAllocation(
  allocationBasis: AllocationBasis,
  brandVolume: number | undefined,
  totalVolume: number | undefined
): { valid: boolean; error?: string; allocationPercentage?: number } {
  if (allocationBasis === 'none' || !brandVolume || !totalVolume) {
    return { valid: true };
  }

  if (brandVolume > totalVolume) {
    return {
      valid: false,
      error: `Brand volume (${brandVolume}) cannot exceed total facility volume (${totalVolume})`,
    };
  }

  const allocationPercentage = (brandVolume / totalVolume) * 100;
  return { valid: true, allocationPercentage };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: RequestPayload = await req.json();

    if (!payload.facility_id || !payload.organization_id || !payload.activity_category ||
        !payload.activity_date || !payload.reporting_period_start || !payload.reporting_period_end ||
        payload.quantity === undefined || !payload.unit) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: facility_id, organization_id, activity_category, activity_date, reporting_period_start, reporting_period_end, quantity, unit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: memberCheck, error: memberError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", payload.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !memberCheck) {
      return new Response(
        JSON.stringify({ error: "User is not a member of this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: facility, error: facilityError } = await supabase
      .from("facilities")
      .select("id, name, operational_control, organization_id")
      .eq("id", payload.facility_id)
      .maybeSingle();

    if (facilityError || !facility) {
      return new Response(
        JSON.stringify({ error: "Facility not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (facility.organization_id !== payload.organization_id) {
      return new Response(
        JSON.stringify({ error: "Facility does not belong to this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dataProvenance = payload.data_provenance || 'secondary_modelled_industry_average';
    const allocationBasis = payload.allocation_basis || 'none';

    const allocationValidation = validatePhysicalAllocation(
      allocationBasis,
      payload.brand_volume_reported,
      payload.total_facility_volume_reported
    );

    if (!allocationValidation.valid) {
      return new Response(
        JSON.stringify({ error: allocationValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const confidenceScore = calculateConfidenceScore(dataProvenance);

    const entryData = {
      facility_id: payload.facility_id,
      organization_id: payload.organization_id,
      activity_category: payload.activity_category,
      activity_date: payload.activity_date,
      reporting_period_start: payload.reporting_period_start,
      reporting_period_end: payload.reporting_period_end,
      quantity: payload.quantity,
      unit: payload.unit,
      data_provenance: dataProvenance,
      confidence_score: confidenceScore,
      allocation_basis: allocationBasis,
      brand_volume_reported: payload.brand_volume_reported,
      total_facility_volume_reported: payload.total_facility_volume_reported,
      allocation_percentage: allocationValidation.allocationPercentage,
      water_source_type: payload.water_source_type,
      water_classification: payload.water_classification,
      wastewater_treatment_method: payload.wastewater_treatment_method,
      water_recycling_rate_percent: payload.water_recycling_rate_percent,
      water_stress_area_flag: payload.water_stress_area_flag,
      waste_category: payload.waste_category,
      waste_treatment_method: payload.waste_treatment_method,
      waste_recovery_percentage: payload.waste_recovery_percentage,
      hazard_classification: payload.hazard_classification,
      disposal_facility_type: payload.disposal_facility_type,
      source_facility_id: payload.source_facility_id,
      source_attestation_url: payload.source_attestation_url,
      supplier_submission_id: payload.supplier_submission_id,
      notes: payload.notes,
      reporting_session_id: payload.reporting_session_id,
      created_by: user.id,
    };

    const { data: entry, error: insertError } = await supabase
      .from("facility_activity_entries")
      .insert(entryData)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create activity entry", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingContext } = await supabase
      .from("emissions_calculation_context")
      .select("id")
      .eq("facility_id", payload.facility_id)
      .eq("reporting_period_start", payload.reporting_period_start)
      .eq("reporting_period_end", payload.reporting_period_end)
      .eq("is_current", true)
      .maybeSingle();

    if (!existingContext) {
      await supabase
        .from("emissions_calculation_context")
        .insert({
          facility_id: payload.facility_id,
          organization_id: payload.organization_id,
          reporting_period_start: payload.reporting_period_start,
          reporting_period_end: payload.reporting_period_end,
          operational_control_status_at_period: facility.operational_control || 'owned',
          context_established_by: user.id,
          is_current: true,
        });
    }

    const assignedScope = facility.operational_control === 'third_party'
      ? payload.activity_category.startsWith('waste_')
        ? 'Scope 3 - Upstream Waste'
        : payload.activity_category.startsWith('water_')
          ? 'Scope 3 - Upstream Water'
          : 'Scope 3 - Upstream Processes'
      : payload.activity_category.startsWith('utility_')
        ? 'Scope 1/2'
        : payload.activity_category.startsWith('waste_')
          ? 'Operational Waste'
          : 'Operational Water';

    return new Response(
      JSON.stringify({
        success: true,
        entry: {
          ...entry,
          assigned_scope: assignedScope,
          facility_name: facility.name,
          operational_control: facility.operational_control,
        },
        glass_box_metadata: {
          data_provenance: dataProvenance,
          confidence_score: confidenceScore,
          allocation_applied: allocationBasis !== 'none',
          allocation_percentage: allocationValidation.allocationPercentage,
          scope_assignment_basis: `Facility operational_control: ${facility.operational_control}`,
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in add-facility-activity-entry:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});