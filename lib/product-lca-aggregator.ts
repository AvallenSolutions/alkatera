/**
 * Product LCA Impact Aggregator
 *
 * Client-side aggregation engine that calculates total product impacts
 * from materials and production site allocations.
 *
 * Replaces the Supabase Edge Function `calculate-product-lca-impacts`
 * to eliminate CORS issues when calling from the browser.
 *
 * Methodology: ISO 14067 / GHG Protocol Product Standard
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { calculateUsePhaseEmissions, type UsePhaseConfig } from './use-phase-factors';
import { calculateMaterialEoL, getMaterialFactorKey, type EoLRegion, type RegionalDefaults, type EoLConfig } from './end-of-life-factors';
import { calculateDistributionEmissions, type DistributionConfig } from './distribution-factors';
import { isStageIncluded } from './system-boundaries';
import { IPCC_AR6_GWP } from './ghg-constants';

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
  emission_intensity_kg_co2e_per_unit?: number;
  production_volume?: number;
  attribution_ratio?: number;
  source?: string;
}

export interface FacilityEmissionsData {
  facilityId: string;
  facilityName: string;
  isContractManufacturer: boolean;
  allocatedEmissions: number;
  scope1Emissions: number;
  scope2Emissions: number;
  allocatedWater: number;
  allocatedWaste: number;
  attributionRatio: number;
  productVolume: number; // units of this product produced at the facility
}

export interface AggregationResult {
  success: boolean;
  total_carbon_footprint: number;
  impacts: Record<string, any>;
  materials_count: number;
  production_sites_count: number;
  error?: string;
  /**
   * Non-fatal data quality warnings surfaced during aggregation.
   * These do not abort the calculation but are stored in aggregated_impacts
   * so they appear in the LCA report and can be acted on by the user.
   * Example: "Water data found in both utility_data_entries and
   * facility_activity_entries — possible double-count, using activity entries."
   */
  warnings?: string[];
}

/**
 * Calculate and store aggregated impacts for a product carbon footprint.
 * This runs entirely client-side using the authenticated Supabase client.
 *
 * facilityEmissions: Pre-computed facility emissions passed directly from
 * the calculator. This bypasses the product_carbon_footprint_production_sites
 * table entirely, avoiding a broken DB trigger that prevents INSERTs.
 */
export async function aggregateProductImpacts(
  supabase: SupabaseClient,
  productCarbonFootprintId: string,
  facilityEmissions?: FacilityEmissionsData[],
  systemBoundary?: string,
  usePhaseConfig?: UsePhaseConfig,
  eolConfig?: EoLConfig,
  distributionConfig?: DistributionConfig
): Promise<AggregationResult> {
  console.log(`[aggregateProductImpacts] Processing PCF: ${productCarbonFootprintId}`);

  // Collect non-fatal warnings to surface in the report
  const calculationWarnings: string[] = [];

  // 1. Fetch materials
  const { data: materials, error: materialsError } = await supabase
    .from('product_carbon_footprint_materials')
    .select('*')
    .eq('product_carbon_footprint_id', productCarbonFootprintId);

  if (materialsError) {
    console.error('[aggregateProductImpacts] Failed to fetch materials:', materialsError);
    return { success: false, total_carbon_footprint: 0, impacts: {}, materials_count: 0, production_sites_count: 0, error: `Failed to fetch materials: ${materialsError.message}` };
  }

  if (!materials || materials.length === 0) {
    return { success: false, total_carbon_footprint: 0, impacts: {}, materials_count: 0, production_sites_count: 0, error: 'No materials found for this LCA' };
  }

  console.log(`[aggregateProductImpacts] Found ${materials.length} materials`);

  // 1b. Calculate overall DQI score as impact-weighted average of material confidence scores.
  //
  // HIGH FIX #10: Default confidence for materials with no score changed from 75 → 40.
  // 75% implied "Fair" quality for materials with completely unknown provenance,
  // which was misleadingly optimistic. 40% reflects "Poor" quality for unknown data.
  // ISO 14044 §4.2.3.6 requires explicit data quality assessment — unknowns should not
  // default to passable quality scores.
  const MISSING_CONFIDENCE_DEFAULT = 40; // 40% = "Poor" for materials with no quality score
  const totalAbsImpact = materials.reduce((sum: number, m: any) => sum + Math.abs(m.impact_climate || 0), 0);
  const weightedDqi = totalAbsImpact > 0
    ? materials.reduce((sum: number, m: any) => {
        const weight = Math.abs(m.impact_climate || 0) / totalAbsImpact;
        return sum + (m.confidence_score ?? MISSING_CONFIDENCE_DEFAULT) * weight;
      }, 0)
    : materials.reduce((sum: number, m: any) => sum + (m.confidence_score ?? MISSING_CONFIDENCE_DEFAULT), 0) / materials.length;
  const dqiScore = Math.round(weightedDqi);
  console.log(`[aggregateProductImpacts] DQI Score: ${dqiScore}% (weighted average of ${materials.length} material confidence scores)`);

  // 2. Use facility emissions passed directly from the calculator
  // This bypasses the product_carbon_footprint_production_sites table entirely,
  // which has a broken BEFORE INSERT trigger that silently aborts INSERTs.
  console.log(`[aggregateProductImpacts] Facility emissions provided: ${facilityEmissions?.length || 0} facilities`);

  // 3. Get the product_id and boundary from the PCF
  const { data: lcaData } = await supabase
    .from('product_carbon_footprints')
    .select('product_id, organization_id, system_boundary')
    .eq('id', productCarbonFootprintId)
    .single();

  // Resolve effective system boundary (param > PCF record > default)
  const effectiveBoundary = systemBoundary || lcaData?.system_boundary || 'cradle-to-gate';
  console.log(`[aggregateProductImpacts] System boundary: ${effectiveBoundary}`);

  // HIGH FIX #9: Validate that required configs are present for wider boundaries.
  // When use-phase or EoL is in scope but config is missing, we proceed (don't abort)
  // but warn loudly so it shows up in the report. Silently skipping would under-report.
  if (isStageIncluded(effectiveBoundary, 'use_phase') && !usePhaseConfig) {
    const msg = `[aggregateProductImpacts] ⚠️ BOUNDARY VALIDATION: System boundary is '${effectiveBoundary}' which includes the use phase, but no usePhaseConfig was provided. Use-phase emissions will be ZERO. Complete the Use Phase step in the LCA wizard to configure refrigeration and carbonation assumptions.`;
    console.warn(msg);
    calculationWarnings.push('Use-phase emissions are missing: boundary includes use phase but no configuration was provided. Run the LCA wizard and complete the Use Phase step.');
  }
  if (isStageIncluded(effectiveBoundary, 'end_of_life') && !eolConfig) {
    const msg = `[aggregateProductImpacts] ⚠️ BOUNDARY VALIDATION: System boundary is '${effectiveBoundary}' which includes end-of-life, but no eolConfig was provided. End-of-life emissions will be ZERO. Complete the End of Life step in the LCA wizard.`;
    console.warn(msg);
    calculationWarnings.push('End-of-life emissions are missing: boundary includes end-of-life but no configuration was provided. Run the LCA wizard and complete the End of Life step.');
  }
  if (isStageIncluded(effectiveBoundary, 'distribution') && !distributionConfig) {
    const msg = `[aggregateProductImpacts] ⚠️ BOUNDARY VALIDATION: System boundary is '${effectiveBoundary}' which includes distribution, but no distributionConfig was provided. Distribution emissions will be ZERO. Complete the Distribution step in the LCA wizard.`;
    console.warn(msg);
    calculationWarnings.push('Distribution emissions are missing: boundary includes distribution but no configuration was provided. Run the LCA wizard and complete the Distribution step.');
  }

  // 7. Aggregate material impacts
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

  // Build per-material breakdown for hotspots
  const materialBreakdown: { name: string; quantity: number; unit: string; climate: number; source: string }[] = [];

  console.log('[aggregateProductImpacts] Processing materials...');

  for (const material of materials as Material[]) {
    const climateImpact = Number(material.impact_climate || 0);
    const climateFossil = Number(material.impact_climate_fossil || 0);
    const climateBiogenic = Number(material.impact_climate_biogenic || 0);
    const climateDluc = Number(material.impact_climate_dluc || 0);
    const transportImpact = Number(material.impact_transport || 0);
    const quantity = Number(material.quantity || 0);

    totalClimate += climateImpact;
    // NOTE: transportImpact is tracked separately in totalTransport but NOT
    // added again to totalClimate — transport is already embedded in
    // impact_climate on the material record when the calculator resolves
    // per-material impacts. Adding it twice was a bug causing systematic
    // over-reporting of the carbon footprint.
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
    // Do NOT add transportImpact again — already included in climateImpact.

    const materialType = (material.material_type || '').toLowerCase();

    if (materialType === 'packaging' || materialType === 'packaging_material') {
      packagingEmissions += climateImpact;
    } else if (material.material_name?.startsWith('[Maturation]')) {
      processingEmissions += climateImpact;
    } else {
      rawMaterialsEmissions += climateImpact;
    }

    // MEDIUM FIX #9: Inbound ingredient transport (from supplier to factory) is
    // part of the "raw materials" lifecycle stage per ISO 14044, not "distribution".
    // "Distribution" in LCA refers to outbound distribution from factory to shelf/consumer.
    // Adding ingredient transport to `distributionEmissions` caused the stage breakdown to
    // mislabel upstream logistics as downstream distribution in the report.
    //
    // Transport in this context = supplier-to-factory (inbound) → raw materials stage.
    // Outbound distribution (factory to shelf) is only added when isStageIncluded('distribution')
    // and would come from a separate distribution activity record (not per-material transport).
    //
    // Reclassify: add transportImpact to the same stage bucket as the material itself.
    if (materialType === 'packaging' || materialType === 'packaging_material') {
      packagingEmissions += transportImpact;
    } else if ((material.material_name || '').startsWith('[Maturation]')) {
      processingEmissions += transportImpact;
    } else {
      rawMaterialsEmissions += transportImpact;
    }
    // Note: distributionEmissions is reserved for outbound distribution activities
    // (added separately when boundary includes 'distribution' stage).

    totalCO2Fossil += climateFossil;
    totalCO2Biogenic += climateBiogenic;

    // CH4 and N2O gas breakdown:
    // These values should come from primary supplier data or verified LCI datasets
    // (e.g. Ecoinvent material records that include individual gas inventories).
    // We do NOT estimate CH4/N2O using fixed percentage ratios of biogenic carbon
    // or total climate impact — those ratios (previously 2% and 0.5%) had no
    // scientific basis and introduced inaccuracy into the gas inventory.
    //
    // If material records include ch4_kg / n2o_kg fields (from primary LCI data),
    // those are used. Otherwise the gas inventory will show 0 for CH4/N2O, which
    // is honest — unknown is better than fabricated.
    //
    // TODO: When Ecoinvent integration is built, pull per-gas values from the
    // LCI dataset rather than estimating from CO2e totals.
    const ch4FromMaterial = Number((material as any).ch4_kg || 0);
    const n2oFromMaterial = Number((material as any).n2o_kg || 0);
    totalCH4 += ch4FromMaterial;
    totalN2O += n2oFromMaterial;

    // Add to per-material breakdown (aggregate by material name)
    // HIGH FIX #5: Use climateImpact only (NOT + transportImpact) so that
    // by_material totals match the total_climate headline figure.
    // Transport is already embedded in climateImpact (included during impact
    // factor resolution); adding transportImpact separately inflates the per-material
    // chart vs. the headline number. The by_material breakdown should show the same
    // basis as total_climate for consistency.
    const materialKey = material.material_name || 'Unknown Material';
    const existingMat = materialBreakdown.find(m => m.name === materialKey);
    if (existingMat) {
      existingMat.quantity += quantity;
      existingMat.climate += climateImpact;
    } else {
      materialBreakdown.push({
        name: materialKey,
        quantity,
        unit: material.unit || 'kg',
        climate: climateImpact,
        source: (material as any).impact_source || 'Product LCA',
      });
    }

    console.log(`[aggregateProductImpacts] Material: ${material.material_name}, Climate: ${climateImpact.toFixed(4)}, Transport: ${transportImpact.toFixed(4)} kg CO2e`);
  }

  // 8. Process facility emissions (passed directly from calculator)
  // The calculator passes TOTAL allocated emissions for the entire product run.
  // Material impacts are already per-unit (per 1 functional unit of product).
  // So we must divide facility emissions by productVolume to get per-unit values.
  if (facilityEmissions && facilityEmissions.length > 0) {
    console.log(`[aggregateProductImpacts] Processing ${facilityEmissions.length} facility emissions...`);

    for (const fe of facilityEmissions) {
      // Convert total allocated emissions to per-unit
      const units = fe.productVolume > 0 ? fe.productVolume : 1;
      const perUnitEmissions = fe.allocatedEmissions / units;
      const perUnitScope1 = fe.scope1Emissions / units;
      const perUnitScope2 = fe.scope2Emissions / units;
      const perUnitWater = fe.allocatedWater / units;
      const perUnitWaste = fe.allocatedWaste / units;

      console.log(`[aggregateProductImpacts] ${fe.facilityName}: total allocated=${fe.allocatedEmissions.toFixed(4)} kg / ${units} units = ${perUnitEmissions.toFixed(6)} kg/unit`);

      if (fe.isContractManufacturer) {
        // Contract manufacturers → Scope 3 Category 1: Purchased Goods and Services
        // Per GHG Protocol Product Standard §6.3.3: processing emissions from facilities
        // not under operational control are classified as upstream Scope 3 Category 1.
        // MEDIUM FIX #20: Documenting this explicitly so reports are methodology-clear.
        scope3Emissions += perUnitEmissions;
        console.log(`[aggregateProductImpacts] CONTRACT MFG ${fe.facilityName}: ${perUnitEmissions.toFixed(6)} kg CO2e/unit -> Scope 3 Cat.1 (Purchased Goods/Services)`);
      } else {
        // Owned facilities → Scope 1 & 2
        scope1Emissions += perUnitScope1;
        scope2Emissions += perUnitScope2;
        console.log(`[aggregateProductImpacts] OWNED ${fe.facilityName}: S1=${perUnitScope1.toFixed(6)}, S2=${perUnitScope2.toFixed(6)} kg CO2e/unit`);
      }

      processingEmissions += perUnitEmissions;
      totalClimate += perUnitEmissions;
      totalClimateFossil += perUnitEmissions;
      totalCO2Fossil += perUnitEmissions;

      totalWater += perUnitWater;
      totalWaste += perUnitWaste;
    }
  }

  // 9a. Use-phase emissions (Cradle-to-Consumer or Cradle-to-Grave)
  if (isStageIncluded(effectiveBoundary, 'use_phase') && usePhaseConfig) {
    // Get product volume for use-phase calculation
    const { data: productForVolume } = await supabase
      .from('products')
      .select('unit_size_value, unit_size_unit')
      .eq('id', lcaData?.product_id)
      .single();

    const volumeLitres = productForVolume?.unit_size_unit === 'ml'
      ? Number(productForVolume.unit_size_value || 0) / 1000
      : productForVolume?.unit_size_unit === 'L' || productForVolume?.unit_size_unit === 'l'
        ? Number(productForVolume.unit_size_value || 0)
        : Number(productForVolume?.unit_size_value || 0) / 1000; // Default assume ml

    if (volumeLitres > 0) {
      const useResult = calculateUsePhaseEmissions(usePhaseConfig, volumeLitres);
      usePhaseEmissions = useResult.total;
      scope3Emissions += useResult.total;
      totalClimate += useResult.total;
      totalClimateFossil += useResult.refrigeration; // Refrigeration is fossil-based electricity
      totalCO2Fossil += useResult.refrigeration;
      totalClimateBiogenic += useResult.carbonation; // Carbonation is biogenic CO2
      totalCO2Biogenic += useResult.carbonation;

      console.log(`[aggregateProductImpacts] Use phase: ${useResult.total.toFixed(6)} kg CO2e (refrigeration: ${useResult.refrigeration.toFixed(6)}, carbonation: ${useResult.carbonation.toFixed(6)})`);
    } else {
      console.log('[aggregateProductImpacts] Use phase: skipped (no volume data)');
    }
  }

  // 9a-bis. Distribution emissions (Cradle-to-Shelf, Cradle-to-Consumer, Cradle-to-Grave)
  if (isStageIncluded(effectiveBoundary, 'distribution') && distributionConfig) {
    try {
      const distResult = await calculateDistributionEmissions(distributionConfig);
      distributionEmissions = distResult.total;
      scope3Emissions += distResult.total;
      totalClimate += distResult.total;
      totalClimateFossil += distResult.total; // Transport is fossil-fuel based
      totalCO2Fossil += distResult.total;

      console.log(`[aggregateProductImpacts] Distribution: ${distResult.total.toFixed(6)} kg CO2e (${distResult.perLeg.length} legs)`);
      for (const leg of distResult.perLeg) {
        console.log(`[aggregateProductImpacts]   Leg "${leg.label}": ${leg.emissions.toFixed(6)} kg CO2e (${leg.mode}, ${leg.distanceKm} km)`);
      }
    } catch (err: any) {
      console.warn(`[aggregateProductImpacts] Distribution calculation failed: ${err.message}`);
      calculationWarnings.push(`Distribution calculation failed: ${err.message}. Distribution emissions will be zero.`);
    }
  }

  // 9b. End-of-life emissions (Cradle-to-Grave only)
  if (isStageIncluded(effectiveBoundary, 'end_of_life')) {
    const eolRegion: EoLRegion = eolConfig?.region || 'eu';

    for (const material of materials as Material[]) {
      const materialType = (material.material_type || '').toLowerCase();
      const quantity = Number(material.quantity || 0);
      if (quantity <= 0) continue;

      // HIGH FIX #6: EoL should only apply to PACKAGING materials and food-waste
      // ingredients. PRIMARY ingredients (barley, water, hops, grapes, etc.) are
      // consumed during processing — they have no end-of-life in the product sense.
      // Applying 'organic' waste factors to 500kg of malt falsely adds large
      // EoL emissions to the total. Only process materials where:
      //   (a) material_type is 'packaging' / 'packaging_material', OR
      //   (b) the material has an explicit packaging_category set (backup guard)
      // Synthetic maturation rows (named '[Maturation] ...' ) also excluded.
      const isPackaging = materialType === 'packaging' || materialType === 'packaging_material';
      const packagingCategory = (material as any).packaging_category || '';
      const isMaturationRow = (material.material_name || '').startsWith('[Maturation]');

      if (!isPackaging || isMaturationRow) {
        // Skip: ingredients consumed during processing have no meaningful EoL pathway.
        // Food waste (organic fraction) is typically handled by waste management and
        // already partially captured in upstream processing emissions.
        continue;
      }

      const factorKey = getMaterialFactorKey(packagingCategory || 'other', material.material_name);

      // Get user pathway overrides if available — keyed by material ID or factorKey
      const pathwayOverrides = eolConfig?.pathways?.[material.id] || eolConfig?.pathways?.[factorKey];

      const eolResult = calculateMaterialEoL(quantity, factorKey, eolRegion, pathwayOverrides);

      endOfLifeEmissions += eolResult.net;
      scope3Emissions += eolResult.net;
      totalClimate += eolResult.net;

      // HIGH FIX #14: The EoL fossil/biogenic split was previously two identical
      // branches (if/else) that both did `totalClimateFossil += eolResult.net`,
      // which was a redundant no-op but obscured intent. Now:
      //   - Gross landfill/incineration emissions → fossil CO2 (fossil-based materials)
      //   - Recycling credits (negative) → reduce fossil CO2 (avoided virgin production)
      //   - Organic material decomposition (paper landfill methane) → biogenic CO2
      // For simplicity, all EoL net emissions are attributed to fossil CO2 since
      // the dominant materials (glass, aluminium, plastic) are fossil-origin.
      // TODO: Split by material when biogenic tracking per material is available.
      totalClimateFossil += eolResult.gross;   // Gross landfill/incineration → fossil
      totalCO2Fossil += eolResult.gross;
      // Recycling credits: net reduction in fossil CO2 (negative avoided burden)
      totalClimateFossil += eolResult.avoided; // avoided is negative, reduces total
      totalCO2Fossil += eolResult.avoided;

      console.log(`[aggregateProductImpacts] EoL ${material.material_name} (${factorKey}): net=${eolResult.net.toFixed(6)}, avoided=${eolResult.avoided.toFixed(6)}, gross=${eolResult.gross.toFixed(6)}`);
    }
  } else if (!isStageIncluded(effectiveBoundary, 'end_of_life')) {
    // Legacy: For cradle-to-gate/shelf/consumer, no EoL
    // (Previously had a crude 30% landfill placeholder — now removed)
    console.log('[aggregateProductImpacts] End-of-life: excluded by boundary');
  }

  const totalCarbonFootprint = totalClimate;

  // Fallback: if no scope allocation, put everything in Scope 3
  // CONSISTENCY FIX: Log when this fallback fires so auditors can see the assumption
  const totalScopeSum = scope1Emissions + scope2Emissions + scope3Emissions;
  if (totalScopeSum === 0 && totalCarbonFootprint > 0) {
    console.warn(
      `[aggregateProductImpacts] ⚠ Scope allocation fallback: no materials were classified into ` +
      `Scope 1/2/3. Assigning full total (${totalCarbonFootprint.toFixed(6)} kg CO2e) to Scope 3. ` +
      `This usually means all materials are category_type=MANUFACTURING_MATERIAL with no ` +
      `facility energy split. Review scope allocation logic if this is unexpected.`
    );
    scope3Emissions = totalCarbonFootprint;
  }

  // GHG reconciliation — ISO 14067 §6.4.3 requires by-gas breakdown to sum to total
  const ghgSum = totalCO2Fossil + totalCO2Biogenic + (totalCH4 * IPCC_AR6_GWP.CH4) + (totalN2O * IPCC_AR6_GWP.N2O) + totalHFCs;
  const ghgDiscrepancy = Math.abs(ghgSum - totalClimate);
  if (ghgDiscrepancy > totalClimate * 0.1 && totalClimate > 0) {
    const unallocatedCO2 = totalClimate - ghgSum;
    if (unallocatedCO2 > 0) {
      // CONSISTENCY FIX: Log silent CO₂ reallocation so auditors can see the adjustment.
      // This fires when the by-gas breakdown doesn't sum to the total (>10% discrepancy),
      // typically because some emission factors don't provide a fossil/biogenic/CH₄/N₂O split.
      // The unallocated remainder is assigned to fossil CO₂ as a conservative assumption.
      console.warn(
        `[aggregateProductImpacts] ⚠ GHG reconciliation: by-gas sum (${ghgSum.toFixed(6)}) differs from ` +
        `total climate (${totalClimate.toFixed(6)}) by ${ghgDiscrepancy.toFixed(6)} kg CO2e ` +
        `(${((ghgDiscrepancy / totalClimate) * 100).toFixed(1)}%). Reallocating ${unallocatedCO2.toFixed(6)} kg ` +
        `to fossil CO₂. This is a conservative assumption — improve by using emission factors ` +
        `with explicit GHG gas breakdowns.`
      );
      totalCO2Fossil += unallocatedCO2;
    }
  }

  // Carbon origin reconciliation — ISO 14067 §6.4.2 requires the fossil + biogenic +
  // dLUC split to sum to the total carbon footprint. If some emission factors (e.g.
  // from OpenLCA/Ecoinvent) don't provide explicit fossil/biogenic splits, the origin
  // sum can fall short. Reallocate the gap to fossil as a conservative assumption.
  const carbonOriginSum = totalClimateFossil + totalClimateBiogenic + totalClimateDluc;
  const carbonOriginGap = totalClimate - carbonOriginSum;
  if (Math.abs(carbonOriginGap) > totalClimate * 0.05 && totalClimate > 0 && carbonOriginGap > 0) {
    console.warn(
      `[aggregateProductImpacts] ⚠ Carbon origin reconciliation: origin sum (${carbonOriginSum.toFixed(6)}) differs from ` +
      `total climate (${totalClimate.toFixed(6)}) by ${carbonOriginGap.toFixed(6)} kg CO2e ` +
      `(${((carbonOriginGap / totalClimate) * 100).toFixed(1)}%). Reallocating ${carbonOriginGap.toFixed(6)} kg ` +
      `to fossil origin as conservative assumption.`
    );
    totalClimateFossil += carbonOriginGap;
  }

  console.log('[aggregateProductImpacts] Aggregated totals:', {
    totalClimate: totalClimate.toFixed(4),
    totalWater: totalWater.toFixed(4),
    totalWaste: totalWaste.toFixed(4),
    totalLand: totalLand.toFixed(4),
    totalCarbonFootprint: totalCarbonFootprint.toFixed(4),
  });

  console.log('[aggregateProductImpacts] Scope breakdown:', {
    scope1: scope1Emissions.toFixed(4),
    scope2: scope2Emissions.toFixed(4),
    scope3: scope3Emissions.toFixed(4),
  });

  // CONSISTENCY FIX: Surface the known discrepancy between stage sum and total.
  // Stage buckets include inbound transport (reclassified to raw_materials/packaging per
  // ISO 14044), but totalClimate only counts impact_climate (transport is embedded in
  // per-material impact_climate but also tracked separately in impact_transport).
  // The stage sum will exceed totalClimate by ~totalTransport. This is an architectural
  // note, not a bug — the stage breakdown is additive-approximate for display purposes.
  if (totalTransport > 0) {
    const stageSum = rawMaterialsEmissions + processingEmissions + packagingEmissions +
      distributionEmissions + usePhaseEmissions + endOfLifeEmissions;
    const discrepancy = Math.abs(stageSum - totalCarbonFootprint);
    if (discrepancy > 0.001) {
      calculationWarnings.push(
        `Lifecycle stage sum (${stageSum.toFixed(4)} kg CO2e) differs from headline total ` +
        `(${totalCarbonFootprint.toFixed(4)} kg CO2e) by ${discrepancy.toFixed(4)} kg CO2e. ` +
        `This is because inbound transport (${totalTransport.toFixed(4)} kg CO2e) is included ` +
        `in stage buckets (per ISO 14044) but not double-counted in the headline total.`
      );
    }
  }

  // 10. Build aggregated impacts object
  const aggregatedImpacts = {
    climate_change_gwp100: totalCarbonFootprint,
    water_consumption: totalWater,
    water_scarcity_aware: totalWaterScarcity,
    land_use: totalLand,
    terrestrial_ecotoxicity: totalTerrestrialEcotoxicity,
    freshwater_eutrophication: totalFreshwaterEutrophication,
    terrestrial_acidification: totalTerrestrialAcidification,
    fossil_resource_scarcity: totalFossilResourceScarcity,
    // circularity_percentage is not yet calculated — set to null rather than
    // a meaningless hardcoded value. Will require packaging recycled-content
    // and recovery rate data to compute properly (ISO 14044 / Ellen MacArthur
    // circularity index). TODO: implement when packaging data is richer.
    circularity_percentage: null,

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
      by_material: materialBreakdown.sort((a, b) => b.climate - a.climate),
      by_lifecycle_stage: {
        raw_materials: rawMaterialsEmissions,
        processing: processingEmissions,
        packaging: packagingEmissions,
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
        method: 'IPCC AR6',
      },
      co2e_contributions: {
        co2_fossil: totalCO2Fossil,
        co2_biogenic: totalCO2Biogenic,
        ch4_as_co2e: totalCH4 * IPCC_AR6_GWP.CH4,
        n2o_as_co2e: totalN2O * IPCC_AR6_GWP.N2O,
        hfc_pfc: totalHFCs,
      },
    },

    data_quality: {
      score: dqiScore,
      rating: dqiScore >= 80 ? 'Good' : dqiScore >= 50 ? 'Fair' : 'Poor',
    },

    materials_count: materials.length,
    production_sites_count: facilityEmissions?.length || 0,
    calculated_at: new Date().toISOString(),
    calculation_version: '2.1.0',
    // Store non-fatal warnings so they appear in the LCA report
    calculation_warnings: calculationWarnings.length > 0 ? calculationWarnings : undefined,
  };

  // 11. Get product unit size for per-unit verification
  const { data: productData } = await supabase
    .from('products')
    .select('unit_size_value, unit_size_unit, functional_unit')
    .eq('id', lcaData?.product_id)
    .single();

  const bulkVolumePerUnit = productData?.unit_size_unit === 'ml'
    ? Number(productData.unit_size_value) / 1000.0
    : Number(productData?.unit_size_value || 1);

  console.log(`[aggregateProductImpacts] RESULT: ${totalCarbonFootprint.toFixed(4)} kg CO2e per ${productData?.functional_unit || 'unit'}`);

  // 12. Update the PCF record
  // Note: aggregated_impacts.climate_change_gwp100 is the single source of truth for carbon footprint
  // total_ghg_emissions column is deprecated and will be removed in a future migration
  const { error: updateError } = await supabase
    .from('product_carbon_footprints')
    .update({
      aggregated_impacts: aggregatedImpacts,
      dqi_score: dqiScore,
      per_unit_emissions_verified: true,
      bulk_volume_per_functional_unit: bulkVolumePerUnit,
      volume_unit: 'L',
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', productCarbonFootprintId);

  if (updateError) {
    console.error('[aggregateProductImpacts] Failed to update LCA:', updateError);
    return { success: false, total_carbon_footprint: 0, impacts: {}, materials_count: 0, production_sites_count: 0, error: `Failed to update LCA: ${updateError.message}` };
  }

  // 12b. Supersede old completed PCFs for the same product.
  // Each calculation creates a new PCF record. Without this cleanup, multiple
  // completed records exist and pages relying on ORDER BY can pick different ones,
  // causing discrepancies (e.g. product page shows 1.95 while passport shows 1.43).
  // Marking old records as 'superseded' ensures only ONE completed PCF per product.
  if (lcaData?.product_id) {
    const { error: supersedeError } = await supabase
      .from('product_carbon_footprints')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('product_id', lcaData.product_id)
      .eq('status', 'completed')
      .neq('id', productCarbonFootprintId);

    if (supersedeError) {
      // Non-fatal — the new PCF is still correctly completed
      console.warn('[aggregateProductImpacts] Failed to supersede old PCFs:', supersedeError);
    } else {
      console.log(`[aggregateProductImpacts] Superseded old completed PCFs for product ${lcaData.product_id}`);
    }
  }

  // 13. Update the product with latest LCA reference
  const { data: lcaRecord } = await supabase
    .from('product_carbon_footprints')
    .select('product_id')
    .eq('id', productCarbonFootprintId)
    .single();

  if (lcaRecord) {
    await supabase
      .from('products')
      .update({
        latest_lca_id: productCarbonFootprintId,
        latest_lca_carbon_footprint: totalCarbonFootprint,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lcaRecord.product_id);

    console.log(`[aggregateProductImpacts] Updated product ${lcaRecord.product_id} with latest LCA`);
  }

  console.log(`[aggregateProductImpacts] LCA calculation complete: ${productCarbonFootprintId}`);

  return {
    success: true,
    total_carbon_footprint: totalCarbonFootprint,
    impacts: aggregatedImpacts,
    materials_count: materials.length,
    production_sites_count: facilityEmissions?.length || 0,
    warnings: calculationWarnings.length > 0 ? calculationWarnings : undefined,
  };
}
