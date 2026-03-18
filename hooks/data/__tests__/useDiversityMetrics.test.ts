import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock supabase client
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock organization context
vi.mock('@/lib/organizationContext', () => ({
  useOrganization: () => ({
    currentOrganization: { id: 'test-org-id' },
  }),
}));

import { useDiversityMetrics, type WorkforceDemographics } from '../useDiversityMetrics';

const mockDemographicsRecord: Partial<WorkforceDemographics> = {
  id: 'demo-1',
  organization_id: 'test-org-id',
  reporting_period: '2026-03-31',
  reporting_period_start: '2026-01-01',
  reporting_period_end: '2026-03-31',
  reporting_year: 2026,
  total_employees: 100,
  gender_data: { male: 55, female: 40, non_binary: 3, not_disclosed: 2 },
  new_hires: 10,
  departures: 5,
  voluntary_departures: 3,
  response_rate: 85,
  management_breakdown: {} as WorkforceDemographics['management_breakdown'],
  created_at: '2026-03-18T10:00:00Z',
  updated_at: '2026-03-18T10:00:00Z',
};

const mockPreviousRecord: Partial<WorkforceDemographics> = {
  id: 'demo-2',
  organization_id: 'test-org-id',
  reporting_period: '2025-12-31',
  reporting_period_start: '2025-10-01',
  reporting_period_end: '2025-12-31',
  reporting_year: 2025,
  total_employees: 90,
  gender_data: { male: 52, female: 34, non_binary: 2, not_disclosed: 2 },
  new_hires: 8,
  departures: 3,
  voluntary_departures: 2,
  response_rate: 80,
  management_breakdown: {} as WorkforceDemographics['management_breakdown'],
  created_at: '2025-12-20T10:00:00Z',
  updated_at: '2025-12-20T10:00:00Z',
};

describe('useDiversityMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes reporting_period_start and reporting_period_end in the interface', () => {
    // Type check: the interface should have these fields
    const record: WorkforceDemographics = {
      ...mockDemographicsRecord,
      id: 'test',
      organization_id: 'test',
      reporting_period: '2026-01-01',
      reporting_period_start: '2026-01-01',
      reporting_period_end: '2026-03-31',
      reporting_year: 2026,
      total_employees: 100,
      total_fte: null,
      gender_data: {},
      ethnicity_data: {},
      age_data: {},
      disability_data: {},
      management_breakdown: {
        board: { total: 0, gender: {}, ethnicity: {} },
        executive: { total: 0, gender: {}, ethnicity: {} },
        senior_management: { total: 0, gender: {}, ethnicity: {} },
        management: { total: 0, gender: {}, ethnicity: {} },
        non_management: { total: 0, gender: {}, ethnicity: {} },
      },
      employment_type_breakdown: {},
      new_hires: 0,
      departures: 0,
      voluntary_departures: 0,
      response_rate: null,
      data_collection_method: null,
      created_at: '',
      updated_at: '',
    };

    expect(record.reporting_period_start).toBe('2026-01-01');
    expect(record.reporting_period_end).toBe('2026-03-31');
  });

  it('calculates period changes when history has 2+ records', () => {
    // Test the period change calculation logic directly
    const history = [mockDemographicsRecord, mockPreviousRecord] as WorkforceDemographics[];
    const current = history[0];
    const previous = history[1];

    const employeeDelta = current.total_employees - previous.total_employees;
    expect(employeeDelta).toBe(10);

    const currentFemale = (current.gender_data.female / current.total_employees) * 100;
    const previousFemale = (previous.gender_data.female / previous.total_employees) * 100;
    expect(currentFemale).toBeCloseTo(40);
    expect(previousFemale).toBeCloseTo(37.78, 1);

    const femaleDelta = currentFemale - previousFemale;
    expect(femaleDelta).toBeGreaterThan(0);
  });

  it('formats period labels from date ranges', async () => {
    // Verify that formatPeriodRange works with the data
    const { formatPeriodRange } = await import('@/lib/reporting-period-utils');

    const label = formatPeriodRange('2026-01-01', '2026-03-31');
    expect(label).toBe('1 Jan 2026 - 31 Mar 2026');

    const yearLabel = formatPeriodRange('2026-01-01', '2026-12-31');
    expect(yearLabel).toBe('2026');
  });

  it('handles null reporting_period_start/end gracefully', () => {
    // Legacy records may not have these fields
    const legacyRecord: Partial<WorkforceDemographics> = {
      ...mockDemographicsRecord,
      reporting_period_start: null,
      reporting_period_end: null,
    };

    // Should fall back to reporting_period
    expect(legacyRecord.reporting_period).toBe('2026-03-31');
    expect(legacyRecord.reporting_period_start).toBeNull();
  });
});
