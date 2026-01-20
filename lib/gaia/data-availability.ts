// Gaia Data Availability Checker
// Determines what data exists for the current organization to power smart suggestions

import { supabase } from '@/lib/supabaseClient';

export interface DataAvailability {
  hasProductLCAs: boolean;
  hasCarbonFootprintData: boolean;
  hasFacilityData: boolean;
  hasSupplierData: boolean;
  hasWaterData: boolean;
  hasScope3Data: boolean;
  hasFleetData: boolean;
  vitalityScoreExists: boolean;
  productCount: number;
  productWithLcaCount: number;
  facilityCount: number;
  supplierCount: number;
  fleetVehicleCount: number;
  hasEmissionsData: boolean;
  scope1Total: number;
  scope2Total: number;
  scope3Total: number;
}

/**
 * Check what data is available for an organization
 * Used to generate smart suggestions and inform AI context
 */
export async function checkDataAvailability(
  organizationId: string
): Promise<DataAvailability> {
  // Run all checks in parallel for performance
  const [
    productStats,
    facilityStats,
    supplierStats,
    fleetStats,
    vitalityStats,
    emissionsStats,
    waterStats,
  ] = await Promise.all([
    checkProductData(organizationId),
    checkFacilityData(organizationId),
    checkSupplierData(organizationId),
    checkFleetData(organizationId),
    checkVitalityScore(organizationId),
    checkEmissionsData(organizationId),
    checkWaterData(organizationId),
  ]);

  const hasScope3Data =
    emissionsStats.scope3Total > 0 ||
    productStats.withLcaCount > 0 ||
    supplierStats.count > 0;

  return {
    hasProductLCAs: productStats.withLcaCount > 0,
    hasCarbonFootprintData: emissionsStats.hasEmissions,
    hasFacilityData: facilityStats.count > 0,
    hasSupplierData: supplierStats.count > 0,
    hasWaterData: waterStats.hasWaterData,
    hasScope3Data,
    hasFleetData: fleetStats.vehicleCount > 0,
    vitalityScoreExists: vitalityStats.exists,
    productCount: productStats.totalCount,
    productWithLcaCount: productStats.withLcaCount,
    facilityCount: facilityStats.count,
    supplierCount: supplierStats.count,
    fleetVehicleCount: fleetStats.vehicleCount,
    hasEmissionsData: emissionsStats.hasEmissions,
    scope1Total: emissionsStats.scope1Total,
    scope2Total: emissionsStats.scope2Total,
    scope3Total: emissionsStats.scope3Total,
  };
}

async function checkProductData(organizationId: string): Promise<{
  totalCount: number;
  withLcaCount: number;
}> {
  const { data, count } = await supabase
    .from('products')
    .select('id, has_lca', { count: 'exact' })
    .eq('organization_id', organizationId);

  const products = data || [];
  const withLcaCount = products.filter((p) => p.has_lca).length;

  return {
    totalCount: count || 0,
    withLcaCount,
  };
}

async function checkFacilityData(organizationId: string): Promise<{
  count: number;
}> {
  const { count } = await supabase
    .from('facilities')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  return { count: count || 0 };
}

async function checkSupplierData(organizationId: string): Promise<{
  count: number;
}> {
  const { count } = await supabase
    .from('suppliers')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  return { count: count || 0 };
}

async function checkFleetData(organizationId: string): Promise<{
  vehicleCount: number;
}> {
  const { count } = await supabase
    .from('fleet_vehicles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  return { vehicleCount: count || 0 };
}

async function checkVitalityScore(organizationId: string): Promise<{
  exists: boolean;
}> {
  const { data } = await supabase
    .from('organization_vitality_scores')
    .select('id')
    .eq('organization_id', organizationId)
    .limit(1)
    .maybeSingle();

  return { exists: !!data };
}

async function checkEmissionsData(organizationId: string): Promise<{
  hasEmissions: boolean;
  scope1Total: number;
  scope2Total: number;
  scope3Total: number;
}> {
  // Check fleet activities (Scope 1)
  const { data: fleetData } = await supabase
    .from('fleet_activities')
    .select('total_emissions_kg')
    .eq('organization_id', organizationId);

  // Check facility activities (Scope 1 & 2)
  const { data: facilityData } = await supabase
    .from('facility_activity_entries')
    .select('emissions_kg_co2e, scope')
    .eq('organization_id', organizationId);

  // Check corporate overheads (Scope 3)
  const { data: overheadData } = await supabase
    .from('corporate_overheads')
    .select('total_emissions_kg')
    .eq('organization_id', organizationId);

  let scope1Total = 0;
  let scope2Total = 0;
  let scope3Total = 0;

  // Fleet is typically Scope 1
  if (fleetData) {
    scope1Total += fleetData.reduce((sum, a) => sum + (a.total_emissions_kg || 0), 0);
  }

  // Facility activities by scope
  if (facilityData) {
    facilityData.forEach((a) => {
      const emissions = a.emissions_kg_co2e || 0;
      if (a.scope === 1) scope1Total += emissions;
      else if (a.scope === 2) scope2Total += emissions;
      else if (a.scope === 3) scope3Total += emissions;
    });
  }

  // Corporate overheads are Scope 3
  if (overheadData) {
    scope3Total += overheadData.reduce((sum, o) => sum + (o.total_emissions_kg || 0), 0);
  }

  // Convert to tonnes
  scope1Total = scope1Total / 1000;
  scope2Total = scope2Total / 1000;
  scope3Total = scope3Total / 1000;

  const hasEmissions = scope1Total > 0 || scope2Total > 0 || scope3Total > 0;

  return { hasEmissions, scope1Total, scope2Total, scope3Total };
}

async function checkWaterData(organizationId: string): Promise<{
  hasWaterData: boolean;
}> {
  // First get facility IDs
  const { data: facilities } = await supabase
    .from('facilities')
    .select('id')
    .eq('organization_id', organizationId);

  if (!facilities || facilities.length === 0) {
    return { hasWaterData: false };
  }

  const facilityIds = facilities.map((f) => f.id);

  // Check for water data
  const { count } = await supabase
    .from('facility_water_data')
    .select('id', { count: 'exact', head: true })
    .in('facility_id', facilityIds);

  return { hasWaterData: (count || 0) > 0 };
}

/**
 * Format data availability for AI context
 */
export function formatDataAvailabilityForContext(
  availability: DataAvailability
): string {
  const lines: string[] = ['## AVAILABLE DATA FOR THIS USER'];

  lines.push(`- Product LCAs: ${availability.hasProductLCAs ? `Yes (${availability.productWithLcaCount} of ${availability.productCount} products)` : 'No'}`);
  lines.push(`- Carbon footprint data: ${availability.hasCarbonFootprintData ? 'Yes' : 'No'}`);
  if (availability.hasCarbonFootprintData) {
    lines.push(`  - Scope 1: ${availability.scope1Total.toFixed(2)} tCO2e`);
    lines.push(`  - Scope 2: ${availability.scope2Total.toFixed(2)} tCO2e`);
    lines.push(`  - Scope 3: ${availability.scope3Total.toFixed(2)} tCO2e`);
  }
  lines.push(`- Facility data: ${availability.hasFacilityData ? `Yes (${availability.facilityCount} facilities)` : 'No'}`);
  lines.push(`- Supplier data: ${availability.hasSupplierData ? `Yes (${availability.supplierCount} suppliers)` : 'No'}`);
  lines.push(`- Water usage data: ${availability.hasWaterData ? 'Yes' : 'No'}`);
  lines.push(`- Fleet data: ${availability.hasFleetData ? `Yes (${availability.fleetVehicleCount} vehicles)` : 'No'}`);
  lines.push(`- Scope 3 emissions: ${availability.hasScope3Data ? 'Yes' : 'No'}`);
  lines.push(`- Vitality Score: ${availability.vitalityScoreExists ? 'Yes' : 'No'}`);

  lines.push('');
  lines.push('When the user asks a question:');
  lines.push('1. Check if you have the required data based on the list above');
  lines.push('2. If YES: Provide the answer with data');
  lines.push('3. If NO: Provide helpful guidance on how to add the missing data');
  lines.push('');

  return lines.join('\n');
}
