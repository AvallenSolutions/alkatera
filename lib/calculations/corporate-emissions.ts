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
// SCOPE 1 CALCULATIONS
// ============================================================================

/**
 * Calculate Scope 1 emissions from facility activity data and fleet
 *
 * Sources:
 * - Facility stationary combustion
 * - Facility mobile combustion
 * - Facility process emissions
 * - Facility fugitive emissions
 * - Fleet vehicles (company-owned combustion)
 */
export async function calculateScope1(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart: string,
  yearEnd: string
): Promise<number> {
  let scope1Total = 0;

  // 1. Facility activity data
  const { data: facilityData } = await supabase
    .from('facility_activity_data')
    .select(`
      quantity,
      scope_1_2_emission_sources!inner (
        scope,
        emission_factor_id
      )
    `)
    .eq('organization_id', organizationId)
    .gte('reporting_period_start', yearStart)
    .lte('reporting_period_end', yearEnd);

  if (facilityData) {
    const scope1Items = facilityData.filter((item: any) =>
      item.scope_1_2_emission_sources?.scope === 'Scope 1'
    );

    for (const item of scope1Items) {
      const factorId = (item as any).scope_1_2_emission_sources?.emission_factor_id;
      if (factorId) {
        const { data: factor } = await supabase
          .from('emissions_factors')
          .select('value')
          .eq('factor_id', factorId)
          .maybeSingle();

        if (factor?.value) {
          scope1Total += item.quantity * parseFloat(factor.value);
        }
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
 * Calculate Scope 2 emissions from facility activity data and fleet
 *
 * Sources:
 * - Purchased electricity
 * - Purchased heat/steam
 * - Fleet vehicles (company-owned electric)
 */
export async function calculateScope2(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart: string,
  yearEnd: string
): Promise<number> {
  let scope2Total = 0;

  // 1. Facility activity data
  const { data: facilityData } = await supabase
    .from('facility_activity_data')
    .select(`
      quantity,
      scope_1_2_emission_sources!inner (
        scope,
        emission_factor_id
      )
    `)
    .eq('organization_id', organizationId)
    .gte('reporting_period_start', yearStart)
    .lte('reporting_period_end', yearEnd);

  if (facilityData) {
    const scope2Items = facilityData.filter((item: any) =>
      item.scope_1_2_emission_sources?.scope === 'Scope 2'
    );

    for (const item of scope2Items) {
      const factorId = (item as any).scope_1_2_emission_sources?.emission_factor_id;
      if (factorId) {
        const { data: factor } = await supabase
          .from('emissions_factors')
          .select('value')
          .eq('factor_id', factorId)
          .maybeSingle();

        if (factor?.value) {
          scope2Total += item.quantity * parseFloat(factor.value);
        }
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

  // Calculate total
  breakdown.total =
    breakdown.products +
    breakdown.business_travel +
    breakdown.purchased_services +
    breakdown.employee_commuting +
    breakdown.capital_goods +
    breakdown.operational_waste +
    breakdown.downstream_logistics +
    breakdown.marketing_materials;

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
