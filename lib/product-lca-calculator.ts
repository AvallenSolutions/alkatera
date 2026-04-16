import { getSupabaseBrowserClient } from './supabase/browser-client';
import { resolveImpactFactors, normalizeToKg, type ProductMaterial, type WaterfallResult, type FallbackEvent } from './impact-waterfall-resolver';
import { calculateTransportEmissions, type TransportMode } from './utils/transport-emissions-calculator';
import { calculateDistributionEmissions } from './distribution-factors';
import { resolveImpactSource } from './utils/data-quality-mapper';
import { aggregateProductImpacts, type FacilityEmissionsData } from './product-lca-aggregator';
import { generateLcaInterpretation } from './lca-interpretation-engine';
import { calculateDistance } from './utils/distance-calculator';
import { boundaryToDbEnum } from './system-boundaries';
import { calculateMaturationImpacts } from './maturation-calculator';
import type { MaturationProfile } from './types/maturation';
import { calculateViticultureImpacts } from './viticulture-calculator';
import { calculateMultiVintageAverage } from './viticulture-multi-vintage';
import type { VineyardGrowingProfile, Vineyard } from './types/viticulture';
import { calculateOrchardImpacts } from './orchard-calculator';
import { calculateMultiHarvestAverage } from './orchard-multi-harvest';
import type { Orchard } from './types/orchard';
import { getGridFactor } from './grid-emission-factors';
import { getAwareFactor } from './calculations/water-risk';

export interface FacilityAllocationInput {
  facilityId: string;
  facilityName: string;
  operationalControl: 'owned' | 'third_party';
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  productionVolume: number;
  productionVolumeUnit: string;
  facilityTotalProduction: number;
}

export interface CalculatePCFParams {
  productId: string;
  functionalUnit?: string;
  systemBoundary?: 'cradle-to-gate' | 'cradle-to-shelf' | 'cradle-to-consumer' | 'cradle-to-grave';
  referenceYear?: number;
  facilityAllocations?: FacilityAllocationInput[];
  onProgress?: (step: string, percent: number) => void;
  usePhaseConfig?: import('./use-phase-factors').UsePhaseConfig;
  eolConfig?: import('./end-of-life-factors').EoLConfig;
  distributionConfig?: import('./distribution-factors').DistributionConfig;
  productLossConfig?: import('./system-boundaries').ProductLossConfig;
  /** When set, re-use the exact emission factor values from this PCF instead of
   *  re-resolving through the waterfall. Enables deterministic re-calculation. */
  pinnedPcfId?: string;
}

/** @deprecated Use CalculatePCFParams instead */
export type CalculateLCAParams = CalculatePCFParams;

export interface CalculatePCFResult {
  success: boolean;
  pcfId?: string;
  /** @deprecated Use pcfId instead */
  lcaId?: string;
  error?: string;
}

/** @deprecated Use CalculatePCFResult instead */
export type CalculateLCAResult = CalculatePCFResult;

// ============================================================================
// CALCULATION DETERMINISM HELPERS
// ============================================================================

/**
 * Generate a SHA-256 fingerprint of all inputs that affect the calculation result.
 * Two calculations with identical fingerprints must produce identical outputs.
 * Uses the Web Crypto API (available in both browser and Next.js).
 */
async function generateCalculationFingerprint(params: {
  materials: Array<{ name: string; quantity_kg: number; data_source_id?: string | null }>;
  factorValues: Array<{ name: string; impact_climate_per_kg: number; gwp_data_source?: string }>;
  facilityAllocations?: FacilityAllocationInput[];
  systemBoundary: string;
  referenceYear: number;
}): Promise<string> {
  // Build a canonical JSON with sorted keys for reproducibility
  const canonical = JSON.stringify({
    boundary: params.systemBoundary,
    facilities: (params.facilityAllocations || []).map(f => ({
      id: f.facilityId,
      production: f.productionVolume,
      total: f.facilityTotalProduction,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    factors: params.factorValues
      .map(f => ({ n: f.name, v: Number(f.impact_climate_per_kg.toFixed(8)), s: f.gwp_data_source }))
      .sort((a, b) => a.n.localeCompare(b.n)),
    materials: params.materials
      .map(m => ({ n: m.name, q: Number(m.quantity_kg.toFixed(6)), d: m.data_source_id || '' }))
      .sort((a, b) => a.n.localeCompare(b.n)),
    year: params.referenceYear,
  });
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Reconstruct a WaterfallResult from a previously stored product_carbon_footprint_materials row.
 * Used in pinned-mode to skip the waterfall resolver and use the exact same factor values.
 */
function buildResultFromPinnedMaterial(pinned: any, newQuantityKg: number): WaterfallResult {
  // The pinned material stores total impacts for its original quantity.
  // Scale to the new quantity: scale = newQty / oldQty
  const oldQuantity = Number(pinned.quantity) || 1;
  const scale = newQuantityKg / oldQuantity;

  return {
    impact_climate: (pinned.impact_climate || 0) * scale,
    impact_climate_fossil: (pinned.impact_climate_fossil || 0) * scale,
    impact_climate_biogenic: (pinned.impact_climate_biogenic || 0) * scale,
    impact_climate_dluc: (pinned.impact_climate_dluc || 0) * scale,
    impact_water: (pinned.impact_water || 0) * scale,
    impact_water_scarcity: (pinned.impact_water_scarcity || 0) * scale,
    impact_land: (pinned.impact_land || 0) * scale,
    impact_waste: (pinned.impact_waste || 0) * scale,
    impact_ozone_depletion: (pinned.impact_ozone_depletion || 0) * scale,
    impact_photochemical_ozone_formation: (pinned.impact_photochemical_ozone_formation || 0) * scale,
    impact_ionising_radiation: (pinned.impact_ionising_radiation || 0) * scale,
    impact_particulate_matter: (pinned.impact_particulate_matter || 0) * scale,
    impact_human_toxicity_carcinogenic: (pinned.impact_human_toxicity_carcinogenic || 0) * scale,
    impact_human_toxicity_non_carcinogenic: (pinned.impact_human_toxicity_non_carcinogenic || 0) * scale,
    impact_terrestrial_ecotoxicity: (pinned.impact_terrestrial_ecotoxicity || 0) * scale,
    impact_freshwater_ecotoxicity: (pinned.impact_freshwater_ecotoxicity || 0) * scale,
    impact_marine_ecotoxicity: (pinned.impact_marine_ecotoxicity || 0) * scale,
    impact_freshwater_eutrophication: (pinned.impact_freshwater_eutrophication || 0) * scale,
    impact_marine_eutrophication: (pinned.impact_marine_eutrophication || 0) * scale,
    impact_terrestrial_acidification: (pinned.impact_terrestrial_acidification || 0) * scale,
    impact_mineral_resource_scarcity: (pinned.impact_mineral_resource_scarcity || 0) * scale,
    impact_fossil_resource_scarcity: (pinned.impact_fossil_resource_scarcity || 0) * scale,
    ch4_kg: (pinned.ch4_kg || 0) * scale,
    ch4_fossil_kg: (pinned.ch4_fossil_kg || 0) * scale,
    ch4_biogenic_kg: (pinned.ch4_biogenic_kg || 0) * scale,
    n2o_kg: (pinned.n2o_kg || 0) * scale,
    data_priority: pinned.data_priority || 3,
    data_quality_tag: pinned.data_quality_tag || 'Secondary_Estimated',
    data_quality_grade: pinned.data_quality_grade || 'LOW',
    source_reference: `Pinned from previous calculation: ${pinned.source_reference || 'unknown'}`,
    confidence_score: pinned.confidence_score || 50,
    methodology: `${pinned.methodology || 'Unknown'} (pinned)`,
    gwp_data_source: `Pinned: ${pinned.gwp_data_source || 'unknown'}`,
    non_gwp_data_source: `Pinned: ${pinned.non_gwp_data_source || 'unknown'}`,
    gwp_reference_id: pinned.gwp_reference_id,
    non_gwp_reference_id: pinned.non_gwp_reference_id,
    is_hybrid_source: pinned.is_hybrid_source || false,
    resolved_factor_id: pinned.resolved_factor_id,
    category_type: pinned.category_type || 'MANUFACTURING_MATERIAL',
  };
}

/**
 * Build a valid ISO 14044 / ISO 14067 functional unit string.
 *
 * MEDIUM FIX #21: The functional unit must be unambiguous (ISO 14044 §4.2.3.2).
 * It defines BOTH the quantitative reference (e.g. "1") AND the reference flow
 * (e.g. "750 mL bottle of Whisky Brand").
 *
 * Rules:
 *   1. If the caller explicitly passes a functional unit string, use it as-is
 *      (caller has provided the most specific description).
 *   2. Otherwise, build it from product.unit_size_value + unit_size_unit + product.name:
 *      e.g. "1 x 700 mL bottle of Knockando 12-Year Single Malt Whisky"
 *   3. Fall back to "1 unit of <name>" if size data is absent.
 *
 * The resulting string must match the quantity used in impact_climate fields
 * (i.e. impacts must be per-bottle, not per-litre, when the FU is "1 x 750 mL bottle").
 * This is verified separately in the aggregation step.
 */
function buildFunctionalUnit(
  explicitFU: string | undefined,
  product: { name: string; unit?: string | null; unit_size_value?: number | string | null; unit_size_unit?: string | null }
): string {
  if (explicitFU && explicitFU.trim().length > 0) {
    return explicitFU.trim();
  }

  const sizeValue = product.unit_size_value ? Number(product.unit_size_value) : null;
  const sizeUnit = product.unit_size_unit || null;

  if (sizeValue && sizeValue > 0 && sizeUnit) {
    // Format: "1 x 700 mL bottle of Product Name"
    // Omit "unit" if unit_size_unit is already descriptive (ml, L, g, kg, cl)
    const sizeLabel = sizeUnit.toLowerCase() === 'l'
      ? `${sizeValue} L`
      : sizeUnit.toLowerCase() === 'ml'
      ? `${sizeValue} mL`
      : sizeUnit.toLowerCase() === 'cl'
      ? `${sizeValue} cL`
      : sizeUnit.toLowerCase() === 'kg'
      ? `${sizeValue} kg`
      : sizeUnit.toLowerCase() === 'g'
      ? `${sizeValue} g`
      : `${sizeValue} ${sizeUnit}`;

    return `1 × ${sizeLabel} ${product.unit && !['ml', 'l', 'cl', 'kg', 'g'].includes(product.unit.toLowerCase()) ? product.unit + ' ' : ''}of ${product.name}`;
  }

  // Final fallback — honest about what we don't know
  const unitLabel = product.unit || 'unit';
  return `1 ${unitLabel} of ${product.name}`;
}

/**
 * Calculate Product Carbon Footprint for a product
 * Uses GHG Protocol Product Standard and ISO 14067 methodology
 */
export async function calculateProductCarbonFootprint(params: CalculatePCFParams): Promise<CalculatePCFResult> {
  const supabase = getSupabaseBrowserClient();
  const { productId, functionalUnit, systemBoundary, referenceYear, onProgress } = params;

  try {
    console.log(`[calculateProductCarbonFootprint] Starting calculation for product: ${productId}`);
    onProgress?.('Loading product data...', 5);

    // 1. Get user and organization
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    // 2. Fetch product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    if (productError || !product) {
      throw new Error(`Product not found: ${productError?.message || 'Unknown error'}`);
    }

    console.log(`[calculateProductCarbonFootprint] Product: ${product.name}`);

    // 3. Fetch all product materials (ingredients + packaging)
    const { data: materials, error: materialsError } = await supabase
      .from('product_materials')
      .select('*')
      .eq('product_id', productId);

    if (materialsError) {
      throw new Error(`Failed to fetch materials: ${materialsError.message}`);
    }

    if (!materials || materials.length === 0) {
      throw new Error('No materials found for this product. Please add ingredients and packaging first.');
    }

    console.log(`[calculateProductCarbonFootprint] Found ${materials.length} materials to process`);
    onProgress?.(`Resolving impact factors for ${materials.length} materials...`, 20);

    // 3b. Recalculate distances based on current production facilities
    // Distances are stored at ingredient creation time and become stale when facilities change
    if (params.facilityAllocations && params.facilityAllocations.length > 0) {
      // Get coordinates for the primary (highest production share) facility
      const primaryAllocation = params.facilityAllocations[0]; // First facility is primary
      const { data: primaryFacility } = await supabase
        .from('facilities')
        .select('address_lat, address_lng, name')
        .eq('id', primaryAllocation.facilityId)
        .single();

      if (primaryFacility?.address_lat && primaryFacility?.address_lng) {
        const facilityLat = Number(primaryFacility.address_lat);
        const facilityLng = Number(primaryFacility.address_lng);
        console.log(`[calculateProductCarbonFootprint] Recalculating distances to primary facility: ${primaryFacility.name} (${facilityLat}, ${facilityLng})`);

        let updatedCount = 0;
        for (const material of materials) {
          if (material.origin_lat && material.origin_lng) {
            const newDistance = calculateDistance(
              Number(material.origin_lat),
              Number(material.origin_lng),
              facilityLat,
              facilityLng
            );

            if (newDistance !== Number(material.distance_km || 0)) {
              console.log(`[calculateProductCarbonFootprint] Distance update for ${material.material_name}: ${material.distance_km || 0} km → ${newDistance} km`);
              material.distance_km = newDistance;
              updatedCount++;

              // Persist the corrected distance back to product_materials
              await supabase
                .from('product_materials')
                .update({ distance_km: newDistance })
                .eq('id', material.id);
            }
          }
        }

        if (updatedCount > 0) {
          console.log(`[calculateProductCarbonFootprint] Updated distances for ${updatedCount} materials`);
        }
      }
    }

    // 4. Create product_lca record
    const { data: lca, error: lcaError } = await supabase
      .from('product_carbon_footprints')
      .insert({
        organization_id: product.organization_id,
        product_id: parseInt(productId),
        product_name: product.name,
        product_description: product.product_description,
        product_image_url: product.product_image_url,
        functional_unit: buildFunctionalUnit(functionalUnit, product),
        system_boundary: systemBoundary || 'cradle-to-gate',
        reference_year: referenceYear || new Date().getFullYear(),
        lca_version: '1.0',
        lca_scope_type: systemBoundary || 'cradle-to-gate',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (lcaError || !lca) {
      throw new Error(`Failed to create LCA: ${lcaError?.message || 'Unknown error'}`);
    }

    // Sync system_boundary to products table so list/detail pages show the correct value
    if (systemBoundary) {
      await supabase
        .from('products')
        .update({ system_boundary: boundaryToDbEnum(systemBoundary) })
        .eq('id', productId);
    }

    // Increment LCA count for subscription tracking
    try {
      await supabase.rpc('increment_lca_count', {
        p_organization_id: product.organization_id,
      });
    } catch (err) {
      // Non-critical — live COUNT(*) in get_organization_usage is the source of truth
      console.warn('[calculateProductCarbonFootprint] Failed to increment LCA count:', err);
    }

    console.log(`[calculateProductCarbonFootprint] Created LCA record: ${lca.id}`);
    onProgress?.('Processing facility allocations...', 50);

    // 4a. Handle facility allocations
    const { facilityAllocations } = params;

    const collectedFacilityEmissions: FacilityEmissionsData[] = [];

    if (facilityAllocations && facilityAllocations.length > 0) {
      // New flow: Use facility allocations provided by user
      console.log(`[calculateProductCarbonFootprint] Processing ${facilityAllocations.length} facility allocations...`);

      for (const allocation of facilityAllocations) {
        // Calculate facility emissions from utility_data_entries
        // This is the same data source used by the Company Emissions page (scope-1-2)
        let facilityTotalEmissions = 0;
        let scope1Raw = 0;
        let scope2Raw = 0;
        let totalWaterFromUtility = 0;

        // Fetch facility country code so we can apply the correct grid factor.
        // Defaults to global average if country not set (conservative/honest).
        const { data: facilityRecord } = await supabase
          .from('facilities')
          .select('location_country_code')
          .eq('id', allocation.facilityId)
          .single();

        const facilityCountryCode = facilityRecord?.location_country_code || null;
        const gridFactorResult = getGridFactor(facilityCountryCode, 'global');
        console.log(
          `[calculateProductCarbonFootprint] Grid factor for ${allocation.facilityName}` +
          ` (${facilityCountryCode ?? 'unknown'}): ${gridFactorResult.factor} kg CO2e/kWh` +
          ` — ${gridFactorResult.source}${gridFactorResult.isEstimated ? ' [ESTIMATED]' : ''}`
        );
        if (gridFactorResult.dataGapWarning) {
          console.warn(`[calculateProductCarbonFootprint] ⚠️ DATA GAP — ${allocation.facilityName}: ${gridFactorResult.dataGapWarning}`);
        }

        // ─── Check for direct production run resource data (highest quality) ───
        // Direct run data is product-specific — no attribution ratio needed for
        // electricity and water. This bypasses facility-level allocation for
        // those resources while still using utility data for Scope 1 fuels.
        // Priority in the allocation cascade:
        //   1. Direct Run Data (this check) — 95% confidence
        //   2. Facility-Level Allocation (below) — 70% confidence
        const { data: directRunData } = await supabase
          .from('production_run_resource_data')
          .select('electricity_computed_kwh, water_intake_m3, wastewater_discharge_m3, production_volume, production_volume_unit')
          .eq('product_id', parseInt(productId))
          .eq('facility_id', allocation.facilityId)
          .gte('production_date', allocation.reportingPeriodStart)
          .lte('production_date', allocation.reportingPeriodEnd);

        const hasDirectRunData = directRunData && directRunData.length > 0;
        let runElectricityKwh = 0;
        let runWaterM3 = 0;

        if (hasDirectRunData) {
          for (const run of directRunData) {
            runElectricityKwh += Number(run.electricity_computed_kwh || 0);
            runWaterM3 += Number(run.water_intake_m3 || 0);
          }
          console.log(
            `[calculateProductCarbonFootprint] ✨ DIRECT RUN DATA for ${allocation.facilityName}: ` +
            `${directRunData.length} run(s), ${runElectricityKwh.toFixed(1)} kWh electricity, ` +
            `${runWaterM3.toFixed(2)} m³ water — no allocation needed for these resources`
          );
        }

        const { data: utilityEntries, error: utilityError } = await supabase
          .from('utility_data_entries')
          .select('utility_type, quantity, unit, calculated_scope')
          .eq('facility_id', allocation.facilityId)
          .lte('reporting_period_start', allocation.reportingPeriodEnd)
          .gte('reporting_period_end', allocation.reportingPeriodStart);

        if (utilityError) {
          console.warn(`[calculateProductCarbonFootprint] Failed to query utility_data_entries for ${allocation.facilityName}:`, utilityError);
        }

        // Hoisted here so it is in scope for both the utility loop and the
        // activity-entries section below where the deduplication logic runs.
        let waterFromUtilityTable = 0;

        // Collect per-energy-type breakdown for report transparency
        const energyBreakdown: Array<{ type: string; quantity: number; unit: string; emissions: number; scope: 'Scope 1' | 'Scope 2' }> = [];

        if (utilityEntries && utilityEntries.length > 0) {
          console.log(`[calculateProductCarbonFootprint] Found ${utilityEntries.length} utility entries for ${allocation.facilityName}`);

          // Emission factors — DEFRA 2025 for combustion fuels (UK-authoritative and
          // widely used internationally for Scope 1 fuels).
          // Electricity (Scope 2) uses a country-specific grid factor resolved above
          // from IEA/DEFRA 2023 data, not a hardcoded UK-only value.
          // Sources:
          //   Scope 1 fuels: DEFRA 2025 GHG Conversion Factors
          //   https://www.gov.uk/government/collections/government-conversion-factors-for-greenhouse-gas-reporting
          //   Scope 2 electricity: lib/grid-emission-factors.ts (IEA 2023 / DEFRA 2025)
          //   Refrigerant HFC-134a GWP-100: IPCC AR6 (GWP = 1430)
          const EMISSION_FACTORS: Record<string, { factor: number; scope: 'Scope 1' | 'Scope 2' }> = {
            diesel_stationary: { factor: 2.68787, scope: 'Scope 1' },   // DEFRA 2025 kg CO2e/litre
            diesel_mobile: { factor: 2.68787, scope: 'Scope 1' },       // DEFRA 2025 kg CO2e/litre
            petrol_mobile: { factor: 2.31, scope: 'Scope 1' },          // DEFRA 2025 kg CO2e/litre
            natural_gas: { factor: 0.18293, scope: 'Scope 1' },         // DEFRA 2025 kg CO2e/kWh
            lpg: { factor: 1.55537, scope: 'Scope 1' },                 // DEFRA 2025 kg CO2e/litre
            heavy_fuel_oil: { factor: 3.17740, scope: 'Scope 1' },      // DEFRA 2025 kg CO2e/litre
            biomass_solid: { factor: 0.01551, scope: 'Scope 1' },       // DEFRA 2025 kg CO2e/kWh
            refrigerant_leakage: { factor: 1430, scope: 'Scope 1' },    // IPCC AR6 GWP-100 HFC-134a
            // Country-specific electricity factor resolved from lib/grid-emission-factors.ts
            electricity_grid: { factor: gridFactorResult.factor, scope: 'Scope 2' },
            heat_steam_purchased: { factor: 0.1662, scope: 'Scope 2' }, // DEFRA 2025 kg CO2e/kWh
          };

          for (const entry of utilityEntries) {
            // When direct run data exists, skip electricity_grid entries from utility —
            // we have product-specific electricity measurements that are more accurate.
            // Also skip water entries — run data provides product-specific water.
            if (hasDirectRunData) {
              if (entry.utility_type === 'electricity_grid') {
                console.log(`[calculateProductCarbonFootprint] ⏭ Skipping utility electricity_grid for ${allocation.facilityName} — using direct run data instead`);
                continue;
              }
              if (entry.utility_type === 'water' || entry.utility_type === 'water_supply') {
                continue; // Water comes from run data
              }
            }

            const config = EMISSION_FACTORS[entry.utility_type];
            if (!config) {
              // Water entries in utility_data_entries (utility_type: water / water_supply)
              // are accumulated separately — NOT added to totalWaterFromUtility yet.
              // We defer the merge until after checking facility_activity_entries so we can
              // pick the best source and avoid double-counting.
              if (entry.utility_type === 'water' || entry.utility_type === 'water_supply') {
                let qty = Number(entry.quantity || 0);
                if (entry.unit === 'litres' || entry.unit === 'L') qty /= 1000; // normalise to m³
                waterFromUtilityTable += qty;
              }
              continue;
            }

            let co2e = Number(entry.quantity) * config.factor;

            // Handle natural gas m³ → kWh conversion (10.55 kWh/m³)
            if (entry.utility_type === 'natural_gas' && entry.unit === 'm³') {
              co2e = Number(entry.quantity) * 10.55 * config.factor;
            }

            if (config.scope === 'Scope 1') {
              scope1Raw += co2e;
            } else {
              scope2Raw += co2e;
            }
            facilityTotalEmissions += co2e;

            // Collect energy type breakdown for report
            energyBreakdown.push({
              type: entry.utility_type,
              quantity: Number(entry.quantity),
              unit: entry.unit || (entry.utility_type === 'natural_gas' ? 'kWh' : 'units'),
              emissions: co2e,
              scope: config.scope,
            });
          }

          console.log(`[calculateProductCarbonFootprint] Utility-based emissions for ${allocation.facilityName}:`, {
            totalEmissions: facilityTotalEmissions,
            scope1: scope1Raw,
            scope2: scope2Raw,
            waterLitres: totalWaterFromUtility,
            entryCount: utilityEntries.length,
          });
        } else {
          console.warn(`[calculateProductCarbonFootprint] No utility data entries found for ${allocation.facilityName}`);
        }

        // Query water data from facility_activity_entries (separate table from utilities).
        // Skip this query when direct run data exists — run data provides product-specific water.
        // IMPORTANT: This table and utility_data_entries can both contain water data for the
        // same facility/period. We must NOT add both to the same total — that would double-count.
        // Priority: Direct run data > facility_activity_entries > utility_data_entries.
        let waterEntries: { activity_category: string; quantity: number; unit: string }[] | null = null;
        if (!hasDirectRunData) {
          const { data: waterData, error: waterError } = await supabase
            .from('facility_activity_entries')
            .select('activity_category, quantity, unit')
            .eq('facility_id', allocation.facilityId)
            .in('activity_category', ['water_intake', 'water_recycled'])
            .lte('reporting_period_start', allocation.reportingPeriodEnd)
            .gte('reporting_period_end', allocation.reportingPeriodStart);

          if (waterError) {
            console.warn(`[calculateProductCarbonFootprint] Failed to query water data for ${allocation.facilityName}:`, waterError);
          }
          waterEntries = waterData;
        }

        // ─── Determine final emissions and water values ───
        // Two paths:
        //   A) Direct run data exists → electricity & water are product-specific (no attribution).
        //      Scope 1 fuels from utility data still need facility-level attribution.
        //   B) No run data → everything uses facility-level attribution (existing approach).

        let scope1Emissions = 0;
        let scope2Emissions = 0;
        let allocatedEmissions = 0;
        let allocatedWater = 0;
        let allocatedWaste = 0;
        let attributionRatio = 0;
        let hasVerifiedFacilityData = false;

        if (hasDirectRunData) {
          // ─── Path A: Direct run data (highest quality) ───
          // Scope 2 from direct run electricity — product-specific, no attribution needed
          const runScope2 = runElectricityKwh * gridFactorResult.factor;

          // Add direct run electricity to energy breakdown
          if (runElectricityKwh > 0) {
            energyBreakdown.push({
              type: 'electricity_grid',
              quantity: runElectricityKwh,
              unit: 'kWh',
              emissions: runScope2,
              scope: 'Scope 2',
            });
          }

          // Scope 1 from utility data (fuels, gas, etc.) — still needs attribution
          // because fuel usage is facility-level, not product-specific
          const rawAttributionRatio = allocation.facilityTotalProduction > 0
            ? allocation.productionVolume / allocation.facilityTotalProduction
            : 0;
          attributionRatio = Math.min(1, Math.max(0, rawAttributionRatio));
          scope1Emissions = scope1Raw * attributionRatio;

          // Scope 2 = ONLY from direct run data (no attribution)
          // Any heat_steam_purchased from utility is still attributed (it's in scope2Raw)
          const attributedOtherScope2 = scope2Raw * attributionRatio;
          scope2Emissions = runScope2 + attributedOtherScope2;

          allocatedEmissions = scope1Emissions + scope2Emissions;

          // Water from direct run data — product-specific, no attribution
          allocatedWater = runWaterM3 * 1000; // m³ → litres
          allocatedWaste = 0;
          hasVerifiedFacilityData = true; // Direct run data is always verified

          console.log(`[calculateProductCarbonFootprint] ✨ Facility ${allocation.facilityName} — DIRECT RUN DATA path:`, {
            runElectricityKwh,
            runScope2_kgCO2e: runScope2,
            scope1FromUtility: scope1Emissions,
            otherScope2Attributed: attributedOtherScope2,
            totalAllocated: allocatedEmissions,
            waterFromRunData_litres: allocatedWater,
            attributionRatioForScope1: attributionRatio,
            gridFactor: gridFactorResult.factor,
          });
        } else {
          // ─── Path B: Facility-level allocation (existing approach) ───
          // Merge water from utility and activity tables
          let waterFromActivityTable = 0;
          if (waterEntries && waterEntries.length > 0) {
            for (const entry of waterEntries) {
              let quantityM3 = Number(entry.quantity || 0);
              if (entry.unit === 'litres' || entry.unit === 'L') {
                quantityM3 = quantityM3 / 1000;
              }
              waterFromActivityTable += quantityM3;
            }
          }

          // Merge water: prefer activity_entries if present (avoids double-counting).
          if (waterFromActivityTable > 0 && waterFromUtilityTable > 0) {
            console.warn(
              `[calculateProductCarbonFootprint] ⚠️ WATER DOUBLE-COUNT RISK for ${allocation.facilityName}: ` +
              `Both utility_data_entries (${waterFromUtilityTable.toFixed(2)} m³) and ` +
              `facility_activity_entries (${waterFromActivityTable.toFixed(2)} m³) contain water data. ` +
              `Using facility_activity_entries only (more specific). ` +
              `Check that users are not entering water in both places.`
            );
            totalWaterFromUtility = waterFromActivityTable;
          } else if (waterFromActivityTable > 0) {
            totalWaterFromUtility = waterFromActivityTable;
            console.log(`[calculateProductCarbonFootprint] Water for ${allocation.facilityName}: ${waterFromActivityTable.toFixed(2)} m³ from facility_activity_entries`);
          } else if (waterFromUtilityTable > 0) {
            totalWaterFromUtility = waterFromUtilityTable;
            console.log(`[calculateProductCarbonFootprint] Water for ${allocation.facilityName}: ${waterFromUtilityTable.toFixed(2)} m³ from utility_data_entries (fallback)`);
          } else {
            console.log(`[calculateProductCarbonFootprint] Water for ${allocation.facilityName}: no water data found in either table`);
          }

          // CRITICAL FIX: Attribution ratio must be in [0, 1].
          const rawAttributionRatio = allocation.facilityTotalProduction > 0
            ? allocation.productionVolume / allocation.facilityTotalProduction
            : 0;
          if (rawAttributionRatio > 1) {
            console.warn(
              `[calculateProductCarbonFootprint] ⚠️ ATTRIBUTION RATIO > 1 for ${allocation.facilityName}: ` +
              `productionVolume=${allocation.productionVolume} > facilityTotalProduction=${allocation.facilityTotalProduction}. ` +
              `This means more product was attributed to this facility than its total output, which is physically impossible. ` +
              `Clamping ratio to 1.0. Please verify that productionVolume and facilityTotalProduction use the same unit.`
            );
          }
          attributionRatio = Math.min(1, Math.max(0, rawAttributionRatio));
          allocatedEmissions = facilityTotalEmissions * attributionRatio;
          scope1Emissions = scope1Raw * attributionRatio;
          scope2Emissions = scope2Raw * attributionRatio;

          hasVerifiedFacilityData = facilityTotalEmissions > 0;

          console.log(`[calculateProductCarbonFootprint] Facility ${allocation.facilityName} emissions data:`, {
            hasUtilityData: facilityTotalEmissions > 0,
            hasVerifiedFacilityData,
            facilityTotalEmissions,
            scope1BeforeAllocation: scope1Raw,
            scope2BeforeAllocation: scope2Raw,
            attributionRatio,
            allocatedScope1: scope1Emissions,
            allocatedScope2: scope2Emissions,
          });

          const totalWater = totalWaterFromUtility;
          const totalWaste = 0;
          allocatedWater = totalWater * attributionRatio;
          allocatedWaste = totalWaste * attributionRatio;
        }

        // Collect for aggregator (passed directly, bypasses broken DB trigger)
        const isContractManufacturer = allocation.operationalControl === 'third_party';
        // Compute total electricity kWh for this facility (attributed)
        const totalElectricityKwh = hasDirectRunData
          ? runElectricityKwh
          : (utilityEntries || [])
              .filter((e: any) => e.utility_type === 'electricity_grid')
              .reduce((sum: number, e: any) => sum + Number(e.quantity || 0), 0) * attributionRatio;

        collectedFacilityEmissions.push({
          facilityId: allocation.facilityId,
          facilityName: allocation.facilityName,
          isContractManufacturer,
          allocatedEmissions,
          scope1Emissions,
          scope2Emissions,
          allocatedWater,
          allocatedWaste,
          attributionRatio,
          productVolume: allocation.productionVolume,
          countryCode: facilityCountryCode || undefined,
          gridEmissionFactor: gridFactorResult.factor,
          electricityKwh: totalElectricityKwh,
          dataSource: hasDirectRunData ? 'direct_run' : 'facility_allocation',
          energyBreakdown: energyBreakdown.length > 0 ? energyBreakdown : undefined,
        });

        // Route to correct table based on facility ownership
        // - Owned facilities → product_carbon_footprint_production_sites (Scope 1 & 2)
        // - Third party (contract manufacturers) → contract_manufacturer_allocations (Scope 3)

        if (isContractManufacturer) {
          // Insert to contract_manufacturer_allocations table
          const cmAllocationRecord = {
            organization_id: product.organization_id,
            product_id: parseInt(productId),
            facility_id: allocation.facilityId,
            reporting_period_start: allocation.reportingPeriodStart,
            reporting_period_end: allocation.reportingPeriodEnd,
            total_facility_production_volume: allocation.facilityTotalProduction,
            production_volume_unit: allocation.productionVolumeUnit || 'units',
            total_facility_co2e_kg: hasDirectRunData ? allocatedEmissions : facilityTotalEmissions,
            co2e_entry_method: hasDirectRunData ? 'direct_run_data' : 'direct',
            client_production_volume: allocation.productionVolume,
            // These are auto-calculated by trigger but we can provide them:
            // attribution_ratio, allocated_emissions_kg_co2e, emission_intensity_kg_co2e_per_unit
            scope1_emissions_kg_co2e: scope1Emissions,
            scope2_emissions_kg_co2e: scope2Emissions,
            scope3_emissions_kg_co2e: 0,
            allocated_water_litres: allocatedWater,
            allocated_waste_kg: allocatedWaste,
            status: hasVerifiedFacilityData ? 'verified' : 'provisional',
            is_energy_intensive_process: false,
            data_source_tag: hasDirectRunData ? 'Direct_Run_Data' : (hasVerifiedFacilityData ? 'Facility_Verified' : 'User_Input'),
          };

          // Delete any existing allocations for this product/facility to avoid
          // "overlapping allocation periods" constraint violation, then insert fresh.
          await supabase
            .from('contract_manufacturer_allocations')
            .delete()
            .eq('product_id', parseInt(productId))
            .eq('facility_id', allocation.facilityId);

          const { error: insertError } = await supabase
            .from('contract_manufacturer_allocations')
            .insert(cmAllocationRecord);

          if (insertError) {
            console.warn(`[calculateProductCarbonFootprint] ⚠️ Failed to insert CM allocation for ${allocation.facilityName}:`, insertError);
          } else {
            console.log(`[calculateProductCarbonFootprint] ✅ Created contract manufacturer allocation for ${allocation.facilityName}: ${allocatedEmissions.toFixed(2)} kg CO2e (Scope 3)`);
          }
        } else {
          // Insert to product_carbon_footprint_production_sites table for owned facilities
          // Safeguard against division by zero for intensity calculations
          const safeProductionVolume = allocation.productionVolume > 0 ? allocation.productionVolume : 1;

          const productionSiteRecord = {
            product_carbon_footprint_id: lca.id,
            organization_id: product.organization_id,
            facility_id: allocation.facilityId,
            production_volume: allocation.productionVolume,
            share_of_production: attributionRatio * 100,
            facility_intensity: facilityTotalEmissions > 0 && allocation.facilityTotalProduction > 0
              ? facilityTotalEmissions / allocation.facilityTotalProduction
              : 0,
            // IMPORTANT: data_source has CHECK constraint: only 'Verified' or 'Industry_Average' allowed
            data_source: hasVerifiedFacilityData ? 'Verified' : 'Industry_Average',
            reporting_period_start: allocation.reportingPeriodStart,
            reporting_period_end: allocation.reportingPeriodEnd,
            attribution_ratio: attributionRatio * 100,
            allocated_emissions_kg_co2e: allocatedEmissions,
            allocated_water_litres: allocatedWater,
            allocated_waste_kg: allocatedWaste,
            emission_intensity_kg_co2e_per_unit: allocatedEmissions / safeProductionVolume,
            water_intensity_litres_per_unit: allocatedWater / safeProductionVolume,
            waste_intensity_kg_per_unit: allocatedWaste / safeProductionVolume,
            scope1_emissions_kg_co2e: scope1Emissions,
            scope2_emissions_kg_co2e: scope2Emissions,
            status: hasVerifiedFacilityData ? 'verified' : 'provisional',
            is_energy_intensive_process: false,
            uses_proxy_data: !hasVerifiedFacilityData,
            data_source_tag: hasDirectRunData ? 'Direct_Run_Data' : (hasVerifiedFacilityData ? 'Facility_Verified' : 'User_Input'),
            co2e_entry_method: hasDirectRunData ? 'Direct Run Data' : 'Production Volume Allocation',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          console.log(`[calculateProductCarbonFootprint] Attempting to insert owned production site:`, {
            facilityId: allocation.facilityId,
            facilityName: allocation.facilityName,
            operationalControl: allocation.operationalControl,
            productionVolume: allocation.productionVolume,
            allocatedEmissions,
            scope1Emissions,
            scope2Emissions,
          });

          const { error: insertError } = await supabase
            .from('product_carbon_footprint_production_sites')
            .insert(productionSiteRecord);

          if (insertError) {
            console.error(`[calculateProductCarbonFootprint] ❌ Failed to insert owned production site for ${allocation.facilityName}:`, {
              errorMessage: insertError.message,
              errorCode: insertError.code,
              errorDetails: insertError.details,
              errorHint: insertError.hint,
              record: productionSiteRecord,
            });
          } else {
            console.log(`[calculateProductCarbonFootprint] ✅ Created owned production site for ${allocation.facilityName}: ${allocatedEmissions.toFixed(2)} kg CO2e (Scope 1/2)`);
          }
        }
      }
    } else {
      // Legacy flow: Copy owned production site allocations from previous PCF (if any)
      // This ensures Scope 1/2 data persists across PCF recalculations
      const { data: previousPCF } = await supabase
        .from('product_carbon_footprints')
        .select('id')
        .eq('product_id', parseInt(productId))
        .neq('id', lca.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousPCF) {
        console.log(`[calculateProductCarbonFootprint] Found previous PCF: ${previousPCF.id}, checking for owned production sites...`);

        const { data: previousSites, error: sitesError } = await supabase
          .from('product_carbon_footprint_production_sites')
          .select('*')
          .eq('product_carbon_footprint_id', previousPCF.id);

        if (sitesError) {
          console.warn('[calculateProductCarbonFootprint] ⚠️ Failed to query previous production sites:', sitesError);
        } else if (previousSites && previousSites.length > 0) {
          console.log(`[calculateProductCarbonFootprint] Found ${previousSites.length} owned production sites from previous PCF`);

          // Copy sites to new PCF (excluding id and timestamps)
          const newSites = previousSites.map(site => {
            const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...siteData } = site;
            return {
              ...siteData,
              product_carbon_footprint_id: lca.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          });

          const { error: insertError } = await supabase
            .from('product_carbon_footprint_production_sites')
            .insert(newSites);

          if (insertError) {
            console.warn('[calculateProductCarbonFootprint] ⚠️ Failed to copy production sites:', insertError);
            console.warn('[calculateProductCarbonFootprint] This may affect Scope 1/2 calculations');
          } else {
            console.log(`[calculateProductCarbonFootprint] ✅ Copied ${newSites.length} owned production sites to new PCF`);

            // HIGH FIX #26: Also populate collectedFacilityEmissions from the copied sites
            // so that Scope 1/2 processing emissions are included in the aggregation.
            // Previously the legacy flow left collectedFacilityEmissions empty, causing
            // all processing emissions to be zero in the aggregated result even when
            // facility data existed in the DB.
            for (const site of newSites) {
              collectedFacilityEmissions.push({
                facilityId: site.facility_id || '',
                facilityName: `Facility (legacy copy from ${previousPCF.id.substring(0, 8)})`,
                isContractManufacturer: false,
                allocatedEmissions: site.allocated_emissions_kg_co2e || 0,
                scope1Emissions: site.scope1_emissions_kg_co2e || 0,
                scope2Emissions: site.scope2_emissions_kg_co2e || 0,
                allocatedWater: site.allocated_water_litres || 0,
                allocatedWaste: site.allocated_waste_kg || 0,
                attributionRatio: site.attribution_ratio || 1,
                productVolume: site.production_volume || 1,
              });
            }

            // Log the emissions being carried forward
            const totalCopiedEmissions = newSites.reduce((sum, s) => sum + (s.allocated_emissions_kg_co2e || 0), 0);
            const totalScope1 = newSites.reduce((sum, s) => sum + (s.scope1_emissions_kg_co2e || 0), 0);
            const totalScope2 = newSites.reduce((sum, s) => sum + (s.scope2_emissions_kg_co2e || 0), 0);
            console.log(`[calculateProductCarbonFootprint] Copied emissions: Total=${totalCopiedEmissions.toFixed(2)} kg, Scope1=${totalScope1.toFixed(2)} kg, Scope2=${totalScope2.toFixed(2)} kg`);
          }
        } else {
          console.log('[calculateProductCarbonFootprint] No owned production sites found in previous PCF');
        }
      } else {
        console.log('[calculateProductCarbonFootprint] No previous PCF found, skipping production site copy');
      }
    }

    // 5. Resolve impact factors for each material using waterfall logic
    const lcaMaterialsWithImpacts = [];
    const fallbackEvents: FallbackEvent[] = [];

    // Load pinned factors if pinnedPcfId is set (idempotent recalculation mode)
    let pinnedMaterials: Map<string, any> | null = null;
    if (params.pinnedPcfId) {
      console.log(`[calculateProductCarbonFootprint] Pinned mode: loading factors from PCF ${params.pinnedPcfId}`);
      const { data: prevMaterials } = await supabase
        .from('product_carbon_footprint_materials')
        .select('*')
        .eq('product_carbon_footprint_id', params.pinnedPcfId);
      if (prevMaterials && prevMaterials.length > 0) {
        pinnedMaterials = new Map(prevMaterials.map((m: any) => [m.material_name, m]));
        console.log(`[calculateProductCarbonFootprint] Pinned mode: loaded ${pinnedMaterials.size} material factors`);
      } else {
        console.warn(`[calculateProductCarbonFootprint] Pinned mode: no materials found for PCF ${params.pinnedPcfId}, falling back to live resolution`);
      }
    }

    // Pre-resolve all impact factors in parallel (OpenLCA calls are the slow part).
    // This turns N sequential API calls into concurrent ones, capped at 4 to avoid
    // overwhelming the OpenLCA server.
    const OPENLCA_CONCURRENCY = 4;
    const resolvedFactors = new Map<string, WaterfallResult>();

    // Build list of materials that need live resolution (not pinned)
    const materialsToResolve = materials.filter(m => !pinnedMaterials?.has(m.material_name));

    if (materialsToResolve.length > 0) {
      console.log(`[calculateProductCarbonFootprint] Resolving ${materialsToResolve.length} materials in parallel (concurrency: ${OPENLCA_CONCURRENCY})`);

      // Semaphore-based concurrency limiter
      const queue = materialsToResolve.map(m => async () => {
        const quantityKg = normalizeToKg(m.quantity, m.unit);
        console.log(`[calculateProductCarbonFootprint] Processing material: ${m.material_name} (${quantityKg} kg)`);
        console.log(`[calculateProductCarbonFootprint] Material OpenLCA data:`, {
          data_source: m.data_source,
          data_source_id: m.data_source_id,
          organization_id: product.organization_id,
        });
        const result = await resolveImpactFactors(m as ProductMaterial, quantityKg, product.organization_id, fallbackEvents);
        resolvedFactors.set(m.material_name, result);
      });

      // Run with concurrency limit
      const results: Promise<void>[] = [];
      const executing = new Set<Promise<void>>();
      for (const task of queue) {
        const p = task();
        results.push(p);
        executing.add(p);
        const cleanup = () => { executing.delete(p); };
        p.then(cleanup, cleanup);
        if (executing.size >= OPENLCA_CONCURRENCY) {
          await Promise.race(executing);
        }
      }
      await Promise.allSettled(results);
    }

    for (const material of materials) {
      try {
        // Normalize quantity to kg
        const quantityKg = normalizeToKg(material.quantity, material.unit);

        // Use pre-resolved factors (parallel) or pinned factors
        let resolved: WaterfallResult;
        if (pinnedMaterials?.has(material.material_name)) {
          console.log(`[calculateProductCarbonFootprint] Using pinned factors for: ${material.material_name}`);
          resolved = buildResultFromPinnedMaterial(pinnedMaterials.get(material.material_name)!, quantityKg);
        } else if (resolvedFactors.has(material.material_name)) {
          resolved = resolvedFactors.get(material.material_name)!;
        } else {
          // Fallback: resolve individually (should not happen, but safe)
          resolved = await resolveImpactFactors(material as ProductMaterial, quantityKg, product.organization_id, fallbackEvents);
        }

        // Calculate transport emissions (multi-modal preferred, single-leg fallback)
        let transportEmissions = 0;
        if (material.transport_legs && material.transport_legs.length > 0) {
          // Multi-modal: sum emissions across all legs
          try {
            const distResult = await calculateDistributionEmissions({
              legs: material.transport_legs,
              productWeightKg: quantityKg,
            });
            transportEmissions = distResult.total;
            console.log(
              `[calculateProductCarbonFootprint] ✓ Multi-modal transport for ${material.material_name}: ` +
              `${transportEmissions.toFixed(4)} kg CO2e (${material.transport_legs.length} legs)`
            );
          } catch (error: any) {
            console.warn(
              `[calculateProductCarbonFootprint] ⚠ Failed multi-modal transport for ${material.material_name}:`,
              error.message
            );
          }
        } else if (material.transport_mode && material.distance_km) {
          // Legacy single-leg fallback (old rows without transport_legs)
          try {
            const transportResult = await calculateTransportEmissions({
              weightKg: quantityKg,
              distanceKm: Number(material.distance_km),
              transportMode: material.transport_mode as TransportMode
            });
            transportEmissions = transportResult.emissions;
            console.log(
              `[calculateProductCarbonFootprint] ✓ Transport emissions for ${material.material_name}: ` +
              `${transportEmissions.toFixed(4)} kg CO2e (${material.transport_mode}, ${material.distance_km} km)`
            );
          } catch (error: any) {
            console.warn(
              `[calculateProductCarbonFootprint] ⚠ Failed to calculate transport emissions for ${material.material_name}:`,
              error.message
            );
          }
        }

        // ISO 14044 §4.3.4.2 — Physical allocation for shared packaging
        // Secondary/shipment/tertiary packaging serves multiple product units.
        // Divide all impacts by units_per_group to get the per-unit share.
        // Primary packaging (container/label/closure) always has units_per_group=1 (no-op).
        //
        // CRITICAL FIX #4: Validate units_per_group before dividing.
        // A zero or NaN value would produce Infinity or NaN in all downstream
        // impact calculations, silently corrupting the entire carbon footprint.
        // We guard against this and warn with a recoverable fallback of 1.
        //
        // CRITICAL FIX #6: Secondary packaging without units_per_group used to
        // silently default to 1, meaning the full packaging impact was attributed
        // to each unit rather than being shared — a systematic over-count.
        // Now we warn explicitly so the data entry issue is surfaced.
        const rawUnitsPerGroup = (material as any).units_per_group;
        const parsedUnitsPerGroup = Number(rawUnitsPerGroup);

        const isSharedPackaging = (
          material.material_type === 'packaging' &&
          material.packaging_category &&
          ['secondary', 'shipment', 'tertiary'].includes(material.packaging_category)
        );

        let unitsPerGroup = 1;
        if (isSharedPackaging) {
          if (!rawUnitsPerGroup || isNaN(parsedUnitsPerGroup) || parsedUnitsPerGroup <= 0) {
            console.warn(
              `[calculateProductCarbonFootprint] ⚠️ PACKAGING ALLOCATION: "${material.material_name}" ` +
              `(${material.packaging_category}) is shared packaging but has no valid units_per_group ` +
              `(value: ${rawUnitsPerGroup}). Defaulting to 1 (full impact per unit — likely an over-count). ` +
              `Please set units_per_group to the number of product units in each ${material.packaging_category} pack.`
            );
            unitsPerGroup = 1;
          } else if (parsedUnitsPerGroup < 1) {
            console.warn(
              `[calculateProductCarbonFootprint] ⚠️ PACKAGING ALLOCATION: "${material.material_name}" ` +
              `units_per_group=${parsedUnitsPerGroup} is less than 1 (invalid). Clamping to 1.`
            );
            unitsPerGroup = 1;
          } else {
            unitsPerGroup = parsedUnitsPerGroup;
          }
        }

        if (unitsPerGroup > 1) {
          console.log(`[calculateProductCarbonFootprint] Applying packaging allocation: ÷${unitsPerGroup} units for ${material.material_name}`);
          // Divide all resolved impact values by units served
          resolved.impact_climate /= unitsPerGroup;
          resolved.impact_climate_fossil /= unitsPerGroup;
          resolved.impact_climate_biogenic /= unitsPerGroup;
          resolved.impact_climate_dluc /= unitsPerGroup;
          if (resolved.ch4_kg) resolved.ch4_kg /= unitsPerGroup;
          if (resolved.ch4_fossil_kg) resolved.ch4_fossil_kg /= unitsPerGroup;
          if (resolved.ch4_biogenic_kg) resolved.ch4_biogenic_kg /= unitsPerGroup;
          if (resolved.n2o_kg) resolved.n2o_kg /= unitsPerGroup;
          resolved.impact_water /= unitsPerGroup;
          resolved.impact_water_scarcity /= unitsPerGroup;
          resolved.impact_land /= unitsPerGroup;
          resolved.impact_waste /= unitsPerGroup;
          if (resolved.impact_terrestrial_ecotoxicity) resolved.impact_terrestrial_ecotoxicity /= unitsPerGroup;
          if (resolved.impact_freshwater_eutrophication) resolved.impact_freshwater_eutrophication /= unitsPerGroup;
          if (resolved.impact_terrestrial_acidification) resolved.impact_terrestrial_acidification /= unitsPerGroup;
          if (resolved.impact_fossil_resource_scarcity) resolved.impact_fossil_resource_scarcity /= unitsPerGroup;
          // Transport of the packaging itself is also shared
          transportEmissions /= unitsPerGroup;
        }

        // ──────────────────────────────────────────────────────────────
        // Impact decomposition adjustments
        //
        // When we have decomposed impacts from OpenLCA contribution analysis,
        // we can replace the generic ecoinvent transport/electricity with
        // user-specific values:
        //
        // Transport: If user provided origin + mode + distance, use their
        //   DEFRA-calculated transport instead of ecoinvent's generic transport.
        //   adjusted = (total - embedded_transport) + user_transport
        //
        // Electricity: If user's origin country differs from the factor's
        //   embedded electricity geography, adjust using the grid factor ratio.
        //   adjusted += embedded_electricity × (user_grid / factor_grid - 1)
        // ──────────────────────────────────────────────────────────────
        let adjustedClimate = resolved.impact_climate;

        const hasDecomposition = (resolved.impact_climate_production ?? 0) > 0;
        const embeddedTransport = resolved.impact_climate_transport_embedded ?? 0;
        const embeddedElectricity = resolved.impact_climate_electricity_embedded ?? 0;
        const embeddedElecGeo = resolved.embedded_electricity_geography;

        // Transport replacement: swap ecoinvent generic transport for user's actual transport
        if (transportEmissions > 0 && hasDecomposition && embeddedTransport > 0) {
          adjustedClimate = resolved.impact_climate - embeddedTransport + transportEmissions;
          console.log(
            `[calculateProductCarbonFootprint] ⚡ Transport replaced for ${material.material_name}: ` +
            `ecoinvent=${embeddedTransport.toFixed(3)} → DEFRA=${transportEmissions.toFixed(3)} kg CO2e`
          );
        }

        // Electricity grid adjustment: correct for processing country's actual grid mix
        if (hasDecomposition && embeddedElectricity > 0 && embeddedElecGeo && (material as any).origin_country_code) {
          const userGrid = getGridFactor((material as any).origin_country_code);
          const factorGrid = getGridFactor(embeddedElecGeo);

          // Only adjust if both grids are known (not estimated) and different
          if (!userGrid.isEstimated && !factorGrid.isEstimated && Math.abs(userGrid.factor - factorGrid.factor) > 0.001) {
            const electricityAdjustment = embeddedElectricity * (userGrid.factor / factorGrid.factor - 1);
            adjustedClimate += electricityAdjustment;
            console.log(
              `[calculateProductCarbonFootprint] ⚡ Electricity adjusted for ${material.material_name}: ` +
              `${embeddedElecGeo}=${factorGrid.factor.toFixed(3)} → ${(material as any).origin_country_code}=${userGrid.factor.toFixed(3)} ` +
              `(Δ=${electricityAdjustment >= 0 ? '+' : ''}${electricityAdjustment.toFixed(3)} kg CO2e)`
            );
          }
        }

        // ──────────────────────────────────────────────────────────────────────
        // Inbound delivery container embodied carbon (optional, ingredient only)
        //
        // When an ingredient is delivered in a bulk container (IBC, drum,
        // flexitank, road tanker), its manufacturing footprint is amortised
        // over reuse cycles and allocated to this ingredient's volume share.
        //
        // Formula (ISO 14044 §4.3.4.2 physical allocation by volume):
        //   ef_per_fill        = container_ef × tare_kg / reuse_cycles
        //   fill_fraction      = ingredient_qty_litres / container_volume_l
        //   container_co2/unit = ef_per_fill × fill_fraction
        //
        // The result is added directly to adjustedClimate and stored separately
        // on the lcaMaterial row for audit traceability.
        //
        // Unit handling:
        //   l / ml → converted to litres (density-neutral; normalizeToKg treats
        //            1 L as 1 kg, so quantityKg already equals litres for volume units)
        //   kg     → use quantityKg as litre approximation (density ≈ 1 kg/L);
        //            a console.warn flags the imprecision for spirits (~0.8 kg/L)
        //   unit   → skip (cannot convert to litres); container impact = 0
        // ──────────────────────────────────────────────────────────────────────
        let containerCO2PerUnit = 0;
        const containerType = (material as any).inbound_container_type as string | null;

        if (material.material_type === 'ingredient' && containerType) {
          try {
            const containerTareKg  = Number((material as any).inbound_container_tare_kg  || 0);
            const containerVolumeL = Number((material as any).inbound_container_volume_l || 0);
            const reuseCycles      = Math.max(1, Number((material as any).inbound_container_reuse_cycles || 1));
            let   containerEf      = Number((material as any).inbound_container_ef || 0);

            // Look up EF from staging_emission_factors when not overridden inline
            if (!containerEf && containerType !== 'custom') {
              const CONTAINER_FACTOR_NAMES: Record<string, string> = {
                ibc_1000l:          'Inbound Container - IBC 1000L (HDPE)',
                ibc_500l:           'Inbound Container - IBC 500L (HDPE)',
                drum_200l:          'Inbound Container - Drum 200L (HDPE)',
                flexitank_24000l:   'Inbound Container - Flexitank 24000L (LDPE)',
                bulk_tanker_25000l: 'Inbound Container - Bulk Tanker 25000L (Stainless steel)',
                // Glass bottles — for ingredients purchased in retail units
                bottle_700ml_glass: 'Inbound Container - Glass Bottle 700ml (standard)',
                bottle_750ml_glass: 'Inbound Container - Glass Bottle 750ml (standard)',
                bottle_1l_glass:    'Inbound Container - Glass Bottle 1L (standard)',
              };
              const factorName = CONTAINER_FACTOR_NAMES[containerType];
              if (factorName) {
                const { data: containerFactor } = await supabase
                  .from('staging_emission_factors')
                  .select('co2_factor')
                  .eq('name', factorName)
                  .eq('category', 'Inbound Container')
                  .maybeSingle();
                containerEf = Number(containerFactor?.co2_factor || 0);
              }
            }

            if (containerEf > 0 && containerTareKg > 0 && containerVolumeL > 0) {
              // Determine ingredient quantity in litres for volume-based allocation
              const unitLower = (material.unit || '').toLowerCase();
              let ingredientLitres = 0;

              if (['l', 'litre', 'litres', 'liter', 'liters'].includes(unitLower)) {
                ingredientLitres = quantityKg; // normalizeToKg treats L as 1:1 with kg
              } else if (['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'].includes(unitLower)) {
                ingredientLitres = quantityKg; // already converted to kg-equivalent
              } else if (['kg', 'kilograms', 'kilogram'].includes(unitLower)) {
                ingredientLitres = quantityKg; // density ≈ 1 kg/L approximation
                console.warn(
                  `[calculateProductCarbonFootprint] ⚠ Container allocation for "${material.material_name}": ` +
                  `unit is kg (weight), not volume. Using 1 kg ≈ 1 L. ` +
                  `Spirits are ~0.8 kg/L — switch to litres for accuracy.`
                );
              } else {
                console.warn(
                  `[calculateProductCarbonFootprint] ⚠ Container allocation skipped for "${material.material_name}": ` +
                  `cannot convert unit '${material.unit}' to litres.`
                );
              }

              if (ingredientLitres > 0) {
                const efPerFill    = (containerEf * containerTareKg) / reuseCycles;
                const fillFraction = ingredientLitres / containerVolumeL;
                containerCO2PerUnit = efPerFill * fillFraction;

                console.log(
                  `[calculateProductCarbonFootprint] ✓ Container impact for "${material.material_name}" ` +
                  `(${containerType}): ef=${containerEf} tare=${containerTareKg}kg ` +
                  `reuse=${reuseCycles} vol=${containerVolumeL}L qty=${ingredientLitres.toFixed(3)}L ` +
                  `→ ${containerCO2PerUnit.toFixed(5)} kg CO2e/unit`
                );
              }
            } else if (containerType && containerType !== 'custom') {
              console.warn(
                `[calculateProductCarbonFootprint] ⚠ Container impact skipped for "${material.material_name}": ` +
                `missing or zero ef (${containerEf}), tare (${containerTareKg}kg), or volume (${containerVolumeL}L).`
              );
            }
          } catch (containerErr: any) {
            // Non-fatal: log and continue; container impact stays at 0
            console.warn(
              `[calculateProductCarbonFootprint] ⚠ Container impact calculation failed for "${material.material_name}":`,
              containerErr.message
            );
          }

          // Add container embodied carbon to the ingredient's climate total
          adjustedClimate += containerCO2PerUnit;
        }

        // Build LCA material record with all impact data
        // Note: data_source must be 'openlca', 'supplier', or NULL per constraint
        // For staging factors, we use NULL
        let dataSource = null;
        if (material.data_source === 'openlca' && material.data_source_id) {
          dataSource = 'openlca';
        } else if (material.data_source === 'supplier' && material.supplier_product_id) {
          dataSource = 'supplier';
        }

        const lcaMaterial = {
          product_carbon_footprint_id: lca.id,
          name: material.material_name,
          material_name: material.material_name,
          material_type: material.material_type,
          quantity: quantityKg,
          unit: 'kg',
          unit_name: material.unit,
          packaging_category: material.packaging_category,
          units_per_group: unitsPerGroup,
          origin_country: material.origin_country,
          country_of_origin: material.origin_country,
          is_organic: material.is_organic_certified,
          is_organic_certified: material.is_organic_certified,
          recycled_content_percentage: material.recycled_content_percentage ?? null,
          supplier_product_id: material.supplier_product_id,
          data_source: dataSource,
          data_source_id: material.data_source_id || null,

          // Transport data
          transport_mode: material.transport_mode || null,
          distance_km: material.distance_km || null,
          impact_transport: transportEmissions,

          // Origin geolocation
          origin_address: material.origin_address || null,
          origin_lat: material.origin_lat || null,
          origin_lng: material.origin_lng || null,
          origin_country_code: material.origin_country_code || null,

          // ISO 14067 §7 biogenic carbon classification
          is_biogenic_carbon: (material as any).is_biogenic_carbon || false,

          // Impact values
          impact_climate: adjustedClimate,
          impact_climate_fossil: (material as any).is_biogenic_carbon ? 0 : resolved.impact_climate_fossil,
          impact_climate_biogenic: (material as any).is_biogenic_carbon ? adjustedClimate : resolved.impact_climate_biogenic,
          impact_climate_dluc: resolved.impact_climate_dluc,
          // GHG gas breakdown (ISO 14067)
          ch4_kg: resolved.ch4_kg || 0,
          ch4_fossil_kg: resolved.ch4_fossil_kg || 0,
          ch4_biogenic_kg: resolved.ch4_biogenic_kg || 0,
          n2o_kg: resolved.n2o_kg || 0,
          impact_water: resolved.impact_water,
          impact_water_scarcity: resolved.impact_water_scarcity,
          impact_land: resolved.impact_land,
          impact_waste: resolved.impact_waste,
          impact_terrestrial_ecotoxicity: resolved.impact_terrestrial_ecotoxicity,
          impact_freshwater_eutrophication: resolved.impact_freshwater_eutrophication,
          impact_terrestrial_acidification: resolved.impact_terrestrial_acidification,
          impact_fossil_resource_scarcity: resolved.impact_fossil_resource_scarcity,

          // Decomposition metadata (for UI transparency)
          impact_climate_production: resolved.impact_climate_production,
          impact_climate_transport_embedded: resolved.impact_climate_transport_embedded,
          impact_climate_electricity_embedded: resolved.impact_climate_electricity_embedded,
          embedded_electricity_geography: resolved.embedded_electricity_geography,

          // Data quality & provenance
          data_priority: resolved.data_priority,
          data_quality_tag: resolved.data_quality_tag,
          data_quality_grade: resolved.data_quality_grade,
          supplier_lca_id: resolved.supplier_lca_id || null,
          confidence_score: resolved.confidence_score,
          methodology: resolved.methodology,
          source_reference: resolved.source_reference,
          impact_source: resolveImpactSource(resolved.data_quality_tag, resolved.data_priority),
          impact_reference_id: resolved.supplier_lca_id || null,

          // Data source tracking for quality metrics
          gwp_data_source: resolved.gwp_data_source,
          non_gwp_data_source: resolved.non_gwp_data_source,
          is_hybrid_source: resolved.is_hybrid_source,
          category_type: resolved.category_type,

          // Inbound delivery container (ingredient rows only; for audit traceability)
          // containerCO2PerUnit is already included in impact_climate above.
          inbound_container_type: containerType ?? null,
          inbound_container_co2_per_unit: containerCO2PerUnit,
        };

        lcaMaterialsWithImpacts.push(lcaMaterial);

        const allocationNote = unitsPerGroup > 1 ? ` (allocated ÷${unitsPerGroup} units)` : '';
        const adjustedNote = adjustedClimate !== resolved.impact_climate ? ` (adjusted from ${resolved.impact_climate.toFixed(3)})` : '';
        console.log(`[calculateProductCarbonFootprint] ✓ Resolved ${material.material_name}: ${adjustedClimate.toFixed(3)} kg CO2e${adjustedNote} (Priority ${resolved.data_priority})${allocationNote}`);

      } catch (error: any) {
        console.error(`[calculateProductCarbonFootprint] ✗ Failed to resolve ${material.material_name}:`, error.message);

        // Clean up: delete the LCA record since we can't proceed
        await supabase.from('product_carbon_footprints').delete().eq('id', lca.id);

        throw new Error(`Missing emission data for material "${material.material_name}". ${error.message}`);
      }
    }

    // 5b. Check for maturation profile and calculate maturation impacts
    //
    // LOW FIX #24: Guard against maturation profile being present for product types
    // that don't barrel-age (beer, cider, soft drinks). Applying barrel CO2e, angel's
    // share VOC, and warehouse energy to a beer product would produce nonsensical results.
    //
    // Maturation is only valid for aged spirits and wines:
    //   Spirits  — whisky, rum, brandy, calvados, cognac, armagnac, etc.
    //   Wine     — barrel-aged wine (Chardonnay, Rioja, Barolo, etc.)
    //   RTD      — excluded (RTDs are not barrel-aged)
    //   Beer/Cider — excluded (beer is not barrel-aged; barrel-finishing is rare)
    //
    // product.product_type is drawn from PRODUCT_TYPE_OPTIONS in industry-benchmarks.ts:
    //   'Spirits', 'Beer & Cider', 'Wine', 'Ready-to-Drink & Cocktails', 'Non-Alcoholic'
    const MATURATION_ELIGIBLE_TYPES = new Set(['spirits', 'wine']);
    const productTypeLower = (product.product_type || '').toLowerCase();
    // CRITICAL FIX: Previously allowed empty/null product_type (!product.product_type)
    // which silently applied barrel impacts (5–20 kg CO₂e) to non-aged products.
    // Now requires explicit product type match. If product_type is not set and a
    // maturation profile exists, the profile is SKIPPED with a warning.
    const isMaturationEligible = !!product.product_type && (
      MATURATION_ELIGIBLE_TYPES.has(productTypeLower) ||
      productTypeLower.includes('spirit') ||
      productTypeLower.includes('whisky') ||
      productTypeLower.includes('whiskey') ||
      productTypeLower.includes('rum') ||
      productTypeLower.includes('brandy') ||
      productTypeLower.includes('cognac') ||
      productTypeLower.includes('calvados') ||
      productTypeLower.includes('armagnac') ||
      productTypeLower.includes('wine')
    );

    const { data: maturationProfile } = await supabase
      .from('maturation_profiles')
      .select('*')
      .eq('product_id', parseInt(productId))
      .maybeSingle();

    if (maturationProfile && !isMaturationEligible) {
      console.warn(
        `[calculateProductCarbonFootprint] ⚠️ MATURATION TYPE MISMATCH: Product "${product.name}" has product_type="${product.product_type}" which is not typically barrel-aged. ` +
        `Maturation profile found (${maturationProfile.barrel_type}, ${maturationProfile.aging_duration_months} months) will be SKIPPED to prevent erroneous impacts. ` +
        `If this product is genuinely barrel-aged, update the product type to "Spirits" or "Wine".`
      );
    }

    if (maturationProfile && isMaturationEligible) {
      console.log(`[calculateProductCarbonFootprint] Processing maturation profile (${maturationProfile.barrel_type}, ${maturationProfile.aging_duration_months} months)...`);
      // HIGH FIX #11: Pass the primary facility's country code so the maturation
    // calculator can use the warehouse's grid factor rather than a hardcoded UK value.
    // The primary facility (first in facilityAllocations) is the best proxy for the
    // warehouse location when a dedicated warehouse_country_code field doesn't exist yet.
    const warehouseCountryCode = params.facilityAllocations?.[0]
      ? (await supabase.from('facilities').select('location_country_code').eq('id', params.facilityAllocations[0].facilityId).single()).data?.location_country_code ?? null
      : null;
    const matResult = calculateMaturationImpacts(maturationProfile as MaturationProfile, warehouseCountryCode);

      // --- Per-bottle allocation ---
      // Regular materials are already per-functional-unit (per bottle). Maturation
      // impacts must be normalized the same way so the aggregator sums correctly.
      const rawBottleSize = product.unit_size_unit === 'ml'
        ? Number(product.unit_size_value) / 1000.0
        : Number(product.unit_size_value || 0.75); // fallback 750ml
      // ACCURACY FIX: Guard against zero/negative bottle size which would cause
      // division-by-zero in per-bottle allocation (Infinity CO2e per bottle).
      const bottleSizeLitres = rawBottleSize > 0 ? rawBottleSize : 0.75;
      if (rawBottleSize <= 0) {
        console.warn(
          `[calculateProductCarbonFootprint] ⚠ Bottle size resolved to ${rawBottleSize}L ` +
          `(unit_size_value: ${product.unit_size_value}, unit: ${product.unit_size_unit}). ` +
          `Using default 0.75L to avoid division-by-zero in maturation allocation.`
        );
      }

      // Use user-specified bottle count if set, otherwise derive from output volume
      const totalBottles = maturationProfile.bottles_produced
        ? Number(maturationProfile.bottles_produced)
        : (matResult.output_volume_litres > 0 && bottleSizeLitres > 0)
          ? matResult.output_volume_litres / bottleSizeLitres
          : 1;

      const barrelPerBottle = totalBottles > 0 ? matResult.barrel_total_co2e / totalBottles : 0;
      const warehousePerBottle = totalBottles > 0 ? matResult.warehouse_co2e_total / totalBottles : 0;
      const vocPerBottle = totalBottles > 0 ? matResult.angel_share_photochemical_ozone / totalBottles : 0;

      console.log(`[calculateProductCarbonFootprint] Maturation per-bottle: ${totalBottles.toFixed(0)} bottles from ${matResult.output_volume_litres.toFixed(1)}L (${(bottleSizeLitres * 1000).toFixed(0)}ml/bottle), barrel=${barrelPerBottle.toFixed(4)}/bottle, warehouse=${warehousePerBottle.toFixed(4)}/bottle`);

      // Inject barrel allocation as a synthetic material (per-bottle)
      lcaMaterialsWithImpacts.push({
        product_carbon_footprint_id: lca.id,
        name: '[Maturation] Oak Barrel Allocation',
        material_name: '[Maturation] Oak Barrel Allocation',
        material_type: 'ingredient',
        quantity: bottleSizeLitres,
        unit: 'L',
        unit_name: 'L',
        packaging_category: null,
        origin_country: null,
        country_of_origin: null,
        is_organic: false,
        is_organic_certified: false,
        supplier_product_id: null,
        data_source: null,
        data_source_id: null,
        transport_mode: null,
        distance_km: null,
        impact_transport: 0,
        origin_address: null,
        origin_lat: null,
        origin_lng: null,
        origin_country_code: null,
        impact_climate: barrelPerBottle,
        // Barrel allocation fossil/biogenic split:
        // Oak barrel manufacturing involves timber (biogenic carbon, ~55% of mass
        // is carbon stored in wood) plus kiln-drying, cooperage energy, and transport
        // (all fossil). Based on Ecoinvent 3.x wooden barrel datasets, approximately
        // 40% of the cradle-to-gate barrel CO2e is fossil (energy use in cooperage
        // + transport) and 60% is biogenic (wood combustion/decomposition credits).
        // Source: Pettersson (2016) LCA of Swedish single malt whisky; SWA (2006).
        // This is preferable to the previous 95/5 split which had no documented basis.
        impact_climate_fossil: barrelPerBottle * 0.40,
        impact_climate_biogenic: barrelPerBottle * 0.60,
        impact_climate_dluc: 0,
        ch4_kg: 0,
        ch4_fossil_kg: 0,
        ch4_biogenic_kg: 0,
        n2o_kg: 0,
        impact_water: 0,
        impact_water_scarcity: 0,
        impact_land: 0,
        impact_waste: 0,
        impact_terrestrial_ecotoxicity: 0,
        impact_freshwater_eutrophication: 0,
        impact_terrestrial_acidification: 0,
        impact_fossil_resource_scarcity: 0,
        impact_photochemical_ozone_formation: vocPerBottle,
        data_priority: 3,
        data_quality_tag: 'Secondary_Estimated',
        supplier_lca_id: null,
        confidence_score: 60,
        methodology: 'Cut-off allocation / Literature estimates',
        source_reference: `Barrel allocation: ${matResult.barrel_total_co2e.toFixed(1)} kg total ÷ ${totalBottles.toFixed(0)} bottles = ${barrelPerBottle.toFixed(4)} kg/bottle (${(bottleSizeLitres * 1000).toFixed(0)}ml, ${matResult.output_volume_litres.toFixed(1)}L output). ${matResult.methodology_notes}`,
        impact_source: 'secondary_modelled',
        impact_reference_id: null,
        data_quality_grade: 'LOW',
        gwp_data_source: 'Alkatera staging factor',
        non_gwp_data_source: 'Alkatera staging factor',
        is_hybrid_source: false,
        category_type: 'maturation',
      });

      // Inject warehouse energy as a synthetic material (per-bottle)
      lcaMaterialsWithImpacts.push({
        product_carbon_footprint_id: lca.id,
        name: '[Maturation] Warehouse Energy',
        material_name: '[Maturation] Warehouse Energy',
        material_type: 'ingredient',
        quantity: bottleSizeLitres,
        unit: 'L',
        unit_name: 'L',
        packaging_category: null,
        origin_country: null,
        country_of_origin: null,
        is_organic: false,
        is_organic_certified: false,
        supplier_product_id: null,
        data_source: null,
        data_source_id: null,
        transport_mode: null,
        distance_km: null,
        impact_transport: 0,
        origin_address: null,
        origin_lat: null,
        origin_lng: null,
        origin_country_code: null,
        impact_climate: warehousePerBottle,
        impact_climate_fossil: warehousePerBottle,
        impact_climate_biogenic: 0,
        impact_climate_dluc: 0,
        ch4_kg: 0,
        ch4_fossil_kg: 0,
        ch4_biogenic_kg: 0,
        n2o_kg: 0,
        impact_water: 0,
        impact_water_scarcity: 0,
        impact_land: 0,
        impact_waste: 0,
        impact_terrestrial_ecotoxicity: 0,
        impact_freshwater_eutrophication: 0,
        impact_terrestrial_acidification: 0,
        impact_fossil_resource_scarcity: 0,
        data_priority: 3,
        data_quality_tag: 'Secondary_Estimated',
        supplier_lca_id: null,
        confidence_score: 55,
        methodology: 'DEFRA 2025 grid factors',
        source_reference: `Warehouse energy: ${matResult.warehouse_co2e_total.toFixed(1)} kg total ÷ ${totalBottles.toFixed(0)} bottles = ${warehousePerBottle.toFixed(4)} kg/bottle. ${maturationProfile.warehouse_energy_kwh_per_barrel_year} kWh/barrel/yr (${maturationProfile.warehouse_energy_source})`,
        impact_source: 'secondary_modelled',
        impact_reference_id: null,
        data_quality_grade: 'LOW',
        gwp_data_source: 'DEFRA 2025',
        non_gwp_data_source: 'DEFRA 2025',
        is_hybrid_source: false,
        category_type: 'maturation',
      });

      console.log(`[calculateProductCarbonFootprint] ✓ Maturation impacts (per-bottle): barrel=${barrelPerBottle.toFixed(4)} kg CO2e, warehouse=${warehousePerBottle.toFixed(4)} kg CO2e, angel's share=${matResult.angel_share_loss_percent_total.toFixed(1)}% volume loss, VOC=${vocPerBottle.toFixed(4)} kg/bottle`);
    }

    // 5c. Check for vineyard growing profile and calculate viticulture impacts
    //
    // For producers who grow their own agricultural inputs (e.g. vineyards
    // growing grapes), the viticulture calculator computes field-level emissions
    // from fertiliser N2O, machinery fuel, irrigation, and soil carbon removals.
    //
    // FLAG Alignment: Emissions and removals are injected as separate synthetic
    // rows. Removals use impact_removals_co2e (never impact_climate) per SBTi
    // FLAG Guidance v1.2.
    // Find vineyard_id from self-grown ingredients linked to this product
    const { data: selfGrownIngredients } = await supabase
      .from('product_materials')
      .select('vineyard_id')
      .eq('product_id', parseInt(productId))
      .eq('is_self_grown', true)
      .not('vineyard_id', 'is', null);

    const vineyardIds = Array.from(new Set(
      (selfGrownIngredients || []).map((m: any) => m.vineyard_id).filter(Boolean)
    ));

    // Process the first linked vineyard (most products have one vineyard)
    const vineyardId = vineyardIds[0];
    const { data: viticultureProfiles } = vineyardId
      ? await supabase
          .from('vineyard_growing_profiles')
          .select('*, vineyards(*)')
          .eq('vineyard_id', vineyardId)
          .order('vintage_year', { ascending: false })
      : { data: null };

    // Use the first profile for vineyard metadata (all profiles share the same vineyard)
    const viticultureProfile = viticultureProfiles?.[0];

    if (viticultureProfile) {
      const vineyard = viticultureProfile.vineyards as unknown as Vineyard;
      const profileCount = viticultureProfiles!.length;
      console.log(`[calculateProductCarbonFootprint] Processing viticulture for vineyard "${vineyard?.name || 'unknown'}" (${profileCount} vintage${profileCount > 1 ? 's' : ''})...`);

      // Resolve AWARE water scarcity factor for vineyard country
      const vineyardCountryCode = vineyard?.location_country_code;
      let vineyardAwareFactor = 1.0;
      if (vineyardCountryCode) {
        const awareData = await getAwareFactor(supabase, vineyardCountryCode);
        if (awareData) vineyardAwareFactor = Number(awareData.aware_factor);
      }

      // Build inputs for all available vintages
      const vintageInputs = viticultureProfiles!.map((p: any) => ({
        vintage_year: p.vintage_year,
        input: {
          climate_zone: vineyard?.climate_zone || 'temperate',
          certification: vineyard?.certification || 'conventional',
          location_country_code: vineyard?.location_country_code || null,
          aware_factor: vineyardAwareFactor,
          area_ha: p.area_ha,
          soil_management: p.soil_management,
          pruning_residue_returned: p.pruning_residue_returned ?? true,
          fertiliser_type: p.fertiliser_type,
          fertiliser_quantity_kg: p.fertiliser_quantity_kg,
          fertiliser_n_content_percent: p.fertiliser_n_content_percent,
          uses_pesticides: p.uses_pesticides,
          pesticide_applications_per_year: p.pesticide_applications_per_year,
          pesticide_type: p.pesticide_type || 'generic',
          uses_herbicides: p.uses_herbicides,
          herbicide_applications_per_year: p.herbicide_applications_per_year,
          herbicide_type: p.herbicide_type || 'generic',
          diesel_litres_per_year: p.diesel_litres_per_year,
          petrol_litres_per_year: p.petrol_litres_per_year,
          is_irrigated: p.is_irrigated,
          water_m3_per_ha: p.water_m3_per_ha,
          irrigation_energy_source: p.irrigation_energy_source,
          grape_yield_tonnes: p.grape_yield_tonnes,
          soil_carbon_override_kg_co2e_per_ha: p.soil_carbon_override_kg_co2e_per_ha,
          previous_land_use_type: vineyard?.previous_land_use_type,
          land_conversion_year: vineyard?.land_conversion_year,
          vintage_year: p.vintage_year,
          removal_verification_status: (p as any).removal_verification_status ?? 'unverified',
          removal_verifier_body: (p as any).removal_verifier_body,
          removal_verifier_standard: (p as any).removal_verifier_standard,
          removal_verification_date: (p as any).removal_verification_date,
          removal_verification_expiry: (p as any).removal_verification_expiry,
          ecosystem_type: (p as any).ecosystem_type ?? undefined,
          in_biodiversity_sensitive_area: (p as any).in_biodiversity_sensitive_area ?? false,
          sensitive_area_details: (p as any).sensitive_area_details ?? undefined,
          water_stress_index: (p as any).water_stress_index ?? undefined,
        },
      }));

      // Multi-vintage averaging (median for 3+, mean for 2, single for 1)
      const multiVintageResult = calculateMultiVintageAverage(vintageInputs);
      const vitResult = multiVintageResult.averaged_impacts;
      const vintageNote = profileCount > 1
        ? ` (${multiVintageResult.method}: vintages ${multiVintageResult.vintages_used.join(', ')})`
        : '';

      // --- Per-bottle allocation ---
      // Viticulture impacts are computed for the entire vineyard area.
      // Normalise to per-bottle using grape yield and bottle size.
      const rawBottleSize = product.unit_size_unit === 'ml'
        ? Number(product.unit_size_value) / 1000.0
        : Number(product.unit_size_value || 0.75);
      const bottleSizeLitres = rawBottleSize > 0 ? rawBottleSize : 0.75;

      // Grapes per bottle: typical wine yield ~0.7-0.8 L per kg grapes
      // Using 1.3 kg grapes per 0.75L bottle as industry average
      const grapeKgPerBottle = (viticultureProfile.grape_yield_tonnes * 1000) > 0
        ? bottleSizeLitres / 0.75 * 1.3 // Scale by bottle size relative to 750ml
        : 1.3;
      const totalBottles = (viticultureProfile.grape_yield_tonnes * 1000) / grapeKgPerBottle;

      // Per-bottle factors
      const fertFieldPerBottle = totalBottles > 0
        ? (vitResult.flag_emissions.total_flag_co2e + vitResult.non_flag_emissions.fertiliser_production_co2e) / totalBottles
        : 0;
      const fuelPerBottle = totalBottles > 0
        ? vitResult.non_flag_emissions.machinery_fuel_co2e / totalBottles
        : 0;
      const irrigationPerBottle = totalBottles > 0
        ? vitResult.non_flag_emissions.irrigation_energy_co2e / totalBottles
        : 0;
      const waterPerBottle = totalBottles > 0
        ? vitResult.water_m3 / totalBottles
        : 0;
      const waterScarcityPerBottle = totalBottles > 0
        ? vitResult.water_scarcity_m3_eq / totalBottles
        : 0;
      const landPerBottle = totalBottles > 0
        ? vitResult.flag_emissions.land_use_m2 / totalBottles
        : 0;
      const removalsPerBottle = totalBottles > 0
        ? vitResult.total_removals / totalBottles
        : 0;
      const pesticidePerBottle = totalBottles > 0
        ? vitResult.non_flag_emissions.pesticide_production_co2e / totalBottles
        : 0;
      const n2oKgPerBottle = totalBottles > 0
        ? vitResult.n2o_kg / totalBottles
        : 0;
      const lucPerBottle = totalBottles > 0
        ? vitResult.flag_emissions.luc_co2e / totalBottles
        : 0;

      console.log(`[calculateProductCarbonFootprint] Viticulture per-bottle: ${totalBottles.toFixed(0)} bottles, fert+N2O=${fertFieldPerBottle.toFixed(4)}, fuel=${fuelPerBottle.toFixed(4)}, irrigation=${irrigationPerBottle.toFixed(4)}, removals=${removalsPerBottle.toFixed(4)}`);

      // Synthetic row template (shared fields)
      const vitBaseRow = {
        product_carbon_footprint_id: lca.id,
        material_type: 'ingredient' as const,
        quantity: bottleSizeLitres,
        unit: 'L',
        unit_name: 'L',
        packaging_category: null,
        origin_country: vineyard?.address_country || null,
        country_of_origin: vineyard?.address_country || null,
        is_organic: vineyard?.certification === 'organic' || vineyard?.certification === 'biodynamic',
        is_organic_certified: vineyard?.certification === 'organic',
        supplier_product_id: null,
        data_source: null,
        data_source_id: null,
        transport_mode: null,
        distance_km: null,
        impact_transport: 0,
        origin_address: null,
        origin_lat: vineyard?.address_lat || null,
        origin_lng: vineyard?.address_lng || null,
        origin_country_code: vineyard?.location_country_code || null,
        data_priority: 2 as const,
        data_quality_tag: 'Secondary_Modelled' as const,
        supplier_lca_id: null,
        impact_source: 'secondary_modelled' as const,
        impact_reference_id: null,
        gwp_data_source: 'IPCC 2019 Tier 1 / DEFRA 2025',
        non_gwp_data_source: 'IPCC 2019 Tier 1 / DEFRA 2025',
        is_hybrid_source: false,
        category_type: 'MANUFACTURING_MATERIAL',
      };

      // Row 1: Fertiliser & Field Emissions (N2O + production)
      lcaMaterialsWithImpacts.push({
        ...vitBaseRow,
        name: '[Viticulture] Fertiliser & Field Emissions',
        material_name: '[Viticulture] Fertiliser & Field Emissions',
        impact_climate: fertFieldPerBottle + pesticidePerBottle,
        impact_climate_fossil: fertFieldPerBottle * 0.95 + pesticidePerBottle, // Fertiliser production is mostly fossil
        impact_climate_biogenic: 0,
        impact_climate_dluc: 0,
        ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0,
        n2o_kg: n2oKgPerBottle,
        impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
        impact_freshwater_ecotoxicity: totalBottles > 0 ? vitResult.freshwater_ecotoxicity / totalBottles : 0,
        impact_terrestrial_ecotoxicity: totalBottles > 0 ? vitResult.terrestrial_ecotoxicity / totalBottles : 0,
        impact_human_toxicity_non_carcinogenic: totalBottles > 0 ? vitResult.human_toxicity_non_carcinogenic / totalBottles : 0,
        impact_freshwater_eutrophication: totalBottles > 0 ? vitResult.freshwater_eutrophication / totalBottles : 0,
        impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
        confidence_score: 65,
        methodology: vitResult.methodology_notes,
        source_reference: `Fertiliser: ${vitResult.flag_emissions.n2o_direct_co2e.toFixed(1)} kg CO2e direct N2O + ${vitResult.flag_emissions.n2o_indirect_co2e.toFixed(1)} kg indirect + ${vitResult.non_flag_emissions.fertiliser_production_co2e.toFixed(1)} kg production${vintageNote}`,
        data_quality_grade: vitResult.data_quality_grade,
      });

      // Row 2: Machinery Fuel
      if (fuelPerBottle > 0) {
        lcaMaterialsWithImpacts.push({
          ...vitBaseRow,
          name: '[Viticulture] Machinery Fuel',
          material_name: '[Viticulture] Machinery Fuel',
          impact_climate: fuelPerBottle,
          impact_climate_fossil: fuelPerBottle,
          impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 70,
          methodology: 'DEFRA 2025 fuel combustion factors',
          source_reference: `Diesel: ${viticultureProfile.diesel_litres_per_year} L/yr, Petrol: ${viticultureProfile.petrol_litres_per_year} L/yr. Total: ${vitResult.non_flag_emissions.machinery_fuel_co2e.toFixed(1)} kg CO2e / ${totalBottles.toFixed(0)} bottles`,
          data_quality_grade: vitResult.data_quality_grade,
        });
      }

      // Row 3: Irrigation
      if (irrigationPerBottle > 0 || waterPerBottle > 0) {
        lcaMaterialsWithImpacts.push({
          ...vitBaseRow,
          name: '[Viticulture] Irrigation',
          material_name: '[Viticulture] Irrigation',
          impact_climate: irrigationPerBottle,
          impact_climate_fossil: irrigationPerBottle,
          impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: waterPerBottle,
          impact_water_scarcity: waterScarcityPerBottle, // AWARE-weighted
          impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 60,
          methodology: 'DEFRA 2025 / grid emission factors',
          source_reference: `Irrigation: ${vitResult.water_m3.toFixed(0)} m3 water, ${viticultureProfile.irrigation_energy_source}. Energy: ${vitResult.non_flag_emissions.irrigation_energy_co2e.toFixed(1)} kg CO2e`,
          data_quality_grade: vitResult.data_quality_grade,
        });
      }

      // Row 4: Land Occupation
      lcaMaterialsWithImpacts.push({
        ...vitBaseRow,
        name: '[Viticulture] Land Occupation',
        material_name: '[Viticulture] Land Occupation',
        impact_climate: 0, // Land occupation itself has no direct climate impact
        impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
        ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
        impact_water: 0, impact_water_scarcity: 0,
        impact_land: landPerBottle,
        impact_waste: 0,
        impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
        impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
        confidence_score: 80,
        methodology: 'Direct land occupation measurement',
        source_reference: `Vineyard: ${viticultureProfile.area_ha} ha (${vitResult.flag_emissions.land_use_m2.toFixed(0)} m2) / ${totalBottles.toFixed(0)} bottles`,
        data_quality_grade: 'HIGH',
      });

      // Row 4b: Land Use Change (dLUC) — IPCC 2019, amortised over 20 years
      if (lucPerBottle > 0) {
        lcaMaterialsWithImpacts.push({
          ...vitBaseRow,
          name: '[Viticulture] Land Use Change (dLUC)',
          material_name: '[Viticulture] Land Use Change (dLUC)',
          impact_climate: lucPerBottle,
          impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: lucPerBottle,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 50,
          methodology: 'IPCC 2019 direct land use change, amortised 20 years',
          source_reference: `dLUC: ${vitResult.flag_emissions.luc_co2e.toFixed(1)} kg CO2e from ${vineyard?.previous_land_use_type || 'unknown'} conversion`,
          data_quality_grade: 'MEDIUM',
        });
      }

      // Row 5: Soil Carbon Removals (FLAG: separate from emissions)
      if (removalsPerBottle > 0) {
        lcaMaterialsWithImpacts.push({
          ...vitBaseRow,
          name: '[Viticulture Removals] Soil Carbon',
          material_name: '[Viticulture Removals] Soil Carbon',
          impact_climate: 0, // FLAG: removals NEVER stored in impact_climate
          impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          // FLAG-compliant: removals in dedicated column
          impact_removals_co2e: removalsPerBottle,
          confidence_score: vitResult.flag_removals.is_verified ? 75 : 45,
          methodology: `Soil carbon: ${vitResult.flag_removals.methodology}`,
          source_reference: `Soil management: ${viticultureProfile.soil_management}. Total removals: ${vitResult.total_removals.toFixed(1)} kg CO2e/yr (${vitResult.flag_removals.methodology}). Per bottle: ${removalsPerBottle.toFixed(4)} kg CO2e`,
          data_quality_grade: vitResult.flag_removals.is_verified ? 'MEDIUM' : 'LOW',
        });
      }

      console.log(`[calculateProductCarbonFootprint] ✓ Viticulture impacts: emissions=${vitResult.total_emissions.toFixed(1)} kg CO2e, removals=${vitResult.total_removals.toFixed(1)} kg CO2e (${vitResult.flag_removals.methodology}), per-kg=${vitResult.total_emissions_per_kg.toFixed(4)} kg CO2e/kg grapes`);
    }

    // ========================================================================
    // 5b. ORCHARD (Fruit Growing) — Self-grown fruit integration
    // ========================================================================
    //
    // Mirrors viticulture integration above. For producers who grow their own
    // fruit (e.g. apples for calvados/cider, pears for perry), the orchard
    // calculator computes field-level emissions from fertiliser N2O, machinery
    // fuel, irrigation, transport, and soil carbon removals.
    //
    // Conversion factors (kg fruit per litre finished product):
    //   Calvados / apple brandy: ~8 kg apples per litre (distillation concentration)
    //   Cider:                   ~1.5 kg apples per litre
    //   Perry:                   ~1.5 kg pears per litre
    //   Fruit wine:              ~1.3 kg fruit per litre (similar to grape wine)
    //   Fruit liqueur:           ~3 kg fruit per litre (maceration + sugar)
    //   Default:                 ~2 kg fruit per litre

    // Find orchard_id from self-grown ingredients linked to this product
    const { data: selfGrownOrchardIngredients } = await supabase
      .from('product_materials')
      .select('orchard_id')
      .eq('product_id', parseInt(productId))
      .eq('is_self_grown', true)
      .not('orchard_id', 'is', null);

    const orchardIds = Array.from(new Set(
      (selfGrownOrchardIngredients || []).map((m: any) => m.orchard_id).filter(Boolean)
    ));

    const orchardId = orchardIds[0]; // Process first linked orchard
    const { data: orchardProfiles } = orchardId
      ? await supabase
          .from('orchard_growing_profiles')
          .select('*, orchards(*)')
          .eq('orchard_id', orchardId)
          .order('harvest_year', { ascending: false })
      : { data: null };

    const orchardProfile = orchardProfiles?.[0];

    if (orchardProfile) {
      const orchard = orchardProfile.orchards as unknown as Orchard;
      const orchardProfileCount = orchardProfiles!.length;
      console.log(`[calculateProductCarbonFootprint] Processing orchard for "${orchard?.name || 'unknown'}" (${orchardProfileCount} harvest${orchardProfileCount > 1 ? 's' : ''})...`);

      // Resolve AWARE water scarcity factor for orchard country
      const orchardCountryCode = orchard?.location_country_code;
      let orchardAwareFactor = 1.0;
      if (orchardCountryCode) {
        const orchAwareData = await getAwareFactor(supabase, orchardCountryCode);
        if (orchAwareData) orchardAwareFactor = Number(orchAwareData.aware_factor);
      }

      // Build inputs for all available harvests
      const harvestInputs = orchardProfiles!.map((p: any) => ({
        harvest_year: p.harvest_year,
        input: {
          orchard_type: orchard?.orchard_type || 'apple',
          climate_zone: orchard?.climate_zone || 'temperate',
          certification: orchard?.certification || 'conventional',
          location_country_code: orchard?.location_country_code || null,
          aware_factor: orchardAwareFactor,
          area_ha: p.area_ha,
          soil_management: p.soil_management,
          pruning_residue_returned: p.pruning_residue_returned ?? true,
          fertiliser_type: p.fertiliser_type,
          fertiliser_quantity_kg: p.fertiliser_quantity_kg,
          fertiliser_n_content_percent: p.fertiliser_n_content_percent,
          uses_pesticides: p.uses_pesticides,
          pesticide_applications_per_year: p.pesticide_applications_per_year,
          pesticide_type: p.pesticide_type || 'generic',
          uses_herbicides: p.uses_herbicides,
          herbicide_applications_per_year: p.herbicide_applications_per_year,
          herbicide_type: p.herbicide_type || 'generic',
          diesel_litres_per_year: p.diesel_litres_per_year,
          petrol_litres_per_year: p.petrol_litres_per_year,
          is_irrigated: p.is_irrigated,
          water_m3_per_ha: p.water_m3_per_ha,
          irrigation_energy_source: p.irrigation_energy_source,
          fruit_yield_tonnes: p.fruit_yield_tonnes,
          transport_distance_km: p.transport_distance_km || 0,
          transport_mode: p.transport_mode || 'road',
          soil_carbon_override_kg_co2e_per_ha: p.soil_carbon_override_kg_co2e_per_ha,
          previous_land_use_type: orchard?.previous_land_use_type,
          land_conversion_year: orchard?.land_conversion_year,
          harvest_year: p.harvest_year,
          removal_verification_status: (p as any).removal_verification_status ?? 'unverified',
          removal_verifier_body: (p as any).removal_verifier_body,
          removal_verifier_standard: (p as any).removal_verifier_standard,
          removal_verification_date: (p as any).removal_verification_date,
          removal_verification_expiry: (p as any).removal_verification_expiry,
          ecosystem_type: (p as any).ecosystem_type ?? undefined,
          in_biodiversity_sensitive_area: (p as any).in_biodiversity_sensitive_area ?? false,
          sensitive_area_details: (p as any).sensitive_area_details ?? undefined,
          water_stress_index: (p as any).water_stress_index ?? undefined,
        },
      }));

      // Multi-harvest averaging (median for 3+, mean for 2, single for 1)
      const multiHarvestResult = calculateMultiHarvestAverage(harvestInputs);
      const orchResult = multiHarvestResult.averaged_impacts;
      const harvestNote = orchardProfileCount > 1
        ? ` (${multiHarvestResult.method}: harvests ${multiHarvestResult.harvests_used.join(', ')})`
        : '';

      // --- Per-unit allocation ---
      // Orchard impacts are computed for the entire orchard area.
      // Normalise to per-unit using fruit yield and product-specific conversion.
      const rawUnitSize = product.unit_size_unit === 'ml'
        ? Number(product.unit_size_value) / 1000.0
        : Number(product.unit_size_value || 0.75);
      const unitSizeLitres = rawUnitSize > 0 ? rawUnitSize : 0.75;

      // Fruit-to-product conversion factor (kg fruit per litre finished product)
      // Determined by product type and production process.
      const FRUIT_CONVERSION_FACTORS: Record<string, number> = {
        spirits: 8.0,    // Calvados, fruit brandy: ~8 kg apples per litre (distillation)
        cider: 1.5,      // Cider/perry: ~1.5 kg fruit per litre
        wine: 1.3,       // Fruit wine: ~1.3 kg per litre (similar to grape)
        liqueur: 3.0,    // Fruit liqueur: ~3 kg per litre (maceration)
      };
      const productType = (product.product_type || '').toLowerCase();
      let fruitKgPerLitre = FRUIT_CONVERSION_FACTORS[productType] || 2.0; // Default 2 kg/L

      // Refine for specific spirit subtypes
      if (productType === 'spirits' || productType.includes('spirit')) {
        // Calvados and apple/pear brandy use high fruit concentration
        const productName = (product.name || '').toLowerCase();
        if (productName.includes('calvados') || productName.includes('brandy')) {
          fruitKgPerLitre = 8.0;
        } else if (productName.includes('liqueur')) {
          fruitKgPerLitre = 3.0;
        }
      }
      // Beer & Cider category
      if (productType.includes('cider') || productType.includes('beer')) {
        fruitKgPerLitre = 1.5;
      }

      const fruitKgPerUnit = unitSizeLitres * fruitKgPerLitre;
      const totalUnits = (orchardProfile.fruit_yield_tonnes * 1000) / fruitKgPerUnit;

      // Per-unit impact factors
      const orchFertFieldPerUnit = totalUnits > 0
        ? (orchResult.flag_emissions.total_flag_co2e + orchResult.non_flag_emissions.fertiliser_production_co2e) / totalUnits
        : 0;
      const orchFuelPerUnit = totalUnits > 0
        ? orchResult.non_flag_emissions.machinery_fuel_co2e / totalUnits
        : 0;
      const orchIrrigationPerUnit = totalUnits > 0
        ? orchResult.non_flag_emissions.irrigation_energy_co2e / totalUnits
        : 0;
      const orchTransportPerUnit = totalUnits > 0
        ? orchResult.non_flag_emissions.transport_co2e / totalUnits
        : 0;
      const orchWaterPerUnit = totalUnits > 0
        ? orchResult.water_m3 / totalUnits
        : 0;
      const orchWaterScarcityPerUnit = totalUnits > 0
        ? orchResult.water_scarcity_m3_eq / totalUnits
        : 0;
      const orchLandPerUnit = totalUnits > 0
        ? orchResult.flag_emissions.land_use_m2 / totalUnits
        : 0;
      const orchRemovalsPerUnit = totalUnits > 0
        ? orchResult.total_removals / totalUnits
        : 0;
      const orchPesticidePerUnit = totalUnits > 0
        ? orchResult.non_flag_emissions.pesticide_production_co2e / totalUnits
        : 0;
      const orchN2oKgPerUnit = totalUnits > 0
        ? orchResult.n2o_kg / totalUnits
        : 0;
      const orchLucPerUnit = totalUnits > 0
        ? orchResult.flag_emissions.luc_co2e / totalUnits
        : 0;

      console.log(`[calculateProductCarbonFootprint] Orchard per-unit: ${totalUnits.toFixed(0)} units (${fruitKgPerLitre} kg fruit/L), fert+N2O=${orchFertFieldPerUnit.toFixed(4)}, fuel=${orchFuelPerUnit.toFixed(4)}, transport=${orchTransportPerUnit.toFixed(4)}, removals=${orchRemovalsPerUnit.toFixed(4)}`);

      // Synthetic row template (shared fields)
      const orchBaseRow = {
        product_carbon_footprint_id: lca.id,
        material_type: 'ingredient' as const,
        quantity: unitSizeLitres,
        unit: 'L',
        unit_name: 'L',
        packaging_category: null,
        origin_country: orchard?.address_country || null,
        country_of_origin: orchard?.address_country || null,
        is_organic: orchard?.certification === 'organic' || orchard?.certification === 'biodynamic',
        is_organic_certified: orchard?.certification === 'organic',
        supplier_product_id: null,
        data_source: null,
        data_source_id: null,
        transport_mode: null,
        distance_km: null,
        impact_transport: 0,
        origin_address: null,
        origin_lat: orchard?.address_lat || null,
        origin_lng: orchard?.address_lng || null,
        origin_country_code: orchard?.location_country_code || null,
        data_priority: 2 as const,
        data_quality_tag: 'Secondary_Modelled' as const,
        supplier_lca_id: null,
        impact_source: 'secondary_modelled' as const,
        impact_reference_id: null,
        gwp_data_source: 'IPCC 2019 Tier 1 / DEFRA 2025',
        non_gwp_data_source: 'IPCC 2019 Tier 1 / DEFRA 2025',
        is_hybrid_source: false,
        category_type: 'MANUFACTURING_MATERIAL',
      };

      // Row 1: Fertiliser & Field Emissions (N2O + production)
      lcaMaterialsWithImpacts.push({
        ...orchBaseRow,
        name: '[Orchard] Fertiliser & Field Emissions',
        material_name: '[Orchard] Fertiliser & Field Emissions',
        impact_climate: orchFertFieldPerUnit + orchPesticidePerUnit,
        impact_climate_fossil: orchFertFieldPerUnit * 0.95 + orchPesticidePerUnit,
        impact_climate_biogenic: 0,
        impact_climate_dluc: 0,
        ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0,
        n2o_kg: orchN2oKgPerUnit,
        impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
        impact_freshwater_ecotoxicity: totalUnits > 0 ? orchResult.freshwater_ecotoxicity / totalUnits : 0,
        impact_terrestrial_ecotoxicity: totalUnits > 0 ? orchResult.terrestrial_ecotoxicity / totalUnits : 0,
        impact_human_toxicity_non_carcinogenic: totalUnits > 0 ? orchResult.human_toxicity_non_carcinogenic / totalUnits : 0,
        impact_freshwater_eutrophication: totalUnits > 0 ? orchResult.freshwater_eutrophication / totalUnits : 0,
        impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
        confidence_score: 65,
        methodology: orchResult.methodology_notes,
        source_reference: `Fertiliser: ${orchResult.flag_emissions.n2o_direct_co2e.toFixed(1)} kg CO2e direct N2O + ${orchResult.flag_emissions.n2o_indirect_co2e.toFixed(1)} kg indirect + ${orchResult.non_flag_emissions.fertiliser_production_co2e.toFixed(1)} kg production${harvestNote}`,
        data_quality_grade: orchResult.data_quality_grade,
      });

      // Row 2: Machinery Fuel
      if (orchFuelPerUnit > 0) {
        lcaMaterialsWithImpacts.push({
          ...orchBaseRow,
          name: '[Orchard] Machinery Fuel',
          material_name: '[Orchard] Machinery Fuel',
          impact_climate: orchFuelPerUnit,
          impact_climate_fossil: orchFuelPerUnit,
          impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 70,
          methodology: 'DEFRA 2025 fuel combustion factors',
          source_reference: `Diesel: ${orchardProfile.diesel_litres_per_year} L/yr, Petrol: ${orchardProfile.petrol_litres_per_year} L/yr. Total: ${orchResult.non_flag_emissions.machinery_fuel_co2e.toFixed(1)} kg CO2e / ${totalUnits.toFixed(0)} units`,
          data_quality_grade: orchResult.data_quality_grade,
        });
      }

      // Row 3: Irrigation
      if (orchIrrigationPerUnit > 0 || orchWaterPerUnit > 0) {
        lcaMaterialsWithImpacts.push({
          ...orchBaseRow,
          name: '[Orchard] Irrigation',
          material_name: '[Orchard] Irrigation',
          impact_climate: orchIrrigationPerUnit,
          impact_climate_fossil: orchIrrigationPerUnit,
          impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: orchWaterPerUnit,
          impact_water_scarcity: orchWaterScarcityPerUnit, // AWARE-weighted
          impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 60,
          methodology: 'DEFRA 2025 / grid emission factors',
          source_reference: `Irrigation: ${orchResult.water_m3.toFixed(0)} m3 water, ${orchardProfile.irrigation_energy_source}. Energy: ${orchResult.non_flag_emissions.irrigation_energy_co2e.toFixed(1)} kg CO2e`,
          data_quality_grade: orchResult.data_quality_grade,
        });
      }

      // Row 4: Transport (orchard to processing facility)
      if (orchTransportPerUnit > 0) {
        lcaMaterialsWithImpacts.push({
          ...orchBaseRow,
          name: '[Orchard] Transport to Facility',
          material_name: '[Orchard] Transport to Facility',
          impact_climate: orchTransportPerUnit,
          impact_climate_fossil: orchTransportPerUnit,
          impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 70,
          methodology: 'DEFRA 2024 tonne-km factors',
          source_reference: `Transport: ${orchardProfile.transport_distance_km || 0} km by ${orchardProfile.transport_mode || 'road'}. ${orchResult.non_flag_emissions.transport_co2e.toFixed(1)} kg CO2e / ${totalUnits.toFixed(0)} units`,
          data_quality_grade: orchResult.data_quality_grade,
        });
      }

      // Row 5: Land Occupation
      lcaMaterialsWithImpacts.push({
        ...orchBaseRow,
        name: '[Orchard] Land Occupation',
        material_name: '[Orchard] Land Occupation',
        impact_climate: 0,
        impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
        ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
        impact_water: 0, impact_water_scarcity: 0,
        impact_land: orchLandPerUnit,
        impact_waste: 0,
        impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
        impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
        confidence_score: 80,
        methodology: 'Direct land occupation measurement',
        source_reference: `Orchard: ${orchardProfile.area_ha} ha (${orchResult.flag_emissions.land_use_m2.toFixed(0)} m2) / ${totalUnits.toFixed(0)} units`,
        data_quality_grade: 'HIGH',
      });

      // Row 5b: Land Use Change (dLUC) — IPCC 2019, amortised over 20 years
      if (orchLucPerUnit > 0) {
        lcaMaterialsWithImpacts.push({
          ...orchBaseRow,
          name: '[Orchard] Land Use Change (dLUC)',
          material_name: '[Orchard] Land Use Change (dLUC)',
          impact_climate: orchLucPerUnit,
          impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: orchLucPerUnit,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 50,
          methodology: 'IPCC 2019 direct land use change, amortised 20 years',
          source_reference: `dLUC: ${orchResult.flag_emissions.luc_co2e.toFixed(1)} kg CO2e from ${orchard?.previous_land_use_type || 'unknown'} conversion`,
          data_quality_grade: 'MEDIUM',
        });
      }

      // Row 6: Soil Carbon Removals (FLAG: separate from emissions)
      if (orchRemovalsPerUnit > 0) {
        lcaMaterialsWithImpacts.push({
          ...orchBaseRow,
          name: '[Orchard Removals] Soil Carbon',
          material_name: '[Orchard Removals] Soil Carbon',
          impact_climate: 0, // FLAG: removals NEVER stored in impact_climate
          impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          impact_removals_co2e: orchRemovalsPerUnit,
          confidence_score: orchResult.flag_removals.is_verified ? 75 : 45,
          methodology: `Soil carbon: ${orchResult.flag_removals.methodology}`,
          source_reference: `Soil management: ${orchardProfile.soil_management}. Total removals: ${orchResult.total_removals.toFixed(1)} kg CO2e/yr (${orchResult.flag_removals.methodology}). Per unit: ${orchRemovalsPerUnit.toFixed(4)} kg CO2e`,
          data_quality_grade: orchResult.flag_removals.is_verified ? 'MEDIUM' : 'LOW',
        });
      }

      console.log(`[calculateProductCarbonFootprint] ✓ Orchard impacts: emissions=${orchResult.total_emissions.toFixed(1)} kg CO2e, removals=${orchResult.total_removals.toFixed(1)} kg CO2e (${orchResult.flag_removals.methodology}), transport=${orchResult.non_flag_emissions.transport_co2e.toFixed(1)} kg CO2e, per-kg=${orchResult.total_emissions_per_kg.toFixed(4)} kg CO2e/kg fruit`);
    }

    // 6. Insert all materials with impact values into product_lca_materials
    // Ensure every row has impact_removals_co2e set (NOT NULL column, DEFAULT 0).
    // The Supabase JS client sends undefined as null which violates the constraint.
    const materialsWithDefaults = lcaMaterialsWithImpacts.map((m: any) => ({
      ...m,
      impact_removals_co2e: m.impact_removals_co2e ?? 0,
    }));

    const { error: insertError } = await supabase
      .from('product_carbon_footprint_materials')
      .insert(materialsWithDefaults);

    if (insertError) {
      // Clean up
      await supabase.from('product_carbon_footprints').delete().eq('id', lca.id);
      throw new Error(`Failed to insert materials: ${insertError.message}`);
    }

    console.log(`[calculateProductCarbonFootprint] Inserted ${lcaMaterialsWithImpacts.length} materials into database`);

    // 7. Import current production site allocations
    // ALWAYS use fresh data from contract_manufacturer_allocations, not stale LCA data
    console.log(`[calculateProductCarbonFootprint] Loading current production site allocations for product ${productId}...`);

    const { data: cmAllocations, error: cmError } = await supabase
      .from('contract_manufacturer_allocations')
      .select('*')
      .eq('product_id', parseInt(productId))
      .eq('organization_id', product.organization_id)
      .order('reporting_period_start', { ascending: false });

    if (cmError) {
      console.error('[calculateProductCarbonFootprint] ❌ Failed to query contract manufacturer allocations');
      console.error('[calculateProductCarbonFootprint] Error details:', cmError);
      console.error('[calculateProductCarbonFootprint] This might indicate:');
      console.error('[calculateProductCarbonFootprint]   - RLS policy blocking access');
      console.error('[calculateProductCarbonFootprint]   - Database connection issue');
      console.error('[calculateProductCarbonFootprint]   - Missing table/columns (run: supabase db reset --local)');

      throw new Error(`Failed to fetch production site data: ${cmError.message}`);
    }

    console.log(`[calculateProductCarbonFootprint] ✓ Contract manufacturer query successful`);
    console.log(`[calculateProductCarbonFootprint] Found ${cmAllocations?.length || 0} allocations for product ${productId}`);

    if (!cmAllocations || cmAllocations.length === 0) {
      console.warn('[calculateProductCarbonFootprint] ⚠️  No contract manufacturer allocations found');
      console.warn('[calculateProductCarbonFootprint] Expected at least 1 allocation for TEST CALVADOS');
      console.warn('[calculateProductCarbonFootprint] Check if migration 20251219165224 was applied: supabase db reset --local');
      console.warn('[calculateProductCarbonFootprint] Or create allocation manually in Production Sites tab');
    } else {
      console.log('[calculateProductCarbonFootprint] Allocation details:', cmAllocations.map(a => ({
        id: a.id,
        facility_id: a.facility_id,
        emissions: a.allocated_emissions_kg_co2e,
        scope1: a.scope1_emissions_kg_co2e,
        scope2: a.scope2_emissions_kg_co2e,
        status: a.status
      })));
    }

    if (cmAllocations && cmAllocations.length > 0) {
      // Contract manufacturer allocations stay in their own table
      // The Edge Function will read from both product_lca_production_sites AND contract_manufacturer_allocations
      console.log(`[calculateProductCarbonFootprint] Found ${cmAllocations.length} contract manufacturer allocations`);
      console.log(`[calculateProductCarbonFootprint] These will be read directly by the Edge Function from contract_manufacturer_allocations table`);
      console.log('[calculateProductCarbonFootprint] Contract manufacturers:', cmAllocations.map(a => ({
        facility_id: a.facility_id,
        emissions: a.allocated_emissions_kg_co2e,
        scope1: a.scope1_emissions_kg_co2e,
        scope2: a.scope2_emissions_kg_co2e,
        status: a.status
      })));

      const totalAllocationEmissions = cmAllocations.reduce((sum, a) => sum + (a.allocated_emissions_kg_co2e || 0), 0);
      console.log(`[calculateProductCarbonFootprint] Total contract manufacturer emissions: ${totalAllocationEmissions.toFixed(2)} kg CO2e`);
    } else {
      console.log(`[calculateProductCarbonFootprint] No contract manufacturer allocations found for this product`);
    }

    // Verify data sources are available
    console.log('[calculateProductCarbonFootprint] 🔍 Verifying production data sources...');

    // Check owned production sites
    const { data: ownedSitesData, error: ownedVerifyError } = await supabase
      .from('product_carbon_footprint_production_sites')
      .select('id, facility_id, allocated_emissions_kg_co2e, scope1_emissions_kg_co2e, scope2_emissions_kg_co2e')
      .eq('product_carbon_footprint_id', lca.id);

    if (ownedVerifyError) {
      console.error('[calculateProductCarbonFootprint] ❌ Failed to verify owned sites:', ownedVerifyError);
    } else {
      const ownedEmissions = (ownedSitesData || []).reduce((sum, s) => sum + (s.allocated_emissions_kg_co2e || 0), 0);
      console.log(`[calculateProductCarbonFootprint] Owned production sites: ${ownedSitesData?.length || 0} (${ownedEmissions.toFixed(2)} kg CO2e)`);
    }

    // Check contract manufacturer allocations
    const cmEmissions = (cmAllocations || []).reduce((sum, a) => sum + (a.allocated_emissions_kg_co2e || 0), 0);
    console.log(`[calculateProductCarbonFootprint] Contract manufacturers: ${cmAllocations?.length || 0} (${cmEmissions.toFixed(2)} kg CO2e)`);

    const totalSites = (ownedSitesData?.length || 0) + (cmAllocations?.length || 0);
    const totalEmissions = ((ownedSitesData || []).reduce((sum, s) => sum + (s.allocated_emissions_kg_co2e || 0), 0)) + cmEmissions;

    if (totalSites > 0) {
      console.log(`[calculateProductCarbonFootprint] ✅ Total production sources: ${totalSites} (${totalEmissions.toFixed(2)} kg CO2e)`);
      console.log('[calculateProductCarbonFootprint] Edge Function will read from both tables');
    } else {
      console.warn('[calculateProductCarbonFootprint] ⚠️  No production sites or contract manufacturers found');
      console.warn('[calculateProductCarbonFootprint] Processing emissions will be zero unless manually entered');
    }

    // 8. Run aggregation to calculate totals (client-side, no edge function needed)
    onProgress?.('Aggregating lifecycle impacts...', 75);
    console.log(`[calculateProductCarbonFootprint] Calling aggregation engine...`);

    // 8a. Finalise pending fallback events with actual resolution data.
    // Events pushed by the waterfall resolver have resolved_priority=0; update them
    // with the final resolved priority and factor value from the material that was saved.
    for (const evt of fallbackEvents) {
      if (evt.resolved_priority === 0) {
        const mat = lcaMaterialsWithImpacts.find((m: any) => m.material_name === evt.material_name);
        if (mat) {
          evt.resolved_priority = mat.data_priority || 3;
          evt.factor_value_kg_co2e = mat.quantity > 0 ? mat.impact_climate / mat.quantity : 0;
          evt.source_reference = mat.source_reference || '';
        }
      }
    }

    // 8b. Build per-material resolution snapshot for fingerprinting and audit
    const materialResolutions = lcaMaterialsWithImpacts.map((m: any) => ({
      name: m.material_name,
      quantity_kg: m.quantity,
      impact_climate_per_kg: m.quantity > 0 ? m.impact_climate / m.quantity : 0,
      priority_resolved: m.data_priority,
      source: m.source_reference,
      confidence: m.confidence_score,
      gwp_data_source: m.gwp_data_source,
    }));

    // 8c. Generate calculation fingerprint for determinism verification
    let calculationFingerprint = '';
    try {
      calculationFingerprint = await generateCalculationFingerprint({
        materials: materials.map(m => ({
          name: m.material_name,
          quantity_kg: normalizeToKg(m.quantity, m.unit),
          data_source_id: m.data_source_id,
        })),
        factorValues: materialResolutions.map((r: any) => ({
          name: r.name,
          impact_climate_per_kg: r.impact_climate_per_kg,
          gwp_data_source: r.gwp_data_source,
        })),
        facilityAllocations: params.facilityAllocations,
        systemBoundary: systemBoundary || 'cradle-to-gate',
        referenceYear: referenceYear || new Date().getFullYear(),
      });
      console.log(`[calculateProductCarbonFootprint] Calculation fingerprint: ${calculationFingerprint.slice(0, 16)}...`);
    } catch (fpErr) {
      console.warn('[calculateProductCarbonFootprint] Fingerprint generation failed (non-fatal):', fpErr);
    }

    console.log(`[calculateProductCarbonFootprint] Passing ${collectedFacilityEmissions.length} facility emissions to aggregator (boundary: ${systemBoundary || 'cradle-to-gate'})`);
    const aggregationResult = await aggregateProductImpacts(
      supabase,
      lca.id,
      collectedFacilityEmissions,
      systemBoundary,
      params.usePhaseConfig,
      params.eolConfig,
      params.distributionConfig,
      params.productLossConfig,
      calculationFingerprint,
      fallbackEvents,
      materialResolutions,
      referenceYear,
    );

    if (!aggregationResult.success) {
      console.error('[calculateProductCarbonFootprint] Aggregation error:', aggregationResult.error);
      throw new Error(`Calculation failed: ${aggregationResult.error}`);
    }

    console.log(`[calculateProductCarbonFootprint] ✓ Calculation complete for LCA: ${lca.id}`);

    // 8d. Write to immutable calculation audit log (LOW FIX #23).
    //
    // ISO 14067 §6.5.6 and GHG Protocol Product Standard Annex B require that
    // calculation parameters are retained to enable third-party verification.
    // The calculation_logs table is append-only (UPDATE/DELETE are blocked by DB triggers).
    //
    // AUDITABILITY FIX: Collect resolved_factor_id from each material's waterfall
    // result for full factor traceability. Every return path in resolveImpactFactors
    // now sets resolved_factor_id to the actual DB record UUID used, eliminating
    // the previous sentinel placeholder.
    try {
      const factorIdsUsed = lcaMaterialsWithImpacts
        .map((m: any) => m.resolved?.resolved_factor_id || m.resolved_factor_id)
        .filter((id: string | undefined): id is string => !!id);
      // Deduplicate and fall back to a descriptive marker if no IDs were collected
      const uniqueFactorIds = Array.from(new Set(factorIdsUsed));
      if (uniqueFactorIds.length === 0) {
        console.warn(`[calculateProductCarbonFootprint] ⚠ No resolved_factor_id found on any material — factor traceability gap. Skipping audit log (factor_ids_used requires valid UUIDs).`);
      } else {
      const { error: auditErr } = await supabase
        .from('calculation_logs')
        .insert({
          organization_id: product.organization_id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          calculation_id: null, // FK references calculated_emissions, not product_carbon_footprints
          input_data: {
            product_id: productId,
            product_carbon_footprint_id: lca.id,
            product_name: product.name,
            system_boundary: systemBoundary || 'cradle-to-gate',
            reference_year: referenceYear || new Date().getFullYear(),
            materials_count: lcaMaterialsWithImpacts.length,
            facility_allocations_count: facilityAllocations?.length || 0,
            calculation_fingerprint: calculationFingerprint || null,
            pinned_from_pcf_id: params.pinnedPcfId || null,
            material_resolutions: materialResolutions,
            fallback_events: fallbackEvents.length > 0 ? fallbackEvents : undefined,
          },
          output_value: aggregationResult.total_carbon_footprint,
          output_unit: 'kg CO2e per functional unit',
          methodology_version: 'ISO 14067:2018 / GHG Protocol Product v2.1.0',
          factor_ids_used: uniqueFactorIds,
          data_quality_tier: aggregationResult.impacts?.data_quality?.score >= 80 ? 1
            : aggregationResult.impacts?.data_quality?.score >= 50 ? 2 : 3,
          multiplication_proof: `${aggregationResult.total_carbon_footprint.toFixed(6)} kg CO2e = sum of ${lcaMaterialsWithImpacts.length} materials`,
        });
      if (auditErr) {
        // Non-fatal: audit log failure should never abort a successful calculation
        console.warn(`[calculateProductCarbonFootprint] ⚠️ Audit log write failed (non-fatal): ${auditErr.message}`);
      } else {
        console.log(`[calculateProductCarbonFootprint] ✓ Audit log written for LCA ${lca.id}`);
      }
      }
    } catch (auditWriteErr: any) {
      console.warn(`[calculateProductCarbonFootprint] ⚠️ Audit log write exception (non-fatal): ${auditWriteErr.message}`);
    }

    // 9. Auto-generate Life Cycle Interpretation (ISO 14044 Section 4.5)
    try {
      onProgress?.('Generating life cycle interpretation...', 90);
      console.log(`[calculateProductCarbonFootprint] Generating Life Cycle Interpretation...`);
      const interpretationResult = await generateLcaInterpretation(supabase, {
        productCarbonFootprintId: lca.id,
        organizationId: product.organization_id,
      });
      if (interpretationResult.success) {
        console.log(`[calculateProductCarbonFootprint] ✓ Interpretation generated successfully`);
      } else {
        console.warn(`[calculateProductCarbonFootprint] ⚠ Interpretation generation failed: ${interpretationResult.error}`);
      }
    } catch (interpError: any) {
      console.warn(`[calculateProductCarbonFootprint] ⚠ Non-critical: Interpretation generation error: ${interpError.message}`);
    }

    onProgress?.('Calculation complete', 100);

    return {
      success: true,
      pcfId: lca.id,
      lcaId: lca.id // backward compatibility
    };

  } catch (error: any) {
    console.error('[calculateProductCarbonFootprint] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to calculate Product Carbon Footprint'
    };
  }
}

/** @deprecated Use calculateProductCarbonFootprint instead */
export const calculateProductLCA = calculateProductCarbonFootprint;
