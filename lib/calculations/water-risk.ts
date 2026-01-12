/**
 * Water Risk Calculation Service
 *
 * Single source of truth for water-related calculations across the platform.
 * Ensures consistency between Dashboard, Company Vitality, and Water pages.
 *
 * Based on AWARE (Available Water Remaining) methodology:
 * - https://wulca-waterlca.org/aware/
 *
 * AWARE factor interpretation:
 * - 1.0 = World average water availability
 * - > 1 = Less water available than average (higher stress)
 * - < 1 = More water available than average (lower stress)
 * - > 10 = Extremely water-stressed regions
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// CONSTANTS - Single source of truth for thresholds
// ============================================================================

/**
 * Risk level thresholds based on AWARE methodology
 * Must match the database thresholds in facility_water_data and aware_factors tables
 */
export const WATER_RISK_THRESHOLDS = {
  HIGH: 10,    // AWARE factor >= 10 = high water stress
  MEDIUM: 1,   // AWARE factor >= 1 = medium water stress (above world average)
  // LOW: < 1   // AWARE factor < 1 = low water stress (below world average)
} as const;

/**
 * Default AWARE factor for unknown locations
 * Uses world average baseline
 */
export const DEFAULT_AWARE_FACTOR = 1.0;

// ============================================================================
// TYPES
// ============================================================================

export type WaterRiskLevel = 'high' | 'medium' | 'low';

export interface AwareFactor {
  country_code: string;
  country_name: string;
  region: string;
  sub_region?: string;
  aware_factor: number;
  baseline_water_stress: number;
  risk_level: WaterRiskLevel;
}

export interface FacilityWaterRisk {
  facility_id: string;
  facility_name: string;
  location_country_code: string;
  water_scarcity_aware: number;
  risk_level: WaterRiskLevel;
  latitude?: number;
  longitude?: number;
  // Operational water (direct facility consumption)
  operational_water_intake_m3: number;
  operational_water_discharge_m3: number;
  operational_net_consumption_m3: number;
  // Embedded water (supply chain footprint)
  product_lca_water_m3: number;
  // Scarcity-weighted consumption
  scarcity_weighted_consumption_m3: number;
  // Production metrics
  production_volume: number;
  products_linked: string[];
  has_operational_data: boolean;
}

export interface WaterRiskSummary {
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  total_facilities: number;
  overall_risk_level: WaterRiskLevel;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Determines risk level based on AWARE factor
 * Uses thresholds consistent with database calculations
 */
export function calculateRiskLevel(awareFactor: number): WaterRiskLevel {
  if (awareFactor >= WATER_RISK_THRESHOLDS.HIGH) return 'high';
  if (awareFactor >= WATER_RISK_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Fetches AWARE factor for a country from the database
 * Returns the factor and related metadata
 */
export async function getAwareFactor(
  supabase: SupabaseClient,
  countryCode: string
): Promise<AwareFactor | null> {
  if (!countryCode) return null;

  const { data, error } = await supabase
    .from('aware_factors')
    .select('*')
    .eq('country_code', countryCode.toUpperCase())
    .maybeSingle();

  if (error) {
    console.error(`Error fetching AWARE factor for ${countryCode}:`, error);
    return null;
  }

  return data;
}

/**
 * Fetches AWARE factors for multiple countries in a single query
 * More efficient than multiple individual lookups
 */
export async function getAwareFactors(
  supabase: SupabaseClient,
  countryCodes: string[]
): Promise<Map<string, AwareFactor>> {
  const result = new Map<string, AwareFactor>();
  if (countryCodes.length === 0) return result;

  const uniqueCodes = Array.from(new Set(countryCodes.map(c => c.toUpperCase())));

  const { data, error } = await supabase
    .from('aware_factors')
    .select('*')
    .in('country_code', uniqueCodes);

  if (error) {
    console.error('Error fetching AWARE factors:', error);
    return result;
  }

  (data || []).forEach((factor: AwareFactor) => {
    result.set(factor.country_code, factor);
  });

  return result;
}

/**
 * Gets the AWARE factor value for a country, with fallback to default
 */
export async function getAwareFactorValue(
  supabase: SupabaseClient,
  countryCode: string | undefined | null
): Promise<number> {
  if (!countryCode) return DEFAULT_AWARE_FACTOR;

  const factor = await getAwareFactor(supabase, countryCode);
  return factor?.aware_factor ?? DEFAULT_AWARE_FACTOR;
}

/**
 * Calculates scarcity-weighted water consumption
 * Multiplies water volume by AWARE factor to get "world-equivalent" consumption
 */
export function calculateScarcityWeighted(
  waterM3: number,
  awareFactor: number
): number {
  return waterM3 * awareFactor;
}

/**
 * Determines overall risk level for an organization based on facility risk distribution
 */
export function calculateOverallRiskLevel(
  highRiskCount: number,
  mediumRiskCount: number,
  lowRiskCount: number
): WaterRiskLevel {
  // If any high-risk facilities, overall is high
  if (highRiskCount > 0) return 'high';
  // If any medium-risk facilities, overall is medium
  if (mediumRiskCount > 0) return 'medium';
  return 'low';
}

/**
 * Calculates water risks for all facilities in an organization
 * Consolidates operational water and embedded water data
 */
export async function calculateFacilityWaterRisks(
  supabase: SupabaseClient,
  organizationId: string
): Promise<FacilityWaterRisk[]> {
  // Fetch facilities
  const { data: facilities, error: facilitiesError } = await supabase
    .from('facilities')
    .select('id, name, location_country_code, address_lat, address_lng')
    .eq('organization_id', organizationId);

  if (facilitiesError) {
    console.error('Error fetching facilities:', facilitiesError);
    throw facilitiesError;
  }

  if (!facilities || facilities.length === 0) {
    return [];
  }

  // Fetch AWARE factors for all facility countries
  const countryCodes = facilities
    .map(f => f.location_country_code)
    .filter(Boolean) as string[];
  const awareFactorsMap = await getAwareFactors(supabase, countryCodes);

  // Fetch operational water data from facility_activity_entries
  const { data: activityEntries, error: activityError } = await supabase
    .from('facility_activity_entries')
    .select('facility_id, water_intake, water_discharge, water_recycled')
    .in('facility_id', facilities.map(f => f.id));

  if (activityError) {
    console.error('Error fetching facility activity entries:', activityError);
    // Continue with empty data rather than failing completely
  }

  // Aggregate operational water per facility
  const operationalWaterMap = new Map<string, {
    intake: number;
    discharge: number;
    recycled: number;
  }>();

  (activityEntries || []).forEach((entry: any) => {
    if (!entry.facility_id) return;

    const current = operationalWaterMap.get(entry.facility_id) || {
      intake: 0,
      discharge: 0,
      recycled: 0,
    };

    current.intake += Number(entry.water_intake || 0);
    current.discharge += Number(entry.water_discharge || 0);
    current.recycled += Number(entry.water_recycled || 0);

    operationalWaterMap.set(entry.facility_id, current);
  });

  // Fetch embedded water from product LCA production sites
  const { data: productionSites, error: sitesError } = await supabase
    .from('product_lca_production_sites')
    .select(`
      facility_id,
      share_of_production_percent,
      production_volume,
      production_unit,
      product_lcas!inner(
        id,
        status,
        organization_id,
        aggregated_impacts,
        products(name)
      )
    `)
    .eq('product_lcas.organization_id', organizationId)
    .eq('product_lcas.status', 'completed');

  if (sitesError) {
    console.error('Error fetching production sites:', sitesError);
    // Continue with empty data
  }

  // Fetch embedded water from contract manufacturer allocations
  const { data: cmAllocations, error: cmError } = await supabase
    .from('contract_manufacturer_allocations')
    .select(`
      facility_id,
      allocated_water_litres,
      client_production_volume,
      products(name)
    `)
    .eq('organization_id', organizationId);

  if (cmError) {
    console.error('Error fetching CM allocations:', cmError);
    // Continue with empty data
  }

  // Aggregate embedded water per facility
  const embeddedWaterMap = new Map<string, {
    totalWater: number;
    totalProduction: number;
    products: string[];
  }>();

  (productionSites || []).forEach((site: any) => {
    const facilityId = site.facility_id;
    if (!facilityId) return;

    const lca = site.product_lcas;
    const waterPerUnit = lca?.aggregated_impacts?.water_consumption || 0;
    const prodVolume = Number(site.production_volume || 0);
    const sharePercent = (Number(site.share_of_production_percent || 100)) / 100;
    const productName = lca?.products?.name || 'Unknown';

    const waterForFacility = waterPerUnit * prodVolume * sharePercent;

    const current = embeddedWaterMap.get(facilityId) || {
      totalWater: 0,
      totalProduction: 0,
      products: [],
    };

    current.totalWater += waterForFacility;
    current.totalProduction += prodVolume * sharePercent;
    if (!current.products.includes(productName)) {
      current.products.push(productName);
    }

    embeddedWaterMap.set(facilityId, current);
  });

  (cmAllocations || []).forEach((allocation: any) => {
    const facilityId = allocation.facility_id;
    if (!facilityId) return;

    const waterLitres = Number(allocation.allocated_water_litres || 0);
    const waterM3 = waterLitres / 1000;
    const prodVolume = Number(allocation.client_production_volume || 0);
    const productName = allocation.products?.name || 'Unknown';

    const current = embeddedWaterMap.get(facilityId) || {
      totalWater: 0,
      totalProduction: 0,
      products: [],
    };

    current.totalWater += waterM3;
    current.totalProduction += prodVolume;
    if (!current.products.includes(productName)) {
      current.products.push(productName);
    }

    embeddedWaterMap.set(facilityId, current);
  });

  // Build facility water risk objects
  const risks: FacilityWaterRisk[] = facilities.map((facility: any) => {
    const countryCode = facility.location_country_code?.toUpperCase() || 'GLOBAL';
    const awareData = awareFactorsMap.get(countryCode);
    const awareFactor = awareData?.aware_factor ?? DEFAULT_AWARE_FACTOR;
    const riskLevel = calculateRiskLevel(awareFactor);

    // Operational water
    const opWater = operationalWaterMap.get(facility.id);
    const operationalIntake = opWater?.intake || 0;
    const operationalDischarge = opWater?.discharge || 0;
    const operationalNet = operationalIntake - operationalDischarge;
    const hasOperationalData = operationalIntake > 0 || operationalDischarge > 0;

    // Embedded water
    const embWater = embeddedWaterMap.get(facility.id);
    const productLcaWater = embWater?.totalWater || 0;

    // Scarcity-weighted (operational only - embedded should be weighted by origin)
    const scarcityWeighted = calculateScarcityWeighted(operationalNet, awareFactor);

    return {
      facility_id: facility.id,
      facility_name: facility.name || 'Unknown Facility',
      location_country_code: countryCode,
      water_scarcity_aware: awareFactor,
      risk_level: riskLevel,
      latitude: facility.address_lat ? parseFloat(facility.address_lat) : undefined,
      longitude: facility.address_lng ? parseFloat(facility.address_lng) : undefined,
      operational_water_intake_m3: operationalIntake,
      operational_water_discharge_m3: operationalDischarge,
      operational_net_consumption_m3: operationalNet,
      product_lca_water_m3: productLcaWater,
      scarcity_weighted_consumption_m3: scarcityWeighted,
      production_volume: embWater?.totalProduction || 0,
      products_linked: embWater?.products || [],
      has_operational_data: hasOperationalData,
    };
  });

  return risks;
}

/**
 * Calculates a summary of water risks for the organization
 */
export function summarizeWaterRisks(risks: FacilityWaterRisk[]): WaterRiskSummary {
  const highRiskCount = risks.filter(r => r.risk_level === 'high').length;
  const mediumRiskCount = risks.filter(r => r.risk_level === 'medium').length;
  const lowRiskCount = risks.filter(r => r.risk_level === 'low').length;

  return {
    high_risk_count: highRiskCount,
    medium_risk_count: mediumRiskCount,
    low_risk_count: lowRiskCount,
    total_facilities: risks.length,
    overall_risk_level: calculateOverallRiskLevel(highRiskCount, mediumRiskCount, lowRiskCount),
  };
}
