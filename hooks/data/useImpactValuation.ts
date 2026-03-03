'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';
import type { ImpactValuationResult } from '@/lib/calculations/impact-valuation';

export interface UseImpactValuationResult {
  result: ImpactValuationResult | null;
  isLoading: boolean;
  error: string | null;
  recalculate: () => Promise<void>;
}

export function useImpactValuation(reportingYear?: number): UseImpactValuationResult {
  const { currentOrganization } = useOrganization();
  const [result, setResult] = useState<ImpactValuationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchValuation = useCallback(
    async (force = false) => {
      if (!currentOrganization?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const queryParam = force ? '?force=true' : '';
        const response = await fetch(`/api/impact-valuation/calculate${queryParam}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportingYear: reportingYear || new Date().getFullYear() }),
        });

        if (response.status === 403) {
          // Feature not available — not an error, just no access
          setResult(null);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errBody.error || `Request failed (${response.status})`);
        }

        const data = await response.json();
        setResult(data.result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load impact valuation';
        console.error('[useImpactValuation]', message);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [currentOrganization?.id, reportingYear]
  );

  useEffect(() => {
    fetchValuation();
  }, [fetchValuation]);

  const recalculate = useCallback(async () => {
    await fetchValuation(true);
  }, [fetchValuation]);

  return {
    result,
    isLoading,
    error,
    recalculate,
  };
}
