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

      if (report && report.breakdown_json) {
        console.log('🔍 [Dashboard Debug] Company Footprint Data:', {
          year: targetYear,
          organization: currentOrganization?.name,
          total_emissions_kg: report.total_emissions,
          total_emissions_t: report.total_emissions ? report.total_emissions / 1000 : 0,
          scope1_t: report.breakdown_json?.scope1 ? report.breakdown_json.scope1 / 1000 : 0,
          scope2_t: report.breakdown_json?.scope2 ? report.breakdown_json.scope2 / 1000 : 0,
          scope3_t: report.breakdown_json?.scope3?.total ? report.breakdown_json.scope3.total / 1000 : 0,
          status: report.status,
          last_updated: report.updated_at,
          data_source: 'corporate_reports.breakdown_json'
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

      const preview = await calculatePreviewFromLCAs(targetYear);

      if (preview && preview.total > 0) {
        console.log('🔍 [Dashboard Debug] Preview Mode Active:', {
          year: targetYear,
          organization: currentOrganization?.name,
          total_emissions_kg: preview.total,
          total_emissions_t: preview.total / 1000,
          scope3_products_t: preview.breakdown.scope3.products / 1000,
          data_source: 'production_logs × product_lcas (PREVIEW)'
        });

        setFootprint({
          year: targetYear,
          total_emissions: preview.total,
          breakdown: preview.breakdown,
          status: 'Draft',
          last_updated: null,
          has_data: true,
        });
        setPreviewMode(true);
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

  async function calculatePreviewFromLCAs(year: number) {
    try {
      const supabase = getSupabaseBrowserClient();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const { data: productionLogs } = await supabase
        .from('production_logs')
        .select('product_id, units_produced, date')
        .eq('organization_id', currentOrganization!.id)
        .gte('date', yearStart)
        .lte('date', yearEnd);

      if (!productionLogs || productionLogs.length === 0) {
        return null;
      }

      let scope3ProductsTotal = 0;

      for (const log of productionLogs) {
        if (!log.units_produced || log.units_produced <= 0) continue;

        const { data: lca } = await supabase
          .from('product_lcas')
          .select('total_ghg_emissions')
          .eq('product_id', log.product_id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lca && lca.total_ghg_emissions) {
          scope3ProductsTotal += lca.total_ghg_emissions * log.units_produced;
        }
      }

      if (scope3ProductsTotal === 0) return null;

      return {
        total: scope3ProductsTotal,
        breakdown: {
          scope1: 0,
          scope2: 0,
          scope3: {
            products: scope3ProductsTotal,
            business_travel: 0,
            purchased_services: 0,
            employee_commuting: 0,
            capital_goods: 0,
            logistics: 0,
            waste: 0,
            marketing: 0,
            total: scope3ProductsTotal,
          },
          total: scope3ProductsTotal,
        },
      };
    } catch (err) {
      console.error('Error calculating preview:', err);
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
