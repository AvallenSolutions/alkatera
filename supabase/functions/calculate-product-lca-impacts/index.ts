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
  // Core 4 impacts
  climate_change_gwp100: number;
  water_consumption: number;
  water_scarcity_aware: number;
  land_use: number;

  // Complete ReCiPe 2016 Midpoint (18 categories)
  ozone_depletion: number;
  photochemical_ozone_formation: number;
  ionising_radiation: number;
  particulate_matter: number;
  human_toxicity_carcinogenic: number;
  human_toxicity_non_carcinogenic: number;
  terrestrial_ecotoxicity: number;
  freshwater_ecotoxicity: number;
  marine_ecotoxicity: number;
  freshwater_eutrophication: number;
  marine_eutrophication: number;
  terrestrial_acidification: number;
  mineral_resource_scarcity: number;
  fossil_resource_scarcity: number;
  waste: number;

  // Legacy fields
  circularity_percentage: number;
  water_risk_level: string;

  // GHG breakdown (ISO 14067)
  climate_fossil: number;
  climate_biogenic: number;
  climate_dluc: number;

  // Data quality and provenance
  data_quality: any;
  data_provenance: {
    hybrid_sources_count: number;
    defra_gwp_count: number;
    supplier_verified_count: number;
    ecoinvent_only_count: number;
    methodology_summary: string;
  };

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

    // 4. Initialize totals for all 18 ReCiPe 2016 categories
    let totalClimate = 0;
    let totalWater = 0;
    let totalWaterScarcity = 0;
    let totalLand = 0;
    let totalWaste = 0;

    // Extended ReCiPe 2016 impacts
    let totalOzoneDepletion = 0;
    let totalPhotochemicalOzone = 0;
    let totalIonisingRadiation = 0;
    let totalParticulateMatter = 0;
    let totalHumanToxCarcinogenic = 0;
    let totalHumanToxNonCarcinogenic = 0;
    let totalTerrestrialEcotox = 0;
    let totalFreshwaterEcotox = 0;
    let totalMarineEcotox = 0;
    let totalFreshwaterEutro = 0;
    let totalMarineEutro = 0;
    let totalTerrestrialAcid = 0;
    let totalMineralResource = 0;
    let totalFossilResource = 0;

    // GHG breakdown tracking
    let climateFossil = 0;
    let climateBiogenic = 0;
    let climateDluc = 0;

    // Data provenance tracking
    let hybridSourcesCount = 0;
    let defraGwpCount = 0;
    let supplierVerifiedCount = 0;
    let ecoinventOnlyCount = 0;

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
      // CRITICAL: impact values are ALREADY PRE-CALCULATED (quantity × factor)
      // Materials are stored with pre-calculated values, DO NOT multiply by quantity again!
      const quantity = Number(material.quantity) || 0;
      const climate = Number(material.impact_climate) || 0;
      const transport = Number(material.impact_transport) || 0;

      // Warn about materials with zero impact
      if (climate === 0 && quantity > 0) {
        console.warn(`[calculate-product-lca-impacts] WARNING: Material "${material.name}" has zero climate impact but non-zero quantity (${quantity} ${material.unit}). Data source: ${material.data_source}, Supplier ID: ${material.supplier_product_id || 'none'}`);
      }

      // Core 4 impacts
      const water = Number(material.impact_water) || 0;
      const waterScarcity = Number(material.impact_water_scarcity) || water * 20;
      const land = Number(material.impact_land) || 0;
      const waste = Number(material.impact_waste) || 0;

      // Extended ReCiPe 2016 impacts
      const ozoneDepletion = Number(material.impact_ozone_depletion) || 0;
      const photochemicalOzone = Number(material.impact_photochemical_ozone_formation) || 0;
      const ionisingRadiation = Number(material.impact_ionising_radiation) || 0;
      const particulateMatter = Number(material.impact_particulate_matter) || 0;
      const humanToxCarcinogenic = Number(material.impact_human_toxicity_carcinogenic) || 0;
      const humanToxNonCarcinogenic = Number(material.impact_human_toxicity_non_carcinogenic) || 0;
      const terrestrialEcotox = Number(material.impact_terrestrial_ecotoxicity) || 0;
      const freshwaterEcotox = Number(material.impact_freshwater_ecotoxicity) || 0;
      const marineEcotox = Number(material.impact_marine_ecotoxicity) || 0;
      const freshwaterEutro = Number(material.impact_freshwater_eutrophication) || 0;
      const marineEutro = Number(material.impact_marine_eutrophication) || 0;
      const terrestrialAcid = Number(material.impact_terrestrial_acidification) || 0;
      const mineralResource = Number(material.impact_mineral_resource_scarcity) || 0;
      const fossilResource = Number(material.impact_fossil_resource_scarcity) || 0;

      // GHG breakdown
      const climateF = Number(material.impact_climate_fossil) || 0;
      const climateB = Number(material.impact_climate_biogenic) || 0;
      const climateD = Number(material.impact_climate_dluc) || 0;

      // Track provenance
      const isHybrid = material.is_hybrid_source || false;
      const gwpSource = material.gwp_data_source || '';
      const dataQualityGrade = material.data_quality_grade || '';

      if (isHybrid && gwpSource.includes('DEFRA')) {
        hybridSourcesCount++;
        defraGwpCount++;
      } else if (dataQualityGrade === 'HIGH' || gwpSource.includes('Supplier')) {
        supplierVerifiedCount++;
      } else if (gwpSource.includes('Ecoinvent') && !isHybrid) {
        ecoinventOnlyCount++;
      }

      // Aggregate core impacts
      totalClimate += climate;
      totalWater += water;
      totalWaterScarcity += waterScarcity;
      totalLand += land;
      totalWaste += waste;

      // Aggregate extended impacts
      totalOzoneDepletion += ozoneDepletion;
      totalPhotochemicalOzone += photochemicalOzone;
      totalIonisingRadiation += ionisingRadiation;
      totalParticulateMatter += particulateMatter;
      totalHumanToxCarcinogenic += humanToxCarcinogenic;
      totalHumanToxNonCarcinogenic += humanToxNonCarcinogenic;
      totalTerrestrialEcotox += terrestrialEcotox;
      totalFreshwaterEcotox += freshwaterEcotox;
      totalMarineEcotox += marineEcotox;
      totalFreshwaterEutro += freshwaterEutro;
      totalMarineEutro += marineEutro;
      totalTerrestrialAcid += terrestrialAcid;
      totalMineralResource += mineralResource;
      totalFossilResource += fossilResource;

      // Aggregate GHG breakdown
      climateFossil += climateF;
      climateBiogenic += climateB;
      climateDluc += climateD;

      // Add transport emissions to totals
      totalClimate += transport;
      transportTotal += transport;

      // All materials are Scope 3 Category 1 (Purchased Goods)
      // Transport is Scope 3 Category 4 (Upstream Transportation)
      scope3Total += climate + transport;

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

      // Transport emissions belong to distribution stage
      if (transport > 0) {
        distributionTotal += transport;
      }

      // GHG breakdown - assume 85% fossil CO2, 15% biogenic CO2 (conservative)
      co2Fossil += climate * 0.85;
      co2Biogenic += climate * 0.15;

      // Transport emissions are 100% fossil CO2
      co2Fossil += transport;

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

    // Generate methodology summary
    const methodologySummary = [];
    if (defraGwpCount > 0) {
      methodologySummary.push(`DEFRA 2025 GHG factors (${defraGwpCount} materials)`);
    }
    if (supplierVerifiedCount > 0) {
      methodologySummary.push(`Supplier verified EPDs (${supplierVerifiedCount} materials)`);
    }
    if (ecoinventOnlyCount > 0) {
      methodologySummary.push(`Ecoinvent 3.12 full dataset (${ecoinventOnlyCount} materials)`);
    }
    if (hybridSourcesCount > 0) {
      methodologySummary.push(`Hybrid sources (${hybridSourcesCount} materials)`);
    }

    // 10. Build aggregated impacts with complete 18 categories
    const aggregatedImpacts: AggregatedImpacts = {
      // Core 4 impacts
      climate_change_gwp100: totalClimate,
      water_consumption: totalWater,
      water_scarcity_aware: totalWaterScarcity,
      land_use: totalLand,

      // Complete ReCiPe 2016 Midpoint (18 categories)
      ozone_depletion: totalOzoneDepletion,
      photochemical_ozone_formation: totalPhotochemicalOzone,
      ionising_radiation: totalIonisingRadiation,
      particulate_matter: totalParticulateMatter,
      human_toxicity_carcinogenic: totalHumanToxCarcinogenic,
      human_toxicity_non_carcinogenic: totalHumanToxNonCarcinogenic,
      terrestrial_ecotoxicity: totalTerrestrialEcotox,
      freshwater_ecotoxicity: totalFreshwaterEcotox,
      marine_ecotoxicity: totalMarineEcotox,
      freshwater_eutrophication: totalFreshwaterEutro,
      marine_eutrophication: totalMarineEutro,
      terrestrial_acidification: totalTerrestrialAcid,
      mineral_resource_scarcity: totalMineralResource,
      fossil_resource_scarcity: totalFossilResource,
      waste: totalWaste,

      // GHG breakdown (ISO 14067)
      climate_fossil: climateFossil,
      climate_biogenic: climateBiogenic,
      climate_dluc: climateDluc,

      // Legacy fields
      circularity_percentage: 0,
      water_risk_level: 'low',

      // Data quality
      data_quality: dataQualitySummary,

      // Data provenance tracking
      data_provenance: {
        hybrid_sources_count: hybridSourcesCount,
        defra_gwp_count: defraGwpCount,
        supplier_verified_count: supplierVerifiedCount,
        ecoinvent_only_count: ecoinventOnlyCount,
        methodology_summary: methodologySummary.join('; '),
      },

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
          co2_fossil: climateFossil,
          co2_biogenic: climateBiogenic,
          ch4: ch4,
          n2o: n2o,
        },
        by_ghg_detailed: {
          co2_fossil: climateFossil,
          co2_biogenic: climateBiogenic,
          co2_dluc: climateDluc,
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
      transportTotal,
      materialsTotal,
      packagingTotal,
      productionTotal,
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

    // 11. Delete existing results and insert new ones into product_lca_results
    const { error: deleteError } = await supabase
      .from("product_lca_results")
      .delete()
      .eq("product_lca_id", product_lca_id);

    if (deleteError) {
      console.warn("[calculate-product-lca-impacts] Warning: Failed to delete old results:", deleteError);
    }

    // Insert new results
    const resultsToInsert = [
      {
        product_lca_id: product_lca_id,
        impact_category: "Climate Change",
        value: totalClimate,
        unit: "kg CO2e"
      },
      {
        product_lca_id: product_lca_id,
        impact_category: "Water Consumption",
        value: totalWater,
        unit: "L"
      },
      {
        product_lca_id: product_lca_id,
        impact_category: "Water Scarcity",
        value: totalWaterScarcity,
        unit: "L H2O-eq"
      },
      {
        product_lca_id: product_lca_id,
        impact_category: "Land Use",
        value: totalLand,
        unit: "m²"
      },
      {
        product_lca_id: product_lca_id,
        impact_category: "Terrestrial Ecotoxicity",
        value: totalTerrestrialEcotox,
        unit: "kg 1,4-DCB"
      },
      {
        product_lca_id: product_lca_id,
        impact_category: "Freshwater Eutrophication",
        value: totalFreshwaterEutro,
        unit: "kg P eq"
      },
      {
        product_lca_id: product_lca_id,
        impact_category: "Terrestrial Acidification",
        value: totalTerrestrialAcid,
        unit: "kg SO2 eq"
      },
      {
        product_lca_id: product_lca_id,
        impact_category: "Fossil Resource Scarcity",
        value: totalFossilResource,
        unit: "kg oil eq"
      }
    ];

    const { error: insertResultsError } = await supabase
      .from("product_lca_results")
      .insert(resultsToInsert);

    if (insertResultsError) {
      console.error("[calculate-product-lca-impacts] Failed to insert results:", insertResultsError);
      // Don't fail the whole operation, just log the error
    } else {
      console.log("[calculate-product-lca-impacts] Successfully inserted impact results");
    }

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