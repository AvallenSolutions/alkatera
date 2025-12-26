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

interface ScopeBreakdown {
  scope1: number;
  scope2: number;
  scope3: {
    products: number;
    business_travel: number;
    purchased_services: number;
    employee_commuting: number;
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

    // Step 1: Scope 1 & 2 - Query facility emissions for the year
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Get Scope 1 & 2 from activity data and calculated emissions
    const { data: facilityEmissions, error: facilityError } = await supabase
      .from("calculated_emissions")
      .select("total_co2e, scope")
      .eq("organization_id", organization_id)
      .gte("date", yearStart)
      .lte("date", yearEnd);

    if (facilityError) {
      console.error("Error fetching facility emissions:", facilityError);
    }

    let scope1Total = 0;
    let scope2Total = 0;

    if (facilityEmissions) {
      facilityEmissions.forEach((emission) => {
        if (emission.scope === 1) {
          scope1Total += emission.total_co2e || 0;
        } else if (emission.scope === 2) {
          scope2Total += emission.total_co2e || 0;
        }
      });
    }

    console.log(`Scope 1 Total: ${scope1Total} kgCO2e`);
    console.log(`Scope 2 Total: ${scope2Total} kgCO2e`);

    // Step 2: Scope 3 (Products) - Query production logs and multiply by LCA impacts
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

        // Get the latest LCA for this product
        const { data: lca } = await supabase
          .from("product_lcas")
          .select("total_ghg_emissions")
          .eq("product_id", log.product_id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lca && lca.total_ghg_emissions && lca.total_ghg_emissions > 0) {
          // LCA emissions are per consumer unit (bottle/can)
          // Multiply emissions per unit by units produced
          const totalImpact = lca.total_ghg_emissions * log.units_produced;

          scope3ProductsTotal += totalImpact;

          console.log(`Product ${log.product_id}: ${log.units_produced} units × ${lca.total_ghg_emissions} kgCO2e/unit = ${totalImpact} kgCO2e`);
        }
      }
    }

    console.log(`Scope 3 (Products) Total: ${scope3ProductsTotal} kgCO2e`);

    // ===== LOGIC BLOCK B: TOP-DOWN (GAP-FILL) =====

    let businessTravelTotal = 0;
    let purchasedServicesTotal = 0;
    let employeeCommutingTotal = 0;

    if (overheads) {
      // Business Travel
      if (overheads.business_travel) {
        const factor = 0.25; // kgCO2e per GBP (from EEIO)
        businessTravelTotal = overheads.business_travel * factor;
      }

      // Purchased Services
      if (overheads.purchased_services) {
        const factor = 0.15; // kgCO2e per GBP (from EEIO)
        purchasedServicesTotal = overheads.purchased_services * factor;
      }

      // Employee Commuting (using FTE count)
      if (overheads.employee_commuting_ftes) {
        const annualCommutingPerFTE = 2500; // kgCO2e per FTE per year (UK average)
        employeeCommutingTotal = overheads.employee_commuting_ftes * annualCommutingPerFTE;
      }
    }

    console.log(`Business Travel: ${businessTravelTotal} kgCO2e`);
    console.log(`Purchased Services: ${purchasedServicesTotal} kgCO2e`);
    console.log(`Employee Commuting: ${employeeCommutingTotal} kgCO2e`);

    // ===== AGGREGATE TOTALS =====

    const scope3Total =
      scope3ProductsTotal +
      businessTravelTotal +
      purchasedServicesTotal +
      employeeCommutingTotal;

    const totalEmissions = scope1Total + scope2Total + scope3Total;

    const breakdown: ScopeBreakdown = {
      scope1: scope1Total,
      scope2: scope2Total,
      scope3: {
        products: scope3ProductsTotal,
        business_travel: businessTravelTotal,
        purchased_services: purchasedServicesTotal,
        employee_commuting: employeeCommutingTotal,
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