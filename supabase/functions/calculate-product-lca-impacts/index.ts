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
      console.error("[calculate-product-lca-impacts] Materials fetch error:", materialsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch materials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[calculate-product-lca-impacts] Found ${materials?.length || 0} materials`);

    const { data: productionSites } = await supabase
      .from("product_lca_production_sites")
      .select(`*, facility:facilities(id, name, calculated_metrics)`)
      .eq("product_lca_id", product_lca_id);

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

    const materialBreakdown: MaterialBreakdownItem[] = [];

    materials?.forEach((material: any) => {
      const quantity = Number(material.quantity) || 0;
      const climate = Number(material.impact_climate) || 0;
      const transport = Number(material.impact_transport) || 0;
      const water = Number(material.impact_water) || 0;
      const waterScarcity = Number(material.impact_water_scarcity) || water * 20;
      const land = Number(material.impact_land) || 0;
      const waste = Number(material.impact_waste) || 0;

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

      const climateF = Number(material.impact_climate_fossil) || 0;
      const climateB = Number(material.impact_climate_biogenic) || 0;
      const climateD = Number(material.impact_climate_dluc) || 0;

      const isHybrid = material.is_hybrid_source || false;
      const gwpSource = material.gwp_data_source || '';
      const dataQualityGrade = material.data_quality_grade || '';

      if (isHybrid && gwpSource.includes('DEFRA')) {
        hybridSourcesCount++; defraGwpCount++;
      } else if (dataQualityGrade === 'HIGH' || gwpSource.includes('Supplier')) {
        supplierVerifiedCount++;
      } else if (gwpSource.includes('Ecoinvent') && !isHybrid) {
        ecoinventOnlyCount++;
      }

      totalClimate += climate; totalWater += water; totalWaterScarcity += waterScarcity;
      totalLand += land; totalWaste += waste;
      totalOzoneDepletion += ozoneDepletion; totalPhotochemicalOzone += photochemicalOzone;
      totalIonisingRadiation += ionisingRadiation; totalParticulateMatter += particulateMatter;
      totalHumanToxCarcinogenic += humanToxCarcinogenic; totalHumanToxNonCarcinogenic += humanToxNonCarcinogenic;
      totalTerrestrialEcotox += terrestrialEcotox; totalFreshwaterEcotox += freshwaterEcotox;
      totalMarineEcotox += marineEcotox; totalFreshwaterEutro += freshwaterEutro;
      totalMarineEutro += marineEutro; totalTerrestrialAcid += terrestrialAcid;
      totalMineralResource += mineralResource; totalFossilResource += fossilResource;
      climateFossil += climateF; climateBiogenic += climateB; climateDluc += climateD;

      totalClimate += transport; transportTotal += transport;
      scope3Total += climate + transport;

      const isPackaging = material.packaging_category || material.name?.toLowerCase().includes('bottle') ||
                         material.name?.toLowerCase().includes('cap') || material.name?.toLowerCase().includes('label');

      if (isPackaging) {
        packagingTotal += climate; packagingStageTotal += climate;
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
    productionSites?.forEach((site: any) => {
      const sharePercent = Number(site.production_volume_share_percent) || 0;
      const facility = site.facility;
      if (!facility || sharePercent === 0) return;
      const calculatedMetrics = facility.calculated_metrics || {};
      const facilityIntensity = Number(calculatedMetrics.emissions_intensity_kg_co2e_per_kg) || 0;
      const allocatedEmissions = (lca.functional_unit || 1) * (sharePercent / 100) * facilityIntensity;
      if (allocatedEmissions > 0) {
        const scope1 = Number(calculatedMetrics.total_scope_1_emissions) || 0;
        const scope2 = Number(calculatedMetrics.total_scope_2_emissions) || 0;
        const totalFacilityEmissions = scope1 + scope2;
        const allocatedScope1 = totalFacilityEmissions > 0 ? (scope1 / totalFacilityEmissions) * allocatedEmissions : 0;
        const allocatedScope2 = totalFacilityEmissions > 0 ? (scope2 / totalFacilityEmissions) * allocatedEmissions : 0;
        totalClimate += allocatedEmissions; scope1Total += allocatedScope1; scope2Total += allocatedScope2;
        productionTotal += allocatedEmissions; processingTotal += allocatedEmissions;
        facilityBreakdown.push({
          facility_name: facility.name, emissions: allocatedEmissions,
          percentage: 0, scope1: allocatedScope1, scope2: allocatedScope2,
        });
      }
    });

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
      score: dataQualityScore, rating: dataQualityRating, total_materials: totalMaterialCount,
      breakdown: {
        primary_verified_count: priority1Count,
        primary_verified_share: `${totalMaterialCount > 0 ? Math.round((priority1Count / totalMaterialCount) * 100) : 0}%`,
        regional_standard_count: priority2Count,
        regional_standard_share: `${totalMaterialCount > 0 ? Math.round((priority2Count / totalMaterialCount) * 100) : 0}%`,
        secondary_modelled_count: priority3Count,
        secondary_modelled_share: `${totalMaterialCount > 0 ? Math.round((priority3Count / totalMaterialCount) * 100) : 0}%`,
      },
    };

    const enrichedMaterialBreakdown = materialBreakdown.map((item: any) => {
      const material = materials?.find((m: any) => m.name === item.name);
      return {
        ...item,
        data_quality_tag: material?.data_quality_tag || 'Unknown',
        confidence_score: material?.confidence_score || 0,
        source_reference: material?.source_reference || 'Unknown',
        methodology: material?.methodology || 'Unknown',
      };
    });

    const methodologySummary = [];
    if (defraGwpCount > 0) methodologySummary.push(`DEFRA 2025 GHG factors (${defraGwpCount} materials)`);
    if (supplierVerifiedCount > 0) methodologySummary.push(`Supplier verified EPDs (${supplierVerifiedCount} materials)`);
    if (ecoinventOnlyCount > 0) methodologySummary.push(`Ecoinvent 3.12 full dataset (${ecoinventOnlyCount} materials)`);
    if (hybridSourcesCount > 0) methodologySummary.push(`Hybrid sources (${hybridSourcesCount} materials)`);

    const aggregatedImpacts = {
      climate_change_gwp100: totalClimate, water_consumption: totalWater, water_scarcity_aware: totalWaterScarcity, land_use: totalLand,
      ozone_depletion: totalOzoneDepletion, photochemical_ozone_formation: totalPhotochemicalOzone,
      ionising_radiation: totalIonisingRadiation, particulate_matter: totalParticulateMatter,
      human_toxicity_carcinogenic: totalHumanToxCarcinogenic, human_toxicity_non_carcinogenic: totalHumanToxNonCarcinogenic,
      terrestrial_ecotoxicity: totalTerrestrialEcotox, freshwater_ecotoxicity: totalFreshwaterEcotox,
      marine_ecotoxicity: totalMarineEcotox, freshwater_eutrophication: totalFreshwaterEutro,
      marine_eutrophication: totalMarineEutro, terrestrial_acidification: totalTerrestrialAcid,
      mineral_resource_scarcity: totalMineralResource, fossil_resource_scarcity: totalFossilResource, waste: totalWaste,
      climate_fossil: climateFossil, climate_biogenic: climateBiogenic, climate_dluc: climateDluc,
      circularity_percentage: 0, water_risk_level: 'low', data_quality: dataQualitySummary,
      data_provenance: {
        hybrid_sources_count: hybridSourcesCount, defra_gwp_count: defraGwpCount,
        supplier_verified_count: supplierVerifiedCount, ecoinvent_only_count: ecoinventOnlyCount,
        methodology_summary: methodologySummary.join('; '),
      },
      breakdown: {
        by_scope: { scope1: scope1Total, scope2: scope2Total, scope3: scope3Total },
        by_category: { materials: materialsTotal, packaging: packagingTotal, production: productionTotal, transport: transportTotal, end_of_life: eolTotal },
        by_ghg: { co2_fossil: climateFossil, co2_biogenic: climateBiogenic, ch4: 0, n2o: 0 },
        by_lifecycle_stage: {
          raw_materials: rawMaterialsTotal, processing: processingTotal, packaging_stage: packagingStageTotal,
          distribution: distributionTotal, use_phase: 0, end_of_life: 0,
        },
        by_material: enrichedMaterialBreakdown,
        by_facility: facilityBreakdown,
      },
    };

    let ef31Impacts: any = null;
    let ef31SingleScore: number | null = null;

    if (hasEF31Access || force_ef31) {
      console.log("[calculate-product-lca-impacts] Calculating EF 3.1 impacts...");

      const ef31RawImpacts: EF31ImpactValues = {
        climate_change_total: 0, climate_change_fossil: 0, climate_change_biogenic: 0, climate_change_luluc: 0,
        ozone_depletion: 0, ionising_radiation: 0, photochemical_ozone_formation: 0, particulate_matter: 0,
        human_toxicity_cancer: 0, human_toxicity_non_cancer: 0, acidification: 0,
        eutrophication_freshwater: 0, eutrophication_marine: 0, eutrophication_terrestrial: 0,
        ecotoxicity_freshwater: 0, land_use: 0, water_use: 0, resource_use_fossils: 0, resource_use_minerals_metals: 0,
      };

      materials?.forEach((material: any) => {
        ef31RawImpacts.climate_change_total += Number(material.ef_climate_change_total) || Number(material.impact_climate) || 0;
        ef31RawImpacts.climate_change_fossil += Number(material.ef_climate_change_fossil) || (Number(material.impact_climate) || 0) * 0.85;
        ef31RawImpacts.climate_change_biogenic += Number(material.ef_climate_change_biogenic) || (Number(material.impact_climate) || 0) * 0.10;
        ef31RawImpacts.climate_change_luluc += Number(material.ef_climate_change_luluc) || (Number(material.impact_climate) || 0) * 0.05;
        ef31RawImpacts.ozone_depletion += Number(material.ef_ozone_depletion) || Number(material.impact_ozone_depletion) || 0;
        ef31RawImpacts.ionising_radiation += Number(material.ef_ionising_radiation) || Number(material.impact_ionising_radiation) || 0;
        ef31RawImpacts.photochemical_ozone_formation += Number(material.ef_photochemical_ozone_formation) || Number(material.impact_photochemical_ozone_formation) || 0;
        ef31RawImpacts.particulate_matter += Number(material.ef_particulate_matter) || Number(material.impact_particulate_matter) || 0;
        ef31RawImpacts.human_toxicity_cancer += Number(material.ef_human_toxicity_cancer) || Number(material.impact_human_toxicity_carcinogenic) || 0;
        ef31RawImpacts.human_toxicity_non_cancer += Number(material.ef_human_toxicity_non_cancer) || Number(material.impact_human_toxicity_non_carcinogenic) || 0;
        ef31RawImpacts.acidification += Number(material.ef_acidification) || Number(material.impact_terrestrial_acidification) || 0;
        ef31RawImpacts.eutrophication_freshwater += Number(material.ef_eutrophication_freshwater) || Number(material.impact_freshwater_eutrophication) || 0;
        ef31RawImpacts.eutrophication_marine += Number(material.ef_eutrophication_marine) || Number(material.impact_marine_eutrophication) || 0;
        ef31RawImpacts.eutrophication_terrestrial += Number(material.ef_eutrophication_terrestrial) || 0;
        ef31RawImpacts.ecotoxicity_freshwater += Number(material.ef_ecotoxicity_freshwater) || Number(material.impact_freshwater_ecotoxicity) || 0;
        ef31RawImpacts.land_use += Number(material.ef_land_use) || Number(material.impact_land) || 0;
        ef31RawImpacts.water_use += Number(material.ef_water_use) || Number(material.impact_water) || 0;
        ef31RawImpacts.resource_use_fossils += Number(material.ef_resource_use_fossils) || Number(material.impact_fossil_resource_scarcity) || 0;
        ef31RawImpacts.resource_use_minerals_metals += Number(material.ef_resource_use_minerals_metals) || Number(material.impact_mineral_resource_scarcity) || 0;
      });

      const normalisedImpacts: Record<string, number> = {
        CC: ef31RawImpacts.climate_change_total / EU27_2010_NORMALISATION_FACTORS.CC,
        OD: ef31RawImpacts.ozone_depletion / EU27_2010_NORMALISATION_FACTORS.OD,
        IR: ef31RawImpacts.ionising_radiation / EU27_2010_NORMALISATION_FACTORS.IR,
        POF: ef31RawImpacts.photochemical_ozone_formation / EU27_2010_NORMALISATION_FACTORS.POF,
        PM: ef31RawImpacts.particulate_matter / EU27_2010_NORMALISATION_FACTORS.PM,
        HTC: ef31RawImpacts.human_toxicity_cancer / EU27_2010_NORMALISATION_FACTORS.HTC,
        HTNC: ef31RawImpacts.human_toxicity_non_cancer / EU27_2010_NORMALISATION_FACTORS.HTNC,
        AC: ef31RawImpacts.acidification / EU27_2010_NORMALISATION_FACTORS.AC,
        EUF: ef31RawImpacts.eutrophication_freshwater / EU27_2010_NORMALISATION_FACTORS.EUF,
        EUM: ef31RawImpacts.eutrophication_marine / EU27_2010_NORMALISATION_FACTORS.EUM,
        EUT: ef31RawImpacts.eutrophication_terrestrial / EU27_2010_NORMALISATION_FACTORS.EUT,
        ETF: ef31RawImpacts.ecotoxicity_freshwater / EU27_2010_NORMALISATION_FACTORS.ETF,
        LU: ef31RawImpacts.land_use / EU27_2010_NORMALISATION_FACTORS.LU,
        WU: ef31RawImpacts.water_use / EU27_2010_NORMALISATION_FACTORS.WU,
        RUF: ef31RawImpacts.resource_use_fossils / EU27_2010_NORMALISATION_FACTORS.RUF,
        RUM: ef31RawImpacts.resource_use_minerals_metals / EU27_2010_NORMALISATION_FACTORS.RUM,
      };

      const weightedImpacts: Record<string, number> = {};
      let singleScoreSum = 0;
      for (const [code, normValue] of Object.entries(normalisedImpacts)) {
        const weight = DEFAULT_WEIGHTING_FACTORS[code as keyof typeof DEFAULT_WEIGHTING_FACTORS] || 0;
        weightedImpacts[code] = normValue * weight;
        singleScoreSum += weightedImpacts[code];
      }

      ef31SingleScore = singleScoreSum;

      ef31Impacts = {
        raw_impacts: ef31RawImpacts,
        normalised_impacts: normalisedImpacts,
        weighted_impacts: weightedImpacts,
        single_score: ef31SingleScore,
        methodology_version: '3.1',
        calculated_at: new Date().toISOString(),
        units: {
          CC: 'kg CO2 eq', OD: 'kg CFC-11 eq', IR: 'kBq U235 eq', POF: 'kg NMVOC eq',
          PM: 'disease incidence', HTC: 'CTUh', HTNC: 'CTUh', AC: 'mol H+ eq',
          EUF: 'kg P eq', EUM: 'kg N eq', EUT: 'mol N eq', ETF: 'CTUe',
          LU: 'pt', WU: 'm3 world eq', RUF: 'MJ', RUM: 'kg Sb eq',
        },
      };

      console.log("[calculate-product-lca-impacts] EF 3.1 single score:", ef31SingleScore);
    }

    const updatePayload: any = {
      aggregated_impacts: aggregatedImpacts,
      status: 'completed',
      updated_at: new Date().toISOString(),
      lca_methodology: 'recipe_2016',
    };

    if (ef31Impacts) {
      updatePayload.ef31_impacts = ef31Impacts;
      updatePayload.ef31_single_score = ef31SingleScore;
      updatePayload.ef31_calculated_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("product_lcas")
      .update(updatePayload)
      .eq("id", product_lca_id);

    if (updateError) {
      console.error("[calculate-product-lca-impacts] Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update LCA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[calculate-product-lca-impacts] Successfully updated LCA with impacts");

    const responsePayload: any = {
      success: true,
      aggregated_impacts: aggregatedImpacts,
      methodology: 'recipe_2016',
    };

    if (ef31Impacts) {
      responsePayload.ef31_impacts = ef31Impacts;
      responsePayload.ef31_single_score = ef31SingleScore;
      responsePayload.methodologies = ['recipe_2016', 'ef_31'];
    }

    return new Response(
      JSON.stringify(responsePayload),
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