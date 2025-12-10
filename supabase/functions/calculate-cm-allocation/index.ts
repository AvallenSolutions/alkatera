import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EnergyInput {
  fuel_type: string;
  consumption_value: number;
  consumption_unit: string;
}

interface AllocationRequest {
  organization_id: string;
  product_id: number;
  facility_id: string;
  supplier_id?: string;
  reporting_period_start: string;
  reporting_period_end: string;
  total_facility_production_volume: number;
  production_volume_unit: string;
  co2e_entry_method: "direct" | "calculated_from_energy";
  direct_co2e_kg?: number;
  energy_inputs?: EnergyInput[];
  emission_factor_year: number;
  client_production_volume: number;
  is_energy_intensive_process: boolean;
  energy_intensive_notes?: string;
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AllocationRequest = await req.json();

    let totalFacilityCo2e = 0;
    const processedEnergyInputs: any[] = [];

    if (body.co2e_entry_method === "direct") {
      totalFacilityCo2e = body.direct_co2e_kg || 0;
    } else if (body.co2e_entry_method === "calculated_from_energy" && body.energy_inputs) {
      for (const input of body.energy_inputs) {
        const { data: factor } = await supabase
          .from("defra_energy_emission_factors")
          .select("*")
          .eq("fuel_type", input.fuel_type)
          .eq("factor_year", body.emission_factor_year)
          .maybeSingle();

        let factorToUse = factor;
        if (!factorToUse) {
          const { data: latestFactor } = await supabase
            .from("defra_energy_emission_factors")
            .select("*")
            .eq("fuel_type", input.fuel_type)
            .order("factor_year", { ascending: false })
            .limit(1)
            .maybeSingle();
          factorToUse = latestFactor;
        }

        if (!factorToUse) {
          return new Response(
            JSON.stringify({ error: `No emission factor found for fuel type: ${input.fuel_type}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const calculatedCo2e = input.consumption_value * factorToUse.co2e_factor;
        totalFacilityCo2e += calculatedCo2e;

        processedEnergyInputs.push({
          fuel_type: input.fuel_type,
          consumption_value: input.consumption_value,
          consumption_unit: input.consumption_unit,
          emission_factor_used: factorToUse.co2e_factor,
          emission_factor_unit: `kgCO2e/${factorToUse.factor_unit}`,
          emission_factor_year: factorToUse.factor_year,
          emission_factor_source: factorToUse.source,
          calculated_co2e_kg: calculatedCo2e,
        });
      }
    }

    const attributionRatio = body.client_production_volume / body.total_facility_production_volume;
    const allocatedEmissions = totalFacilityCo2e * attributionRatio;
    const emissionIntensity = allocatedEmissions / body.client_production_volume;

    const status = body.is_energy_intensive_process ? "provisional" : "verified";

    const calculationMetadata = {
      calculation_timestamp: new Date().toISOString(),
      formula: "allocated_emissions = total_facility_co2e * (client_volume / total_volume)",
      methodology: "ISO 14067 Physical Allocation",
      inputs: {
        total_facility_co2e_kg: totalFacilityCo2e,
        total_facility_production_volume: body.total_facility_production_volume,
        client_production_volume: body.client_production_volume,
        production_volume_unit: body.production_volume_unit,
      },
      outputs: {
        attribution_ratio: attributionRatio,
        allocated_emissions_kg_co2e: allocatedEmissions,
        emission_intensity_kg_co2e_per_unit: emissionIntensity,
      },
      emission_factor_metadata: {
        year: body.emission_factor_year,
        source: "DEFRA",
        entry_method: body.co2e_entry_method,
      },
      energy_inputs_breakdown: processedEnergyInputs,
    };

    const allocationData = {
      organization_id: body.organization_id,
      product_id: body.product_id,
      facility_id: body.facility_id,
      supplier_id: body.supplier_id || null,
      reporting_period_start: body.reporting_period_start,
      reporting_period_end: body.reporting_period_end,
      total_facility_production_volume: body.total_facility_production_volume,
      production_volume_unit: body.production_volume_unit,
      total_facility_co2e_kg: totalFacilityCo2e,
      co2e_entry_method: body.co2e_entry_method,
      emission_factor_year: body.emission_factor_year,
      emission_factor_source: "DEFRA",
      client_production_volume: body.client_production_volume,
      attribution_ratio: attributionRatio,
      allocated_emissions_kg_co2e: allocatedEmissions,
      emission_intensity_kg_co2e_per_unit: emissionIntensity,
      status: status,
      is_energy_intensive_process: body.is_energy_intensive_process,
      energy_intensive_notes: body.energy_intensive_notes || null,
      created_by: user.id,
      data_quality_score: body.co2e_entry_method === "calculated_from_energy" ? 4 : 3,
      data_source_tag: "Primary - Allocated",
      calculation_metadata: calculationMetadata,
      locked_at: new Date().toISOString(),
    };

    const { data: allocation, error: insertError } = await supabase
      .from("contract_manufacturer_allocations")
      .insert(allocationData)
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (processedEnergyInputs.length > 0) {
      const energyInputsWithAllocationId = processedEnergyInputs.map((input) => ({
        ...input,
        allocation_id: allocation.id,
      }));

      const { error: energyError } = await supabase
        .from("contract_manufacturer_energy_inputs")
        .insert(energyInputsWithAllocationId);

      if (energyError) {
        console.error("Error inserting energy inputs:", energyError);
      }
    }

    const { error: logError } = await supabase.from("calculation_logs").insert({
      organization_id: body.organization_id,
      calculation_type: "contract_manufacturer_allocation",
      input_data: body,
      output_data: {
        allocation_id: allocation.id,
        attribution_ratio: attributionRatio,
        allocated_emissions_kg_co2e: allocatedEmissions,
        emission_intensity_kg_co2e_per_unit: emissionIntensity,
        status: status,
      },
      methodology: "ISO 14067 Physical Allocation",
      created_by: user.id,
    });

    if (logError) {
      console.error("Error creating calculation log:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        allocation_id: allocation.id,
        status: status,
        results: {
          total_facility_co2e_kg: totalFacilityCo2e,
          attribution_ratio: attributionRatio,
          allocated_emissions_kg_co2e: allocatedEmissions,
          emission_intensity_kg_co2e_per_unit: emissionIntensity,
        },
        message: body.is_energy_intensive_process
          ? "Allocation saved as Provisional - pending verification"
          : "Allocation saved and verified",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing allocation:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
