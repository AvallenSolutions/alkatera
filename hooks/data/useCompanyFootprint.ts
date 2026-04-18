'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import {
  calculateCorporateEmissions,
  ScopeBreakdown,
} from '@/lib/calculations/corporate-emissions';
import {
  fetchHistoricalSustainabilityMetrics,
  historicalTotalKgCo2e,
  type MetricSource,
} from '@/lib/trends/historical-fallback';

interface CompanyFootprint {
  year: number;
  total_emissions: number;
  breakdown: ScopeBreakdown | null;
  status: 'Draft' | 'Finalized';
  last_updated: string | null;
  has_data: boolean;
  /**
   * Provenance of this footprint — 'operational' when sourced from measured /
   * calculated activity data, 'imported' when falling back to a historical
   * sustainability-report row. Absent when has_data is false.
   */
  source?: MetricSource;
}

/**
 * Hook to calculate company-wide carbon footprint
 *
 * Uses the shared corporate-emissions calculator to ensure consistency
 * across Dashboard, Company Vitality, and CCF Reports.
 */
export function useCompanyFootprint(year?: number) {
  const { currentOrganization } = useOrganization();
  const [footprint, setFootprint] = useState<CompanyFootprint | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetYear = year || new Date().getFullYear();

  const fetchFootprint = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = getSupabaseBrowserClient();

      // Use shared calculation service for consistency
      const result = await calculateCorporateEmissions(
        supabase,
        currentOrganization.id,
        targetYear
      );

      if (result.hasData) {

        setFootprint({
          year: targetYear,
          total_emissions: result.breakdown.total,
          breakdown: result.breakdown,
          status: 'Draft',
          last_updated: new Date().toISOString(),
          has_data: true,
          source: 'operational',
        });
        setPreviewMode(false);
      } else {
        // Fall back to historical_imports for this year if a sustainability
        // report has been imported. Imported values never replace operational
        // data — they only fill empty years.
        const historical = await fetchHistoricalSustainabilityMetrics(
          supabase,
          currentOrganization.id,
          targetYear,
        );
        const importedTotal = historical ? historicalTotalKgCo2e(historical) : undefined;
        if (historical && importedTotal !== undefined) {
          const s1Kg = (historical.scope1_tco2e ?? 0) * 1000;
          const s2Kg = (historical.scope2_tco2e_market ?? historical.scope2_tco2e_location ?? 0) * 1000;
          const s3Kg = (historical.scope3_tco2e ?? 0) * 1000;
          setFootprint({
            year: targetYear,
            total_emissions: importedTotal,
            breakdown: {
              total: importedTotal,
              scope1: s1Kg,
              scope2: s2Kg,
              scope3: { total: s3Kg, byCategory: {} },
            } as unknown as ScopeBreakdown,
            status: 'Draft',
            last_updated: null,
            has_data: true,
            source: 'imported',
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
      }
    } catch (err: any) {
      console.error('Error fetching company footprint:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, targetYear]);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchFootprint();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchFootprint is stable via useCallback([orgId, year])
  }, [currentOrganization?.id, targetYear]);

  return {
    footprint,
    previewMode,
    loading,
    error,
    refetch: fetchFootprint,
  };
}
