'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import type { ScopeBreakdown } from '@/lib/calculations/corporate-emissions';
import type { MetricSource } from '@/lib/trends/historical-fallback';

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
 * Hook to fetch the company-wide carbon footprint.
 *
 * The corporate-emissions cascade (~14 DB queries) runs SERVER-SIDE in
 * /api/emissions/corporate — running it here via the browser supabase client
 * cost a ~100ms HTTPS round trip per query, multiplied per reporting year on
 * the trends tab. One HTTP call now; same shared calculator, same shape.
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

      const params = new URLSearchParams({
        year: String(targetYear),
        organization_id: currentOrganization.id,
      });
      const res = await fetch(`/api/emissions/corporate?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Footprint request failed (${res.status})`);
      }
      const data = (await res.json()) as CompanyFootprint;
      setFootprint(data);
      setPreviewMode(false);
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
