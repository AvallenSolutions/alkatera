import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useOrganization } from '@/lib/organizationContext';

export interface EmployeeSurvey {
  id: string;
  organization_id: string;
  survey_name: string;
  survey_type: string;
  survey_provider: string | null;
  description: string | null;
  status: string;
  launch_date: string | null;
  close_date: string | null;
  total_invited: number;
  total_responses: number;
  response_rate: number | null;
  is_anonymous: boolean;
  survey_questions: unknown[];
  created_at: string;
  updated_at: string;
}

/** Matches a single row in people_survey_responses */
export interface SurveyResponseRow {
  id: string;
  survey_id: string;
  organization_id: string;
  question_category: string | null;
  question_text: string | null;
  avg_score: number | null;
  response_count: number | null;
  score_1_count: number;
  score_2_count: number;
  score_3_count: number;
  score_4_count: number;
  score_5_count: number;
  positive_sentiment_percentage: number | null;
  neutral_sentiment_percentage: number | null;
  negative_sentiment_percentage: number | null;
  created_at: string;
  updated_at: string;
}

/** Aggregated category scores derived from multiple SurveyResponseRow records */
export interface AggregatedSurveyScores {
  category_scores: Record<string, number>;
  overall_score: number | null;
}

export interface Benefit {
  id: string;
  organization_id: string;
  benefit_name: string;
  benefit_type: string;
  description: string | null;
  eligibility_criteria: string | null;
  eligible_employee_count: number | null;
  uptake_count: number;
  uptake_rate: number | null;
  employer_contribution: number | null;
  employee_contribution: number | null;
  currency: string;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
  reporting_year: number;
  created_at: string;
  updated_at: string;
}

export interface BenefitTypeBreakdown {
  type: string;
  type_display: string;
  count: number;
  avg_uptake_rate: number;
  total_employer_contribution: number;
}

export interface WellbeingMetrics {
  surveys: EmployeeSurvey[];
  latest_survey: EmployeeSurvey | null;
  latest_responses: AggregatedSurveyScores | null;
  benefits: Benefit[];
  active_benefits_count: number;
  benefit_summary: {
    total: number;
    avg_uptake_rate: number;
    total_employer_investment: number;
    by_type: BenefitTypeBreakdown[];
  };
  engagement_score: number | null;
  wellbeing_score: number | null;
  survey_participation_trend: {
    survey_name: string;
    date: string;
    response_rate: number;
  }[];
}

const BENEFIT_TYPE_LABELS: Record<string, string> = {
  health: 'Health & Medical',
  pension: 'Pension & Retirement',
  leave: 'Leave & Time Off',
  flexible_working: 'Flexible Working',
  wellness: 'Wellness Programs',
  financial: 'Financial Benefits',
  family: 'Family Support',
  development: 'Learning & Development',
};

export function useWellbeingMetrics(year?: number) {
  const { currentOrganization } = useOrganization();
  const [metrics, setMetrics] = useState<WellbeingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWellbeingData = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentYear = year || new Date().getFullYear();

      // Fetch surveys with responses
      const { data: surveyData, error: surveyError } = await supabase
        .from('people_employee_surveys')
        .select('*, people_survey_responses(*)')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (surveyError && surveyError.code !== 'PGRST116') throw surveyError;

      // Fetch benefits
      const { data: benefitData, error: benefitError } = await supabase
        .from('people_benefits')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('reporting_year', currentYear)
        .order('benefit_type')
        .order('benefit_name');

      if (benefitError && benefitError.code !== 'PGRST116') throw benefitError;

      const surveys = surveyData || [];
      const benefits = benefitData || [];

      // Find latest completed survey
      const completedSurveys = surveys.filter(s => s.status === 'closed' || s.total_responses > 0);
      const latestSurvey = completedSurveys[0] || null;

      // Aggregate per-row responses into a category_scores map
      let latestResponses: AggregatedSurveyScores | null = null;
      if (latestSurvey?.people_survey_responses && latestSurvey.people_survey_responses.length > 0) {
        const responseRows = latestSurvey.people_survey_responses as SurveyResponseRow[];
        const categoryScores: Record<string, number> = {};
        let totalScore = 0;
        let scoreCount = 0;

        for (const row of responseRows) {
          if (row.question_category && row.avg_score !== null) {
            categoryScores[row.question_category] = row.avg_score;
            totalScore += row.avg_score;
            scoreCount++;
          }
        }

        latestResponses = {
          category_scores: categoryScores,
          overall_score: scoreCount > 0 ? totalScore / scoreCount : null,
        };
      }

      // Calculate benefit summary
      const activeBenefits = benefits.filter(b => b.is_active);
      const uptakeRates = activeBenefits.filter(b => b.uptake_rate).map(b => b.uptake_rate!);
      const avgUptakeRate = uptakeRates.length > 0
        ? uptakeRates.reduce((a, b) => a + b, 0) / uptakeRates.length
        : 0;

      const totalEmployerInvestment = benefits.reduce((sum, b) => sum + (b.employer_contribution || 0), 0);

      // Group benefits by type
      const byTypeMap: Record<string, { count: number; uptake_sum: number; uptake_count: number; contribution: number }> = {};
      benefits.forEach(benefit => {
        const type = benefit.benefit_type || 'other';
        if (!byTypeMap[type]) {
          byTypeMap[type] = { count: 0, uptake_sum: 0, uptake_count: 0, contribution: 0 };
        }
        byTypeMap[type].count++;
        if (benefit.uptake_rate) {
          byTypeMap[type].uptake_sum += benefit.uptake_rate;
          byTypeMap[type].uptake_count++;
        }
        byTypeMap[type].contribution += benefit.employer_contribution || 0;
      });

      const byType: BenefitTypeBreakdown[] = Object.entries(byTypeMap)
        .map(([type, data]) => ({
          type,
          type_display: BENEFIT_TYPE_LABELS[type] || type,
          count: data.count,
          avg_uptake_rate: data.uptake_count > 0 ? data.uptake_sum / data.uptake_count : 0,
          total_employer_contribution: data.contribution,
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate engagement and wellbeing scores from survey data
      let engagementScore: number | null = null;
      let wellbeingScore: number | null = null;

      if (latestResponses) {
        engagementScore = latestResponses.category_scores?.engagement ?? latestResponses.overall_score;
        wellbeingScore = latestResponses.category_scores?.wellbeing ?? latestResponses.overall_score;
      }

      // Calculate survey participation trend
      const surveyParticipationTrend = completedSurveys
        .filter(s => s.response_rate)
        .map(s => ({
          survey_name: s.survey_name,
          date: s.close_date || s.launch_date || s.created_at,
          response_rate: s.response_rate!,
        }))
        .slice(0, 10)
        .reverse();

      setMetrics({
        surveys,
        latest_survey: latestSurvey,
        latest_responses: latestResponses,
        benefits,
        active_benefits_count: activeBenefits.length,
        benefit_summary: {
          total: benefits.length,
          avg_uptake_rate: avgUptakeRate,
          total_employer_investment: totalEmployerInvestment,
          by_type: byType,
        },
        engagement_score: engagementScore,
        wellbeing_score: wellbeingScore,
        survey_participation_trend: surveyParticipationTrend,
      });

    } catch (err) {
      console.error('Error fetching wellbeing metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch wellbeing metrics');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, year]);

  useEffect(() => {
    fetchWellbeingData();
  }, [fetchWellbeingData]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchWellbeingData,
  };
}
