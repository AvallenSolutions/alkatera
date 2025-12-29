'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

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

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchFootprint();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id, targetYear]);

  async function fetchFootprint() {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      setError(null);

      const supabase = getSupabaseBrowserClient();

      const { data: report, error: reportError } = await supabase
        .from('corporate_reports')
        .select('id, year, total_emissions, breakdown_json, status, updated_at')
        .eq('organization_id', currentOrganization.id)
        .eq('year', targetYear)
        .maybeSingle();

      if (reportError) throw reportError;

      if (report && report.breakdown_json && report.total_emissions > 0) {
        console.log('🔍 [Dashboard] Using official corporate report:', {
          year: targetYear,
          total_emissions_kg: report.total_emissions,
          total_emissions_t: report.total_emissions / 1000,
          scope1_t: report.breakdown_json?.scope1 ? report.breakdown_json.scope1 / 1000 : 0,
          scope2_t: report.breakdown_json?.scope2 ? report.breakdown_json.scope2 / 1000 : 0,
          scope3_t: report.breakdown_json?.scope3?.total ? report.breakdown_json.scope3.total / 1000 : 0,
          data_source: 'corporate_reports (official)'
        });

        setFootprint({
          year: report.year,
          total_emissions: report.total_emissions || 0,
          breakdown: report.breakdown_json,
          status: report.status,
          last_updated: report.updated_at,
          has_data: report.total_emissions > 0,
        });
        setPreviewMode(false);
        setLoading(false);
        return;
      }

      // Calculate live data from actual sources (same as Company Emissions page)
      const liveData = await calculateLiveEmissions(targetYear, report?.id);

      if (liveData && liveData.total > 0) {
        console.log('🔍 [Dashboard] Using live calculated data:', {
          year: targetYear,
          total_emissions_kg: liveData.total,
          total_emissions_t: liveData.total / 1000,
          scope1_t: liveData.breakdown.scope1 / 1000,
          scope2_t: liveData.breakdown.scope2 / 1000,
          scope3_t: liveData.breakdown.scope3.total / 1000,
          data_source: 'Live calculation (facility_activity_data + LCAs + overheads)'
        });

        setFootprint({
          year: targetYear,
          total_emissions: liveData.total,
          breakdown: liveData.breakdown,
          status: report?.status || 'Draft',
          last_updated: null,
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

  async function calculateLiveEmissions(year: number, reportId?: string) {
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
      const { data: fleetScope1Data } = await supabase
        .from('fleet_activities')
        .select('emissions_tco2e')
        .eq('organization_id', currentOrganization!.id)
        .eq('scope', 'Scope 1')
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      if (fleetScope1Data) {
        fleetScope1Data.forEach((item: any) => {
          // Convert from tCO2e to kgCO2e (multiply by 1000)
          scope1Total += (item.emissions_tco2e || 0) * 1000;
        });
      }

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
      const { data: fleetScope2Data } = await supabase
        .from('fleet_activities')
        .select('emissions_tco2e')
        .eq('organization_id', currentOrganization!.id)
        .eq('scope', 'Scope 2')
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      if (fleetScope2Data) {
        fleetScope2Data.forEach((item: any) => {
          // Convert from tCO2e to kgCO2e (multiply by 1000)
          scope2Total += (item.emissions_tco2e || 0) * 1000;
        });
      }

      // Calculate Scope 3 Category 1 from LCAs (same as Company Emissions page)
      const { data: productionLogs } = await supabase
        .from('production_logs')
        .select('product_id, units_produced, date')
        .eq('organization_id', currentOrganization!.id)
        .gte('date', yearStart)
        .lte('date', yearEnd);

      let scope3ProductsTotal = 0;
      if (productionLogs) {
        for (const log of productionLogs) {
          if (!log.units_produced || log.units_produced <= 0) continue;

          const { data: lca } = await supabase
            .from('product_lcas')
            .select('id')
            .eq('product_id', log.product_id)
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lca) {
            // Fetch materials breakdown to match Company Emissions page calculation
            const { data: materials } = await supabase
              .from('product_lca_materials')
              .select('material_type, impact_climate')
              .eq('product_lca_id', lca.id);

            let materialsPerUnit = 0;
            let packagingPerUnit = 0;

            if (materials) {
              materials.forEach((m: any) => {
                if (m.material_type === 'ingredient') {
                  materialsPerUnit += m.impact_climate || 0;
                } else if (m.material_type === 'packaging') {
                  packagingPerUnit += m.impact_climate || 0;
                }
              });
            }

            // Calculate total emissions: emissions per unit × number of units (in kg)
            const totalImpactKg = (materialsPerUnit + packagingPerUnit) * log.units_produced;
            scope3ProductsTotal += totalImpactKg;
          }
        }
      }

      // Calculate Scope 3 other categories from corporate overheads
      const scope3Overheads = {
        business_travel: 0,
        purchased_services: 0,
        employee_commuting: 0,
        capital_goods: 0,
        logistics: 0,
        waste: 0,
        marketing: 0,
      };

      if (reportId) {
        const { data: overheadData } = await supabase
          .from('corporate_overheads')
          .select('category, computed_co2e, material_type')
          .eq('report_id', reportId);

        if (overheadData) {
          overheadData.forEach((entry: any) => {
            const co2e = entry.computed_co2e || 0;
            switch (entry.category) {
              case 'business_travel':
                scope3Overheads.business_travel += co2e;
                break;
              case 'employee_commuting':
                scope3Overheads.employee_commuting += co2e;
                break;
              case 'capital_goods':
                scope3Overheads.capital_goods += co2e;
                break;
              case 'operational_waste':
                scope3Overheads.waste += co2e;
                break;
              case 'downstream_logistics':
                scope3Overheads.logistics += co2e;
                break;
              case 'purchased_services':
                if (entry.material_type) {
                  scope3Overheads.marketing += co2e;
                } else {
                  scope3Overheads.purchased_services += co2e;
                }
                break;
            }
          });
        }
      }

      // Add Scope 3 Cat 6 (Business Travel - Grey Fleet) from fleet activities
      const { data: fleetScope3Data } = await supabase
        .from('fleet_activities')
        .select('emissions_tco2e')
        .eq('organization_id', currentOrganization!.id)
        .eq('scope', 'Scope 3 Cat 6')
        .gte('reporting_period_start', yearStart)
        .lte('reporting_period_end', yearEnd);

      if (fleetScope3Data) {
        fleetScope3Data.forEach((item: any) => {
          // Convert from tCO2e to kgCO2e (multiply by 1000) and add to business travel
          scope3Overheads.business_travel += (item.emissions_tco2e || 0) * 1000;
        });
      }

      const scope3Total =
        scope3ProductsTotal +
        scope3Overheads.business_travel +
        scope3Overheads.purchased_services +
        scope3Overheads.employee_commuting +
        scope3Overheads.capital_goods +
        scope3Overheads.logistics +
        scope3Overheads.waste +
        scope3Overheads.marketing;

      const totalEmissions = scope1Total + scope2Total + scope3Total;

      if (totalEmissions === 0) return null;

      return {
        total: totalEmissions,
        breakdown: {
          scope1: scope1Total,
          scope2: scope2Total,
          scope3: {
            products: scope3ProductsTotal,
            business_travel: scope3Overheads.business_travel,
            purchased_services: scope3Overheads.purchased_services,
            employee_commuting: scope3Overheads.employee_commuting,
            capital_goods: scope3Overheads.capital_goods,
            logistics: scope3Overheads.logistics,
            waste: scope3Overheads.waste,
            marketing: scope3Overheads.marketing,
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
