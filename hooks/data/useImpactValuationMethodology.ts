'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useOrganization } from '@/lib/organizationContext';

export interface MethodologyItem {
  capital: string;
  metric_key: string;
  label: string;
  proxy_value: number;
  unit: string;
  source: string;
  version: string;
}

export interface UseImpactValuationMethodologyResult {
  items: MethodologyItem[];
  proxyVersion: string | null;
  calculatedAt: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches the proxy values used in the latest Impact Valuation calculation
 * for the current organisation and year.
 */
export function useImpactValuationMethodology(
  reportingYear?: number
): UseImpactValuationMethodologyResult {
  const { currentOrganization } = useOrganization();
  const [items, setItems] = useState<MethodologyItem[]>([]);
  const [proxyVersion, setProxyVersion] = useState<string | null>(null);
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const year = reportingYear || new Date().getFullYear();

  const fetchMethodology = useCallback(async () => {
    if (!currentOrganization?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const supabase = getSupabaseBrowserClient();

      // 1. Fetch the latest result to get proxy_version and calculated_at
      const { data: latestResult, error: resultError } = await supabase
        .from('impact_valuation_results')
        .select('proxy_version, calculated_at')
        .eq('organization_id', currentOrganization.id)
        .eq('reporting_year', year)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (resultError) throw resultError;

      if (!latestResult) {
        // No calculation exists for this org/year
        setItems([]);
        setProxyVersion(null);
        setCalculatedAt(null);
        setIsLoading(false);
        return;
      }

      setProxyVersion(latestResult.proxy_version);
      setCalculatedAt(latestResult.calculated_at);

      // 2. Fetch all proxy values matching that version
      const { data: proxyValues, error: proxyError } = await supabase
        .from('impact_proxy_values')
        .select('capital, metric_key, label, proxy_value, unit, source, version')
        .eq('version', latestResult.proxy_version)
        .order('capital', { ascending: true })
        .order('metric_key', { ascending: true });

      if (proxyError) throw proxyError;

      setItems(
        (proxyValues || []).map((pv) => ({
          capital: pv.capital,
          metric_key: pv.metric_key,
          label: pv.label,
          proxy_value: Number(pv.proxy_value),
          unit: pv.unit,
          source: pv.source,
          version: pv.version,
        }))
      );
    } catch (err) {
      console.error('[useImpactValuationMethodology]', err);
      setError(err instanceof Error ? err.message : 'Failed to load methodology data');
    } finally {
      setIsLoading(false);
    }
  }, [currentOrganization?.id, year]);

  useEffect(() => {
    fetchMethodology();
  }, [fetchMethodology]);

  return {
    items,
    proxyVersion,
    calculatedAt,
    isLoading,
    error,
  };
}
