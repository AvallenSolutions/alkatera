import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MaterialBreakdownItem {
  name: string;
  quantity: number;
  unit: string;
  emissions: number;
  percentage: number;
  category: string;
  dataSource: string;
}

interface FacilityBreakdownItem {
  facility_name: string;
  emissions: number;
  percentage: number;
  scope1: number;
  scope2: number;
}

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
    by_scope: {
      scope1: number;
      scope2: number;
      scope3: number;
    };
    by_category: {
      materials: number;
      packaging: number;
      production: number;
      transport: number;
      end_of_life: number;
    };
    by_material: MaterialBreakdownItem[];
    by_facility: FacilityBreakdownItem[];
    by_lifecycle_stage: Array<{
      stage: string;
      emissions: number;
      percentage: number;
    }>;
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
      .select("id, product_id, product_name, functional_unit, functional_unit_quantity, organization_id")
      .eq("id", product_lca_id)
      .single();

    if (lcaError) throw lcaError;
    if (!lca) throw new Error("LCA not found");

    console.log(`[LCA Calculation] Found LCA: ${lca.product_name}`);

    // 2. Fetch all materials with their PRE-CALCULATED impacts
    // This matches Calculation Verifier pattern: quantity × emission_factor already stored
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
        impact_source,
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

    // 3. Fetch production sites and their emissions FROM FACILITY ACTIVITY DATA
    // This replicates the Calculation Verifier approach
    const { data: productionSites, error: sitesError } = await supabase
      .from("product_lca_production_sites")
      .select(`
        facility_id,
        production_volume,
        share_of_production,
        facility_intensity,
        attributable_emissions_per_unit,
        facilities (
          id,
          name,
          location_country_code
        )
      `)
      .eq("product_lca_id", product_lca_id);

    if (sitesError) console.warn("Error fetching production sites:", sitesError);

    console.log(`[LCA Calculation] Found ${productionSites?.length || 0} production sites`);

    // 4. For each facility, fetch actual Scope 1 & 2 activity data
    // This is the KEY difference - we use REAL facility data like Calculation Verifier
    const facilityEmissions: Record<string, { scope1: number; scope2: number; total: number; name: string }> = {};

    if (productionSites && productionSites.length > 0) {
      for (const site of productionSites) {
        const { data: activityData } = await supabase
          .from('facility_activity_data')
          .select(`
            quantity,
            unit,
            emission_source:scope_1_2_emission_sources(
              scope,
              source_name,
              emission_factor_co2e
            )
          `)
          .eq('facility_id', site.facility_id);

        if (activityData && activityData.length > 0) {
          let scope1Total = 0;
          let scope2Total = 0;

          activityData.forEach((activity: any) => {
            const quantity = parseFloat(activity.quantity || '0');
            const emissionFactor = parseFloat(activity.emission_source?.emission_factor_co2e || '0');
            const emissions = quantity * emissionFactor;

            if (activity.emission_source?.scope === 'scope_1') {
              scope1Total += emissions;
            } else {
              scope2Total += emissions;
            }
          });

          facilityEmissions[site.facility_id] = {
            scope1: scope1Total,
            scope2: scope2Total,
            total: scope1Total + scope2Total,
            name: site.facilities?.name || 'Unknown Facility'
          };

          console.log(`[LCA Calculation] Facility ${site.facilities?.name}: Scope 1 = ${scope1Total.toFixed(3)}, Scope 2 = ${scope2Total.toFixed(3)}`);
        }
      }
    }

    // 5. Initialize totals
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

    // Scope breakdown
    let scope1Total = 0;
    let scope2Total = 0;
    let scope3Total = 0;

    // GHG breakdown
    let fossilCO2 = 0;
    let biogenicCO2 = 0;
    let landUseChange = 0;
    let methaneTotal = 0;
    let nitrousOxideTotal = 0;

    // Material breakdown array
    const materialBreakdown: MaterialBreakdownItem[] = [];

    // 6. Calculate materials impacts - ALL materials are Scope 3 upstream
    materials?.forEach((material: any) => {
      // Impact values are ALREADY CALCULATED (quantity × factor)
      // Just like Calculation Verifier: activity.quantity × emission_source.emission_factor_co2e
      const climate = Number(material.impact_climate) || 0;
      const water = Number(material.impact_water) || 0;
      const waterScarcity = Number(material.impact_water_scarcity) || water * 20;
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

      // All materials are Scope 3 Category 1 (Purchased Goods)
      scope3Total += climate;

      // Categorize as material vs packaging
      const isPackaging = material.packaging_category ||
                         material.name?.toLowerCase().includes('bottle') ||
                         material.name?.toLowerCase().includes('cap') ||
                         material.name?.toLowerCase().includes('label') ||
                         material.name?.toLowerCase().includes('packaging') ||
                         material.name?.toLowerCase().includes('cardboard');

      if (isPackaging) {
        packagingClimate += climate;
      } else {
        materialsClimate += climate;
      }

      // Add to material breakdown
      materialBreakdown.push({
        name: material.name,
        quantity: material.quantity,
        unit: material.unit,
        emissions: climate,
        percentage: 0, // Will calculate after we know total
        category: isPackaging ? 'Packaging' : 'Ingredient',
        dataSource: material.impact_source || 'secondary_modelled'
      });

      // GHG breakdown by material type
      const name = (material.name || '').toLowerCase();
      const category = (material.packaging_category || '').toLowerCase();

      // Glass/Plastic/Metal = Fossil
      if (category === 'glass' || name.includes('glass') ||
          category === 'plastic' || category === 'pet' || category === 'hdpe' || name.includes('plastic') ||
          category === 'metal' || category === 'aluminium' || name.includes('aluminium') || name.includes('cap')) {
        fossilCO2 += climate;
      }
      // Sugar = Mostly biogenic
      else if (name.includes('sugar') || name.includes('glucose') || name.includes('fructose')) {
        biogenicCO2 += climate * 0.75;
        fossilCO2 += climate * 0.20;
        nitrousOxideTotal += (climate * 0.05) / 273;
      }
      // Fruits/Juice = Biogenic + LUC
      else if (name.includes('fruit') || name.includes('apple') || name.includes('lemon') || name.includes('juice')) {
        biogenicCO2 += climate * 0.70;
        fossilCO2 += climate * 0.15;
        landUseChange += climate * 0.12;
        nitrousOxideTotal += (climate * 0.03) / 273;
      }
      // Paper/Cardboard = Biogenic + Fossil
      else if (category === 'paper' || category === 'cardboard' || name.includes('label') || name.includes('cardboard')) {
        biogenicCO2 += climate * 0.60;
        fossilCO2 += climate * 0.35;
        landUseChange += climate * 0.05;
      }
      // Water = Fossil (energy for treatment/pumping)
      else if (name.includes('water')) {
        fossilCO2 += climate * 0.95;
        methaneTotal += (climate * 0.05) / 27.9;
      }
      // Citric acid, flavours, etc = Fossil
      else if (name.includes('acid') || name.includes('flavour') || name.includes('citric')) {
        fossilCO2 += climate * 0.90;
        methaneTotal += (climate * 0.05) / 27.9;
        nitrousOxideTotal += (climate * 0.05) / 273;
      }
      // Default split
      else {
        fossilCO2 += climate * 0.70;
        biogenicCO2 += climate * 0.20;
        landUseChange += climate * 0.05;
        methaneTotal += (climate * 0.03) / 27.9;
        nitrousOxideTotal += (climate * 0.02) / 273;
      }
    });

    console.log(`[LCA Calculation] Materials total: ${totalClimate.toFixed(6)} kg CO2eq`);
    console.log(`[LCA Calculation] Breakdown: Materials ${materialsClimate.toFixed(6)}, Packaging ${packagingClimate.toFixed(6)}`);

    // 7. Calculate production emissions from facility data
    const facilityBreakdown: FacilityBreakdownItem[] = [];

    Object.values(facilityEmissions).forEach((facility) => {
      const facilityTotal = facility.scope1 + facility.scope2;
      productionClimate += facilityTotal;
      totalClimate += facilityTotal;
      scope1Total += facility.scope1;
      scope2Total += facility.scope2;

      // Production is 100% fossil CO2 from energy
      fossilCO2 += facilityTotal;

      facilityBreakdown.push({
        facility_name: facility.name,
        emissions: facilityTotal,
        percentage: 0, // Will calculate after
        scope1: facility.scope1,
        scope2: facility.scope2
      });

      console.log(`[LCA Calculation] Facility ${facility.name}: ${facilityTotal.toFixed(6)} kg CO2eq`);
    });

    console.log(`[LCA Calculation] Production total: ${productionClimate.toFixed(6)} kg CO2eq`);
    console.log(`[LCA Calculation] GRAND TOTAL: ${totalClimate.toFixed(6)} kg CO2eq`);
    console.log(`[LCA Calculation] Scope breakdown: S1=${scope1Total.toFixed(6)}, S2=${scope2Total.toFixed(6)}, S3=${scope3Total.toFixed(6)}`);

    // 8. Calculate percentages
    if (totalClimate > 0) {
      materialBreakdown.forEach(item => {
        item.percentage = (item.emissions / totalClimate) * 100;
      });
      facilityBreakdown.forEach(item => {
        item.percentage = (item.emissions / totalClimate) * 100;
      });
    }

    // 9. Calculate water risk level
    const avgWaterScarcity = totalWater > 0 ? totalWaterScarcity / totalWater : 0;
    let waterRiskLevel = 'low';
    if (avgWaterScarcity > 40) waterRiskLevel = 'high';
    else if (avgWaterScarcity > 20) waterRiskLevel = 'medium';

    // 10. Calculate circularity
    const circularityPercentage = totalFossilResource > 0
      ? Math.max(0, Math.min(100, 100 - (totalFossilResource * 10)))
      : 65;

    // 11. Build lifecycle stage breakdown
    const lifecycleStageBreakdown: Array<{ stage: string; emissions: number; percentage: number }> = [
      {
        stage: 'Raw Material Extraction',
        emissions: scope3Total,
        percentage: totalClimate > 0 ? (scope3Total / totalClimate) * 100 : 0
      },
      {
        stage: 'Production',
        emissions: scope1Total + scope2Total,
        percentage: totalClimate > 0 ? ((scope1Total + scope2Total) / totalClimate) * 100 : 0
      }
    ];

    // 12. Build aggregated impacts with FULL breakdown structure
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
        by_scope: {
          scope1: scope1Total,
          scope2: scope2Total,
          scope3: scope3Total
        },
        by_category: {
          materials: materialsClimate,
          packaging: packagingClimate,
          production: productionClimate,
          transport: 0,
          end_of_life: 0
        },
        by_material: materialBreakdown.sort((a, b) => b.emissions - a.emissions),
        by_facility: facilityBreakdown,
        by_lifecycle_stage: lifecycleStageBreakdown
      },
      ghg_breakdown: {
        carbon_origin: {
          fossil: fossilCO2,
          biogenic: biogenicCO2,
          land_use_change: landUseChange
        },
        gas_inventory: {
          co2_fossil: fossilCO2,
          co2_biogenic: biogenicCO2,
          methane: methaneTotal,
          nitrous_oxide: nitrousOxideTotal,
          hfc_pfc: 0
        }
      }
    };

    console.log(`[LCA Calculation] Final aggregated impacts:`, {
      total_climate: totalClimate.toFixed(6),
      scope_breakdown: {
        scope1: scope1Total.toFixed(6),
        scope2: scope2Total.toFixed(6),
        scope3: scope3Total.toFixed(6)
      },
      category_breakdown: {
        materials: materialsClimate.toFixed(6),
        packaging: packagingClimate.toFixed(6),
        production: productionClimate.toFixed(6)
      },
      ghg_breakdown: {
        fossil: fossilCO2.toFixed(6),
        biogenic: biogenicCO2.toFixed(6),
        luc: landUseChange.toFixed(6)
      },
      material_count: materialBreakdown.length,
      facility_count: facilityBreakdown.length
    });

    // 13. Update product_lcas with aggregated impacts
    const { error: updateError } = await supabase
      .from("product_lcas")
      .update({
        aggregated_impacts: aggregatedImpacts,
        status: "completed",
        updated_at: new Date().toISOString()
      })
      .eq("id", product_lca_id);

    if (updateError) throw updateError;

    console.log(`[LCA Calculation] ✅ Successfully updated LCA ${product_lca_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        product_lca_id,
        aggregated_impacts: aggregatedImpacts
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error: any) {
    console.error("[LCA Calculation] ❌ Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to calculate LCA impacts"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});
