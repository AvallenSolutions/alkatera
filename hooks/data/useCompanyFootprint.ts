'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import { useScope3Emissions } from './useScope3Emissions';

interface ScopeBreakdown {
  scope1: number;
  scope2: number;
  scope3: {
    products: number;
    business_travel: number;
    purchased_services: number;
    employee_commuting: number;
    capital_goods: number;
    logistics: number;
    waste: number;
    marketing: number;
    total: number;
  };
  total: number;
}

interface CompanyFootprint {
  year: number;
  total_emissions: number;
  breakdown: ScopeBreakdown | null;
  status: 'Draft' | 'Finalized';
  last_updated: string | null;
  has_data: boolean;
}

export function useCompanyFootprint(year?: number) {
  const { currentOrganization } = useOrganization();
  const [footprint, setFootprint] = useState<CompanyFootprint | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetYear = year || new Date().getFullYear();

  // Use the shared Scope 3 emissions hook
  const { scope3Emissions, isLoading: isLoadingScope3 } = useScope3Emissions(
    currentOrganization?.id,
    targetYear
  );

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchFootprint();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id, targetYear, scope3Emissions]);

  async function fetchFootprint() {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      setError(null);

      const supabase = getSupabaseBrowserClient();

      // Dashboard always shows live calculated data
      // Calculate live data from actual sources (same as Company Emissions page)
      const liveData = await calculateLiveEmissions(targetYear, scope3Emissions);

      if (liveData && liveData.total > 0) {
        console.log('🔍 [Dashboard] Using live calculated data:', {
          year: targetYear,
          total_emissions_kg: liveData.total,
          total_emissions_t: liveData.total / 1000,
          scope1_t: liveData.breakdown.scope1 / 1000,
          scope2_t: liveData.breakdown.scope2 / 1000,
          scope3_t: liveData.breakdown.scope3.total / 1000,
          data_source: 'Live calculation (facility_activity_data + fleet + shared scope3 hook)'
        });

        setFootprint({
          year: targetYear,
          total_emissions: liveData.total,
          breakdown: liveData.breakdown,
          status: 'Draft',
          last_updated: new Date().toISOString(),
          has_data: true,
        });
        setPreviewMode(false);
      } else {
        setFootprint({
          year: targetYear,
          total_emissions: 0,
          breakdown: null,
          status: 'Draft',
          last_updated: null,
          has_data: false,
        });
        setPreviewMode(false);
      }
    } catch (err: any) {
      console.error('Error fetching company footprint:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function calculateLiveEmissions(
    year: number,
    scope3Data: { total: number; products: number; business_travel: number; purchased_services: number; employee_commuting: number; capital_goods: number; operational_waste: number; downstream_logistics: number; marketing_materials: number }
  ) {
    try {
      const supabase = getSupabaseBrowserClient();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      // Calculate Scope 1 emissions from facility activity data
      const { data: scope1Data } = await supabase
        .from('facility_activity_data')
        .select(`
          quantity,
          scope_1_2_emission_sources!inner (
            scope,
            emission_factor_id
          )
        `)
        .eq('organization_id', currentOrganization!.id)
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      let scope1Total = 0;
      if (scope1Data) {
        const scope1Items = scope1Data.filter((item: any) =>
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

      // Add Scope 1 emissions from fleet activities (company-owned combustion vehicles)
      console.log('🚗 [Fleet Scope 1] Starting query with filters:', {
        organization_id: currentOrganization!.id,
        yearStart,
        yearEnd,
        scope1_before_fleet_kg: scope1Total
      });

      const { data: fleetScope1Data, error: fleetScope1Error } = await supabase
        .from('fleet_activities')
        .select('emissions_tco2e, reporting_period_start, reporting_period_end')
        .eq('organization_id', currentOrganization!.id)
        .eq('scope', 'Scope 1')
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      console.log('🚗 [Fleet Scope 1] Query result:', {
        count: fleetScope1Data?.length || 0,
        data: fleetScope1Data,
        error: fleetScope1Error,
        yearStart,
        yearEnd
      });

      let fleetScope1Kg = 0;
      if (fleetScope1Data && fleetScope1Data.length > 0) {
        console.log('🚗 [Fleet Scope 1] Processing fleet activities...');
        fleetScope1Data.forEach((item: any) => {
          // Convert from tCO2e to kgCO2e (multiply by 1000)
          const itemKg = (item.emissions_tco2e || 0) * 1000;
          console.log('🚗 [Fleet Scope 1] Item:', {
            emissions_tco2e: item.emissions_tco2e,
            emissions_kg: itemKg,
            reporting_period: `${item.reporting_period_start} to ${item.reporting_period_end}`
          });
          fleetScope1Kg += itemKg;
          scope1Total += itemKg;
        });
      } else {
        console.warn('🚗 [Fleet Scope 1] No fleet activities found or error occurred');
      }

      console.log('🚗 [Fleet Scope 1] Final totals:', {
        fleet_kg: fleetScope1Kg,
        fleet_tonnes: fleetScope1Kg / 1000,
        scope1_before_fleet: scope1Total - fleetScope1Kg,
        scope1_after_fleet: scope1Total,
        scope1_after_fleet_tonnes: scope1Total / 1000
      });

      // Calculate Scope 2 emissions from facility activity data
      const { data: scope2Data } = await supabase
        .from('facility_activity_data')
        .select(`
          quantity,
          scope_1_2_emission_sources!inner (
            scope,
            emission_factor_id
          )
        `)
        .eq('organization_id', currentOrganization!.id)
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      let scope2Total = 0;
      if (scope2Data) {
        const scope2Items = scope2Data.filter((item: any) =>
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

      // Add Scope 2 emissions from fleet activities (company-owned electric vehicles)
      console.log('🚗 [Fleet Scope 2] Starting query, scope2_before_fleet_kg:', scope2Total);

      const { data: fleetScope2Data, error: fleetScope2Error } = await supabase
        .from('fleet_activities')
        .select('emissions_tco2e, reporting_period_start, reporting_period_end')
        .eq('organization_id', currentOrganization!.id)
        .eq('scope', 'Scope 2')
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      console.log('🚗 [Fleet Scope 2] Query result:', {
        count: fleetScope2Data?.length || 0,
        data: fleetScope2Data,
        error: fleetScope2Error
      });

      let fleetScope2Kg = 0;
      if (fleetScope2Data && fleetScope2Data.length > 0) {
        fleetScope2Data.forEach((item: any) => {
          // Convert from tCO2e to kgCO2e (multiply by 1000)
          const itemKg = (item.emissions_tco2e || 0) * 1000;
          console.log('🚗 [Fleet Scope 2] Item:', { emissions_kg: itemKg });
          fleetScope2Kg += itemKg;
          scope2Total += itemKg;
        });
      }

      console.log('🚗 [Fleet Scope 2] Final totals:', {
        fleet_kg: fleetScope2Kg,
        fleet_tonnes: fleetScope2Kg / 1000,
        scope2_after_fleet_kg: scope2Total,
        scope2_after_fleet_tonnes: scope2Total / 1000
      });

      // Use Scope 3 data from shared hook (same calculation as Company Emissions page)
      const scope3Total = scope3Data.total;

      const totalEmissions = scope1Total + scope2Total + scope3Total;

      if (totalEmissions === 0) return null;

      return {
        total: totalEmissions,
        breakdown: {
          scope1: scope1Total,
          scope2: scope2Total,
          scope3: {
            products: scope3Data.products,
            business_travel: scope3Data.business_travel,
            purchased_services: scope3Data.purchased_services,
            employee_commuting: scope3Data.employee_commuting,
            capital_goods: scope3Data.capital_goods,
            logistics: scope3Data.downstream_logistics,
            waste: scope3Data.operational_waste,
            marketing: scope3Data.marketing_materials,
            total: scope3Total,
          },
          total: totalEmissions,
        },
      };
    } catch (err) {
      console.error('Error calculating live emissions:', err);
      return null;
    }
  }

  return {
    footprint,
    previewMode,
    loading,
    error,
    refetch: fetchFootprint,
  };
}
