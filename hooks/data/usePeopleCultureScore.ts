import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

export interface PeopleCultureScore {
  id: string;
  organization_id: string;
  calculation_date: string;
  reporting_year: number;
  overall_score: number;
  fair_work_score: number | null;
  diversity_score: number | null;
  wellbeing_score: number | null;
  training_score: number | null;
  living_wage_compliance: number | null;
  gender_pay_gap_mean: number | null;
  gender_pay_gap_median: number | null;
  ceo_worker_pay_ratio: number | null;
  training_hours_per_employee: number | null;
  employee_engagement_score: number | null;
  data_completeness: number | null;
  calculation_metadata: Record<string, unknown> | null;
}

export interface PeopleCultureSummary {
  organization_id: string;
  organization_name: string;
  total_employees: number;
  gender_data: Record<string, number> | null;
  latest_demographics_date: string | null;
  compensation_records: number | null;
  avg_salary: number | null;
  calculated_pay_gap: number | null;
  total_training_hours: number;
  training_hours_per_employee: number;
  dei_total_actions: number;
  dei_completed_actions: number;
  people_culture_score: number | null;
  fair_work_score: number | null;
  diversity_score: number | null;
  wellbeing_score: number | null;
  training_score: number | null;
  living_wage_compliance: number | null;
  gender_pay_gap_mean: number | null;
  score_calculation_date: string | null;
}

export function usePeopleCultureScore(year?: number) {
  const { currentOrganization } = useOrganization();
  const [score, setScore] = useState<PeopleCultureScore | null>(null);
  const [summary, setSummary] = useState<PeopleCultureSummary | null>(null);
  const [history, setHistory] = useState<PeopleCultureScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasAutoCalculated = useRef(false);

  const fetchScore = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentYear = year || new Date().getFullYear();

      // Fetch latest score
      const { data: scoreData, error: scoreError } = await supabase
        .from('people_culture_scores')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('reporting_year', currentYear)
        .order('calculation_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scoreError && scoreError.code !== 'PGRST116') {
        throw scoreError;
      }

      setScore(scoreData || null);

      // Fetch score history
      const { data: historyData, error: historyError } = await supabase
        .from('people_culture_scores')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('calculation_date', { ascending: false })
        .limit(12);

      if (historyError && historyError.code !== 'PGRST116') {
        console.warn('Error fetching score history:', historyError);
      } else {
        setHistory(historyData || []);
      }

      // Fetch summary view
      const { data: summaryData, error: summaryError } = await supabase
        .from('people_culture_summary')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (summaryError && summaryError.code !== 'PGRST116') {
        console.warn('Error fetching summary:', summaryError);
      } else {
        setSummary(summaryData || null);
      }

      // Auto-calculate if no score exists yet (first visit)
      if (!scoreData && !hasAutoCalculated.current) {
        hasAutoCalculated.current = true;
        try {
          const response = await fetch('/api/people-culture/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year: currentYear }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.score) {
              setScore(result.score);
              setHistory(prev => [result.score, ...prev]);
            }
          }
        } catch (calcErr) {
          console.warn('Auto-calculation failed (non-critical):', calcErr);
        }
      }

    } catch (err) {
      console.error('Error fetching people culture score:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch score');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, year]);

  const recalculateScore = useCallback(async () => {
    if (!currentOrganization?.id) return null;

    try {
      const response = await fetch('/api/people-culture/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: year || new Date().getFullYear() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to recalculate score');
      }

      const result = await response.json();

      // Refresh data after recalculation
      await fetchScore();

      return result.score;
    } catch (err) {
      console.error('Error recalculating score:', err);
      throw err;
    }
  }, [currentOrganization?.id, year, fetchScore]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  return {
    score,
    summary,
    history,
    loading,
    error,
    refetch: fetchScore,
    recalculate: recalculateScore,
  };
}
