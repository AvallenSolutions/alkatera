import { describe, it, expect } from 'vitest';
import {
  mapPeopleCulture,
  pickLatestSnapshot,
  type PeopleCultureRaw,
  type PeopleCompensationRow,
} from '../people-culture';

const emptyRaw = (): PeopleCultureRaw => ({
  demographics: [],
  compensation: [],
  training: [],
  benefits: [],
  deiActions: [],
  surveys: [],
  engagementResponses: [],
});

const comp = (over: Partial<PeopleCompensationRow>): PeopleCompensationRow => ({
  hourly_rate: null,
  annual_salary: null,
  work_country: 'United Kingdom',
  work_region: null,
  gender: null,
  employment_type: 'full_time',
  role_level: null,
  ...over,
});

describe('mapPeopleCulture', () => {
  it('returns null (not fabricated values) for everything on an empty org', () => {
    const out = mapPeopleCulture(emptyRaw());
    expect(out.totalEmployees).toBeNull();
    expect(out.femalePercentage).toBeNull();
    expect(out.livingWageCompliance).toBeNull();
    expect(out.genderPayGapMean).toBeNull();
    expect(out.ceoWorkerPayRatio).toBeNull();
    expect(out.trainingHoursPerEmployee).toBeNull();
    expect(out.engagementScore).toBeNull();
    expect(out.newHires).toBeNull();
    expect(out.departures).toBeNull();
    expect(out.turnoverRate).toBeNull();
    expect(out.deiActionsTotal).toBeNull();
    expect(out.deiActionsCompleted).toBeNull();
    expect(out.benefits).toEqual([]);
    // Scores genuinely score an empty org at zero (0-100 scale).
    expect(out.overallScore).toBe(0);
    expect(out.dataCompleteness).toBe(0);
  });

  it('never emits the dashboard fallbacks: living wage stays null with no rates, pay gap stays null with no male salaries', () => {
    const raw = emptyRaw();
    // Rows exist but none yields an hourly rate, and all salaries are female.
    raw.compensation = [
      comp({ gender: 'female', annual_salary: 30000 }),
      comp({ gender: 'female', annual_salary: 32000 }),
      comp({ gender: 'female', annual_salary: 31000 }),
      comp({ gender: 'female', annual_salary: 29000 }),
      comp({ gender: 'female', annual_salary: 33000 }),
    ];
    const out = mapPeopleCulture(raw);
    expect(out.genderPayGapMean).toBeNull(); // NOT 0
    // Salaries convert to hourly, so living wage IS measured here...
    expect(out.livingWageCompliance).not.toBeNull();

    // ...but with no usable rate at all it must be null, NOT 50.
    const noRates = emptyRaw();
    noRates.compensation = [comp({}), comp({})];
    expect(mapPeopleCulture(noRates).livingWageCompliance).toBeNull();
  });

  it('computes femalePercentage over the gender_data denominator, not total_employees', () => {
    const raw = emptyRaw();
    raw.demographics = [
      {
        total_employees: 100, // deliberately different from the jsonb sum
        gender_data: { male: 6, female: 3, non_binary: 1 },
        new_hires: 5,
        departures: 10,
        reporting_period_end: '2025-12-31',
        snapshot_date: null,
        created_at: '2026-01-05',
      },
    ];
    const out = mapPeopleCulture(raw);
    // 3 of 10 disclosed, not 3 of 100.
    expect(out.femalePercentage).toBe(30);
    expect(out.totalEmployees).toBe(100);
    // turnoverRate = departures / totalEmployees, as 0-100.
    expect(out.turnoverRate).toBe(10);
    expect(out.newHires).toBe(5);
    expect(out.departures).toBe(10);
  });

  it('leaves turnover and training-per-employee null when headcount is unmeasured', () => {
    const raw = emptyRaw();
    raw.demographics = [
      {
        total_employees: null,
        gender_data: { male: 2, female: 2 },
        new_hires: null,
        departures: 3,
        reporting_period_end: null,
        snapshot_date: '2025-06-30',
        created_at: null,
      },
    ];
    raw.training = [{ total_hours: 40, participants: 4, participants_count: null }];
    const out = mapPeopleCulture(raw);
    expect(out.turnoverRate).toBeNull();
    expect(out.trainingHoursPerEmployee).toBeNull();
    expect(out.femalePercentage).toBe(50);
  });

  it('derives training hours per employee and scales engagement to 0-100', () => {
    const raw = emptyRaw();
    raw.demographics = [
      {
        total_employees: 20,
        gender_data: {},
        new_hires: 0,
        departures: 0,
        reporting_period_end: '2025-12-31',
        snapshot_date: null,
        created_at: null,
      },
    ];
    raw.training = [
      { total_hours: 100, participants: 10, participants_count: null },
      { total_hours: 60, participants: null, participants_count: 6 },
    ];
    raw.surveys = [{ id: 's1', survey_type: 'engagement', response_rate: 80 }];
    raw.engagementResponses = [{ avg_score: 4 }, { avg_score: 3 }];
    const out = mapPeopleCulture(raw);
    expect(out.trainingHoursPerEmployee).toBe(8); // 160 / 20
    // (3.5 / 5) * 100
    expect(out.engagementScore).toBe(70);
  });

  it('counts DEI actions and lists benefit names', () => {
    const raw = emptyRaw();
    raw.deiActions = [
      { status: 'completed', is_public: true },
      { status: 'in_progress', is_public: false },
    ];
    raw.benefits = [
      { benefit_name: 'Cycle to work', uptake_rate: 40 },
      { benefit_name: 'Private health', uptake_rate: null },
    ];
    const out = mapPeopleCulture(raw);
    expect(out.deiActionsTotal).toBe(2);
    expect(out.deiActionsCompleted).toBe(1);
    expect(out.benefits).toEqual(['Cycle to work', 'Private health']);
  });

  it('keeps every score on the 0-100 scale with rich data', () => {
    const raw = emptyRaw();
    raw.demographics = [
      {
        total_employees: 10,
        gender_data: { male: 5, female: 5 },
        new_hires: 2,
        departures: 1,
        reporting_period_end: '2025-12-31',
        snapshot_date: null,
        created_at: null,
      },
    ];
    raw.compensation = [
      ...Array(5).fill(comp({ gender: 'male', hourly_rate: 20 })),
      ...Array(5).fill(comp({ gender: 'female', hourly_rate: 20 })),
    ];
    raw.training = [{ total_hours: 200, participants: 10, participants_count: null }];
    raw.benefits = [{ benefit_name: 'Pension', uptake_rate: 90 }];
    raw.deiActions = [{ status: 'completed', is_public: true }];
    raw.surveys = [{ id: 's1', survey_type: 'engagement', response_rate: 75 }];
    raw.engagementResponses = [{ avg_score: 4.5 }];
    const out = mapPeopleCulture(raw);
    for (const v of [
      out.overallScore,
      out.fairWorkScore,
      out.diversityScore,
      out.wellbeingScore,
      out.trainingScore,
      out.dataCompleteness,
      out.livingWageCompliance!,
      out.engagementScore!,
      out.femalePercentage!,
      out.turnoverRate!,
    ]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(out.genderPayGapMean).toBe(0); // measured, genuinely zero gap
    expect(out.overallScore).toBeGreaterThan(1); // 0-100, not 0-1
    expect(out.dataCompleteness).toBeGreaterThan(1);
  });
});

describe('pickLatestSnapshot', () => {
  it('skips legacy per-dimension rows and picks the newest real snapshot', () => {
    const legacy = {
      total_employees: null,
      gender_data: null,
      new_hires: null,
      departures: null,
      reporting_period_end: '2025-12-31',
      snapshot_date: null,
      created_at: '2026-03-01',
    };
    const older = {
      total_employees: 8,
      gender_data: { male: 4, female: 4 },
      new_hires: 1,
      departures: 0,
      reporting_period_end: '2025-03-31',
      snapshot_date: null,
      created_at: '2025-04-01',
    };
    const newer = { ...older, total_employees: 9, reporting_period_end: '2025-09-30' };
    expect(pickLatestSnapshot([legacy, older, newer])).toBe(newer);
    expect(pickLatestSnapshot([legacy])).toBeNull();
  });
});
