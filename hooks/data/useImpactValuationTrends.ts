'use client';

import { useState, useEffect } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

export interface ImpactValuationTrendPoint {
  reporting_year: number;
  natural_total: number;
  human_total: number;
  social_total: number;
  governance_total: number;
  grand_total: number;
  positive_total: number;
  negative_total: number;
  data_coverage: number;
  confidence_level: string;
  calculated_at: string;
}

export interface UseImpactValuationTrendsResult {
  trends: ImpactValuationTrendPoint[];
  isLoading: boolean;
  error: string | null;
}

export function useImpactValuationTrends(): UseImpactValuationTrendsResult {
  const { currentOrganization } = useOrganization();
  const [trends, setTrends] = useState<ImpactValuationTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrends() {
      if (!currentOrganization?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const supabase = getSupabaseBrowserClient();
        // Query only columns guaranteed to exist pre-migration.
        // positive_total / negative_total are derived in JS for backward compat.
        const { data, error: queryError } = await supabase
          .from('impact_valuation_results')
          .select(
            'reporting_year, natural_total, human_total, social_total, governance_total, grand_total, human_living_wage_value, data_coverage, confidence_level, calculated_at'
          )
          .eq('organization_id', currentOrganization.id)
          .order('reporting_year', { ascending: true });

        if (queryError) {
          throw new Error(queryError.message);
        }

        if (!data || data.length === 0) {
          setTrends([]);
          return;
        }

        // Map rows to trend points — derive positive/negative from per-capital columns
        const mapped: ImpactValuationTrendPoint[] = data.map((row) => {
          const naturalTotal = Number(row.natural_total) || 0;
          const humanTotal = Number(row.human_total) || 0;
          const socialTotal = Number(row.social_total) || 0;
          const governanceTotal = Number(row.governance_total) || 0;
          const livingWageValue = Number(row.human_living_wage_value) || 0;

          const positiveTotal = (humanTotal - livingWageValue) + socialTotal + governanceTotal;
          const negativeTotal = naturalTotal + livingWageValue;

          return {
            reporting_year: Number(row.reporting_year),
            natural_total: naturalTotal,
            human_total: humanTotal,
            social_total: socialTotal,
            governance_total: governanceTotal,
            grand_total: positiveTotal - negativeTotal,
            positive_total: positiveTotal,
            negative_total: negativeTotal,
            data_coverage: (Number(row.data_coverage) || 0) / 100,
            confidence_level: (row.confidence_level as string) || 'low',
            calculated_at: row.calculated_at as string,
          };
        });

        setTrends(mapped);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load trends';
        console.error('[useImpactValuationTrends]', message);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTrends();
  }, [currentOrganization?.id]);

  return { trends, isLoading, error };
}
