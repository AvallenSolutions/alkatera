'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/hooks/useOrganization';

export interface CommunityImpactScore {
  id: string;
  organization_id: string;
  overall_score: number | null;
  giving_score: number | null;
  local_impact_score: number | null;
  volunteering_score: number | null;
  engagement_score: number | null;
  data_completeness: number | null;
  calculated_at: string;
}

export interface UseCommunityImpactScoreResult {
  score: CommunityImpactScore | null;
  history: Array<{ overall_score: number; calculated_at: string }>;
  loading: boolean;
  error: string | null;
  recalculate: () => Promise<void>;
}

export function useCommunityImpactScore(): UseCommunityImpactScoreResult {
  const { organization } = useOrganization();
  const [score, setScore] = useState<CommunityImpactScore | null>(null);
  const [history, setHistory] = useState<Array<{ overall_score: number; calculated_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScore = useCallback(async () => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/community-impact/score?organization_id=${organization.id}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch community impact score');
      }

      const data = await response.json();
      setScore(data.current);
      setHistory(data.history || []);
    } catch (err) {
      console.error('Error fetching community impact score:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch score');
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  const recalculate = useCallback(async () => {
    if (!organization?.id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/community-impact/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organization.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to recalculate score');
      }

      await fetchScore();
    } catch (err) {
      console.error('Error recalculating score:', err);
      setError(err instanceof Error ? err.message : 'Failed to recalculate');
      throw err;
    }
  }, [organization?.id, fetchScore]);

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
