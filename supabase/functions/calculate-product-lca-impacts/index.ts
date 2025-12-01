import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AggregatedImpacts {
  climate_change_gwp100: number;
  water_consumption: number;
  water_scarcity_aware: number;
  land_use: number;
  terrestrial_ecotoxicity: number;
  freshwater_eutrophication: number;
  terrestrial_acidification: number;
  fossil_resource_scarcity: number;
  circularity_percentage: number;
  water_risk_level: string;
  breakdown: {
    materials: number;
    packaging: number;
    production: number;
    transport: number;
    end_of_life: number;
  };
  ghg_breakdown: {
    carbon_origin: {
      fossil: number;
      biogenic: number;
      land_use_change: number;
    };
    gas_inventory: {
      co2_fossil: number;
      co2_biogenic: number;
      methane: number;
      nitrous_oxide: number;
      hfc_pfc: number;
    };
  };
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { product_lca_id } = await req.json();

    if (!product_lca_id) {
      throw new Error("product_lca_id is required");
    }

    console.log(`[LCA Calculation] Starting calculation for LCA: ${product_lca_id}`);

    // 1. Fetch LCA basic info
    const { data: lca, error: lcaError } = await supabase
      .from("product_lcas")
      .select("id, product_id, product_name, functional_unit, functional_unit_quantity")
      .eq("id", product_lca_id)
      .single();

    if (lcaError) throw lcaError;
    if (!lca) throw new Error("LCA not found");

    console.log(`[LCA Calculation] Found LCA: ${lca.product_name}`);

    // 2. Fetch all materials with their impacts
    const { data: materials, error: materialsError } = await supabase
      .from("product_lca_materials")
      .select(`
        id,
        name,
        quantity,
        unit,
        impact_climate,
        impact_water,
        impact_land,
        impact_waste,
        impact_water_scarcity,
        impact_terrestrial_ecotoxicity,
        impact_freshwater_eutrophication,
        impact_terrestrial_acidification,
        impact_fossil_resource_scarcity,
        packaging_category,
        lca_sub_stage_id,
        lca_sub_stages (
          lca_stage_id,
          lca_life_cycle_stages (
            name
          )
        )
      `)
      .eq("product_lca_id", product_lca_id);

    if (materialsError) throw materialsError;

    console.log(`[LCA Calculation] Found ${materials?.length || 0} materials`);

    // 3. Fetch production sites and their emissions
    const { data: productionSites, error: sitesError } = await supabase
      .from("product_lca_production_sites")
      .select(`
        facility_id,
        production_volume,
        share_of_production,
        facility_intensity,
        attributable_emissions_per_unit,
        facilities (
          name,
          location_country_code
        )
      `)
      .eq("product_lca_id", product_lca_id);

    if (sitesError) console.warn("Error fetching production sites:", sitesError);

    console.log(`[LCA Calculation] Found ${productionSites?.length || 0} production sites`);

    // Initialize totals
    let totalClimate = 0;
    let totalWater = 0;
    let totalWaterScarcity = 0;
    let totalLand = 0;
    let totalTerrestrialEcotox = 0;
    let totalFreshwaterEutro = 0;
    let totalTerrestrialAcid = 0;
    let totalFossilResource = 0;

    // Breakdown by category
    let materialsClimate = 0;
    let packagingClimate = 0;
    let productionClimate = 0;

    // GHG breakdown
    let fossilCO2 = 0;
    let biogenicCO2 = 0;
    let landUseChange = 0;
    let methaneTotal = 0;
    let nitrousOxideTotal = 0;

    // 4. Calculate materials impacts
    materials?.forEach((material: any) => {
      const climate = Number(material.impact_climate) || 0;
      const water = Number(material.impact_water) || 0;
      const waterScarcity = Number(material.impact_water_scarcity) || water * 20; // Default AWARE factor
      const land = Number(material.impact_land) || 0;
      const terrestrialEcotox = Number(material.impact_terrestrial_ecotoxicity) || 0;
      const freshwaterEutro = Number(material.impact_freshwater_eutrophication) || 0;
      const terrestrialAcid = Number(material.impact_terrestrial_acidification) || 0;
      const fossilResource = Number(material.impact_fossil_resource_scarcity) || 0;

      totalClimate += climate;
      totalWater += water;
      totalWaterScarcity += waterScarcity;
      totalLand += land;
      totalTerrestrialEcotox += terrestrialEcotox;
      totalFreshwaterEutro += freshwaterEutro;
      totalTerrestrialAcid += terrestrialAcid;
      totalFossilResource += fossilResource;

      // Categorize as material vs packaging
      const isPackaging = material.packaging_category ||
                         material.name?.toLowerCase().includes('bottle') ||
                         material.name?.toLowerCase().includes('cap') ||
                         material.name?.toLowerCase().includes('label') ||
                         material.name?.toLowerCase().includes('packaging');

      if (isPackaging) {
        packagingClimate += climate;
      } else {
        materialsClimate += climate;
      }

      // GHG breakdown by material type
      const name = (material.name || '').toLowerCase();
      const category = (material.packaging_category || '').toLowerCase();

      if (category === 'glass' || name.includes('glass')) {
        fossilCO2 += climate;
      } else if (category === 'plastic' || category === 'pet' || category === 'hdpe' || name.includes('plastic')) {
        fossilCO2 += climate;
      } else if (category === 'metal' || category === 'aluminium' || name.includes('aluminium') || name.includes('cap')) {
        fossilCO2 += climate;
      } else if (name.includes('sugar') || name.includes('glucose') || name.includes('fructose')) {
        biogenicCO2 += climate * 0.85;
        fossilCO2 += climate * 0.10;
        nitrousOxideTotal += (climate * 0.05) / 273;
      } else if (name.includes('fruit') || name.includes('apple') || name.includes('lemon') || name.includes('juice')) {
        biogenicCO2 += climate * 0.80;
        fossilCO2 += climate * 0.10;
        landUseChange += climate * 0.08;
        nitrousOxideTotal += (climate * 0.02) / 273;
      } else if (category === 'paper' || category === 'cardboard' || name.includes('label') || name.includes('cardboard')) {
        biogenicCO2 += climate * 0.70;
        fossilCO2 += climate * 0.25;
        landUseChange += climate * 0.05;
      } else if (name.includes('water')) {
        fossilCO2 += climate * 0.90;
        methaneTotal += (climate * 0.10) / 27.9;
      } else {
        // Default split
        fossilCO2 += climate * 0.70;
        biogenicCO2 += climate * 0.20;
        landUseChange += climate * 0.05;
        methaneTotal += (climate * 0.03) / 27.9;
        nitrousOxideTotal += (climate * 0.02) / 273;
      }
    });

    console.log(`[LCA Calculation] Materials total: ${totalClimate.toFixed(3)} kg CO2eq`);

    // 5. Calculate production emissions
    productionSites?.forEach((site: any) => {
      const emissions = Number(site.attributable_emissions_per_unit) || 0;
      productionClimate += emissions;
      totalClimate += emissions;

      // Production is 100% fossil CO2 from energy
      fossilCO2 += emissions;
    });

    console.log(`[LCA Calculation] Production total: ${productionClimate.toFixed(3)} kg CO2eq`);

    // 6. Calculate water risk level
    const avgWaterScarcity = totalWater > 0 ? totalWaterScarcity / totalWater : 0;
    let waterRiskLevel = 'low';
    if (avgWaterScarcity > 40) waterRiskLevel = 'high';
    else if (avgWaterScarcity > 20) waterRiskLevel = 'medium';

    // 7. Calculate circularity
    const circularityPercentage = totalFossilResource > 0
      ? Math.max(0, Math.min(100, 100 - (totalFossilResource * 10)))
      : 65; // Default if no data

    // 8. Build aggregated impacts
    const aggregatedImpacts: AggregatedImpacts = {
      climate_change_gwp100: totalClimate,
      water_consumption: totalWater,
      water_scarcity_aware: totalWaterScarcity,
      land_use: totalLand,
      terrestrial_ecotoxicity: totalTerrestrialEcotox,
      freshwater_eutrophication: totalFreshwaterEutro,
      terrestrial_acidification: totalTerrestrialAcid,
      fossil_resource_scarcity: totalFossilResource,
      circularity_percentage: Math.round(circularityPercentage),
      water_risk_level: waterRiskLevel,
      breakdown: {
        materials: materialsClimate,
        packaging: packagingClimate,
        production: productionClimate,
        transport: 0, // TODO: Add transport when available
        end_of_life: 0, // TODO: Add end-of-life when available
      },
      ghg_breakdown: {
        carbon_origin: {
          fossil: fossilCO2,
          biogenic: biogenicCO2,
          land_use_change: landUseChange,
        },
        gas_inventory: {
          co2_fossil: fossilCO2,
          co2_biogenic: biogenicCO2,
          methane: methaneTotal,
          nitrous_oxide: nitrousOxideTotal,
          hfc_pfc: 0,
        },
      },
    };

    console.log(`[LCA Calculation] Total impacts calculated:`, {
      climate: totalClimate.toFixed(3),
      breakdown: {
        materials: materialsClimate.toFixed(3),
        packaging: packagingClimate.toFixed(3),
        production: productionClimate.toFixed(3),
      },
      ghg: {
        fossil: fossilCO2.toFixed(3),
        biogenic: biogenicCO2.toFixed(3),
        luc: landUseChange.toFixed(3),
      }
    });

    // 9. Update product_lcas with aggregated impacts
    const { error: updateError } = await supabase
      .from("product_lcas")
      .update({
        aggregated_impacts: aggregatedImpacts,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", product_lca_id);

    if (updateError) throw updateError;

    console.log(`[LCA Calculation] Successfully updated LCA ${product_lca_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        product_lca_id,
        aggregated_impacts: aggregatedImpacts,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("[LCA Calculation] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to calculate LCA impacts",
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
