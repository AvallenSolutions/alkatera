import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FacilityDataDashboard } from '../FacilityDataDashboard';

// Helpers to build dates relative to the current month, since the dashboard
// always shows the last 12 months ending now.
const pad = (n: number) => String(n).padStart(2, '0');
const monthDate = (offset: number, day: number | 'last'): string => {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const d =
    day === 'last'
      ? new Date(base.getFullYear(), base.getMonth() + 1, 0)
      : new Date(base.getFullYear(), base.getMonth(), day);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const electricityEntry = (offset: number, quantity = 1000) => ({
  utility_type: 'electricity_grid',
  quantity,
  unit: 'kWh',
  reporting_period_start: monthDate(offset, 1),
  reporting_period_end: monthDate(offset, 'last'),
  data_quality: 'actual',
});

const noData = { utilityData: [], waterData: [], wasteData: [], dataContracts: [] };

describe('FacilityDataDashboard', () => {
  it('shows an empty state when nothing has been recorded', () => {
    render(<FacilityDataDashboard {...noData} />);
    expect(screen.getByText('No data recorded yet')).toBeInTheDocument();
  });

  it('shows monthly values and highlights gap months after tracking starts', () => {
    // Bills for 5, 4 and 2 months ago: gaps at 3 months ago and last month
    render(
      <FacilityDataDashboard
        {...noData}
        utilityData={[electricityEntry(-5), electricityEntry(-4), electricityEntry(-2, 2500)]}
      />
    );

    expect(screen.getByRole('button', { name: /Purchased Electricity/ })).toBeInTheDocument();

    const gapCells = screen.getAllByTitle(/no data recorded \(gap\)/);
    expect(gapCells).toHaveLength(2);

    // Current month is pending, not a gap
    expect(screen.getByTitle(/bill may not have arrived yet/)).toBeInTheDocument();

    // Coverage: 3 covered of 5 tracked months (current month excluded while empty)
    expect(screen.getByText('3/5')).toBeInTheDocument();

    // Monthly values land in the right cells
    expect(screen.getByTitle(/2,500 kWh/)).toBeInTheDocument();

    // Trend section renders with totals
    expect(screen.getByText('12-Month Trend')).toBeInTheDocument();
    expect(screen.getByText('Total (12 months)')).toBeInTheDocument();
  });

  it('spreads a quarterly bill across the months it covers instead of showing gaps', () => {
    const quarterlyWaterBill = {
      activity_category: 'water_intake',
      quantity: 300,
      unit: 'm3',
      reporting_period_start: monthDate(-3, 1),
      reporting_period_end: monthDate(-1, 'last'),
      data_provenance: 'primary_measured_onsite',
    };

    render(<FacilityDataDashboard {...noData} waterData={[quarterlyWaterBill]} />);

    expect(screen.getByRole('button', { name: /Water Intake/ })).toBeInTheDocument();
    expect(screen.queryAllByTitle(/no data recorded \(gap\)/)).toHaveLength(0);
    expect(screen.getByText('3/3')).toBeInTheDocument();

    // ~100 m3 allocated to each covered month (proportional by days)
    const coveredCells = screen.getAllByTitle(/m3$/);
    expect(coveredCells).toHaveLength(3);
  });

  it('shows a contracted utility with no entries as a full-gap row', () => {
    render(
      <FacilityDataDashboard {...noData} dataContracts={[{ utility_type: 'natural_gas' }]} />
    );

    expect(screen.getByRole('button', { name: /Natural Gas/ })).toBeInTheDocument();
    // 11 gap months (current month shows as pending instead)
    expect(screen.getAllByTitle(/no data recorded \(gap\)/)).toHaveLength(11);
    expect(screen.getByText('0/11')).toBeInTheDocument();
  });

  it('marks estimated data distinctly from actual data', () => {
    render(
      <FacilityDataDashboard
        {...noData}
        utilityData={[{ ...electricityEntry(-2), data_quality: 'estimated' }]}
      />
    );
    expect(screen.getByTitle(/\(estimated\)/)).toBeInTheDocument();
  });
});
