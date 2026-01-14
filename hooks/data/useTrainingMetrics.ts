import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

export interface TrainingRecord {
  id: string;
  organization_id: string;
  training_name: string;
  training_type: string;
  description: string | null;
  provider_type: string | null;
  provider_name: string | null;
  delivery_method: string | null;
  hours_per_participant: number;
  total_hours: number | null;
  participants: number;
  eligible_employees: number | null;
  start_date: string | null;
  completion_date: string | null;
  reporting_year: number;
  certification_awarded: boolean;
  certification_name: string | null;
  cost_per_participant: number | null;
  total_cost: number | null;
  currency: string;
  completion_rate: number | null;
  satisfaction_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingTypeBreakdown {
  type: string;
  type_display: string;
  count: number;
  total_hours: number;
  total_participants: number;
  avg_hours_per_participant: number;
}

export interface TrainingMetrics {
  records: TrainingRecord[];
  total_records: number;
  total_hours: number;
  total_participants: number;
  avg_hours_per_employee: number;
  by_type: TrainingTypeBreakdown[];
  by_delivery_method: Record<string, { count: number; hours: number }>;
  certifications_awarded: number;
  total_investment: number;
  investment_per_employee: number;
  avg_satisfaction: number | null;
  avg_completion_rate: number | null;
  monthly_trend: {
    month: string;
    hours: number;
    participants: number;
  }[];
}

const TRAINING_TYPE_LABELS: Record<string, string> = {
  mandatory: 'Mandatory',
  professional_development: 'Professional Development',
  leadership: 'Leadership',
  dei: 'Diversity, Equity & Inclusion',
  health_safety: 'Health & Safety',
  sustainability: 'Sustainability',
  technical: 'Technical Skills',
};

export function useTrainingMetrics(year?: number) {
  const { currentOrganization } = useOrganization();
  const [metrics, setMetrics] = useState<TrainingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainingData = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentYear = year || new Date().getFullYear();

      // Fetch training records
      const { data: trainingData, error: trainingError } = await supabase
        .from('people_training_records')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('reporting_year', currentYear)
        .order('completion_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (trainingError) throw trainingError;

      // Fetch demographics for per-employee calculations
      const { data: demographicsData, error: demoError } = await supabase
        .from('people_workforce_demographics')
        .select('total_employees')
        .eq('organization_id', currentOrganization.id)
        .order('reporting_period', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (demoError && demoError.code !== 'PGRST116') {
        console.warn('Error fetching demographics:', demoError);
      }

      const records = trainingData || [];
      const totalEmployees = demographicsData?.total_employees || 1;

      // Calculate totals
      const totalHours = records.reduce((sum, r) => sum + (r.total_hours || 0), 0);
      const totalParticipants = records.reduce((sum, r) => sum + (r.participants || 0), 0);
      const totalInvestment = records.reduce((sum, r) => sum + (r.total_cost || 0), 0);
      const certificationsAwarded = records.filter(r => r.certification_awarded).length;

      // Calculate averages
      const satisfactionScores = records.filter(r => r.satisfaction_score).map(r => r.satisfaction_score!);
      const completionRates = records.filter(r => r.completion_rate).map(r => r.completion_rate!);

      const avgSatisfaction = satisfactionScores.length > 0
        ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length
        : null;
      const avgCompletionRate = completionRates.length > 0
        ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
        : null;

      // Group by type
      const byTypeMap: Record<string, { count: number; hours: number; participants: number }> = {};
      records.forEach(record => {
        const type = record.training_type || 'other';
        if (!byTypeMap[type]) {
          byTypeMap[type] = { count: 0, hours: 0, participants: 0 };
        }
        byTypeMap[type].count++;
        byTypeMap[type].hours += record.total_hours || 0;
        byTypeMap[type].participants += record.participants || 0;
      });

      const byType: TrainingTypeBreakdown[] = Object.entries(byTypeMap)
        .map(([type, data]) => ({
          type,
          type_display: TRAINING_TYPE_LABELS[type] || type,
          count: data.count,
          total_hours: data.hours,
          total_participants: data.participants,
          avg_hours_per_participant: data.participants > 0 ? data.hours / data.participants : 0,
        }))
        .sort((a, b) => b.total_hours - a.total_hours);

      // Group by delivery method
      const byDeliveryMethod: Record<string, { count: number; hours: number }> = {};
      records.forEach(record => {
        const method = record.delivery_method || 'not_specified';
        if (!byDeliveryMethod[method]) {
          byDeliveryMethod[method] = { count: 0, hours: 0 };
        }
        byDeliveryMethod[method].count++;
        byDeliveryMethod[method].hours += record.total_hours || 0;
      });

      // Calculate monthly trend
      const monthlyMap: Record<string, { hours: number; participants: number }> = {};
      records.forEach(record => {
        if (record.completion_date) {
          const month = record.completion_date.substring(0, 7); // YYYY-MM
          if (!monthlyMap[month]) {
            monthlyMap[month] = { hours: 0, participants: 0 };
          }
          monthlyMap[month].hours += record.total_hours || 0;
          monthlyMap[month].participants += record.participants || 0;
        }
      });

      const monthlyTrend = Object.entries(monthlyMap)
        .map(([month, data]) => ({
          month,
          hours: data.hours,
          participants: data.participants,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setMetrics({
        records,
        total_records: records.length,
        total_hours: totalHours,
        total_participants: totalParticipants,
        avg_hours_per_employee: totalHours / totalEmployees,
        by_type: byType,
        by_delivery_method: byDeliveryMethod,
        certifications_awarded: certificationsAwarded,
        total_investment: totalInvestment,
        investment_per_employee: totalInvestment / totalEmployees,
        avg_satisfaction: avgSatisfaction,
        avg_completion_rate: avgCompletionRate,
        monthly_trend: monthlyTrend,
      });

    } catch (err) {
      console.error('Error fetching training metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch training metrics');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, year]);

  useEffect(() => {
    fetchTrainingData();
  }, [fetchTrainingData]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchTrainingData,
  };
}
