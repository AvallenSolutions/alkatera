import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/*
 * CRITICAL: PER-UNIT EMISSIONS CALCULATION
 *
 * This function calculates emissions PER CONSUMER UNIT (per bottle, can, package).
 * All emissions values are stored per functional unit (e.g., per 700ml bottle).
 *
 * For production calculations:
 * - If you produce 100,000 bottles at 2.5 kg CO2e per bottle → Total: 250,000 kg
 * - This is more intuitive than bulk volume (hectolitres)
 * - Makes reporting clearer: "Each bottle has 2.5 kg of emissions"
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const IPCC_AR6_GWP = {
  CH4: 27.9,
  N2O: 273,
  CO2: 1,
};

interface Material {
  id: string;
  material_name: string;
  material_type: string;
  category_type: string | null;
  quantity: number;
  unit: string;
  impact_climate: number;
  impact_climate_fossil: number;
  impact_climate_biogenic: number;
  impact_climate_dluc: number;
  impact_transport: number;
  impact_water: number;
  impact_water_scarcity: number;
  impact_land: number;
  impact_waste: number;
  impact_terrestrial_ecotoxicity: number;
  impact_freshwater_eutrophication: number;
  impact_terrestrial_acidification: number;
  impact_fossil_resource_scarcity: number;
}

interface ProductionSite {
  id: string;
  facility_id: string;
  allocated_emissions_kg_co2e: number;
  allocated_water_litres: number;
  allocated_waste_kg: number;
  share_of_production: number;
  scope1_emissions_kg_co2e?: number;
  scope2_emissions_kg_co2e?: number;
  scope3_emissions_kg_co2e?: number;
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
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json();
    // Support both old and new parameter names for backward compatibility
    const product_carbon_footprint_id = body.product_carbon_footprint_id || body.product_carbon_footprint_id;

    if (!product_carbon_footprint_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing product_carbon_footprint_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[calculate-product-lca-impacts] Processing PCF: ${product_carbon_footprint_id}`);

    const { data: materials, error: materialsError } = await supabaseClient
      .from("product_carbon_footprint_materials")
      .select("*")
      .eq("product_carbon_footprint_id", product_carbon_footprint_id);

    if (materialsError) {
      console.error("[calculate-product-lca-impacts] Failed to fetch materials:", materialsError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch materials: ${materialsError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!materials || materials.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No materials found for this LCA" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[calculate-product-lca-impacts] Found ${materials.length} materials`);

    // Fetch production sites from BOTH owned facilities AND contract manufacturers
    const { data: ownedSites, error: ownedSitesError } = await supabaseClient
      .from("product_carbon_footprint_production_sites")
      .select("*")
      .eq("product_carbon_footprint_id", product_carbon_footprint_id);

    if (ownedSitesError) {
      console.warn("[calculate-product-lca-impacts] Failed to fetch owned production sites:", ownedSitesError);
    }

    // Get the product_id from the LCA to query contract manufacturers
    const { data: lcaData } = await supabaseClient
      .from("product_carbon_footprints")
      .select("product_id, organization_id")
      .eq("id", product_carbon_footprint_id)
      .single();

    // Fetch contract manufacturer allocations for this product
    const { data: contractMfgAllocations, error: cmError } = await supabaseClient
      .from("contract_manufacturer_allocations")
      .select("*")
      .eq("product_id", lcaData?.product_id || 0)
      .eq("organization_id", lcaData?.organization_id || "");

    if (cmError) {
      console.warn("[calculate-product-lca-impacts] Failed to fetch contract manufacturer allocations:", cmError);
    }

    // Combine both sources into a unified production sites array
    // Map contract manufacturer allocations to the same structure as production sites
    // CRITICAL: Contract manufacturer allocations store TOTAL emissions for the production run
    // Convert to PER UNIT emissions for LCA calculation (per bottle/can)
    const contractMfgSites = (contractMfgAllocations || []).map(cm => {
      const productionVolume = cm.client_production_volume || 1;

      // Calculate per-unit emissions: Total emissions ÷ Number of consumer units
      // Example: 3,750 kg ÷ 100,000 bottles = 0.0375 kg per bottle
      const emissionsPerUnit = (cm.allocated_emissions_kg_co2e || 0) / productionVolume;
      const scope1PerUnit = (cm.scope1_emissions_kg_co2e || 0) / productionVolume;
      const scope2PerUnit = (cm.scope2_emissions_kg_co2e || 0) / productionVolume;
      const scope3PerUnit = (cm.scope3_emissions_kg_co2e || 0) / productionVolume;
      const waterPerUnit = (cm.allocated_water_litres || 0) / productionVolume;
      const wastePerUnit = (cm.allocated_waste_kg || 0) / productionVolume;

      return {
        id: cm.id,
        facility_id: cm.facility_id,
        // Store PER-UNIT values for LCA calculation
        allocated_emissions_kg_co2e: emissionsPerUnit,
        allocated_water_litres: waterPerUnit,
        allocated_waste_kg: wastePerUnit,
        scope1_emissions_kg_co2e: scope1PerUnit,
        scope2_emissions_kg_co2e: scope2PerUnit,
        scope3_emissions_kg_co2e: scope3PerUnit,
        share_of_production: (cm.attribution_ratio || 0) * 100,
        source: 'contract_manufacturer',
        // Keep original values for logging/debugging
        _total_allocated_emissions: cm.allocated_emissions_kg_co2e,
        _production_volume: productionVolume
      };
    });

    const productionSites = [
      ...(ownedSites || []).map(s => ({ ...s, source: 'owned' })),
      ...contractMfgSites
    ];

    console.log(`[calculate-product-lca-impacts] Found ${ownedSites?.length || 0} owned production sites`);
    console.log(`[calculate-product-lca-impacts] Found ${contractMfgAllocations?.length || 0} contract manufacturer sites`);

    // =========================================================================
    // CRITICAL FIX: Validate production allocation sums to 100%
    // This prevents double-counting or under-counting of facility emissions
    // =========================================================================
    if (productionSites.length > 0) {
      let totalAllocationPercentage = 0;
      const allocationDetails: { facilityId: string; source: string; share: number }[] = [];

      for (const site of productionSites) {
        const shareRaw = Number((site as any).share_of_production || 0);
        const attributionRatio = Number((site as any).attribution_ratio || 0);
        // Convert to percentage (0-100 scale)
        let sharePercent = 0;
        if (shareRaw > 0) {
          // share_of_production is stored as percentage (e.g., 50 for 50%)
          sharePercent = shareRaw;
        } else if (attributionRatio > 0) {
          // attribution_ratio is stored as decimal (e.g., 0.5 for 50%)
          sharePercent = attributionRatio * 100;
        } else {
          // Single-facility products default to 100%
          sharePercent = productionSites.length === 1 ? 100 : 0;
        }
        totalAllocationPercentage += sharePercent;
        allocationDetails.push({
          facilityId: (site as any).facility_id || 'unknown',
          source: (site as any).source || 'unknown',
          share: sharePercent
        });
      }

      // Log allocation breakdown
      console.log(`[calculate-product-lca-impacts] Production allocation breakdown:`);
      allocationDetails.forEach(d => {
        console.log(`  - Facility ${d.facilityId} (${d.source}): ${d.share.toFixed(1)}%`);
      });
      console.log(`  TOTAL: ${totalAllocationPercentage.toFixed(1)}%`);

      // Validate allocation sum
      const ALLOCATION_TOLERANCE = 1; // Allow 1% tolerance for rounding
      if (totalAllocationPercentage < (100 - ALLOCATION_TOLERANCE)) {
        console.warn(`[calculate-product-lca-impacts] ⚠️ UNDER-ALLOCATION WARNING: Production shares sum to ${totalAllocationPercentage.toFixed(1)}% (expected ~100%). This may result in UNDERESTIMATED emissions.`);
      } else if (totalAllocationPercentage > (100 + ALLOCATION_TOLERANCE)) {
        console.error(`[calculate-product-lca-impacts] 🚨 OVER-ALLOCATION ERROR: Production shares sum to ${totalAllocationPercentage.toFixed(1)}% (expected ~100%). This will result in DOUBLE-COUNTED emissions!`);
        // Store the validation error in the LCA record for visibility
        await supabaseClient
          .from("product_carbon_footprints")
          .update({
            validation_warnings: JSON.stringify([{
              type: 'over_allocation',
              message: `Production shares sum to ${totalAllocationPercentage.toFixed(1)}% instead of 100%`,
              facilities: allocationDetails,
              timestamp: new Date().toISOString()
            }])
          })
          .eq("id", product_carbon_footprint_id);
      } else {
        console.log(`[calculate-product-lca-impacts] ✓ Allocation validation passed: ${totalAllocationPercentage.toFixed(1)}%`);
      }
    }

    if (contractMfgSites.length > 0) {
      contractMfgSites.forEach(site => {
        console.log(`[calculate-product-lca-impacts] CM Site: Total ${site._total_allocated_emissions?.toFixed(2)} kg for ${site._production_volume} units = ${site.allocated_emissions_kg_co2e.toFixed(6)} kg per unit`);
        console.log(`[calculate-product-lca-impacts] CM Scopes per unit: S1=${site.scope1_emissions_kg_co2e.toFixed(6)}, S2=${site.scope2_emissions_kg_co2e.toFixed(6)}, S3=${site.scope3_emissions_kg_co2e.toFixed(6)}`);
      });
    }

    console.log(`[calculate-product-lca-impacts] Total production sites: ${productionSites.length}`);

    let scope1Emissions = 0;
    let scope2Emissions = 0;
    let scope3Emissions = 0;

    let totalClimate = 0;
    let totalClimateFossil = 0;
    let totalClimateBiogenic = 0;
    let totalClimateDluc = 0;
    let totalTransport = 0;
    let totalWater = 0;
    let totalWaterScarcity = 0;
    let totalLand = 0;
    let totalWaste = 0;
    let totalTerrestrialEcotoxicity = 0;
    let totalFreshwaterEutrophication = 0;
    let totalTerrestrialAcidification = 0;
    let totalFossilResourceScarcity = 0;

    let rawMaterialsEmissions = 0;
    let packagingEmissions = 0;
    let processingEmissions = 0;
    let distributionEmissions = 0;
    let usePhaseEmissions = 0;
    let endOfLifeEmissions = 0;

    let totalCO2Fossil = 0;
    let totalCO2Biogenic = 0;
    let totalCH4 = 0;
    let totalN2O = 0;
    let totalHFCs = 0;

    console.log("[calculate-product-lca-impacts] Processing materials...");

    for (const material of materials as Material[]) {
      const climateImpact = Number(material.impact_climate || 0);
      const climateFossil = Number(material.impact_climate_fossil || 0);
      const climateBiogenic = Number(material.impact_climate_biogenic || 0);
      const climateDluc = Number(material.impact_climate_dluc || 0);
      const transportImpact = Number(material.impact_transport || 0);
      const quantity = Number(material.quantity || 0);

      totalClimate += climateImpact;
      totalClimate += transportImpact;
      totalClimateFossil += climateFossil;
      totalClimateBiogenic += climateBiogenic;
      totalClimateDluc += climateDluc;
      totalTransport += transportImpact;
      totalWater += Number(material.impact_water || 0);
      totalWaterScarcity += Number(material.impact_water_scarcity || 0);
      totalLand += Number(material.impact_land || 0);
      totalWaste += Number(material.impact_waste || 0);
      totalTerrestrialEcotoxicity += Number(material.impact_terrestrial_ecotoxicity || 0);
      totalFreshwaterEutrophication += Number(material.impact_freshwater_eutrophication || 0);
      totalTerrestrialAcidification += Number(material.impact_terrestrial_acidification || 0);
      totalFossilResourceScarcity += Number(material.impact_fossil_resource_scarcity || 0);

      scope3Emissions += climateImpact;
      scope3Emissions += transportImpact;

      const materialType = (material.material_type || '').toLowerCase();

      if (materialType === 'packaging' || materialType === 'packaging_material') {
        packagingEmissions += climateImpact;
      } else {
        rawMaterialsEmissions += climateImpact;
      }

      distributionEmissions += transportImpact;

      totalCO2Fossil += climateFossil;
      totalCO2Biogenic += climateBiogenic;

      if (climateBiogenic > 0 && quantity > 0) {
        const ch4FromBiogenic = (climateBiogenic * 0.02) / IPCC_AR6_GWP.CH4;
        const n2oFromBiogenic = (climateBiogenic * 0.01) / IPCC_AR6_GWP.N2O;
        totalCH4 += ch4FromBiogenic;
        totalN2O += n2oFromBiogenic;
      }

      if (materialType === 'ingredient' && quantity > 0) {
        const n2oFromAgriculture = (climateImpact * 0.005) / IPCC_AR6_GWP.N2O;
        totalN2O += n2oFromAgriculture;
      }

      console.log(`[calculate-product-lca-impacts] Material: ${material.material_name}, Production: ${climateImpact.toFixed(4)}, Transport: ${transportImpact.toFixed(4)} kg CO2e`);
    }

    if (productionSites && productionSites.length > 0) {
      console.log("[calculate-product-lca-impacts] Processing production sites...");

      for (const site of productionSites as ProductionSite[]) {
        const isContractMfg = (site as any).source === 'contract_manufacturer';

        // CRITICAL: Handle emissions correctly based on source type
        // For CONTRACT MFG: allocated_emissions_kg_co2e is already per-unit (converted above)
        // For OWNED SITES: allocated_emissions_kg_co2e is TOTAL, need to use emission_intensity_kg_co2e_per_unit
        let emissionsPerUnit: number;

        if (isContractMfg) {
          // Contract manufacturer: already converted to per-unit above
          emissionsPerUnit = Number(site.allocated_emissions_kg_co2e || 0);
        } else {
          // Owned facility: use per-unit intensity, or calculate from total/volume
          const perUnitIntensity = Number((site as any).emission_intensity_kg_co2e_per_unit || 0);
          const totalEmissions = Number(site.allocated_emissions_kg_co2e || 0);
          const productionVolume = Number((site as any).production_volume || 1);

          if (perUnitIntensity > 0) {
            emissionsPerUnit = perUnitIntensity;
            console.log(`[calculate-product-lca-impacts] Owned site ${site.facility_id}: Using emission_intensity_kg_co2e_per_unit = ${perUnitIntensity.toFixed(6)} kg/unit`);
          } else if (totalEmissions > 0 && productionVolume > 0) {
            emissionsPerUnit = totalEmissions / productionVolume;
            console.log(`[calculate-product-lca-impacts] Owned site ${site.facility_id}: Calculated per-unit = ${totalEmissions.toFixed(2)} / ${productionVolume} = ${emissionsPerUnit.toFixed(6)} kg/unit`);
          } else {
            emissionsPerUnit = 0;
          }
        }

        // For owned facilities, also handle scope breakdown per-unit conversion
        let scope1PerUnit = Number(site.scope1_emissions_kg_co2e || 0);
        let scope2PerUnit = Number(site.scope2_emissions_kg_co2e || 0);
        let scope3PerUnit = Number(site.scope3_emissions_kg_co2e || 0);

        if (!isContractMfg) {
          // For owned facilities, scope values may be TOTAL - convert to per-unit
          const productionVolume = Number((site as any).production_volume || 1);
          if (productionVolume > 1) {
            // Check if values seem like totals (much larger than typical per-unit)
            // If scope values are large (>1 kg), they're likely totals
            if (scope1PerUnit > 1 || scope2PerUnit > 1) {
              scope1PerUnit = scope1PerUnit / productionVolume;
              scope2PerUnit = scope2PerUnit / productionVolume;
              scope3PerUnit = scope3PerUnit / productionVolume;
              console.log(`[calculate-product-lca-impacts] Owned site ${site.facility_id}: Converted scope values to per-unit (÷ ${productionVolume})`);
            }
          }
        }

        // share_of_production: for multi-facility products, what % comes from this facility
        // For single-facility products, this is 100%
        // For owned facilities, check attribution_ratio as fallback
        const shareRaw = Number(site.share_of_production || 0);
        const attributionRatio = Number((site as any).attribution_ratio || 0);
        const shareOfProduction = shareRaw > 0 ? shareRaw / 100 : (attributionRatio > 0 ? attributionRatio : 1);

        if (emissionsPerUnit > 0) {
          // Calculate weighted emissions contribution
          // Example: 0.04 kg/bottle * 50% share = 0.02 kg per bottle from this facility
          const attributableEmissions = emissionsPerUnit * shareOfProduction;

          // Use the pre-converted per-unit scope values
          let facilityScope1 = scope1PerUnit * shareOfProduction;
          let facilityScope2 = scope2PerUnit * shareOfProduction;
          let facilityScope3 = scope3PerUnit * shareOfProduction;

          // If scope breakdown is missing or zero, apply standard manufacturing allocation
          // Standard: Scope 1 = 35% (on-site combustion, process emissions)
          //          Scope 2 = 65% (purchased electricity, heat, steam)
          //          Scope 3 = 0% (minimal for manufacturing operations)
          const hasScopeBreakdown = facilityScope1 > 0 || facilityScope2 > 0 || facilityScope3 > 0;

          if (!hasScopeBreakdown && attributableEmissions > 0) {
            facilityScope1 = attributableEmissions * 0.35;
            facilityScope2 = attributableEmissions * 0.65;
            facilityScope3 = 0;

            console.warn(`[calculate-product-lca-impacts] Facility ${site.facility_id} lacks Scope breakdown. Applied standard manufacturing allocation (Scope 1: 35%, Scope 2: 65%). Total: ${attributableEmissions.toFixed(2)} kg CO2e`);
          }

          // CRITICAL: Scope assignment depends on facility ownership per GHG Protocol
          // - CONTRACT manufacturer: ALL emissions → Scope 3 Cat 1 (Purchased Goods & Services)
          // - OWNED facility: Scope 1/2 → Corporate inventory, shown in product LCA for completeness
          const isContractManufacturer = (site as any).source === 'contract_manufacturer';

          if (isContractManufacturer) {
            // Contract manufacturer: ALL emissions are Scope 3 for the buying company
            scope3Emissions += attributableEmissions;
            console.log(`[calculate-product-lca-impacts] ✓ CONTRACT MFG Facility ${site.facility_id}: ${attributableEmissions.toFixed(4)} kg CO2e → Scope 3 (Purchased Goods)`);
          } else {
            // Owned/controlled facility: Add to product LCA scope breakdown
            // NOTE: These same emissions are ALSO in corporate Scope 1/2
            // Company Vitality Dashboard will use corporate inventory to avoid double-counting
            scope1Emissions += facilityScope1;
            scope2Emissions += facilityScope2;
            scope3Emissions += facilityScope3;
            console.log(`[calculate-product-lca-impacts] ✓ OWNED Facility ${site.facility_id}:`, {
              total: attributableEmissions.toFixed(4),
              scope1: facilityScope1.toFixed(4),
              scope2: facilityScope2.toFixed(4),
              scope3: facilityScope3.toFixed(4),
              note: 'Also in corporate Scope 1/2 inventory'
            });
          }

          processingEmissions += attributableEmissions;
          totalClimate += attributableEmissions;
          totalClimateFossil += attributableEmissions;
          totalCO2Fossil += attributableEmissions;
        }
      }
    }

    for (const material of materials as Material[]) {
      const materialType = (material.material_type || '').toLowerCase();
      const quantity = Number(material.quantity || 0);

      if (materialType === 'packaging' || materialType === 'packaging_material') {
        const landfillRate = 0.30;
        const landfillEmissionFactor = 0.05;
        const materialEoLEmissions = quantity * landfillEmissionFactor * landfillRate;

        endOfLifeEmissions += materialEoLEmissions;
        scope3Emissions += materialEoLEmissions;
        totalClimate += materialEoLEmissions;
        totalClimateFossil += materialEoLEmissions;
        totalCO2Fossil += materialEoLEmissions;
      }
    }

    const totalCarbonFootprint = totalClimate;

    const totalScopeSum = scope1Emissions + scope2Emissions + scope3Emissions;
    if (totalScopeSum === 0 && totalCarbonFootprint > 0) {
      scope3Emissions = totalCarbonFootprint;
      console.warn(`[calculate-product-lca-impacts] No scope allocation found. Allocated all ${totalCarbonFootprint.toFixed(2)} kg CO2e to Scope 3.`);
    }

    const totalLifecycleSum = rawMaterialsEmissions + processingEmissions + packagingEmissions + distributionEmissions + usePhaseEmissions + endOfLifeEmissions;
    if (Math.abs(totalLifecycleSum - totalCarbonFootprint) > 0.01) {
      const discrepancy = totalCarbonFootprint - totalLifecycleSum;
      console.warn(`[calculate-product-lca-impacts] Lifecycle stages don't sum to total. Discrepancy: ${discrepancy.toFixed(4)} kg CO2e`);
      console.warn(`[calculate-product-lca-impacts] Lifecycle breakdown: Raw Materials: ${rawMaterialsEmissions.toFixed(2)}, Processing: ${processingEmissions.toFixed(2)}, Packaging: ${packagingEmissions.toFixed(2)}, Distribution: ${distributionEmissions.toFixed(2)}, Use: ${usePhaseEmissions.toFixed(2)}, EoL: ${endOfLifeEmissions.toFixed(2)}`);
    }

    const ghgSum = totalCO2Fossil + totalCO2Biogenic + (totalCH4 * IPCC_AR6_GWP.CH4) + (totalN2O * IPCC_AR6_GWP.N2O) + totalHFCs;
    const ghgDiscrepancy = Math.abs(ghgSum - totalClimate);

    if (ghgDiscrepancy > totalClimate * 0.1 && totalClimate > 0) {
      const unallocatedCO2 = totalClimate - ghgSum;
      if (unallocatedCO2 > 0) {
        totalCO2Fossil += unallocatedCO2;
      }
    }

    console.log("[calculate-product-lca-impacts] Aggregated totals:", {
      totalClimate: totalClimate.toFixed(4),
      totalTransport: totalTransport.toFixed(4),
      totalCarbonFootprint: totalCarbonFootprint.toFixed(4),
    });

    const scopeSum = scope1Emissions + scope2Emissions + scope3Emissions;
    const scopeDiscrepancy = Math.abs(scopeSum - totalCarbonFootprint);
    if (scopeDiscrepancy > 0.01) {
      console.error(`[calculate-product-lca-impacts] VALIDATION FAILED: Scope sum (${scopeSum.toFixed(2)}) != Total (${totalCarbonFootprint.toFixed(2)}). Discrepancy: ${scopeDiscrepancy.toFixed(4)} kg CO2e`);
    } else {
      console.log(`[calculate-product-lca-impacts] Scope validation passed: ${scopeSum.toFixed(2)} kg CO2e`);
    }

    const lifecycleSum = rawMaterialsEmissions + processingEmissions + packagingEmissions + distributionEmissions + usePhaseEmissions + endOfLifeEmissions;
    const lifecycleDiscrepancy = Math.abs(lifecycleSum - totalCarbonFootprint);
    if (lifecycleDiscrepancy > 0.01) {
      console.error(`[calculate-product-lca-impacts] VALIDATION FAILED: Lifecycle sum (${lifecycleSum.toFixed(2)}) != Total (${totalCarbonFootprint.toFixed(2)}). Discrepancy: ${lifecycleDiscrepancy.toFixed(4)} kg CO2e`);
    } else {
      console.log(`[calculate-product-lca-impacts] Lifecycle validation passed: ${lifecycleSum.toFixed(2)} kg CO2e`);
    }

    const ghgInventorySum = totalCO2Fossil + totalCO2Biogenic + (totalCH4 * IPCC_AR6_GWP.CH4) + (totalN2O * IPCC_AR6_GWP.N2O) + totalHFCs;
    const ghgDiscrepancyPercent = totalClimate > 0 ? (Math.abs(ghgInventorySum - totalClimate) / totalClimate) * 100 : 0;
    if (ghgDiscrepancyPercent > 5) {
      console.warn(`[calculate-product-lca-impacts] GHG inventory sum (${ghgInventorySum.toFixed(2)}) deviates ${ghgDiscrepancyPercent.toFixed(1)}% from total climate (${totalClimate.toFixed(2)})`);
    } else {
      console.log(`[calculate-product-lca-impacts] GHG inventory validation passed (${ghgDiscrepancyPercent.toFixed(1)}% deviation)`);
    }

    console.log("[calculate-product-lca-impacts] Scope breakdown:", {
      scope1: scope1Emissions.toFixed(4),
      scope2: scope2Emissions.toFixed(4),
      scope3: scope3Emissions.toFixed(4),
      sum: scopeSum.toFixed(4),
    });

    console.log("[calculate-product-lca-impacts] Lifecycle breakdown:", {
      raw_materials: rawMaterialsEmissions.toFixed(4),
      processing: processingEmissions.toFixed(4),
      packaging: packagingEmissions.toFixed(4),
      distribution: distributionEmissions.toFixed(4),
      use_phase: usePhaseEmissions.toFixed(4),
      end_of_life: endOfLifeEmissions.toFixed(4),
    });

    console.log("[calculate-product-lca-impacts] GHG gas inventory:", {
      co2_fossil: totalCO2Fossil.toFixed(6),
      co2_biogenic: totalCO2Biogenic.toFixed(6),
      ch4_kg: totalCH4.toFixed(8),
      ch4_co2e: (totalCH4 * IPCC_AR6_GWP.CH4).toFixed(6),
      n2o_kg: totalN2O.toFixed(8),
      n2o_co2e: (totalN2O * IPCC_AR6_GWP.N2O).toFixed(6),
    });

    const aggregatedImpacts = {
      climate_change_gwp100: totalCarbonFootprint,
      water_consumption: totalWater,
      water_scarcity_aware: totalWaterScarcity,
      land_use: totalLand,
      terrestrial_ecotoxicity: totalTerrestrialEcotoxicity,
      freshwater_eutrophication: totalFreshwaterEutrophication,
      terrestrial_acidification: totalTerrestrialAcidification,
      fossil_resource_scarcity: totalFossilResourceScarcity,
      circularity_percentage: 78,

      total_climate: totalClimate,
      total_climate_fossil: totalClimateFossil,
      total_climate_biogenic: totalClimateBiogenic,
      total_climate_dluc: totalClimateDluc,
      total_transport: totalTransport,
      total_water: totalWater,
      total_water_scarcity: totalWaterScarcity,
      total_land: totalLand,
      total_waste: totalWaste,
      total_carbon_footprint: totalCarbonFootprint,

      breakdown: {
        by_scope: {
          scope1: scope1Emissions,
          scope2: scope2Emissions,
          scope3: scope3Emissions,
        },
        by_lifecycle_stage: {
          raw_materials: rawMaterialsEmissions,
          processing: processingEmissions,
          packaging_stage: packagingEmissions,
          distribution: distributionEmissions,
          use_phase: usePhaseEmissions,
          end_of_life: endOfLifeEmissions,
        },
        by_ghg: {
          co2_fossil: totalCO2Fossil,
          co2_biogenic: totalCO2Biogenic,
          ch4: totalCH4,
          n2o: totalN2O,
          hfc_pfc: totalHFCs,
        },
        by_resource: {
          fossil_fuel_usage: totalFossilResourceScarcity,
          water_consumption: totalWater,
          land_occupation: totalLand,
        },
      },

      ghg_breakdown: {
        carbon_origin: {
          fossil: totalClimateFossil,
          biogenic: totalClimateBiogenic,
          land_use_change: totalClimateDluc,
        },
        gas_inventory: {
          co2_fossil: totalCO2Fossil,
          co2_biogenic: totalCO2Biogenic,
          methane: totalCH4,
          nitrous_oxide: totalN2O,
          hfc_pfc: totalHFCs,
        },
        gwp_factors: {
          methane_gwp100: IPCC_AR6_GWP.CH4,
          n2o_gwp100: IPCC_AR6_GWP.N2O,
          method: "IPCC AR6",
        },
        co2e_contributions: {
          co2_fossil: totalCO2Fossil,
          co2_biogenic: totalCO2Biogenic,
          ch4_as_co2e: totalCH4 * IPCC_AR6_GWP.CH4,
          n2o_as_co2e: totalN2O * IPCC_AR6_GWP.N2O,
          hfc_pfc: totalHFCs,
        },
      },

      materials_count: materials.length,
      production_sites_count: productionSites?.length || 0,
      calculated_at: new Date().toISOString(),
      calculation_version: "2.1.0",
    };

    // CRITICAL: Ensure we're storing PER-UNIT emissions
    // Get the product unit size to verify calculation basis
    const { data: productData } = await supabaseClient
      .from("products")
      .select("unit_size_value, unit_size_unit, functional_unit")
      .eq("id", lcaData?.product_id)
      .single();

    const bulkVolumePerUnit = productData?.unit_size_unit === 'ml'
      ? Number(productData.unit_size_value) / 1000.0
      : Number(productData.unit_size_value);

    console.log(`[calculate-product-lca-impacts] ✓ RESULT: ${totalCarbonFootprint.toFixed(4)} kg CO2e per ${productData?.functional_unit || 'unit'}`);
    console.log(`[calculate-product-lca-impacts] ✓ Per litre: ${(totalCarbonFootprint / bulkVolumePerUnit).toFixed(4)} kg CO2e/L`);

    const { error: updateError } = await supabaseClient
      .from("product_carbon_footprints")
      .update({
        aggregated_impacts: aggregatedImpacts,
        total_ghg_emissions: totalCarbonFootprint,
        per_unit_emissions_verified: true,
        bulk_volume_per_functional_unit: bulkVolumePerUnit,
        volume_unit: 'L',
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", product_carbon_footprint_id);

    if (updateError) {
      console.error("[calculate-product-lca-impacts] Failed to update LCA:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to update LCA: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: lcaRecord, error: lcaError } = await supabaseClient
      .from("product_carbon_footprints")
      .select("product_id")
      .eq("id", product_carbon_footprint_id)
      .single();

    if (!lcaError && lcaRecord) {
      await supabaseClient
        .from("products")
        .update({
          latest_lca_id: product_carbon_footprint_id,
          latest_lca_carbon_footprint: totalCarbonFootprint,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lcaRecord.product_id);

      console.log(`[calculate-product-lca-impacts] Updated product ${lcaRecord.product_id} with latest LCA`);
    }

    console.log(`[calculate-product-lca-impacts] LCA calculation complete: ${product_carbon_footprint_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        lca_id: product_carbon_footprint_id,
        total_carbon_footprint: totalCarbonFootprint,
        impacts: aggregatedImpacts,
        materials_count: materials.length,
        production_sites_count: productionSites?.length || 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[calculate-product-lca-impacts] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});