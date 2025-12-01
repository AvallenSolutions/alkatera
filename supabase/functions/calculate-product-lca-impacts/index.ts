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
    by_ghg: {
      co2_fossil: number;
      co2_biogenic: number;
      ch4: number;
      n2o: number;
    };
    by_lifecycle_stage: {
      raw_materials: number;
      processing: number;
      packaging_stage: number;
      distribution: number;
      use_phase: number;
      end_of_life: number;
    };
    by_material: MaterialBreakdownItem[];
    by_facility: FacilityBreakdownItem[];
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
      return new Response(
        JSON.stringify({ success: false, error: "product_lca_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[calculate-product-lca-impacts] Starting calculation for LCA:", product_lca_id);

    // 1. Fetch LCA
    const { data: lca, error: lcaError } = await supabase
      .from("product_lcas")
      .select("*")
      .eq("id", product_lca_id)
      .maybeSingle();

    if (lcaError || !lca) {
      console.error("[calculate-product-lca-impacts] LCA not found:", lcaError);
      return new Response(
        JSON.stringify({ success: false, error: "LCA not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch materials
    const { data: materials, error: materialsError } = await supabase
      .from("product_lca_materials")
      .select("*")
      .eq("product_lca_id", product_lca_id);

    if (materialsError) {
      console.error("[calculate-product-lca-impacts] Materials fetch error:", materialsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch materials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[calculate-product-lca-impacts] Found ${materials?.length || 0} materials`);

    // Log material details for debugging
    materials?.forEach((mat: any, idx: number) => {
      console.log(`[calculate-product-lca-impacts] Material ${idx + 1}:`, {
        name: mat.name,
        quantity: mat.quantity,
        unit: mat.unit,
        data_source: mat.data_source,
        supplier_product_id: mat.supplier_product_id,
        impact_climate: mat.impact_climate,
        impact_water: mat.impact_water,
        impact_land: mat.impact_land,
      });
    });

    // 3. Fetch production sites (facilities)
    const { data: productionSites, error: sitesError } = await supabase
      .from("product_lca_production_sites")
      .select(`
        *,
        facility:facilities(
          id,
          name,
          calculated_metrics
        )
      `)
      .eq("product_lca_id", product_lca_id);

    if (sitesError) {
      console.warn("[calculate-product-lca-impacts] Production sites fetch warning:", sitesError);
    }

    console.log(`[calculate-product-lca-impacts] Found ${productionSites?.length || 0} production sites`);

    // 4. Initialize totals
    let totalClimate = 0;
    let totalWater = 0;
    let totalWaterScarcity = 0;
    let totalLand = 0;
    let totalTerrestrialEcotox = 0;
    let totalFreshwaterEutro = 0;
    let totalTerrestrialAcid = 0;
    let totalFossilResource = 0;

    // Scope breakdown
    let scope1Total = 0;
    let scope2Total = 0;
    let scope3Total = 0;

    // Category breakdown
    let materialsTotal = 0;
    let packagingTotal = 0;
    let productionTotal = 0;
    let transportTotal = 0;
    let eolTotal = 0;

    // GHG breakdown
    let co2Fossil = 0;
    let co2Biogenic = 0;
    let ch4 = 0;
    let n2o = 0;

    // Lifecycle stage breakdown
    let rawMaterialsTotal = 0;
    let processingTotal = 0;
    let packagingStageTotal = 0;
    let distributionTotal = 0;
    let usePhaseTotal = 0;
    let endOfLifeTotal = 0;

    // Material breakdown array
    const materialBreakdown: MaterialBreakdownItem[] = [];

    // 6. Calculate materials impacts - ALL materials are Scope 3 upstream
    materials?.forEach((material: any) => {
      // CRITICAL FIX: impact_climate is ALREADY PRE-CALCULATED (quantity × factor)
      // Materials are stored with pre-calculated values, DO NOT multiply by quantity again!
      const quantity = Number(material.quantity) || 0;
      const climate = Number(material.impact_climate) || 0;

      // Warn about materials with zero impact
      if (climate === 0 && quantity > 0) {
        console.warn(`[calculate-product-lca-impacts] WARNING: Material "${material.name}" has zero climate impact but non-zero quantity (${quantity} ${material.unit}). Data source: ${material.data_source}, Supplier ID: ${material.supplier_product_id || 'none'}`);
      }
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
                         material.name?.toLowerCase().includes('label');

      if (isPackaging) {
        packagingTotal += climate;
        packagingStageTotal += climate;
      } else {
        materialsTotal += climate;
        rawMaterialsTotal += climate;
      }

      // GHG breakdown - assume 85% fossil CO2, 15% biogenic CO2 (conservative)
      co2Fossil += climate * 0.85;
      co2Biogenic += climate * 0.15;

      // Add to material breakdown
      if (climate > 0) {
        materialBreakdown.push({
          name: material.name || 'Unknown Material',
          quantity: quantity,
          unit: material.unit || 'kg',
          emissions: climate,
          percentage: 0, // Will calculate after total is known
          category: isPackaging ? 'packaging' : 'ingredient',
          dataSource: material.impact_source || material.data_source || 'unknown',
        });
      }
    });

    // 7. Calculate facility impacts
    const facilityBreakdown: FacilityBreakdownItem[] = [];
    
    productionSites?.forEach((site: any) => {
      const sharePercent = Number(site.production_volume_share_percent) || 0;
      const facility = site.facility;

      if (!facility || sharePercent === 0) return;

      const calculatedMetrics = facility.calculated_metrics || {};
      const facilityIntensity = Number(calculatedMetrics.emissions_intensity_kg_co2e_per_kg) || 0;

      // Calculate allocated emissions: functional_unit × share × intensity
      const allocatedEmissions = (lca.functional_unit || 1) * (sharePercent / 100) * facilityIntensity;

      if (allocatedEmissions > 0) {
        const scope1 = Number(calculatedMetrics.total_scope_1_emissions) || 0;
        const scope2 = Number(calculatedMetrics.total_scope_2_emissions) || 0;
        const totalFacilityEmissions = scope1 + scope2;

        // Allocate scope 1 and 2 proportionally
        const allocatedScope1 = totalFacilityEmissions > 0 ? (scope1 / totalFacilityEmissions) * allocatedEmissions : 0;
        const allocatedScope2 = totalFacilityEmissions > 0 ? (scope2 / totalFacilityEmissions) * allocatedEmissions : 0;

        totalClimate += allocatedEmissions;
        scope1Total += allocatedScope1;
        scope2Total += allocatedScope2;
        productionTotal += allocatedEmissions;
        processingTotal += allocatedEmissions;

        facilityBreakdown.push({
          facility_name: facility.name,
          emissions: allocatedEmissions,
          percentage: 0, // Will calculate later
          scope1: allocatedScope1,
          scope2: allocatedScope2,
        });
      }
    });

    // 8. Calculate percentages
    if (totalClimate > 0) {
      materialBreakdown.forEach(item => {
        item.percentage = (item.emissions / totalClimate) * 100;
      });

      facilityBreakdown.forEach(item => {
        item.percentage = (item.emissions / totalClimate) * 100;
      });
    }

    // Sort by emissions (highest first)
    materialBreakdown.sort((a, b) => b.emissions - a.emissions);
    facilityBreakdown.sort((a, b) => b.emissions - a.emissions);

    // 9. Calculate data quality summary (ISO Compliance)
    const totalMaterialCount = materials.length;
    const priority1Count = materials.filter((m: any) => Number(m.data_priority) === 1).length;
    const priority2Count = materials.filter((m: any) => Number(m.data_priority) === 2).length;
    const priority3Count = materials.filter((m: any) => Number(m.data_priority) === 3).length;

    const dataQualityScore = totalMaterialCount > 0
      ? Math.round((priority1Count * 95 + priority2Count * 85 + priority3Count * 70) / totalMaterialCount)
      : 0;

    let dataQualityRating = 'Low';
    if (dataQualityScore >= 85) dataQualityRating = 'High';
    else if (dataQualityScore >= 70) dataQualityRating = 'Medium';

    const dataQualitySummary = {
      score: dataQualityScore,
      rating: dataQualityRating,
      total_materials: totalMaterialCount,
      breakdown: {
        primary_verified_count: priority1Count,
        primary_verified_share: `${Math.round((priority1Count / totalMaterialCount) * 100)}%`,
        regional_standard_count: priority2Count,
        regional_standard_share: `${Math.round((priority2Count / totalMaterialCount) * 100)}%`,
        secondary_modelled_count: priority3Count,
        secondary_modelled_share: `${Math.round((priority3Count / totalMaterialCount) * 100)}%`,
      },
    };

    // Enrich material breakdown with provenance
    const enrichedMaterialBreakdown = materialBreakdown.map((item: any) => {
      const material = materials.find((m: any) => m.name === item.name);
      return {
        ...item,
        data_quality_tag: material?.data_quality_tag || 'Unknown',
        confidence_score: material?.confidence_score || 0,
        source_reference: material?.source_reference || 'Unknown',
        methodology: material?.methodology || 'Unknown',
      };
    });

    // 10. Build aggregated impacts
    const aggregatedImpacts: AggregatedImpacts = {
      climate_change_gwp100: totalClimate,
      water_consumption: totalWater,
      water_scarcity_aware: totalWaterScarcity,
      land_use: totalLand,
      terrestrial_ecotoxicity: totalTerrestrialEcotox,
      freshwater_eutrophication: totalFreshwaterEutro,
      terrestrial_acidification: totalTerrestrialAcid,
      fossil_resource_scarcity: totalFossilResource,
      circularity_percentage: 0,
      water_risk_level: 'low',
      data_quality: dataQualitySummary,
      breakdown: {
        by_scope: {
          scope1: scope1Total,
          scope2: scope2Total,
          scope3: scope3Total,
        },
        by_category: {
          materials: materialsTotal,
          packaging: packagingTotal,
          production: productionTotal,
          transport: transportTotal,
          end_of_life: eolTotal,
        },
        by_ghg: {
          co2_fossil: co2Fossil,
          co2_biogenic: co2Biogenic,
          ch4: ch4,
          n2o: n2o,
        },
        by_ghg_detailed: {
          co2_fossil: materials.reduce((sum: number, m: any) => sum + (Number(m.impact_climate_fossil) || 0), 0),
          co2_biogenic: materials.reduce((sum: number, m: any) => sum + (Number(m.impact_climate_biogenic) || 0), 0),
          co2_dluc: materials.reduce((sum: number, m: any) => sum + (Number(m.impact_climate_dluc) || 0), 0),
          ch4: ch4,
          n2o: n2o,
        },
        by_lifecycle_stage: {
          raw_materials: rawMaterialsTotal,
          processing: processingTotal,
          packaging_stage: packagingStageTotal,
          distribution: distributionTotal,
          use_phase: usePhaseTotal,
          end_of_life: endOfLifeTotal,
        },
        by_material: enrichedMaterialBreakdown,
        by_facility: facilityBreakdown,
      },
    };

    console.log("[calculate-product-lca-impacts] Calculated totals:", {
      totalClimate,
      scope1Total,
      scope2Total,
      scope3Total,
      materialsCount: materialBreakdown.length,
      facilitiesCount: facilityBreakdown.length,
      materialBreakdownTop3: materialBreakdown.slice(0, 3),
    });

    // 10. Update product_lcas table
    const { error: updateError } = await supabase
      .from("product_lcas")
      .update({
        aggregated_impacts: aggregatedImpacts,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq("id", product_lca_id);

    if (updateError) {
      console.error("[calculate-product-lca-impacts] Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update LCA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[calculate-product-lca-impacts] Successfully updated LCA with impacts");

    return new Response(
      JSON.stringify({
        success: true,
        aggregated_impacts: aggregatedImpacts,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[calculate-product-lca-impacts] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});