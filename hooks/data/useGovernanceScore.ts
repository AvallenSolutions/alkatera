'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrganization } from '@/lib/organizationContext';

export interface GovernanceScore {
  id: string;
  organization_id: string;
  overall_score: number | null;
  policy_score: number | null;
  stakeholder_score: number | null;
  board_score: number | null;
  ethics_score: number | null;
  transparency_score: number | null;
  data_completeness: number | null;
  calculated_at: string;
  calculation_period_start: string;
  calculation_period_end: string;
}

export interface GovernanceScoreHistory {
  overall_score: number;
  calculated_at: string;
}

export interface UseGovernanceScoreResult {
  score: GovernanceScore | null;
  history: GovernanceScoreHistory[];
  loading: boolean;
  error: string | null;
  recalculate: () => Promise<void>;
}

export function useGovernanceScore(): UseGovernanceScoreResult {
  const { currentOrganization } = useOrganization();
  const [score, setScore] = useState<GovernanceScore | null>(null);
  const [history, setHistory] = useState<GovernanceScoreHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasAutoCalculated = useRef(false);

  const fetchScore = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/governance/score?organization_id=${currentOrganization.id}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch governance score');
      }

      const data = await response.json();
      setScore(data.current);
      setHistory(data.history || []);

      // Auto-calculate if no score exists yet (first visit)
      if (!data.current && !hasAutoCalculated.current) {
        hasAutoCalculated.current = true;
        try {
          const calcResponse = await fetch('/api/governance/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organization_id: currentOrganization.id }),
          });

          if (calcResponse.ok) {
            const newScore = await calcResponse.json();
            if (newScore) {
              setScore(newScore);
              setHistory(prev => [{ overall_score: newScore.overall_score, calculated_at: newScore.calculated_at }, ...prev]);
            }
          }
        } catch (calcErr) {
          console.warn('Auto-calculation failed (non-critical):', calcErr);
        }
      }
    } catch (err) {
      console.error('Error fetching governance score:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch score');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const recalculate = useCallback(async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/governance/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: currentOrganization.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to recalculate governance score');
      }

      // Refetch to get updated data
      await fetchScore();
    } catch (err) {
      console.error('Error recalculating governance score:', err);
      setError(err instanceof Error ? err.message : 'Failed to recalculate');
      throw err;
    }
  }, [currentOrganization?.id, fetchScore]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  return {
    score,
    history,
    loading,
    error,
    recalculate,
  };
}
