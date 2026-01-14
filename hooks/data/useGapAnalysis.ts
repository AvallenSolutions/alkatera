import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/hooks/useOrganization';

interface GapAnalysis {
  id: string;
  organization_id: string;
  framework_id: string;
  requirement_id: string;
  compliance_status: 'not_assessed' | 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
  current_score: number | null;
  gap_description: string | null;
  action_required: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical' | null;
  assigned_to: string | null;
  target_completion_date: string | null;
  notes: string | null;
  framework?: {
    name: string;
    code: string;
    version: string;
  };
  requirement?: {
    requirement_code: string;
    requirement_name: string;
    category: string;
    sub_category: string;
    points_available: number;
  };
}

interface GapSummary {
  total: number;
  compliant: number;
  partial: number;
  non_compliant: number;
  not_assessed: number;
  not_applicable: number;
  compliance_rate: number;
  total_points_available: number;
  total_points_achieved: number;
}

export function useGapAnalysis(frameworkId?: string) {
  const { organization } = useOrganization();
  const [analyses, setAnalyses] = useState<GapAnalysis[]>([]);
  const [summary, setSummary] = useState<GapSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyses = useCallback(async () => {
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

      const response = await fetch(`/api/certifications/gap-analysis?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch gap analyses');
      }

      const data = await response.json();
      setAnalyses(data.analyses || []);
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      console.error('Error fetching gap analyses:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [organization?.id, frameworkId]);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const updateGapAnalysis = async (
    requirementId: string,
    data: Partial<GapAnalysis>
  ) => {
    if (!organization?.id || !frameworkId) return null;

    try {
      const response = await fetch('/api/certifications/gap-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organization.id,
          framework_id: frameworkId,
          requirement_id: requirementId,
          ...data,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update gap analysis');
      }

      const result = await response.json();
      await fetchAnalyses();
      return result;
    } catch (err) {
      console.error('Error updating gap analysis:', err);
      throw err;
    }
  };

  const bulkUpdateStatus = async (
    requirementIds: string[],
    status: GapAnalysis['compliance_status']
  ) => {
    if (!organization?.id || !frameworkId) return;

    try {
      const updates = requirementIds.map(reqId =>
        updateGapAnalysis(reqId, { compliance_status: status })
      );
      await Promise.all(updates);
    } catch (err) {
      console.error('Error bulk updating gap analyses:', err);
      throw err;
    }
  };

  // Group analyses by category
  const analysesByCategory = analyses.reduce((acc: Record<string, GapAnalysis[]>, analysis) => {
    const category = analysis.requirement?.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(analysis);
    return acc;
  }, {});

  // Get high priority gaps
  const highPriorityGaps = analyses.filter(
    a => a.priority === 'high' || a.priority === 'critical'
  );

  // Get action items (non-compliant or partial with actions required)
  const actionItems = analyses.filter(
    a => (a.compliance_status === 'non_compliant' || a.compliance_status === 'partial') &&
         a.action_required
  );

  return {
    analyses,
    summary,
    analysesByCategory,
    highPriorityGaps,
    actionItems,
    loading,
    error,
    refetch: fetchAnalyses,
    updateGapAnalysis,
    bulkUpdateStatus,
  };
}
