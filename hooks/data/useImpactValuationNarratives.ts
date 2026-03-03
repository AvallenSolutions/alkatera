'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/organizationContext';

export interface UseImpactValuationNarrativesResult {
  boardSummary: string | null;
  retailTenderInsert: string | null;
  isLoading: boolean;
  error: string | null;
  regenerate: () => Promise<void>;
}

/**
 * Fetches AI-generated board summary and retail tender insert narratives
 * for the current organisation's Impact Valuation.
 *
 * Only calls the API if `hasResult` is true (i.e. a calculation exists).
 */
export function useImpactValuationNarratives(
  reportingYear?: number,
  hasResult = false
): UseImpactValuationNarrativesResult {
  const { currentOrganization } = useOrganization();
  const [boardSummary, setBoardSummary] = useState<string | null>(null);
  const [retailTenderInsert, setRetailTenderInsert] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNarratives = useCallback(
    async (force = false) => {
      if (!currentOrganization?.id || !hasResult) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/impact-valuation/narratives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportingYear: reportingYear || new Date().getFullYear(),
            force,
          }),
        });

        if (response.status === 404) {
          // No calculation exists — not an error, just no data yet
          return;
        }

        if (response.status === 403) {
          // Feature not available
          return;
        }

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errBody.error || `Request failed (${response.status})`);
        }

        const data = await response.json();
        setBoardSummary(data.boardSummary || null);
        setRetailTenderInsert(data.retailTenderInsert || null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to generate narratives';
        console.error('[useImpactValuationNarratives]', message);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [currentOrganization?.id, reportingYear, hasResult]
  );

  useEffect(() => {
    if (hasResult) {
      fetchNarratives();
    }
  }, [fetchNarratives, hasResult]);

  const regenerate = useCallback(async () => {
    await fetchNarratives(true);
  }, [fetchNarratives]);

  return {
    boardSummary,
    retailTenderInsert,
    isLoading,
    error,
    regenerate,
  };
}
