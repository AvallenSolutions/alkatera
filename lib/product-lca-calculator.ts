import { getSupabaseBrowserClient } from './supabase/browser-client';
import { resolveImpactFactors, normalizeToKg, type ProductMaterial } from './impact-waterfall-resolver';
import { calculateTransportEmissions, type TransportMode } from './utils/transport-emissions-calculator';
import { resolveImpactSource } from './utils/data-quality-mapper';
import { aggregateProductImpacts, type FacilityEmissionsData } from './product-lca-aggregator';
import { generateLcaInterpretation } from './lca-interpretation-engine';
import { calculateDistance } from './utils/distance-calculator';
import { calculateMaturationImpacts } from './maturation-calculator';
import type { MaturationProfile } from './types/maturation';
import { getGridFactor } from './grid-emission-factors';

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
        functional_unit: functionalUnit || `1 ${product.unit || 'unit'} of ${product.name}`,
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
        // IMPORTANT: This table and utility_data_entries can both contain water data for the
        // same facility/period. We must NOT add both to the same total — that would double-count.
        // Priority: facility_activity_entries (more granular, activity-specific) > utility_data_entries.
        // If activity entries exist for water, use them exclusively. If not, fall back to utility entries.
        const { data: waterEntries, error: waterError } = await supabase
          .from('facility_activity_entries')
          .select('activity_category, quantity, unit')
          .eq('facility_id', allocation.facilityId)
          .in('activity_category', ['water_intake', 'water_recycled'])
          .lte('reporting_period_start', allocation.reportingPeriodEnd)
          .gte('reporting_period_end', allocation.reportingPeriodStart);

        if (waterError) {
          console.warn(`[calculateProductCarbonFootprint] Failed to query water data for ${allocation.facilityName}:`, waterError);
        }

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
        // If both sources have data, log a warning — this indicates a data entry issue
        // where water was recorded in both tables for the same reporting period.
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

        const attributionRatio = allocation.productionVolume / allocation.facilityTotalProduction;
        const allocatedEmissions = facilityTotalEmissions * attributionRatio;
        const scope1Emissions = scope1Raw * attributionRatio;
        const scope2Emissions = scope2Raw * attributionRatio;

        // Track if we found verified facility data (from either source)
        const hasVerifiedFacilityData = facilityTotalEmissions > 0;

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

        // Extract water and waste from utility data
        const totalWater = totalWaterFromUtility;
        const totalWaste = 0; // Waste data not yet captured in utility_data_entries
        const allocatedWater = totalWater * attributionRatio;
        const allocatedWaste = totalWaste * attributionRatio;

        // Collect for aggregator (passed directly, bypasses broken DB trigger)
        const isContractManufacturer = allocation.operationalControl === 'third_party';
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
            total_facility_co2e_kg: facilityTotalEmissions,
            co2e_entry_method: hasVerifiedFacilityData ? 'direct' : 'direct',
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
            data_source_tag: hasVerifiedFacilityData ? 'Facility_Verified' : 'User_Input',
          };

          // Use upsert to handle existing allocations for same period
          const { error: insertError } = await supabase
            .from('contract_manufacturer_allocations')
            .upsert(cmAllocationRecord, {
              onConflict: 'product_id,facility_id,reporting_period_start,reporting_period_end'
            });

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
            data_source_tag: hasVerifiedFacilityData ? 'Facility_Verified' : 'User_Input',
            co2e_entry_method: 'Production Volume Allocation',
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

    for (const material of materials) {
      try {
        // Normalize quantity to kg
        const quantityKg = normalizeToKg(material.quantity, material.unit);

        console.log(`[calculateProductCarbonFootprint] Processing material: ${material.material_name} (${quantityKg} kg)`);
        console.log(`[calculateProductCarbonFootprint] Material OpenLCA data:`, {
          data_source: material.data_source,
          data_source_id: material.data_source_id,
          organization_id: product.organization_id,
        });

        // Apply waterfall logic to get impact factors
        // Pass organization ID to enable OpenLCA lookups (Priority 2.5)
        const resolved = await resolveImpactFactors(material as ProductMaterial, quantityKg, product.organization_id);

        // Calculate transport emissions if transport data is available
        let transportEmissions = 0;
        if (material.transport_mode && material.distance_km) {
          try {
            const transportResult = await calculateTransportEmissions({
              weightKg: quantityKg,
              distanceKm: Number(material.distance_km),
              transportMode: material.transport_mode as TransportMode
            });
            transportEmissions = transportResult.emissions;
            console.log(`[calculateProductCarbonFootprint] ✓ Transport emissions for ${material.material_name}: ${transportEmissions.toFixed(4)} kg CO2e (${material.transport_mode}, ${material.distance_km} km)`);
          } catch (error: any) {
            console.warn(`[calculateProductCarbonFootprint] ⚠ Failed to calculate transport emissions for ${material.material_name}:`, error.message);
          }
        }

        // ISO 14044 §4.3.4.2 — Physical allocation for shared packaging
        // Secondary/shipment/tertiary packaging serves multiple product units.
        // Divide all impacts by units_per_group to get the per-unit share.
        // Primary packaging (container/label/closure) always has units_per_group=1 (no-op).
        const unitsPerGroup = (
          material.material_type === 'packaging' &&
          material.packaging_category &&
          ['secondary', 'shipment', 'tertiary'].includes(material.packaging_category) &&
          (material as any).units_per_group &&
          Number((material as any).units_per_group) > 1
        ) ? Number((material as any).units_per_group) : 1;

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

          // Impact values
          impact_climate: resolved.impact_climate,
          impact_climate_fossil: resolved.impact_climate_fossil,
          impact_climate_biogenic: resolved.impact_climate_biogenic,
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
        };

        lcaMaterialsWithImpacts.push(lcaMaterial);

        const totalMaterialEmissions = resolved.impact_climate + transportEmissions;
        const allocationNote = unitsPerGroup > 1 ? ` (allocated ÷${unitsPerGroup} units)` : '';
        console.log(`[calculateProductCarbonFootprint] ✓ Resolved ${material.material_name}: ${resolved.impact_climate.toFixed(3)} kg CO2e + ${transportEmissions.toFixed(3)} kg transport = ${totalMaterialEmissions.toFixed(3)} kg CO2e total (Priority ${resolved.data_priority})${allocationNote}`);

      } catch (error: any) {
        console.error(`[calculateProductCarbonFootprint] ✗ Failed to resolve ${material.material_name}:`, error.message);

        // Clean up: delete the LCA record since we can't proceed
        await supabase.from('product_carbon_footprints').delete().eq('id', lca.id);

        throw new Error(`Missing emission data for material "${material.material_name}". ${error.message}`);
      }
    }

    // 5b. Check for maturation profile and calculate maturation impacts
    const { data: maturationProfile } = await supabase
      .from('maturation_profiles')
      .select('*')
      .eq('product_id', parseInt(productId))
      .maybeSingle();

    if (maturationProfile) {
      console.log(`[calculateProductCarbonFootprint] Processing maturation profile (${maturationProfile.barrel_type}, ${maturationProfile.aging_duration_months} months)...`);
      const matResult = calculateMaturationImpacts(maturationProfile as MaturationProfile);

      // --- Per-bottle allocation ---
      // Regular materials are already per-functional-unit (per bottle). Maturation
      // impacts must be normalized the same way so the aggregator sums correctly.
      const bottleSizeLitres = product.unit_size_unit === 'ml'
        ? Number(product.unit_size_value) / 1000.0
        : Number(product.unit_size_value || 0.75); // fallback 750ml

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

    // 6. Insert all materials with impact values into product_lca_materials
    const { error: insertError } = await supabase
      .from('product_carbon_footprint_materials')
      .insert(lcaMaterialsWithImpacts);

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

    console.log(`[calculateProductCarbonFootprint] Passing ${collectedFacilityEmissions.length} facility emissions to aggregator (boundary: ${systemBoundary || 'cradle-to-gate'})`);
    const aggregationResult = await aggregateProductImpacts(
      supabase,
      lca.id,
      collectedFacilityEmissions,
      systemBoundary,
      params.usePhaseConfig,
      params.eolConfig
    );

    if (!aggregationResult.success) {
      console.error('[calculateProductCarbonFootprint] Aggregation error:', aggregationResult.error);
      throw new Error(`Calculation failed: ${aggregationResult.error}`);
    }

    console.log(`[calculateProductCarbonFootprint] ✓ Calculation complete for LCA: ${lca.id}`);

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
