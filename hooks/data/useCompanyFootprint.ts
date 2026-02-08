'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';
import {
  calculateCorporateEmissions,
  ScopeBreakdown,
} from '@/lib/calculations/corporate-emissions';

interface CompanyFootprint {
  year: number;
  total_emissions: number;
  breakdown: ScopeBreakdown | null;
  status: 'Draft' | 'Finalized';
  last_updated: string | null;
  has_data: boolean;
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
  }, [currentOrganization?.id, targetYear]);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchFootprint();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id, targetYear, fetchFootprint]);

  return {
    footprint,
    previewMode,
    loading,
    error,
    refetch: fetchFootprint,
  };
}
