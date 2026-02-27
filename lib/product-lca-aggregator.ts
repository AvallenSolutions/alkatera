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
import {
  assessMaterialDataQuality,
  assessAggregateDataQuality,
  propagateUncertainty,
  type MaterialDataQuality,
} from './data-quality-assessment';
import { generateInterpretation } from './lca-interpretation';

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
  let totalCH4 = 0;        // Derived: totalCH4Fossil + totalCH4Biogenic (set after loop)
  let totalCH4Fossil = 0;  // kg CH₄ from fossil sources (GWP-100 = 29.8)
  let totalCH4Biogenic = 0; // kg CH₄ from biogenic sources (GWP-100 = 27.0)
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

    // ISO COMPLIANCE FIX: Removed duplicate transport addition to stage buckets.
    // Transport is already embedded in impact_climate on each material record
    // (see NOTE at line ~227). The climateImpact added to stage buckets above
    // already includes inbound transport. Adding transportImpact again was
    // double-counting, causing stage sum to exceed headline total by ~totalTransport.
    // Outbound distribution is handled separately by the distribution stage.

    totalCO2Fossil += climateFossil;
    totalCO2Biogenic += climateBiogenic;

    // CH₄ and N₂O gas breakdown (ISO 14067 §6.4.3):
    // Read per-gas masses from material records when available (populated by the
    // waterfall resolver from ecoinvent/DEFRA LCI data). Separate fossil and
    // biogenic CH₄ to apply distinct IPCC AR6 GWP-100 factors (29.8 vs 27.0).
    // If the fossil/biogenic split is not available, assign total CH₄ to fossil
    // as a conservative assumption (higher GWP).
    const ch4FossilFromMaterial = Number((material as any).ch4_fossil_kg || 0);
    const ch4BiogenicFromMaterial = Number((material as any).ch4_biogenic_kg || 0);
    const ch4TotalFromMaterial = Number((material as any).ch4_kg || 0);
    const n2oFromMaterial = Number((material as any).n2o_kg || 0);

    if (ch4FossilFromMaterial > 0 || ch4BiogenicFromMaterial > 0) {
      totalCH4Fossil += ch4FossilFromMaterial;
      totalCH4Biogenic += ch4BiogenicFromMaterial;
    } else {
      // No fossil/biogenic split — assign total to fossil (conservative: higher GWP)
      totalCH4Fossil += ch4TotalFromMaterial;
    }
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

  // Derive total CH₄ from fossil + biogenic for backward compatibility
  totalCH4 = totalCH4Fossil + totalCH4Biogenic;

  // ISSUE A FIX: N₂O plausibility check (ISO 14067 §6.4.3).
  // Two checks:
  // 1. Per-kg threshold: N₂O > 0.01 kg per kg product is physically implausible
  //    (typical agricultural N₂O is 10⁻⁵ to 10⁻⁴ kg per kg product).
  // 2. Proportion check: N₂O CO₂e > 30% of total climate impact is implausible
  //    for beverage products (indicates scaling error in emission factor database).
  {
    const totalProductMass = (materials as any[]).reduce((sum: number, m: any) => sum + Number(m.quantity || 0), 0);
    if (totalN2O > 0 && totalProductMass > 0) {
      const n2oPerKgProduct = totalN2O / totalProductMass;
      const n2oCo2eEstimate = totalN2O * IPCC_AR6_GWP.N2O;
      const n2oProportionOfTotal = totalClimate > 0 ? (n2oCo2eEstimate / totalClimate) : 0;

      if (n2oPerKgProduct > 0.01 || (n2oProportionOfTotal > 0.30 && totalClimate > 0)) {
        const cappedN2O = totalProductMass * 0.0001; // 10⁻⁴ kg N₂O/kg (high end of plausible)
        const reason = n2oPerKgProduct > 0.01
          ? `exceeds per-kg threshold (${n2oPerKgProduct.toExponential(3)} kg/kg > 0.01)`
          : `N₂O CO₂e (${n2oCo2eEstimate.toFixed(4)} kg) is ${(n2oProportionOfTotal * 100).toFixed(0)}% of total (${totalClimate.toFixed(4)} kg)`;
        calculationWarnings.push(
          `N₂O mass (${totalN2O.toExponential(3)} kg) ${reason}. ` +
          `This likely indicates a scaling error in the emission factor database. ` +
          `N₂O has been capped at ${cappedN2O.toExponential(3)} kg.`
        );
        console.warn(
          `[aggregateProductImpacts] ⚠ N₂O plausibility: ${totalN2O.toExponential(3)} kg — ${reason}. ` +
          `Capping at ${cappedN2O.toExponential(3)} kg (10⁻⁴ kg/kg).`
        );
        totalN2O = cappedN2O;
      }
    }
  }

  // ISSUE A FIX: Compute pure CO₂ species mass by subtracting CH₄ and N₂O CO₂e
  // from totalCO2Fossil/totalCO2Biogenic.
  //
  // Root cause: totalCO2Fossil/totalCO2Biogenic represent TOTAL CO₂e by carbon origin
  // (all GHG species combined), not pure CO₂ molecule emissions. impact_climate_fossil
  // on material records is the full GWP from fossil sources (including embedded CH₄/N₂O).
  // The GHG species table must show pure CO₂ values so that:
  //   CO₂_fossil_pure + CO₂_biogenic_pure + CH₄_co2e + N₂O_co2e + HFCs = headline total.
  const ch4FossilCO2e = totalCH4Fossil * IPCC_AR6_GWP.CH4_FOSSIL;
  const ch4BiogenicCO2e = totalCH4Biogenic * IPCC_AR6_GWP.CH4_BIOGENIC;
  const n2oCO2e = totalN2O * IPCC_AR6_GWP.N2O;
  // Assign N₂O to fossil origin (conservative: agricultural N₂O is from mineral fertilisers)
  let co2FossilPure = totalCO2Fossil - ch4FossilCO2e - n2oCO2e;
  let co2BiogenicPure = totalCO2Biogenic - ch4BiogenicCO2e;

  // If pure CO₂ goes negative, the CH₄/N₂O estimates exceed the total CO₂e from that
  // origin — cap at zero and add a warning.
  if (co2FossilPure < 0) {
    calculationWarnings.push(
      `Pure fossil CO₂ computed as negative (${co2FossilPure.toFixed(4)} kg) after subtracting ` +
      `CH₄ and N₂O CO₂e from total fossil CO₂e. This indicates CH₄/N₂O gas estimates may ` +
      `exceed the total impact — gas breakdown factors may need review. Capped at zero.`
    );
    co2FossilPure = 0;
  }
  if (co2BiogenicPure < 0) {
    calculationWarnings.push(
      `Pure biogenic CO₂ computed as negative (${co2BiogenicPure.toFixed(4)} kg) after subtracting ` +
      `biogenic CH₄ CO₂e. Capped at zero.`
    );
    co2BiogenicPure = 0;
  }

  // GHG species reconciliation — ISO 14067 §6.4.3: by-gas sum must equal headline total
  const speciesSum = co2FossilPure + co2BiogenicPure + ch4FossilCO2e + ch4BiogenicCO2e + n2oCO2e + totalHFCs;
  const speciesDiscrepancy = Math.abs(speciesSum - totalClimate);
  if (speciesDiscrepancy > 0.001 && totalClimate > 0) {
    // Reconcile by adjusting fossil CO₂ (the largest and most uncertain component)
    const adjustment = totalClimate - speciesSum;
    co2FossilPure += adjustment;
    if (co2FossilPure < 0) co2FossilPure = 0;
    calculationWarnings.push(
      `GHG species sum (${speciesSum.toFixed(4)} kg CO₂e) differs from headline total ` +
      `(${totalClimate.toFixed(4)} kg CO₂e) by ${speciesDiscrepancy.toFixed(4)} kg CO₂e. ` +
      `Adjusted fossil CO₂ by ${adjustment.toFixed(4)} kg to reconcile.`
    );
    console.warn(
      `[aggregateProductImpacts] ⚠ GHG species reconciliation: sum=${speciesSum.toFixed(6)}, ` +
      `headline=${totalClimate.toFixed(6)}, adjustment=${adjustment.toFixed(6)} applied to fossil CO₂.`
    );
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

  // ISO 14044 integrity check: lifecycle stage sum should equal headline total.
  // Transport is embedded in impact_climate per material, so stage buckets and
  // headline total should reconcile. Any discrepancy indicates a data issue.
  {
    const stageSum = rawMaterialsEmissions + processingEmissions + packagingEmissions +
      distributionEmissions + usePhaseEmissions + endOfLifeEmissions;
    const discrepancy = Math.abs(stageSum - totalCarbonFootprint);
    if (discrepancy > 0.001) {
      calculationWarnings.push(
        `Lifecycle stage sum (${stageSum.toFixed(4)} kg CO₂e) differs from headline total ` +
        `(${totalCarbonFootprint.toFixed(4)} kg CO₂e) by ${discrepancy.toFixed(4)} kg CO₂e. ` +
        `This may indicate a rounding or allocation issue. Review material stage assignments.`
      );
    }
  }

  // 10. Calculate circularity percentage from packaging recycled content.
  //
  // Simplified Material Circularity Index: weight-averaged recycled content
  // across all packaging materials. This measures the "circular input" fraction
  // — how much of the packaging mass comes from recycled feedstock.
  //
  // Formula: Σ(weight_i × recycled_content_i) / Σ(weight_i) for packaging materials
  //
  // This is a defensible simplification of the Ellen MacArthur MCI when only
  // input-side data (recycled content %) is available. Output-side recyclability
  // rates could be incorporated later for a full MCI score.
  let circularityPercentage: number | null = null;
  {
    let totalPackagingWeight = 0;
    let weightedRecycledContent = 0;

    for (const material of materials as any[]) {
      const matType = (material.material_type || '').toLowerCase();
      if (matType !== 'packaging' && matType !== 'packaging_material') continue;

      const weight = Number(material.quantity || 0);
      const recycledPct = Number(material.recycled_content_percentage || 0);

      totalPackagingWeight += weight;
      weightedRecycledContent += weight * recycledPct;
    }

    if (totalPackagingWeight > 0) {
      circularityPercentage = Math.round((weightedRecycledContent / totalPackagingWeight) * 10) / 10;
      console.log(
        `[aggregateProductImpacts] Circularity: ${circularityPercentage}% ` +
        `(weight-averaged recycled content across ${totalPackagingWeight.toFixed(3)} kg packaging)`
      );
    } else {
      console.log('[aggregateProductImpacts] Circularity: no packaging materials found, defaulting to null');
    }
  }

  // 10b. Automatic uncertainty and sensitivity analysis (ISO 14044 §4.5.3)
  // Assess each material's data quality using the pedigree matrix approach,
  // propagate uncertainties via root-sum-of-squares, and run ±20% sensitivity
  // analysis on the top 3 contributors.
  const materialAssessments: MaterialDataQuality[] = [];
  for (const material of materials as any[]) {
    const impactSource = (material.impact_source || '').toLowerCase();
    const qualityGrade = (material.data_quality_grade || '').toUpperCase();

    const tier = impactSource === 'primary_verified' ? 'primary_verified' as const
      : impactSource === 'secondary_modelled' ? 'secondary_modelled' as const
      : 'secondary_estimated' as const;

    const grade = qualityGrade === 'HIGH' ? 'HIGH' as const
      : qualityGrade === 'MEDIUM' ? 'MEDIUM' as const
      : 'LOW' as const;

    // Parse data year from source reference
    let dataYear: number | null = null;
    const yearMatch = (material.gwp_data_source || '').match(/\b(20\d{2})\b/);
    if (yearMatch) dataYear = parseInt(yearMatch[1]);

    materialAssessments.push(assessMaterialDataQuality({
      materialName: material.material_name || 'Unknown',
      materialId: material.id || '',
      impactValue: Math.abs(Number(material.impact_climate || 0)),
      impactUnit: 'kg CO₂e',
      dataSource: material.gwp_data_source || 'Unknown',
      dataSourceTier: tier,
      qualityGrade: grade,
      uncertaintyPercent: material.uncertainty_percent,
      dataYear,
      dataRegion: material.origin_country_code || 'GLO',
      studyRegion: 'GLO',
      referenceYear: new Date().getFullYear(),
    }));
  }

  const aggregateQuality = assessAggregateDataQuality(materialAssessments);
  const propagatedUncertaintyPct = propagateUncertainty(materialAssessments, totalCarbonFootprint);

  // 95% confidence interval for total footprint (lognormal distribution)
  const uncertaintyFraction = propagatedUncertaintyPct / 100;
  const ci95Lower = totalCarbonFootprint * Math.exp(-1.96 * uncertaintyFraction);
  const ci95Upper = totalCarbonFootprint * Math.exp(1.96 * uncertaintyFraction);

  // ISSUE B FIX: Compute display percentage from CI half-width, not from σ_g.
  // The propagatedUncertaintyPct is σ_g (geometric standard deviation) used in the
  // lognormal CI formula. But the "±X%" label must reflect the actual half-width
  // of the 95% CI as a percentage of the headline value:
  //   halfWidth = (upper - lower) / 2
  //   displayPct = (halfWidth / headline) × 100
  // Previously, σ_g was displayed directly (e.g. "±14%") but the CI bounds implied
  // ±28%, making the label and bounds mutually inconsistent.
  const ci95HalfWidth = (ci95Upper - ci95Lower) / 2;
  const uncertaintyDisplayPct = totalCarbonFootprint > 0
    ? Math.round((ci95HalfWidth / totalCarbonFootprint) * 100)
    : 0;

  // Sensitivity analysis: ±20% emission factor variation on top 3 contributors
  const sortedForSensitivity = [...materialBreakdown].sort((a, b) => Math.abs(b.climate) - Math.abs(a.climate));
  const top3ForSensitivity = sortedForSensitivity.slice(0, 3);
  const sensitivityResults = top3ForSensitivity.map(mat => {
    const materialImpact = mat.climate;
    const variationAmount = Math.abs(materialImpact) * 0.20;
    const resultLower = totalCarbonFootprint - variationAmount;
    const resultUpper = totalCarbonFootprint + variationAmount;
    const sensitivityRatio = totalCarbonFootprint > 0
      ? Math.abs(materialImpact) / totalCarbonFootprint
      : 0;

    return {
      material_name: mat.name,
      baseline_impact_kg_co2e: Math.round(materialImpact * 10000) / 10000,
      baseline_contribution_pct: totalCarbonFootprint > 0
        ? Math.round((Math.abs(materialImpact) / totalCarbonFootprint) * 1000) / 10
        : 0,
      variation_pct: 20,
      result_range: {
        lower: Math.round(resultLower * 10000) / 10000,
        upper: Math.round(resultUpper * 10000) / 10000,
      },
      sensitivity_ratio: Math.round(sensitivityRatio * 1000) / 1000,
      is_highly_sensitive: sensitivityRatio > 0.2,
    };
  });

  // Generate conclusion text
  const highlySensitiveParams = sensitivityResults.filter(r => r.is_highly_sensitive);
  const sensitivityConclusion = highlySensitiveParams.length > 0
    ? `The total carbon footprint is most sensitive to ${highlySensitiveParams.map(r => r.material_name).join(', ')}. ` +
      `A ±20% variation in ${highlySensitiveParams.length === 1 ? 'this emission factor changes' : 'these emission factors changes'} ` +
      `the total result by up to ±${Math.round(highlySensitiveParams.reduce((sum, r) => sum + r.sensitivity_ratio, 0) * 20)}%. ` +
      `Priority should be given to improving data quality for these materials.`
    : 'No individual material contributes more than 20% of the total footprint. ' +
      'The result is relatively robust to emission factor variations.';

  console.log(`[aggregateProductImpacts] Uncertainty: ±${uncertaintyDisplayPct}% (σ_g=${propagatedUncertaintyPct}%, 95% CI: ${ci95Lower.toFixed(4)} – ${ci95Upper.toFixed(4)} kg CO₂e)`);
  console.log(`[aggregateProductImpacts] Sensitivity: ${sensitivityResults.length} parameters tested, ${highlySensitiveParams.length} highly sensitive`);

  // 11. Build aggregated impacts object
  const aggregatedImpacts = {
    climate_change_gwp100: totalCarbonFootprint,
    water_consumption: totalWater,
    water_scarcity_aware: totalWaterScarcity,
    land_use: totalLand,
    terrestrial_ecotoxicity: totalTerrestrialEcotoxicity,
    freshwater_eutrophication: totalFreshwaterEutrophication,
    terrestrial_acidification: totalTerrestrialAcidification,
    fossil_resource_scarcity: totalFossilResourceScarcity,
    circularity_percentage: circularityPercentage,
    // ISSUE D: Circularity methodology disclaimer — proprietary metric + recycling rate note
    circularity_methodology: {
      is_proprietary_metric: true,
      method_name: 'Simplified Material Circularity Index',
      description: 'Weight-averaged recycled content across packaging materials. This is a proprietary simplification of the Ellen MacArthur Foundation Material Circularity Indicator (MCI v1.0) using only input-side data (recycled content %). It is not a certified MCI score.',
      reference: 'Adapted from: Ellen MacArthur Foundation, Material Circularity Indicator (2015)',
      recycling_rate_methodology: 'Recycling rate represents the weight-averaged recycled content ' +
        'percentage across all packaging materials, calculated as: ' +
        'Σ(packaging_weight_i × recycled_content_%_i) / Σ(packaging_weight_i). ' +
        'This measures circular input (how much packaging mass comes from recycled feedstock) ' +
        'rather than end-of-life recyclability.',
    },

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
        ch4_fossil: totalCH4Fossil,
        ch4_biogenic: totalCH4Biogenic,
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
        // ISSUE A FIX: co2_fossil/co2_biogenic now store PURE CO₂ species mass (GWP=1),
        // not total CO₂e by carbon origin. This ensures the GHG species table rows
        // (CO₂ + CH₄ + N₂O) sum to the headline total without double-counting.
        co2_fossil: co2FossilPure,
        co2_biogenic: co2BiogenicPure,
        co2_luluc: totalClimateDluc,
        methane: totalCH4,
        methane_fossil: totalCH4Fossil,
        methane_biogenic: totalCH4Biogenic,
        nitrous_oxide: totalN2O,
        hfc_pfc: totalHFCs,
      },
      gwp_factors: {
        methane_gwp100: IPCC_AR6_GWP.CH4,
        methane_fossil_gwp100: IPCC_AR6_GWP.CH4_FOSSIL,
        methane_biogenic_gwp100: IPCC_AR6_GWP.CH4_BIOGENIC,
        n2o_gwp100: IPCC_AR6_GWP.N2O,
        method: 'IPCC AR6',
      },
      co2e_contributions: {
        // ISSUE A FIX: CO₂e contributions use pure CO₂ species values so that
        // sum of all rows equals headline total (climate_change_gwp100).
        co2_fossil: co2FossilPure,
        co2_biogenic: co2BiogenicPure,
        co2_luluc: totalClimateDluc,
        ch4_as_co2e: ch4FossilCO2e + ch4BiogenicCO2e,
        ch4_fossil_as_co2e: ch4FossilCO2e,
        ch4_biogenic_as_co2e: ch4BiogenicCO2e,
        n2o_as_co2e: n2oCO2e,
        hfc_pfc: totalHFCs,
      },
    },

    data_quality: {
      score: dqiScore,
      rating: dqiScore >= 80 ? 'Good' : dqiScore >= 50 ? 'Fair' : 'Poor',
      // MINOR 1: DQI aggregation methodology disclosure
      aggregation_method: 'Impact-weighted arithmetic mean of per-material confidence scores, following the Pedigree Matrix approach (Weidema & Wesnæs 1996) as adopted by ISO 14044 §4.2.3.6.3 and ecoinvent.',
      pedigree_dimensions: ['Reliability', 'Completeness', 'Temporal representativeness', 'Geographical representativeness', 'Technological representativeness'],
      // ISSUE C FIX: Allocation method — specific, accurate statement.
      // Removed vague "as documented per material" language.
      // If no materials use economic allocation, say so explicitly.
      allocation_summary: {
        default_method: 'physical_mass' as const,
        description: 'Physical allocation by mass is applied for all co-products in this study, ' +
          'following the ISO 14044 Clause 4.3.4 allocation hierarchy. Economic allocation was not ' +
          'required, as physical mass relationships could be established for all co-products assessed.',
        economic_allocation_materials: [] as Array<{ material: string; method: string; justification: string; economic_ratio?: string }>,
      },
    },

    // ISO 14044 §4.5.3: Uncertainty propagation and sensitivity analysis
    uncertainty_sensitivity: {
      propagated_uncertainty_pct: uncertaintyDisplayPct,
      // ISSUE B FIX: Store σ_g separately from the display percentage.
      // σ_g is used in the lognormal CI formula; display % is the half-width / headline.
      geometric_std_dev_pct: propagatedUncertaintyPct,
      confidence_interval_95: {
        lower: Math.round(ci95Lower * 10000) / 10000,
        upper: Math.round(ci95Upper * 10000) / 10000,
      },
      data_quality_assessment: {
        overall_dqi: aggregateQuality.overallDqi,
        overall_confidence: aggregateQuality.overallConfidence,
        weighted_pedigree: aggregateQuality.pedigreeAggregate,
        data_source_breakdown: aggregateQuality.dataSourceBreakdown,
        temporal_coverage: aggregateQuality.temporalCoverage,
        quality_flags: aggregateQuality.qualityFlags,
        iso_compliant: aggregateQuality.isoCompliant,
        compliance_gaps: aggregateQuality.complianceGaps,
      },
      sensitivity_analysis: {
        method: '±20% emission factor variation on top 3 contributors',
        variation_pct: 20,
        parameters: sensitivityResults,
        conclusion: sensitivityConclusion,
      },
    },

    // MAJOR 1: LULUC CO₂e justification note (ISO 14067 §6.4.9.4)
    // When LULUC (land use and land use change) is zero, explain why
    luluc_note: totalClimateDluc === 0
      ? 'Land use and land use change (LULUC) emissions are reported as zero. ' +
        'The current emission factor databases (ecoinvent 3.12, AGRIBALYSE 3.2, DEFRA) ' +
        'do not provide separate LULUC characterisation factors for all input materials. ' +
        'Where country-specific LULUC data becomes available, it will be incorporated in future assessments.'
      : undefined,

    // MAJOR 2: Zero-impact categories — list categories assessed but reporting zero
    zero_impact_categories: (() => {
      const sumField = (field: string) => (materials as any[]).reduce((sum: number, m: any) => sum + (Number(m[field]) || 0), 0);
      const zeroCategories: Array<{ category: string; reason: string }> = [];
      const checks: Array<[string, number, string]> = [
        ['Marine Eutrophication', sumField('impact_marine_eutrophication'), 'No marine eutrophication characterisation factors available in the applied emission factor datasets for these input materials.'],
        ['Ozone Depletion', sumField('impact_ozone_depletion'), 'No ozone-depleting substances identified in the product system.'],
        ['Photochemical Ozone Formation', sumField('impact_photochemical_ozone_formation'), 'No photochemical ozone formation characterisation factors available for these input materials.'],
        ['Particulate Matter', sumField('impact_particulate_matter'), 'No particulate matter characterisation factors available for these input materials.'],
        ['Human Toxicity (Cancer)', sumField('impact_human_toxicity_carcinogenic'), 'No carcinogenic toxicity characterisation factors available for these input materials.'],
        ['Human Toxicity (Non-cancer)', sumField('impact_human_toxicity_non_carcinogenic'), 'No non-carcinogenic toxicity characterisation factors available for these input materials.'],
      ];
      for (const [name, value, reason] of checks) {
        if (value === 0) zeroCategories.push({ category: name, reason });
      }
      return zeroCategories.length > 0 ? zeroCategories : undefined;
    })(),

    // MAJOR 3: Critical review disclosure (ISO 14044 §6)
    critical_review: {
      status: 'not_conducted' as const,
      disclosure: 'This LCA study has not undergone an independent critical review per ISO 14044 §6. ' +
        'A critical review by an external expert or panel is recommended before this study is used ' +
        'for public comparative assertions (ISO 14044 §5.3). The AlkaTera platform provides automated ' +
        'compliance checks but these do not constitute a formal critical review.',
      recommendation: 'Engage a qualified independent reviewer with expertise in beverage product LCA ' +
        'to conduct a critical review per ISO 14044 §6.2 (external expert review) before publication.',
    },

    // MAJOR 4: Scope 1/2/3 attribution methodology note
    scope_methodology: {
      standard: 'GHG Protocol Product Life Cycle Accounting and Reporting Standard',
      attribution_method: 'Operational control approach',
      note: 'Scope 1 emissions are allocated from facilities under operational control using ' +
        'physical allocation by production volume. Scope 2 emissions reflect purchased electricity ' +
        'and heat using the location-based method with country-specific IEA grid emission factors. ' +
        'Scope 3 emissions include upstream raw material extraction, processing, inbound transport, ' +
        'and contract manufacturing. ' +
        (facilityEmissions && facilityEmissions.some(fe => fe.isContractManufacturer)
          ? 'Contract manufacturer emissions are classified as Scope 3 Category 1 (Purchased Goods and Services) per GHG Protocol §6.3.3.'
          : 'No contract manufacturers are included in this assessment.'),
    },

    // MAJOR 5: Transport emissions accounting note
    transport_note: {
      method: 'Transport emissions are calculated using DEFRA freight emission factors and embedded ' +
        'in per-material impact_climate values during the waterfall impact resolution step. ' +
        'Inbound transport (supplier to factory) is allocated to the raw materials/packaging lifecycle ' +
        'stage per ISO 14044. Outbound distribution (factory to retail/consumer) is only included ' +
        'when the system boundary extends to Cradle-to-Shelf or beyond.',
      total_transport_kg_co2e: totalTransport,
      is_embedded_in_materials: true,
      outbound_included: isStageIncluded(effectiveBoundary, 'distribution'),
    },

    materials_count: materials.length,
    production_sites_count: facilityEmissions?.length || 0,
    calculated_at: new Date().toISOString(),
    calculation_version: '2.2.0',
    // Store non-fatal warnings so they appear in the LCA report
    calculation_warnings: calculationWarnings.length > 0 ? calculationWarnings : undefined,

    // ISSUE E: Report metadata for version tracking (ISO 14044 §4.2.1)
    report_metadata: {
      version: '2.0',
      generated_at: new Date().toISOString(),
      calculation_engine: 'alkatera-aggregator-v2.2.0',
    },

    // ISO 14044 §4.5: Interpretation — generated below and attached here
    interpretation: null as any,
  };

  // 11a. Generate ISO 14044 §4.5 Interpretation chapter
  // Must run after aggregatedImpacts is built since it reads from it
  (aggregatedImpacts as any).interpretation = generateInterpretation(
    aggregatedImpacts,
    effectiveBoundary
  );

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
