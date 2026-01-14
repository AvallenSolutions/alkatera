import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/hooks/useOrganization';

interface ScoreRecord {
  id: string;
  organization_id: string;
  framework_id: string;
  calculation_date: string;
  total_score: number;
  category_scores: Record<string, { achieved: number; available: number; percentage: number }>;
  requirements_met: number;
  requirements_partial: number;
  requirements_not_met: number;
  notes: string | null;
  framework?: {
    name: string;
    code: string;
    version: string;
  };
}

interface OrganizationCertification {
  id: string;
  organization_id: string;
  framework_id: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'certified' | 'expired';
  current_score: number | null;
  target_date: string | null;
  certification_date: string | null;
  framework?: {
    name: string;
    code: string;
    version: string;
    passing_score: number;
  };
}

interface ReadinessSummary {
  totalFrameworks: number;
  certified: number;
  ready: number;
  inProgress: number;
  notStarted: number;
  averageScore: number;
}

export function useCertificationScore(frameworkId?: string) {
  const { organization } = useOrganization();
  const [scoreHistory, setScoreHistory] = useState<ScoreRecord[]>([]);
  const [latestScores, setLatestScores] = useState<ScoreRecord[]>([]);
  const [certifications, setCertifications] = useState<OrganizationCertification[]>([]);
  const [readinessSummary, setReadinessSummary] = useState<ReadinessSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScores = useCallback(async () => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        organization_id: organization.id,
        ...(frameworkId && { framework_id: frameworkId }),
      });

      const response = await fetch(`/api/certifications/score?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch certification scores');
      }

      const data = await response.json();
      setScoreHistory(data.scoreHistory || []);
      setLatestScores(data.latestScores || []);
      setCertifications(data.certifications || []);
      setReadinessSummary(data.readinessSummary);
      setError(null);
    } catch (err) {
      console.error('Error fetching scores:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [organization?.id, frameworkId]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  const calculateScore = async (targetFrameworkId: string, notes?: string) => {
    if (!organization?.id) return null;

    try {
      const response = await fetch('/api/certifications/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organization.id,
          framework_id: targetFrameworkId,
          notes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate score');
      }

      const data = await response.json();
      await fetchScores();
      return data;
    } catch (err) {
      console.error('Error calculating score:', err);
      throw err;
    }
  };

  // Get latest score for a specific framework
  const getLatestScore = (fwId: string): ScoreRecord | undefined => {
    return latestScores.find(s => s.framework_id === fwId);
  };

  // Get certification status for a specific framework
  const getCertificationStatus = (fwId: string): OrganizationCertification | undefined => {
    return certifications.find(c => c.framework_id === fwId);
  };

  // Get score trend for a framework (last 6 scores)
  const getScoreTrend = (fwId: string): { date: string; score: number }[] => {
    return scoreHistory
      .filter(s => s.framework_id === fwId)
      .slice(0, 6)
      .map(s => ({
        date: s.calculation_date,
        score: s.total_score,
      }))
      .reverse();
  };

  // Check if ready for certification
  const isReadyForCertification = (fwId: string): boolean => {
    const cert = getCertificationStatus(fwId);
    const score = getLatestScore(fwId);
    const passingScore = cert?.framework?.passing_score || 80;
    return (score?.total_score || 0) >= passingScore;
  };

  return {
    scoreHistory,
    latestScores,
    certifications,
    readinessSummary,
    loading,
    error,
    refetch: fetchScores,
    calculateScore,
    getLatestScore,
    getCertificationStatus,
    getScoreTrend,
    isReadyForCertification,
  };
}
