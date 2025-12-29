import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FleetEmissionsRequest {
  organization_id: string;
  vehicle_id?: string;
  manual_vehicle_category?: string;
  manual_fuel_type?: string;
  manual_ownership_type?: string;
  data_entry_method: 'volume' | 'distance' | 'spend' | 'consumption';
  fuel_volume_litres?: number;
  distance_km?: number;
  spend_amount?: number;
  spend_currency?: string;
  electricity_kwh?: number;
  grid_region?: string;
  activity_date: string;
  reporting_period_start?: string;
  reporting_period_end?: string;
  data_quality?: string;
  data_source_notes?: string;
  purpose?: string;
  driver_name?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    const payload: FleetEmissionsRequest = await req.json();

    if (!payload.organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.data_entry_method) {
      return new Response(
        JSON.stringify({ error: 'data_entry_method is required (volume, distance, spend, or consumption)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let vehicleCategory = payload.manual_vehicle_category || 'car';
    let fuelType = payload.manual_fuel_type || 'petrol';
    let ownershipType = payload.manual_ownership_type || 'company_owned';
    let calculatedScope = 'Scope 1';

    if (payload.vehicle_id) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .select('vehicle_class, fuel_type, propulsion_type, ownership_type, calculated_scope')
        .eq('id', payload.vehicle_id)
        .single();

      if (vehicleError) {
        return new Response(
          JSON.stringify({ error: 'Vehicle not found', details: vehicleError.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      vehicleCategory = vehicle.vehicle_class || 'car';
      fuelType = vehicle.fuel_type || 'petrol';
      ownershipType = vehicle.ownership_type || 'company_owned';
      calculatedScope = vehicle.calculated_scope || 'Scope 1';
    } else {
      if (ownershipType === 'company_owned' || ownershipType === 'company_leased') {
        if (fuelType === 'electric') {
          calculatedScope = 'Scope 2';
        } else {
          calculatedScope = 'Scope 1';
        }
      } else {
        calculatedScope = 'Scope 3 Cat 6';
      }
    }

    let emissionFactorName: string;
    let activityValue: number;
    let factorUnit: string;

    switch (payload.data_entry_method) {
      case 'volume':
        if (!payload.fuel_volume_litres) {
          return new Response(
            JSON.stringify({ error: 'fuel_volume_litres is required for volume-based calculation' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        activityValue = payload.fuel_volume_litres;
        emissionFactorName = fuelType === 'diesel' ? 'Diesel - Mobile Combustion' : 'Petrol - Mobile Combustion';
        factorUnit = 'kgCO2e/litre';
        break;

      case 'distance':
        if (!payload.distance_km) {
          return new Response(
            JSON.stringify({ error: 'distance_km is required for distance-based calculation' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        activityValue = payload.distance_km;

        if (fuelType === 'electric') {
          emissionFactorName = vehicleCategory === 'van'
            ? 'Battery Electric Vehicle - Van'
            : 'Battery Electric Vehicle - Average Car';
        } else if (vehicleCategory === 'van') {
          emissionFactorName = 'Class III Van - Diesel';
        } else if (vehicleCategory === 'hgv') {
          emissionFactorName = 'Articulated HGV';
        } else {
          emissionFactorName = fuelType === 'diesel'
            ? 'Average Car - Diesel'
            : 'Average Car - Petrol';
        }
        factorUnit = 'kgCO2e/km';
        break;

      case 'consumption':
        if (!payload.electricity_kwh) {
          return new Response(
            JSON.stringify({ error: 'electricity_kwh is required for consumption-based calculation' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        activityValue = payload.electricity_kwh;
        emissionFactorName = 'UK Grid Electricity';
        factorUnit = 'kgCO2e/kWh';
        break;

      case 'spend':
        return new Response(
          JSON.stringify({ error: 'Spend-based calculation not yet implemented' }),
          { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid data_entry_method' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const { data: factor, error: factorError } = await supabase
      .from('emissions_factors')
      .select('factor_id, value, unit, name, source')
      .ilike('name', emissionFactorName)
      .order('year_of_publication', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (factorError || !factor) {
      console.error('Factor lookup failed:', emissionFactorName, factorError);
      return new Response(
        JSON.stringify({ error: `Emission factor not found: ${emissionFactorName}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emissionsKgCO2e = activityValue * Number(factor.value);
    const emissionsTCO2e = emissionsKgCO2e / 1000;

    const { data: logData, error: logError } = await supabase
      .from('calculation_logs')
      .insert({
        organization_id: payload.organization_id,
        input_data: {
          vehicle_id: payload.vehicle_id,
          vehicle_category: vehicleCategory,
          fuel_type: fuelType,
          ownership_type: ownershipType,
          data_entry_method: payload.data_entry_method,
          activity_value: activityValue,
          activity_date: payload.activity_date,
        },
        output_value: emissionsTCO2e,
        output_unit: 'tCO2e',
        methodology_version: 'Fleet Emissions Calculator v1.0',
        factor_ids_used: [factor.factor_id],
      })
      .select('log_id')
      .single();

    if (logError) {
      console.error('Calculation log error:', logError);
    }

    const { data: activityData, error: insertError } = await supabase
      .from('fleet_activities')
      .insert({
        organization_id: payload.organization_id,
        vehicle_id: payload.vehicle_id || null,
        manual_vehicle_category: payload.vehicle_id ? null : vehicleCategory,
        manual_fuel_type: payload.vehicle_id ? null : fuelType,
        manual_ownership_type: payload.vehicle_id ? null : ownershipType,
        activity_date: payload.activity_date,
        distance_km: payload.distance_km || null,
        fuel_volume_litres: payload.fuel_volume_litres || null,
        electricity_kwh: payload.electricity_kwh || null,
        spend_amount: payload.spend_amount || null,
        spend_currency: payload.spend_currency || 'GBP',
        data_entry_method: payload.data_entry_method,
        emissions_tco2e: emissionsTCO2e,
        scope: calculatedScope,
        data_quality: payload.data_quality || 'Secondary',
        data_source_notes: payload.data_source_notes || null,
        purpose: payload.purpose || null,
        driver_name: payload.driver_name || null,
        reporting_period_start: payload.reporting_period_start || payload.activity_date,
        reporting_period_end: payload.reporting_period_end || payload.activity_date,
        emission_factor_id: factor.factor_id,
        calculation_log_id: logData?.log_id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Activity insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save fleet activity', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        activity_id: activityData.id,
        calculated_scope: calculatedScope,
        emissions_kgco2e: emissionsKgCO2e,
        emissions_tco2e: emissionsTCO2e,
        emission_factor: {
          name: factor.name,
          value: factor.value,
          unit: factor.unit,
          source: factor.source,
        },
        calculation_log_id: logData?.log_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Fleet emissions calculation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});