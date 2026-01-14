import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

export interface WorkforceDemographics {
  id: string;
  organization_id: string;
  reporting_period: string;
  reporting_year: number;
  total_employees: number;
  total_fte: number | null;
  gender_data: Record<string, number>;
  ethnicity_data: Record<string, number>;
  age_data: Record<string, number>;
  disability_data: Record<string, number>;
  management_breakdown: {
    board: { total: number; gender: Record<string, number>; ethnicity: Record<string, number> };
    executive: { total: number; gender: Record<string, number>; ethnicity: Record<string, number> };
    senior_management: { total: number; gender: Record<string, number>; ethnicity: Record<string, number> };
    management: { total: number; gender: Record<string, number>; ethnicity: Record<string, number> };
    non_management: { total: number; gender: Record<string, number>; ethnicity: Record<string, number> };
  };
  employment_type_breakdown: Record<string, number>;
  new_hires: number;
  departures: number;
  voluntary_departures: number;
  response_rate: number | null;
  data_collection_method: string | null;
  created_at: string;
  updated_at: string;
}

export interface DEIAction {
  id: string;
  organization_id: string;
  action_name: string;
  action_category: string;
  description: string | null;
  target_group: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  target_date: string | null;
  completion_date: string | null;
  owner_name: string | null;
  owner_department: string | null;
  success_metrics: string | null;
  outcomes_achieved: string | null;
  evidence_links: { url: string; description: string; type: string }[];
  bcorp_requirement_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenderRepresentation {
  level: string;
  total: number;
  male: number;
  female: number;
  non_binary: number;
  not_disclosed: number;
  female_percentage: number;
}

export interface DiversityMetrics {
  demographics: WorkforceDemographics | null;
  demographics_history: WorkforceDemographics[];
  dei_actions: DEIAction[];
  dei_summary: {
    total: number;
    by_status: Record<string, number>;
    by_category: Record<string, number>;
    completion_rate: number;
  };
  gender_representation: GenderRepresentation[];
  representation_trends: {
    period: string;
    female_percentage: number;
    total_employees: number;
  }[];
  turnover_rate: number | null;
  voluntary_turnover_rate: number | null;
}

export function useDiversityMetrics(year?: number) {
  const { currentOrganization } = useOrganization();
  const [metrics, setMetrics] = useState<DiversityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiversityData = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentYear = year || new Date().getFullYear();

      // Fetch latest demographics
      const { data: latestDemographics, error: demoError } = await supabase
        .from('people_workforce_demographics')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('reporting_period', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (demoError && demoError.code !== 'PGRST116') throw demoError;

      // Fetch demographics history for trends
      const { data: demographicsHistory, error: historyError } = await supabase
        .from('people_workforce_demographics')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('reporting_period', { ascending: false })
        .limit(12);

      if (historyError && historyError.code !== 'PGRST116') {
        console.warn('Error fetching demographics history:', historyError);
      }

      // Fetch DEI actions
      const { data: deiActions, error: deiError } = await supabase
        .from('people_dei_actions')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (deiError && deiError.code !== 'PGRST116') throw deiError;

      const actions = deiActions || [];
      const history = demographicsHistory || [];

      // Calculate DEI summary
      const deiSummary = {
        total: actions.length,
        by_status: {} as Record<string, number>,
        by_category: {} as Record<string, number>,
        completion_rate: 0,
      };

      actions.forEach(action => {
        deiSummary.by_status[action.status] = (deiSummary.by_status[action.status] || 0) + 1;
        deiSummary.by_category[action.action_category] = (deiSummary.by_category[action.action_category] || 0) + 1;
      });

      const completedActions = actions.filter(a => a.status === 'completed').length;
      deiSummary.completion_rate = actions.length > 0 ? (completedActions / actions.length) * 100 : 0;

      // Calculate gender representation by level
      const genderRepresentation: GenderRepresentation[] = [];
      if (latestDemographics?.management_breakdown) {
        const breakdown = latestDemographics.management_breakdown;
        const levels = ['board', 'executive', 'senior_management', 'management', 'non_management'];

        levels.forEach(level => {
          const levelData = breakdown[level as keyof typeof breakdown];
          if (levelData && levelData.total > 0) {
            const gender = levelData.gender || {};
            const male = gender.male || 0;
            const female = gender.female || 0;
            const nonBinary = gender.non_binary || 0;
            const notDisclosed = levelData.total - male - female - nonBinary;

            genderRepresentation.push({
              level: level.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
              total: levelData.total,
              male,
              female,
              non_binary: nonBinary,
              not_disclosed: notDisclosed,
              female_percentage: (female / levelData.total) * 100,
            });
          }
        });
      }

      // Calculate representation trends
      const representationTrends = history.map(demo => {
        const genderData = demo.gender_data || {};
        const female = genderData.female || 0;
        const total = demo.total_employees || 1;

        return {
          period: demo.reporting_period,
          female_percentage: (female / total) * 100,
          total_employees: total,
        };
      }).reverse();

      // Calculate turnover rates
      let turnoverRate: number | null = null;
      let voluntaryTurnoverRate: number | null = null;

      if (latestDemographics) {
        const avgEmployees = latestDemographics.total_employees;
        if (avgEmployees > 0) {
          turnoverRate = (latestDemographics.departures / avgEmployees) * 100;
          voluntaryTurnoverRate = (latestDemographics.voluntary_departures / avgEmployees) * 100;
        }
      }

      setMetrics({
        demographics: latestDemographics || null,
        demographics_history: history,
        dei_actions: actions,
        dei_summary: deiSummary,
        gender_representation: genderRepresentation,
        representation_trends: representationTrends,
        turnover_rate: turnoverRate,
        voluntary_turnover_rate: voluntaryTurnoverRate,
      });

    } catch (err) {
      console.error('Error fetching diversity metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch diversity metrics');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, year]);

  useEffect(() => {
    fetchDiversityData();
  }, [fetchDiversityData]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchDiversityData,
  };
}
