/**
 * People & Culture report section fetcher.
 *
 * House pattern (lib/provenance/rollup.ts): `gatherPeopleCulture` does ONLY
 * I/O — no auth, the caller passes an already-scoped Supabase client (RLS
 * from routes, service-role from Inngest) — and `mapPeopleCulture` is the
 * pure, unit-testable half.
 *
 * YEAR POLICY: strict by `reporting_year` on every people_* table (all of
 * them carry the column with a DB default of the entry year, so no row can
 * be missing it). A 2025 report never borrows 2026 salary rows.
 *
 * Computes LIVE from raw tables — never reads the people_culture_scores
 * snapshot, which only refreshes when a user visits the dashboard.
 *
 * No invented fallbacks (this is a published disclosure, not a dashboard):
 * - livingWageCompliance is null when no compensation row yields an hourly
 *   rate — never the dashboard's fabricated 50.
 * - genderPayGapMean is null when calculateGenderPayGap reports insufficient
 *   data (fewer than 5 salaries of either gender) — never 0.
 * - totalEmployees comes from the year's demographics snapshot only; the
 *   dashboard's fallback to "number of compensation rows" is a fabricated
 *   headcount and is deliberately not reproduced here.
 * Null means "not yet measured" downstream; every score/rate on the payload
 * is 0-100.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  analyzeLivingWageCompliance,
  calculateGenderPayGap,
  calculatePayRatios,
  calculatePeopleCultureScore,
  type CompensationRecord,
  type PeopleCultureScoreInput,
} from '@/lib/calculations/people-culture-score';
import type { PeopleCultureData } from './types';

// ============================================================================
// Raw row shapes (only the columns the mapper reads)
// ============================================================================

export interface PeopleDemographicsRow {
  total_employees: number | null;
  gender_data: Record<string, number> | null;
  new_hires: number | null;
  departures: number | null;
  reporting_period_end: string | null;
  snapshot_date: string | null;
  created_at: string | null;
}

export interface PeopleCompensationRow {
  hourly_rate: number | null;
  annual_salary: number | null;
  work_country: string | null;
  work_region: string | null;
  gender: string | null;
  employment_type: string | null;
  role_level: string | null;
}

export interface PeopleTrainingRow {
  total_hours: number | null;
  participants: number | null;
  participants_count: number | null;
}

export interface PeopleBenefitRow {
  benefit_name: string | null;
  uptake_rate: number | null;
}

export interface PeopleDeiActionRow {
  status: string | null;
  is_public: boolean | null;
}

export interface PeopleSurveyRow {
  id: string;
  survey_type: string | null;
  response_rate: number | null;
}

export interface PeopleSurveyResponseRow {
  /** 1-5 category average from people_survey_responses. */
  avg_score: number | null;
}

export interface PeopleCultureRaw {
  demographics: PeopleDemographicsRow[];
  compensation: PeopleCompensationRow[];
  training: PeopleTrainingRow[];
  benefits: PeopleBenefitRow[];
  deiActions: PeopleDeiActionRow[];
  /** Completed surveys for the reporting year (any type). */
  surveys: PeopleSurveyRow[];
  /** Category-average rows belonging to the year's completed ENGAGEMENT surveys. */
  engagementResponses: PeopleSurveyResponseRow[];
}

// ============================================================================
// Pure mapper
// ============================================================================

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The demographics table holds two row shapes: legacy per-dimension rows
 * (dimension/category_value/employee_count) and full workforce snapshots
 * (total_employees + gender_data jsonb). Only snapshots can answer headcount
 * questions, so pick the latest row that actually is one.
 */
export function pickLatestSnapshot(
  rows: PeopleDemographicsRow[],
): PeopleDemographicsRow | null {
  const snapshots = rows.filter(
    (r) =>
      r.total_employees != null ||
      (r.gender_data != null && Object.keys(r.gender_data).length > 0),
  );
  if (snapshots.length === 0) return null;
  const sortKey = (r: PeopleDemographicsRow) =>
    r.reporting_period_end ?? r.snapshot_date ?? r.created_at ?? '';
  return [...snapshots].sort((a, b) => sortKey(b).localeCompare(sortKey(a)))[0];
}

export function mapPeopleCulture(raw: PeopleCultureRaw): PeopleCultureData {
  const snapshot = pickLatestSnapshot(raw.demographics);

  const totalEmployees = snapshot?.total_employees ?? null;

  // femalePercentage over the gender_data jsonb denominator (sum of all
  // disclosed categories), NOT over total_employees — the jsonb may cover a
  // subset of the workforce and using total_employees would understate.
  const genderData = snapshot?.gender_data ?? null;
  const genderDenominator = genderData
    ? Object.values(genderData).reduce((sum, n) => sum + (n || 0), 0)
    : 0;
  const femalePercentage =
    genderData && genderDenominator > 0
      ? round1(((genderData['female'] ?? 0) / genderDenominator) * 100)
      : null;

  const newHires = snapshot?.new_hires ?? null;
  const departures = snapshot?.departures ?? null;
  // turnoverRate = departures / totalEmployees, as a 0-100 percentage.
  const turnoverRate =
    departures != null && totalEmployees != null && totalEmployees > 0
      ? round1((departures / totalEmployees) * 100)
      : null;

  // ---- Compensation-derived metrics, via the shared lib helpers ----
  const compRecords: CompensationRecord[] = raw.compensation.map((c) => ({
    hourly_rate: c.hourly_rate ?? null,
    annual_salary: c.annual_salary ?? null,
    work_country: c.work_country ?? '',
    work_region: c.work_region ?? null,
    gender: c.gender ?? null,
    employment_type: c.employment_type ?? 'full_time',
    role_level: c.role_level ?? null,
  }));

  const livingWage = analyzeLivingWageCompliance(compRecords);
  const livingWageMeasured =
    livingWage.employees_above_living_wage + livingWage.employees_below_living_wage > 0;
  const livingWageCompliance = livingWageMeasured
    ? round1(livingWage.compliance_rate)
    : null;

  const payGap = calculateGenderPayGap(compRecords);
  const genderPayGapMean = payGap.has_sufficient_data
    ? payGap.mean_gap_percentage
    : null;

  const payRatios = calculatePayRatios(compRecords);
  const ceoWorkerPayRatio =
    payRatios.median_salary > 0 ? payRatios.ceo_to_median_ratio : null;

  // ---- Training ----
  const totalTrainingHours = raw.training.reduce(
    (sum, t) => sum + (t.total_hours || 0),
    0,
  );
  const trainingHoursPerEmployee =
    raw.training.length > 0 && totalEmployees != null && totalEmployees > 0
      ? round1(totalTrainingHours / totalEmployees)
      : null;
  const totalTrainingParticipants = raw.training.reduce(
    (sum, t) => sum + (t.participants ?? t.participants_count ?? 0),
    0,
  );
  const trainingParticipationRate =
    raw.training.length > 0 && totalEmployees != null && totalEmployees > 0
      ? Math.min(100, round1((totalTrainingParticipants / totalEmployees) * 100))
      : undefined;

  // ---- Surveys / engagement ----
  const responseRates = raw.surveys
    .map((s) => s.response_rate)
    .filter((r): r is number => r != null);
  const surveyResponseRate =
    responseRates.length > 0
      ? responseRates.reduce((a, b) => a + b, 0) / responseRates.length
      : undefined;

  const engagementScores = raw.engagementResponses
    .map((r) => r.avg_score)
    .filter((s): s is number => s != null);
  // Stored 1-5 per category; payload contract is 0-100.
  const engagementAvg5 =
    engagementScores.length > 0
      ? engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length
      : null;
  const engagementScore =
    engagementAvg5 != null ? round1((engagementAvg5 / 5) * 100) : null;

  // ---- Benefits ----
  const benefits = raw.benefits
    .map((b) => b.benefit_name)
    .filter((n): n is string => !!n);
  const uptakeRates = raw.benefits
    .map((b) => b.uptake_rate)
    .filter((r): r is number => r != null);
  const benefitUptakeRate =
    uptakeRates.length > 0
      ? uptakeRates.reduce((a, b) => a + b, 0) / uptakeRates.length
      : undefined;

  // ---- DEI actions ----
  const deiActionsTotal = raw.deiActions.length > 0 ? raw.deiActions.length : null;
  const deiActionsCompleted =
    raw.deiActions.length > 0
      ? raw.deiActions.filter((a) => a.status === 'completed').length
      : null;

  // ---- Composite score (only measured inputs; undefined = not measured,
  // so the scorer's data-completeness denominator stays honest) ----
  const scoreInput: Partial<PeopleCultureScoreInput> = {
    ...(livingWageCompliance != null
      ? { livingWageComplianceRate: livingWageCompliance }
      : {}),
    ...(genderPayGapMean != null ? { genderPayGapMean } : {}),
    ...(ceoWorkerPayRatio != null ? { payRatio: ceoWorkerPayRatio } : {}),
    ...(genderData && genderDenominator > 0
      ? { genderDiversityRatio: (genderData['female'] ?? 0) / genderDenominator }
      : {}),
    ...(raw.deiActions.length > 0
      ? {
          hasPublishedDEICommitments: raw.deiActions.some((a) => a.is_public === true),
          deiActionsCompletedRate:
            (raw.deiActions.filter((a) => a.status === 'completed').length /
              raw.deiActions.length) *
            100,
        }
      : {}),
    ...(benefitUptakeRate != null ? { benefitUptakeRate } : {}),
    ...(surveyResponseRate != null ? { surveyResponseRate } : {}),
    ...(engagementAvg5 != null ? { engagementScore: engagementAvg5 } : {}),
    ...(trainingHoursPerEmployee != null
      ? { avgTrainingHoursPerEmployee: trainingHoursPerEmployee }
      : {}),
    ...(trainingParticipationRate != null ? { trainingParticipationRate } : {}),
  };
  const score = calculatePeopleCultureScore(scoreInput);

  return {
    overallScore: score.overall_score,
    fairWorkScore: score.fair_work_score,
    diversityScore: score.diversity_score,
    wellbeingScore: score.wellbeing_score,
    trainingScore: score.training_score,
    dataCompleteness: score.data_completeness,
    livingWageCompliance,
    genderPayGapMean,
    ceoWorkerPayRatio,
    trainingHoursPerEmployee,
    engagementScore,
    totalEmployees,
    femalePercentage,
    newHires,
    departures,
    turnoverRate,
    deiActionsTotal,
    deiActionsCompleted,
    benefits,
  };
}

// ============================================================================
// Gather (I/O only)
// ============================================================================

export async function gatherPeopleCulture(
  supabase: SupabaseClient,
  organizationId: string,
  year: number,
): Promise<PeopleCultureData> {
  const [demographics, compensation, training, benefits, deiActions, surveys] =
    await Promise.all([
      supabase
        .from('people_workforce_demographics')
        .select(
          'total_employees, gender_data, new_hires, departures, reporting_period_end, snapshot_date, created_at',
        )
        .eq('organization_id', organizationId)
        .eq('reporting_year', year),
      supabase
        .from('people_employee_compensation')
        .select(
          'hourly_rate, annual_salary, work_country, work_region, gender, employment_type, role_level',
        )
        .eq('organization_id', organizationId)
        .eq('reporting_year', year),
      supabase
        .from('people_training_records')
        .select('total_hours, participants, participants_count')
        .eq('organization_id', organizationId)
        .eq('reporting_year', year),
      supabase
        .from('people_benefits')
        .select('benefit_name, uptake_rate')
        .eq('organization_id', organizationId)
        .eq('reporting_year', year),
      supabase
        .from('people_dei_actions')
        .select('status, is_public')
        .eq('organization_id', organizationId)
        .eq('reporting_year', year),
      // Only completed surveys carry results worth disclosing (drafts have
      // no responses; matches the dashboard's own filter).
      supabase
        .from('people_employee_surveys')
        .select('id, survey_type, response_rate')
        .eq('organization_id', organizationId)
        .eq('reporting_year', year)
        .eq('status', 'completed'),
    ]);

  for (const res of [demographics, compensation, training, benefits, deiActions, surveys]) {
    if (res.error) throw new Error(`gatherPeopleCulture: ${res.error.message}`);
  }

  // Engagement category scores live in people_survey_responses (1-5 averages),
  // keyed by survey — a second, dependent fetch scoped to the year's
  // completed engagement surveys.
  const engagementSurveyIds = ((surveys.data ?? []) as PeopleSurveyRow[])
    .filter((s) => s.survey_type === 'engagement')
    .map((s) => s.id);
  let engagementResponses: PeopleSurveyResponseRow[] = [];
  if (engagementSurveyIds.length > 0) {
    const responses = await supabase
      .from('people_survey_responses')
      .select('avg_score')
      .eq('organization_id', organizationId)
      .in('survey_id', engagementSurveyIds);
    if (responses.error) {
      throw new Error(`gatherPeopleCulture: ${responses.error.message}`);
    }
    engagementResponses = (responses.data ?? []) as PeopleSurveyResponseRow[];
  }

  return mapPeopleCulture({
    demographics: (demographics.data ?? []) as PeopleDemographicsRow[],
    compensation: (compensation.data ?? []) as PeopleCompensationRow[],
    training: (training.data ?? []) as PeopleTrainingRow[],
    benefits: (benefits.data ?? []) as PeopleBenefitRow[],
    deiActions: (deiActions.data ?? []) as PeopleDeiActionRow[],
    surveys: (surveys.data ?? []) as PeopleSurveyRow[],
    engagementResponses,
  });
}
