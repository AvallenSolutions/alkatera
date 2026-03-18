import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangePicker } from '../date-range-picker';

describe('DateRangePicker', () => {
  it('renders with placeholder text when no range selected', () => {
    render(
      <DateRangePicker
        value={undefined}
        onChange={() => {}}
        placeholder="Select date range"
      />
    );

    expect(screen.getByText('Select date range')).toBeInTheDocument();
  });

  it('displays formatted date range when values provided', () => {
    const value = {
      from: new Date(2026, 0, 1),
      to: new Date(2026, 2, 31),
    };

    render(
      <DateRangePicker value={value} onChange={() => {}} />
    );

    expect(screen.getByText(/1 Jan 2026/)).toBeInTheDocument();
    expect(screen.getByText(/31 Mar 2026/)).toBeInTheDocument();
  });

  it('displays only start date when no end date', () => {
    const value = {
      from: new Date(2026, 0, 1),
      to: undefined,
    };

    render(
      <DateRangePicker value={value} onChange={() => {}} />
    );

    expect(screen.getByText('1 Jan 2026')).toBeInTheDocument();
  });

  it('renders preset buttons when presets provided', () => {
    const presets = [
      { label: 'Q1', from: new Date(2026, 0, 1), to: new Date(2026, 2, 31) },
      { label: 'Q2', from: new Date(2026, 3, 1), to: new Date(2026, 5, 30) },
    ];

    render(
      <DateRangePicker
        value={undefined}
        onChange={() => {}}
        presets={presets}
      />
    );

    // Open the popover
    fireEvent.click(screen.getByRole('button', { name: /select date range/i }));

    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('Q2')).toBeInTheDocument();
  });

  it('calls onChange when a preset is clicked', () => {
    const onChange = vi.fn();
    const presets = [
      { label: 'Q1', from: new Date(2026, 0, 1), to: new Date(2026, 2, 31) },
    ];

    render(
      <DateRangePicker
        value={undefined}
        onChange={onChange}
        presets={presets}
      />
    );

    // Open the popover
    fireEvent.click(screen.getByRole('button', { name: /select date range/i }));

    // Click the preset
    fireEvent.click(screen.getByText('Q1'));

    expect(onChange).toHaveBeenCalledWith({
      from: presets[0].from,
      to: presets[0].to,
    });
  });

  it('respects disabled state', () => {
    render(
      <DateRangePicker
        value={undefined}
        onChange={() => {}}
        disabled
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('uses default placeholder when none provided', () => {
    render(
      <DateRangePicker value={undefined} onChange={() => {}} />
    );

    expect(screen.getByText('Select date range')).toBeInTheDocument();
  });
});
