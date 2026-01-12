import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CCFReques {
  organization_id: string;
  year: number;
  overheads?: {
    business_travel?: number;
    purchased_services?: number;
    employee_commuting_ftes?: number;
  };
}

// NOTE: This interface must match /lib/calculations/corporate-emissions.ts
// to ensure consistency across Dashboard, Company Vitality, and CCF Reports
interface ScopeBreakdown {
  scope1: number;
  scope2: number;
  scope3: {
    products: number;
    business_travel: number;
    purchased_services: number;
    employee_commuting: number;
    capital_goods: number;
    downstream_logistics: number;
    operational_waste: number;
    marketing_materials: number;
    total: number;
  };
  total: number;
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

    const { organization_id, year, overheads }: CCFReques = await req.json();

    if (!organization_id || !year) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: organization_id, year" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Generating CCF report for org ${organization_id}, year ${year}`);

    // ===== LOGIC BLOCK A: BOTTOM-UP (HIGH ACCURACY) =====

    // Step 1: Scope 1 & 2 - Query facility activity data for the year
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Get Scope 1 & 2 from facility_activity_data (same as Company Emissions page)
    const { data: facilityData, error: facilityError } = await supabase
      .from("facility_activity_data")
      .select(`
        quantity,
        scope_1_2_emission_sources!inner (
          scope,
          emission_factor_id
        )
      `)
      .eq("organization_id", organization_id)
      .gte("reporting_period_start", yearStart)
      .lte("reporting_period_end", yearEnd);

    if (facilityError) {
      console.error("Error fetching facility emissions:", facilityError);
    }

    let scope1Total = 0;
    let scope2Total = 0;

    if (facilityData) {
      // Calculate Scope 1
      const scope1Items = facilityData.filter((item: any) =>
        item.scope_1_2_emission_sources?.scope === 'Scope 1'
      );

      for (const item of scope1Items) {
        const factorId = (item as any).scope_1_2_emission_sources?.emission_factor_id;
        if (factorId) {
          const { data: factor } = await supabase
            .from('emissions_factors')
            .select('value')
            .eq('factor_id', factorId)
            .maybeSingle();

          if (factor?.value) {
            scope1Total += item.quantity * parseFloat(factor.value);
          }
        }
      }

      // Calculate Scope 2
      const scope2Items = facilityData.filter((item: any) =>
        item.scope_1_2_emission_sources?.scope === 'Scope 2'
      );

      for (const item of scope2Items) {
        const factorId = (item as any).scope_1_2_emission_sources?.emission_factor_id;
        if (factorId) {
          const { data: factor } = await supabase
            .from('emissions_factors')
            .select('value')
            .eq('factor_id', factorId)
            .maybeSingle();

          if (factor?.value) {
            scope2Total += item.quantity * parseFloat(factor.value);
          }
        }
      }
    }

    console.log(`Scope 1 Total (facilities): ${scope1Total} kgCO2e`);
    console.log(`Scope 2 Total (facilities): ${scope2Total} kgCO2e`);

    // Add fleet emissions to Scope 1 & 2
    const { data: fleetScope1Data } = await supabase
      .from('fleet_activities')
      .select('emissions_tco2e')
      .eq('organization_id', organization_id)
      .eq('scope', 'Scope 1')
      .gte('reporting_period_start', yearStart)
      .lte('reporting_period_end', yearEnd);

    let fleetScope1Kg = 0;
    if (fleetScope1Data) {
      fleetScope1Data.forEach((item: any) => {
        const itemKg = (item.emissions_tco2e || 0) * 1000; // Convert tCO2e to kgCO2e
        fleetScope1Kg += itemKg;
        scope1Total += itemKg;
      });
    }

    const { data: fleetScope2Data } = await supabase
      .from('fleet_activities')
      .select('emissions_tco2e')
      .eq('organization_id', organization_id)
      .eq('scope', 'Scope 2')
      .gte('reporting_period_start', yearStart)
      .lte('reporting_period_end', yearEnd);

    let fleetScope2Kg = 0;
    if (fleetScope2Data) {
      fleetScope2Data.forEach((item: any) => {
        const itemKg = (item.emissions_tco2e || 0) * 1000; // Convert tCO2e to kgCO2e
        fleetScope2Kg += itemKg;
        scope2Total += itemKg;
      });
    }

    console.log(`Fleet Scope 1: ${fleetScope1Kg} kgCO2e`);
    console.log(`Fleet Scope 2: ${fleetScope2Kg} kgCO2e`);
    console.log(`Scope 1 Total (with fleet): ${scope1Total} kgCO2e`);
    console.log(`Scope 2 Total (with fleet): ${scope2Total} kgCO2e`);

    // Step 2: Scope 3 (Products) - Query production logs and multiply by LCA total impacts
    // CRITICAL: Use total_ghg_emissions (full lifecycle) NOT just materials breakdown
    const { data: productionLogs, error: productionError } = await supabase
      .from("production_logs")
      .select("product_id, units_produced, date")
      .eq("organization_id", organization_id)
      .gte("date", yearStart)
      .lte("date", yearEnd);

    if (productionError) {
      console.error("Error fetching production logs:", productionError);
    }

    let scope3ProductsTotal = 0;

    if (productionLogs) {
      for (const log of productionLogs) {
        // Skip if no units produced
        if (!log.units_produced || log.units_produced <= 0) {
          console.warn(`Skipping production log for product ${log.product_id} - no units_produced`);
          continue;
        }

        // CRITICAL: Use aggregated_impacts.breakdown.by_scope.scope3 instead of total_ghg_emissions
        // total_ghg_emissions includes owned facility Scope 1 & 2 which would cause double counting
        // breakdown.by_scope.scope3 contains only: materials + transport + contract mfg + end-of-life
        const { data: lca } = await supabase
          .from("product_lcas")
          .select("id, aggregated_impacts")
          .eq("product_id", log.product_id)
          .eq("status", "completed")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Extract Scope 3 emissions from the breakdown (excludes owned facility S1+S2)
        const scope3PerUnit = lca?.aggregated_impacts?.breakdown?.by_scope?.scope3 || 0;

        if (lca && scope3PerUnit > 0) {
          // Use the Scope 3 portion only - excludes owned facility emissions
          // (materials, transport, contract mfg, end-of-life)
          const totalImpactKg = scope3PerUnit * log.units_produced;
          scope3ProductsTotal += totalImpactKg;

          console.log(`Product ${log.product_id}: ${log.units_produced} units × ${scope3PerUnit.toFixed(4)} kgCO2e/unit (Scope 3 only) = ${totalImpactKg.toFixed(2)} kgCO2e`);
        }
      }
    }

    console.log(`Scope 3 (Products) Total: ${scope3ProductsTotal} kgCO2e`);

    // ===== LOGIC BLOCK B: FETCH ALL OVERHEADS FROM DATABASE =====

    // First check if a report exists to get its ID
    const { data: existingReport } = await supabase
      .from("corporate_reports")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("year", year)
      .maybeSingle();

    let overheadScope3Total = 0;
    let businessTravelTotal = 0;
    let purchasedServicesTotal = 0;
    let employeeCommutingTotal = 0;
    let capitalGoodsTotal = 0;
    let logisticsTotal = 0;
    let wasteTotal = 0;
    let marketingMaterialsTotal = 0;

    // Fetch all overhead entries from the database if report exists
    // NOTE: Logic must match /lib/calculations/corporate-emissions.ts
    if (existingReport) {
      const { data: overheadEntries, error: overheadError } = await supabase
        .from("corporate_overheads")
        .select("category, computed_co2e, material_type")
        .eq("report_id", existingReport.id);

      if (!overheadError && overheadEntries) {
        console.log(`Found ${overheadEntries.length} overhead entries`);

        // Sum by category - matches shared corporate-emissions.ts logic
        overheadEntries.forEach((entry: any) => {
          const co2e = entry.computed_co2e || 0;
          overheadScope3Total += co2e;

          switch (entry.category) {
            case "business_travel":
              businessTravelTotal += co2e;
              break;
            case "employee_commuting":
              employeeCommutingTotal += co2e;
              break;
            case "capital_goods":
              capitalGoodsTotal += co2e;
              break;
            case "operational_waste":
              wasteTotal += co2e;
              break;
            case "downstream_logistics":
              logisticsTotal += co2e;
              break;
            case "purchased_services":
              // Marketing materials have material_type field set
              if (entry.material_type) {
                marketingMaterialsTotal += co2e;
              } else {
                purchasedServicesTotal += co2e;
              }
              break;
            default:
              // Fallback to purchased_services
              purchasedServicesTotal += co2e;
              break;
          }
        });

        console.log(`Overhead Scope 3 Total: ${overheadScope3Total} kgCO2e`);
        console.log(`Business Travel (overheads): ${businessTravelTotal} kgCO2e`);
        console.log(`Purchased Services: ${purchasedServicesTotal} kgCO2e`);
        console.log(`Marketing Materials: ${marketingMaterialsTotal} kgCO2e`);
        console.log(`Employee Commuting: ${employeeCommutingTotal} kgCO2e`);
        console.log(`Capital Goods: ${capitalGoodsTotal} kgCO2e`);
        console.log(`Logistics: ${logisticsTotal} kgCO2e`);
        console.log(`Waste: ${wasteTotal} kgCO2e`);
      }
    }

    // Add Scope 3 Cat 6 (Grey Fleet) to business travel
    const { data: fleetScope3Data } = await supabase
      .from('fleet_activities')
      .select('emissions_tco2e')
      .eq('organization_id', organization_id)
      .eq('scope', 'Scope 3 Cat 6')
      .gte('reporting_period_start', yearStart)
      .lte('reporting_period_end', yearEnd);

    let fleetScope3Kg = 0;
    if (fleetScope3Data) {
      fleetScope3Data.forEach((item: any) => {
        const itemKg = (item.emissions_tco2e || 0) * 1000; // Convert tCO2e to kgCO2e
        fleetScope3Kg += itemKg;
        businessTravelTotal += itemKg;
        overheadScope3Total += itemKg;
      });
    }

    console.log(`Fleet Scope 3 Cat 6 (Grey Fleet): ${fleetScope3Kg} kgCO2e`);
    console.log(`Business Travel Total (with fleet): ${businessTravelTotal} kgCO2e`);

    // ===== AGGREGATE TOTALS =====

    const scope3Total = scope3ProductsTotal + overheadScope3Total;

    const totalEmissions = scope1Total + scope2Total + scope3Total;

    const breakdown: ScopeBreakdown = {
      scope1: scope1Total,
      scope2: scope2Total,
      scope3: {
        products: scope3ProductsTotal,
        business_travel: businessTravelTotal,
        purchased_services: purchasedServicesTotal,
        employee_commuting: employeeCommutingTotal,
        capital_goods: capitalGoodsTotal,
        downstream_logistics: logisticsTotal,
        operational_waste: wasteTotal,
        marketing_materials: marketingMaterialsTotal,
        total: scope3Total,
      },
      total: totalEmissions,
    };

    // ===== SAVE TO DATABASE =====

    // Create or update the corporate report
    const { data: report, error: reportError } = await supabase
      .from("corporate_reports")
      .upsert(
        {
          organization_id,
          year,
          status: "Draft",
          total_emissions: totalEmissions,
          breakdown_json: breakdown,
        },
        {
          onConflict: "organization_id,year",
        }
      )
      .select()
      .single();

    if (reportError) {
      throw reportError;
    }

    // Save overhead entries if provided
    if (overheads && report) {
      const overheadEntries = [];

      if (overheads.business_travel) {
        overheadEntries.push({
          report_id: report.id,
          category: "business_travel",
          spend_amount: overheads.business_travel,
          currency: "GBP",
          emission_factor: 0.25,
          computed_co2e: businessTravelTotal,
        });
      }

      if (overheads.purchased_services) {
        overheadEntries.push({
          report_id: report.id,
          category: "purchased_services",
          spend_amount: overheads.purchased_services,
          currency: "GBP",
          emission_factor: 0.15,
          computed_co2e: purchasedServicesTotal,
        });
      }

      if (overheads.employee_commuting_ftes) {
        overheadEntries.push({
          report_id: report.id,
          category: "employee_commuting",
          spend_amount: overheads.employee_commuting_ftes,
          currency: "GBP",
          emission_factor: 2500,
          computed_co2e: employeeCommutingTotal,
        });
      }

      if (overheadEntries.length > 0) {
        // Delete existing overheads for this report
        await supabase
          .from("corporate_overheads")
          .delete()
          .eq("report_id", report.id);

        // Insert new overheads
        await supabase.from("corporate_overheads").insert(overheadEntries);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_id: report.id,
        breakdown,
        total_emissions: totalEmissions,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error generating CCF report:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to generate CCF report",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});