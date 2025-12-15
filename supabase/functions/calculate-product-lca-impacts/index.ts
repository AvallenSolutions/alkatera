import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EU27_2010_NORMALISATION_FACTORS = {
  CC: 8090,
  OD: 0.0536,
  IR: 4220,
  POF: 40.6,
  PM: 0.000594,
  HTC: 0.0000169,
  HTNC: 0.000233,
  AC: 55.5,
  EUF: 1.61,
  EUM: 19.5,
  EUT: 177,
  ETF: 17500,
  LU: 819000,
  WU: 11500,
  RUF: 65000,
  RUM: 0.0636,
};

const DEFAULT_WEIGHTING_FACTORS = {
  CC: 0.2106,
  OD: 0.0631,
  IR: 0.0501,
  POF: 0.0478,
  PM: 0.0896,
  HTC: 0.0213,
  HTNC: 0.0184,
  AC: 0.0620,
  EUF: 0.0280,
  EUM: 0.0296,
  EUT: 0.0371,
  ETF: 0.0192,
  LU: 0.0794,
  WU: 0.0851,
  RUF: 0.0832,
  RUM: 0.0755,
};

interface EF31ImpactValues {
  climate_change_total: number;
  climate_change_fossil: number;
  climate_change_biogenic: number;
  climate_change_luluc: number;
  ozone_depletion: number;
  ionising_radiation: number;
  photochemical_ozone_formation: number;
  particulate_matter: number;
  human_toxicity_cancer: number;
  human_toxicity_non_cancer: number;
  acidification: number;
  eutrophication_freshwater: number;
  eutrophication_marine: number;
  eutrophication_terrestrial: number;
  ecotoxicity_freshwater: number;
  land_use: number;
  water_use: number;
  resource_use_fossils: number;
  resource_use_minerals_metals: number;
}

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

    const { product_lca_id, calculate_ef31 = false, force_ef31 = false } = await req.json();

    if (!product_lca_id) {
      return new Response(
        JSON.stringify({ success: false, error: "product_lca_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[calculate-product-lca-impacts] Starting calculation for LCA:", product_lca_id, { calculate_ef31, force_ef31 });

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

    let hasEF31Access = false;
    if (calculate_ef31 || force_ef31) {
      const { data: org } = await supabase
        .from("organizations")
        .select("subscription_tier, subscription_status")
        .eq("id", lca.organization_id)
        .maybeSingle();

      if (org) {
        const activeTiers = ['premium', 'enterprise'];
        const activeStatuses = ['active', 'trial'];
        hasEF31Access = activeTiers.includes(org.subscription_tier) && activeStatuses.includes(org.subscription_status);
      }

      if (hasEF31Access) {
        console.log("[calculate-product-lca-impacts] Organization has EF 3.1 access");
      }
    }

    const { data: materials, error: materialsError } = await supabase
      .from("product_lca_materials")
      .select("*")
      .eq("product_lca_id", product_lca_id);

    if (materialsError) {
      console.error("[calculate-product-lca-impacts] Error loading materials:", materialsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to load materials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[calculate-product-lca-impacts] Found ${materials?.length || 0} materials`);

    const { data: productionSites, error: sitesError } = await supabase
      .from("product_lca_production_sites")
      .select(`*, facility:facilities(id, name)`)
      .eq("product_lca_id", product_lca_id);

    if (sitesError) {
      console.error("[calculate-product-lca-impacts] Error loading production sites:", sitesError);
    }

    console.log(`[calculate-product-lca-impacts] Found ${productionSites?.length || 0} production sites`);

    let totalClimate = 0, totalWater = 0, totalWaterScarcity = 0, totalLand = 0, totalWaste = 0;
    let totalOzoneDepletion = 0, totalPhotochemicalOzone = 0, totalIonisingRadiation = 0, totalParticulateMatter = 0;
    let totalHumanToxCarcinogenic = 0, totalHumanToxNonCarcinogenic = 0, totalTerrestrialEcotox = 0;
    let totalFreshwaterEcotox = 0, totalMarineEcotox = 0, totalFreshwaterEutro = 0, totalMarineEutro = 0;
    let totalTerrestrialAcid = 0, totalMineralResource = 0, totalFossilResource = 0;
    let climateFossil = 0, climateBiogenic = 0, climateDluc = 0;
    let hybridSourcesCount = 0, defraGwpCount = 0, supplierVerifiedCount = 0, ecoinventOnlyCount = 0;
    let scope1Total = 0, scope2Total = 0, scope3Total = 0;
    let materialsTotal = 0, packagingTotal = 0, productionTotal = 0, transportTotal = 0, eolTotal = 0;
    let rawMaterialsTotal = 0, processingTotal = 0, packagingStageTotal = 0, distributionTotal = 0;
    let totalPackagingMass = 0, recyclablePackagingMass = 0;

    const materialBreakdown: MaterialBreakdownItem[] = [];

    materials?.forEach((material: any) => {
      const quantity = Number(material.quantity) || 0;
      const climate = Number(material.impact_climate) || 0;
      const transport = Number(material.impact_transport) || 0;
      const water = Number(material.impact_water) || 0;
      const waterScarcity = Number(material.impact_water_scarcity) || 0;
      const land = Number(material.impact_land) || 0;
      const waste = Number(material.impact_waste) || 0;
      const terrestrialEcotox = Number(material.impact_terrestrial_ecotoxicity) || 0;
      const freshwaterEutro = Number(material.impact_freshwater_eutrophication) || 0;
      const terrestrialAcid = Number(material.impact_terrestrial_acidification) || 0;
      const fossilResource = Number(material.impact_fossil_resource_scarcity) || 0;

      totalClimate += climate;
      totalWater += water;
      totalWaterScarcity += waterScarcity;
      totalLand += land;
      totalWaste += waste;
      totalTerrestrialEcotox += terrestrialEcotox;
      totalFreshwaterEutro += freshwaterEutro;
      totalTerrestrialAcid += terrestrialAcid;
      totalFossilResource += fossilResource;

      climateFossil += Number(material.impact_climate_fossil) || 0;
      climateBiogenic += Number(material.impact_climate_biogenic) || 0;
      climateDluc += Number(material.impact_climate_dluc) || 0;

      const dataSource = material.impact_source || material.data_source || 'unknown';
      if (dataSource.includes('hybrid')) hybridSourcesCount++;
      else if (dataSource.includes('defra')) defraGwpCount++;
      else if (dataSource.includes('supplier')) supplierVerifiedCount++;
      else if (dataSource.includes('ecoinvent')) ecoinventOnlyCount++;

      totalClimate += transport; transportTotal += transport;
      scope3Total += climate + transport;

      const isPackaging = material.packaging_category || material.name?.toLowerCase().includes('bottle') ||
                         material.name?.toLowerCase().includes('cap') || material.name?.toLowerCase().includes('label');

      if (isPackaging) {
        packagingTotal += climate; packagingStageTotal += climate;
        totalPackagingMass += quantity;

        // Determine recyclability based on material name
        const materialNameLower = (material.name || '').toLowerCase();
        const isRecyclable =
          materialNameLower.includes('glass') ||
          materialNameLower.includes('aluminium') ||
          materialNameLower.includes('aluminum') ||
          materialNameLower.includes('steel') ||
          materialNameLower.includes('paper') ||
          materialNameLower.includes('cardboard') ||
          materialNameLower.includes('pet') ||
          materialNameLower.includes('hdpe') ||
          materialNameLower.includes('metal') ||
          materialNameLower.includes('cork');

        if (isRecyclable) {
          recyclablePackagingMass += quantity;
        }
      } else {
        materialsTotal += climate; rawMaterialsTotal += climate;
      }

      if (transport > 0) distributionTotal += transport;

      if (climate > 0) {
        materialBreakdown.push({
          name: material.name || 'Unknown Material',
          quantity, unit: material.unit || 'kg', emissions: climate,
          percentage: 0, category: isPackaging ? 'packaging' : 'ingredient',
          dataSource: material.impact_source || material.data_source || 'unknown',
        });
      }
    });

    const facilityBreakdown: FacilityBreakdownItem[] = [];

    for (const site of productionSites || []) {
      const productionVolume = Number(site.production_volume) || 0;
      const facilityIntensity = Number(site.facility_intensity) || 0;
      const facility = site.facility;

      console.log(`[calculate-product-lca-impacts] Processing site: ${facility?.name}, volume: ${productionVolume}, intensity: ${facilityIntensity}`);

      if (!facility || productionVolume === 0 || facilityIntensity === 0) {
        console.log(`[calculate-product-lca-impacts] Skipping site - missing data`);
        continue;
      }

      const allocatedEmissions = productionVolume * facilityIntensity;

      console.log(`[calculate-product-lca-impacts] Allocated emissions: ${allocatedEmissions} kg CO2e`);

      if (allocatedEmissions > 0) {
        const { data: facilityEmissions } = await supabase
          .from("facility_emissions_aggregated")
          .select("total_co2e, results_payload")
          .eq("facility_id", facility.id)
          .order("reporting_period_end", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Extract scope breakdown from facility's results_payload
        const scopeBreakdown = facilityEmissions?.results_payload?.scope_breakdown;
        const actualScope1Total = scopeBreakdown?.scope1 || 0;
        const actualScope2Total = scopeBreakdown?.scope2 || 0;
        const actualTotalEmissions = actualScope1Total + actualScope2Total;

        console.log(`[calculate-product-lca-impacts] Facility-specific emissions - Scope 1: ${actualScope1Total}, Scope 2: ${actualScope2Total}, Total: ${actualTotalEmissions}`);

        let allocatedScope1 = 0;
        let allocatedScope2 = 0;

        if (actualTotalEmissions > 0) {
          const scope1Ratio = actualScope1Total / actualTotalEmissions;
          const scope2Ratio = actualScope2Total / actualTotalEmissions;

          allocatedScope1 = allocatedEmissions * scope1Ratio;
          allocatedScope2 = allocatedEmissions * scope2Ratio;

          console.log(`[calculate-product-lca-impacts] Using facility scope ratios - Scope 1: ${(scope1Ratio * 100).toFixed(1)}%, Scope 2: ${(scope2Ratio * 100).toFixed(1)}%`);
        } else {
          console.log(`[calculate-product-lca-impacts] No scope breakdown found in facility data, treating as Scope 3 upstream emissions`);
          allocatedScope1 = 0;
          allocatedScope2 = 0;
        }

        totalClimate += allocatedEmissions;
        scope1Total += allocatedScope1;
        scope2Total += allocatedScope2;

        if (allocatedScope1 === 0 && allocatedScope2 === 0) {
          scope3Total += allocatedEmissions;
        }

        productionTotal += allocatedEmissions;
        processingTotal += allocatedEmissions;

        facilityBreakdown.push({
          facility_name: facility.name,
          emissions: allocatedEmissions,
          percentage: 0,
          scope1: allocatedScope1,
          scope2: allocatedScope2,
        });
      }
    }

    console.log(`[calculate-product-lca-impacts] Total processing emissions: ${processingTotal} kg CO2e`);
    console.log(`[calculate-product-lca-impacts] Total climate: ${totalClimate} kg CO2e`);

    if (totalClimate > 0) {
      materialBreakdown.forEach(item => { item.percentage = (item.emissions / totalClimate) * 100; });
      facilityBreakdown.forEach(item => { item.percentage = (item.emissions / totalClimate) * 100; });
    }
    materialBreakdown.sort((a, b) => b.emissions - a.emissions);
    facilityBreakdown.sort((a, b) => b.emissions - a.emissions);

    const totalMaterialCount = materials?.length || 0;
    const priority1Count = materials?.filter((m: any) => Number(m.data_priority) === 1).length || 0;
    const priority2Count = materials?.filter((m: any) => Number(m.data_priority) === 2).length || 0;
    const priority3Count = materials?.filter((m: any) => Number(m.data_priority) === 3).length || 0;
    const dataQualityScore = totalMaterialCount > 0 ? Math.round((priority1Count * 95 + priority2Count * 85 + priority3Count * 70) / totalMaterialCount) : 0;
    let dataQualityRating = 'Low';
    if (dataQualityScore >= 85) dataQualityRating = 'High';
    else if (dataQualityScore >= 70) dataQualityRating = 'Medium';

    const dataQualitySummary = {
      overall_score: dataQualityScore,
      rating: dataQualityRating,
      material_count: totalMaterialCount,
      primary_data_count: priority1Count,
      regional_data_count: priority2Count,
      modelled_data_count: priority3Count,
      hybrid_sources: hybridSourcesCount,
      defra_gwp: defraGwpCount,
      supplier_verified: supplierVerifiedCount,
      ecoinvent_only: ecoinventOnlyCount
    };

    // Calculate circularity percentage based on recyclable packaging mass
    const circularityPercentage = totalPackagingMass > 0
      ? Math.round((recyclablePackagingMass / totalPackagingMass) * 100)
      : 0;

    console.log(`[calculate-product-lca-impacts] Circularity: ${circularityPercentage}% (${recyclablePackagingMass}kg recyclable / ${totalPackagingMass}kg total packaging)`);

    const aggregatedImpacts = {
      climate_change_gwp100: totalClimate,
      climate_fossil: climateFossil,
      climate_biogenic: climateBiogenic,
      climate_dluc: climateDluc,
      water_consumption: totalWater,
      water_scarcity_aware: totalWaterScarcity,
      land_use: totalLand,
      waste: totalWaste,
      terrestrial_ecotoxicity: totalTerrestrialEcotox,
      freshwater_eutrophication: totalFreshwaterEutro,
      terrestrial_acidification: totalTerrestrialAcid,
      fossil_resource_scarcity: totalFossilResource,
      ozone_depletion: totalOzoneDepletion,
      photochemical_ozone_formation: totalPhotochemicalOzone,
      ionising_radiation: totalIonisingRadiation,
      particulate_matter: totalParticulateMatter,
      human_toxicity_carcinogenic: totalHumanToxCarcinogenic,
      human_toxicity_non_carcinogenic: totalHumanToxNonCarcinogenic,
      freshwater_ecotoxicity: totalFreshwaterEcotox,
      marine_ecotoxicity: totalMarineEcotox,
      marine_eutrophication: totalMarineEutro,
      mineral_resource_scarcity: totalMineralResource,
      circularity_percentage: circularityPercentage,
      water_risk_level: 'low',
      breakdown: {
        by_scope: {
          scope1: scope1Total,
          scope2: scope2Total,
          scope3: scope3Total
        },
        by_category: {
          materials: materialsTotal,
          packaging: packagingTotal,
          production: productionTotal,
          transport: transportTotal,
          end_of_life: eolTotal
        },
        by_lifecycle_stage: {
          raw_materials: rawMaterialsTotal,
          processing: processingTotal,
          packaging_stage: packagingStageTotal,
          distribution: distributionTotal,
          use_phase: 0,
          end_of_life: eolTotal
        },
        by_ghg: {
          co2_fossil: climateFossil,
          co2_biogenic: climateBiogenic,
          ch4: 0,
          n2o: 0
        },
        by_material: materialBreakdown.slice(0, 20),
        by_facility: facilityBreakdown
      },
      data_quality: dataQualitySummary,
      data_provenance: {
        methodology_summary: '',
        hybrid_sources_count: hybridSourcesCount,
        defra_gwp_count: defraGwpCount,
        supplier_verified_count: supplierVerifiedCount,
        ecoinvent_only_count: ecoinventOnlyCount
      }
    };

    const { error: updateError } = await supabase
      .from("product_lcas")
      .update({
        aggregated_impacts: aggregatedImpacts,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq("id", product_lca_id);

    if (updateError) {
      console.error("[calculate-product-lca-impacts] Error updating LCA:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update LCA results" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[calculate-product-lca-impacts] Calculation completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        total_climate: totalClimate,
        scope1: scope1Total,
        scope2: scope2Total,
        scope3: scope3Total,
        material_count: materials?.length || 0,
        production_sites: productionSites?.length || 0,
        data_quality_score: dataQualityScore
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[calculate-product-lca-impacts] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});