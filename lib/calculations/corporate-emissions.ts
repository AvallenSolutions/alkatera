/**
 * Corporate Emissions Calculator
 *
 * SINGLE SOURCE OF TRUTH for all corporate emissions calculations.
 * Used by: Dashboard, Company Vitality, and CCF Reports.
 *
 * This ensures consistent values across all surfaces.
 *
 * Standards Compliance:
 * - GHG Protocol Corporate Standard
 * - ISO 14064-1
 * - No double counting between scopes
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface Scope3Breakdown {
  products: number;
  business_travel: number;
  purchased_services: number;
  employee_commuting: number;
  capital_goods: number;
  operational_waste: number;
  downstream_logistics: number;
  marketing_materials: number;
  // NEW: Previously missing GHG Protocol categories
  upstream_transport: number;   // Category 4: Upstream Transportation
  downstream_transport: number; // Category 9: Downstream Transportation (distinct from logistics spend)
  use_phase: number;            // Category 11: Use of Sold Products
  // UI-friendly aliases (for backward compatibility with existing components)
  logistics: number;      // alias for downstream_logistics
  waste: number;          // alias for operational_waste
  marketing: number;      // alias for marketing_materials
  total: number;
}

export interface ScopeBreakdown {
  scope1: number;
  scope2: number;
  scope3: Scope3Breakdown;
  total: number;
}

export interface CorporateEmissionsResult {
  year: number;
  breakdown: ScopeBreakdown;
  hasData: boolean;
}

// ============================================================================
// EMISSION FACTORS (for utility_data_entries calculations)
// ============================================================================

const UTILITY_EMISSION_FACTORS: Record<string, { factor: number; scope: 'Scope 1' | 'Scope 2' }> = {
  // Scope 1 - Direct emissions
  diesel_stationary: { factor: 2.68787, scope: 'Scope 1' },
  diesel_mobile: { factor: 2.68787, scope: 'Scope 1' },
  petrol_mobile: { factor: 2.31, scope: 'Scope 1' },
  natural_gas: { factor: 0.18293, scope: 'Scope 1' },
  lpg: { factor: 1.55537, scope: 'Scope 1' },
  heavy_fuel_oil: { factor: 3.17740, scope: 'Scope 1' },
  biomass_solid: { factor: 0.01551, scope: 'Scope 1' },
  refrigerant_leakage: { factor: 1430, scope: 'Scope 1' },
  // Scope 2 - Indirect emissions from purchased energy
  electricity_grid: { factor: 0.207, scope: 'Scope 2' },
  heat_steam_purchased: { factor: 0.1662, scope: 'Scope 2' },
};

// ============================================================================
// SCOPE 1 CALCULATIONS
// ============================================================================

/**
 * Calculate Scope 1 emissions from facility utility data and fleet
 *
 * Sources:
 * - Facility utility_data_entries (natural gas, diesel, LPG, etc.)
 * - Fleet vehicles (company-owned combustion)
 *
 * IMPORTANT: This calculation includes ALL facilities for the organization,
 * even those without utility data entries (which contribute 0 emissions).
 * This ensures complete facility coverage and transparency.
 */
export async function calculateScope1(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart: string,
  yearEnd: string
): Promise<number> {
  let scope1Total = 0;

  // 1. First, fetch ALL facilities for this organization to ensure complete coverage
  const { data: allFacilities } = await supabase
    .from('facilities')
    .select('id, name')
    .eq('organization_id', organizationId);

  const facilityIds = allFacilities?.map(f => f.id) || [];

  // 2. Fetch utility data for ALL facilities (using LEFT JOIN approach via IN clause)
  // This ensures we query all facilities, even those without data
  if (facilityIds.length > 0) {
    const { data: utilityData } = await supabase
      .from('utility_data_entries')
      .select(`
        quantity,
        unit,
        utility_type,
        facility_id
      `)
      .in('facility_id', facilityIds)
      .gte('reporting_period_start', yearStart)
      .lte('reporting_period_end', yearEnd);

    if (utilityData) {
      for (const entry of utilityData) {
        const emissionConfig = UTILITY_EMISSION_FACTORS[(entry as any).utility_type];
        if (!emissionConfig || emissionConfig.scope !== 'Scope 1') continue;

        let co2e = (entry as any).quantity * emissionConfig.factor;

        // Handle unit conversion for natural gas (m³ to kWh)
        if ((entry as any).utility_type === 'natural_gas' && (entry as any).unit === 'm³') {
          co2e = (entry as any).quantity * 10.55 * emissionConfig.factor;
        }

        scope1Total += co2e;
      }
    }
  }

  // 2. Fleet Scope 1 (company-owned combustion vehicles)
  const { data: fleetScope1Data } = await supabase
    .from('fleet_activities')
    .select('emissions_tco2e')
    .eq('organization_id', organizationId)
    .eq('scope', 'Scope 1')
    .gte('reporting_period_start', yearStart)
    .lte('reporting_period_end', yearEnd);

  if (fleetScope1Data) {
    fleetScope1Data.forEach((item: any) => {
      // Convert from tCO2e to kgCO2e
      scope1Total += (item.emissions_tco2e || 0) * 1000;
    });
  }

  return scope1Total;
}

// ============================================================================
// SCOPE 2 CALCULATIONS
// ============================================================================

/**
 * Calculate Scope 2 emissions from facility utility data and fleet
 *
 * Sources:
 * - Facility utility_data_entries (purchased electricity, heat/steam)
 * - Fleet vehicles (company-owned electric)
 *
 * IMPORTANT: This calculation includes ALL facilities for the organization,
 * even those without utility data entries (which contribute 0 emissions).
 * This ensures complete facility coverage and transparency.
 */
export async function calculateScope2(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart: string,
  yearEnd: string
): Promise<number> {
  let scope2Total = 0;

  // 1. First, fetch ALL facilities for this organization to ensure complete coverage
  const { data: allFacilities } = await supabase
    .from('facilities')
    .select('id, name')
    .eq('organization_id', organizationId);

  const facilityIds = allFacilities?.map(f => f.id) || [];

  // 2. Fetch utility data for ALL facilities (using LEFT JOIN approach via IN clause)
  // This ensures we query all facilities, even those without data
  if (facilityIds.length > 0) {
    const { data: utilityData } = await supabase
      .from('utility_data_entries')
      .select(`
        quantity,
        unit,
        utility_type,
        facility_id
      `)
      .in('facility_id', facilityIds)
      .gte('reporting_period_start', yearStart)
      .lte('reporting_period_end', yearEnd);

    if (utilityData) {
      for (const entry of utilityData) {
        const emissionConfig = UTILITY_EMISSION_FACTORS[(entry as any).utility_type];
        if (!emissionConfig || emissionConfig.scope !== 'Scope 2') continue;

        const co2e = (entry as any).quantity * emissionConfig.factor;
        scope2Total += co2e;
      }
    }
  }

  // 2. Fleet Scope 2 (company-owned electric vehicles)
  const { data: fleetScope2Data } = await supabase
    .from('fleet_activities')
    .select('emissions_tco2e')
    .eq('organization_id', organizationId)
    .eq('scope', 'Scope 2')
    .gte('reporting_period_start', yearStart)
    .lte('reporting_period_end', yearEnd);

  if (fleetScope2Data) {
    fleetScope2Data.forEach((item: any) => {
      // Convert from tCO2e to kgCO2e
      scope2Total += (item.emissions_tco2e || 0) * 1000;
    });
  }

  return scope2Total;
}

// ============================================================================
// SCOPE 3 CALCULATIONS
// ============================================================================

/**
 * Calculate Scope 3 emissions with full breakdown
 *
 * Categories:
 * - Cat 1: Purchased goods (products) - uses LCA scope3 breakdown to avoid double counting
 * - Cat 2: Capital goods
 * - Cat 4: Upstream transportation (downstream_logistics)
 * - Cat 5: Waste generated (operational_waste)
 * - Cat 6: Business travel (includes grey fleet)
 * - Cat 7: Employee commuting
 * - Cat 8: Purchased services (including marketing materials)
 */
export async function calculateScope3(
  supabase: SupabaseClient,
  organizationId: string,
  year: number,
  yearStart: string,
  yearEnd: string
): Promise<Scope3Breakdown> {
  const breakdown: Scope3Breakdown = {
    products: 0,
    business_travel: 0,
    purchased_services: 0,
    employee_commuting: 0,
    capital_goods: 0,
    operational_waste: 0,
    downstream_logistics: 0,
    marketing_materials: 0,
    // NEW: Previously missing GHG Protocol categories
    upstream_transport: 0,    // Category 4
    downstream_transport: 0,  // Category 9
    use_phase: 0,             // Category 11
    // UI aliases (populated at the end)
    logistics: 0,
    waste: 0,
    marketing: 0,
    total: 0,
  };

  // =========================================================================
  // Category 1: Purchased Goods & Services (Products)
  // =========================================================================
  // CRITICAL: Use aggregated_impacts.breakdown.by_scope.scope3 to avoid double counting
  // This excludes owned facility Scope 1 & 2 which are already in corporate inventory

  const { data: productionData } = await supabase
    .from('production_logs')
    .select('product_id, units_produced')
    .eq('organization_id', organizationId)
    .gte('date', yearStart)
    .lte('date', yearEnd);

  if (productionData) {
    for (const log of productionData) {
      if (!log.units_produced || log.units_produced <= 0) continue;

      const { data: lca } = await supabase
        .from('product_lcas')
        .select('aggregated_impacts')
        .eq('product_id', log.product_id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Extract Scope 3 portion only (excludes owned facility S1+S2)
      const scope3PerUnit = lca?.aggregated_impacts?.breakdown?.by_scope?.scope3 || 0;

      if (scope3PerUnit > 0) {
        breakdown.products += scope3PerUnit * log.units_produced;
      }
    }
  }

  // =========================================================================
  // Categories 2-8: Corporate Overheads
  // =========================================================================

  const { data: reportData } = await supabase
    .from('corporate_reports')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('year', year)
    .maybeSingle();

  if (reportData) {
    const { data: overheadData } = await supabase
      .from('corporate_overheads')
      .select('category, computed_co2e, material_type')
      .eq('report_id', reportData.id);

    if (overheadData) {
      overheadData.forEach((entry) => {
        const co2e = entry.computed_co2e || 0;

        switch (entry.category) {
          case 'business_travel':
            breakdown.business_travel += co2e;
            break;
          case 'employee_commuting':
            breakdown.employee_commuting += co2e;
            break;
          case 'capital_goods':
            breakdown.capital_goods += co2e;
            break;
          case 'operational_waste':
            // IMPORTANT: This is Scope 3 Category 5 - Waste Generated in Operations
            // This is DIFFERENT from product end-of-life waste:
            // - Operational waste: Manufacturing scrap, packaging waste, office waste
            // - End-of-life waste: Consumer disposal of products (tracked in product LCA)
            // See lib/calculations/waste-circularity.ts for detailed documentation
            breakdown.operational_waste += co2e;
            break;
          case 'downstream_logistics':
            breakdown.downstream_logistics += co2e;
            break;
          case 'purchased_services':
            // Marketing materials have material_type field set
            if (entry.material_type) {
              breakdown.marketing_materials += co2e;
            } else {
              breakdown.purchased_services += co2e;
            }
            break;
          // NEW: Manual entries for Categories 4, 9, 11
          // These ADD to the LCA-calculated values from scope3-categories.ts
          case 'upstream_transport':
            // Category 4: Upstream Transportation - manual entries
            breakdown.upstream_transport += co2e;
            break;
          case 'downstream_transport':
            // Category 9: Downstream Transportation - manual entries (distinct from downstream_logistics)
            breakdown.downstream_transport += co2e;
            break;
          case 'use_phase':
            // Category 11: Use of Sold Products - manual entries
            breakdown.use_phase += co2e;
            break;
          default:
            // Fallback to purchased_services
            breakdown.purchased_services += co2e;
            break;
        }
      });
    }
  }

  // =========================================================================
  // Category 6 Addition: Grey Fleet (Scope 3 Cat 6)
  // =========================================================================
  // Employee-owned vehicles used for business travel

  const { data: fleetScope3Data } = await supabase
    .from('fleet_activities')
    .select('emissions_tco2e')
    .eq('organization_id', organizationId)
    .eq('scope', 'Scope 3 Cat 6')
    .gte('reporting_period_start', yearStart)
    .lte('reporting_period_end', yearEnd);

  if (fleetScope3Data) {
    fleetScope3Data.forEach((item: any) => {
      // Convert from tCO2e to kgCO2e and add to business travel
      const itemKg = (item.emissions_tco2e || 0) * 1000;
      breakdown.business_travel += itemKg;
    });
  }

  // =========================================================================
  // NEW: Categories 4, 9, 11 (Previously Missing)
  // =========================================================================
  // These categories use the new scope3-categories.ts calculations
  // Import is deferred to avoid circular dependencies

  try {
    const { calculateScope3Cat4, calculateScope3Cat9, calculateScope3Cat11 } =
      await import('./scope3-categories');

    const [cat4, cat9, cat11] = await Promise.all([
      calculateScope3Cat4(supabase, organizationId, yearStart, yearEnd),
      calculateScope3Cat9(supabase, organizationId, yearStart, yearEnd),
      calculateScope3Cat11(supabase, organizationId, yearStart, yearEnd),
    ]);

    breakdown.upstream_transport = cat4.totalKgCO2e;
    breakdown.downstream_transport = cat9.totalKgCO2e;
    breakdown.use_phase = cat11.totalKgCO2e;

    // Log data quality notes for visibility
    if (cat4.notes.length > 0 || cat9.notes.length > 0 || cat11.notes.length > 0) {
      console.log('[calculateScope3] Scope 3 Category Notes:', {
        cat4: cat4.notes,
        cat9: cat9.notes,
        cat11: cat11.notes,
      });
    }
  } catch (err) {
    console.warn('[calculateScope3] Could not calculate Categories 4, 9, 11:', err);
    // Continue with zeros if calculations fail
  }

  // Calculate total (now includes ALL categories)
  breakdown.total =
    breakdown.products +
    breakdown.business_travel +
    breakdown.purchased_services +
    breakdown.employee_commuting +
    breakdown.capital_goods +
    breakdown.operational_waste +
    breakdown.downstream_logistics +
    breakdown.marketing_materials +
    breakdown.upstream_transport +     // Category 4
    breakdown.downstream_transport +   // Category 9
    breakdown.use_phase;               // Category 11

  // Populate UI-friendly aliases for backward compatibility
  breakdown.logistics = breakdown.downstream_logistics;
  breakdown.waste = breakdown.operational_waste;
  breakdown.marketing = breakdown.marketing_materials;

  return breakdown;
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate complete corporate emissions for a given year
 *
 * This is the SINGLE SOURCE OF TRUTH for all corporate emissions.
 * All UI surfaces should use this function to ensure consistency.
 */
export async function calculateCorporateEmissions(
  supabase: SupabaseClient,
  organizationId: string,
  year: number
): Promise<CorporateEmissionsResult> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Calculate all scopes
  const [scope1, scope2, scope3] = await Promise.all([
    calculateScope1(supabase, organizationId, yearStart, yearEnd),
    calculateScope2(supabase, organizationId, yearStart, yearEnd),
    calculateScope3(supabase, organizationId, year, yearStart, yearEnd),
  ]);

  const total = scope1 + scope2 + scope3.total;

  return {
    year,
    breakdown: {
      scope1,
      scope2,
      scope3,
      total,
    },
    hasData: total > 0,
  };
}
