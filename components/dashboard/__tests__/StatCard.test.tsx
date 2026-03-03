import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Import component under test
import { StatCard } from '../StatCard'

// ── Tests ────────────────────────────────────────────────────────────────────

describe('StatCard', () => {
  it('renders skeleton when loading=true', () => {
    const { container } = render(
      <StatCard label="Emissions" value="120" unit="tCO₂e" href="/emissions" loading />
    )

    // When loading, no label/value text should be visible
    expect(screen.queryByText('Emissions')).toBeNull()
    expect(screen.queryByText('120')).toBeNull()
    // Skeleton elements should be present
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0)
  })

  it('renders label, value, and unit', () => {
    render(
      <StatCard label="Total Emissions" value="120" unit="tCO₂e" href="/emissions" />
    )

    expect(screen.getByText('Total Emissions')).toBeTruthy()
    expect(screen.getByText('120')).toBeTruthy()
    expect(screen.getByText('tCO₂e')).toBeTruthy()
  })

  it('wraps in Link with correct href', () => {
    render(
      <StatCard label="Emissions" value="120" unit="tCO₂e" href="/emissions" />
    )

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/emissions')
  })

  it('shows emerald dot for status "good"', () => {
    const { container } = render(
      <StatCard label="Compliance" value="95" unit="%" href="/compliance" status="good" />
    )

    const dot = container.querySelector('.bg-emerald-500')
    expect(dot).toBeTruthy()
  })

  it('shows amber dot for status "warning"', () => {
    const { container } = render(
      <StatCard label="Score" value="60" unit="pts" href="/score" status="warning" />
    )

    const dot = container.querySelector('.bg-amber-500')
    expect(dot).toBeTruthy()
  })

  it('shows red dot for status "critical"', () => {
    const { container } = render(
      <StatCard label="Risk" value="High" unit="" href="/risk" status="critical" />
    )

    const dot = container.querySelector('.bg-red-500')
    expect(dot).toBeTruthy()
  })

  it('shows slate dot for status "neutral"', () => {
    const { container } = render(
      <StatCard label="Neutral" value="50" unit="" href="/neutral" status="neutral" />
    )

    const dot = container.querySelector('.bg-slate-400')
    expect(dot).toBeTruthy()
  })

  it('shows up arrow with trend percentage', () => {
    render(
      <StatCard
        label="Emissions"
        value="120"
        unit="tCO₂e"
        href="/emissions"
        trend={12}
        trendDirection="up"
      />
    )

    expect(screen.getByText('↑ 12%')).toBeTruthy()
  })

  it('uses emerald for down trend when higherIsBetter=false', () => {
    const { container } = render(
      <StatCard
        label="Emissions"
        value="100"
        unit="tCO₂e"
        href="/emissions"
        trend={5}
        trendDirection="down"
        higherIsBetter={false}
      />
    )

    // Down trend on a metric where lower is better should be emerald (positive)
    const trendEl = screen.getByText('↓ 5%')
    expect(trendEl.className).toContain('emerald')
  })

  it('uses red for up trend when higherIsBetter=false', () => {
    const { container } = render(
      <StatCard
        label="Emissions"
        value="150"
        unit="tCO₂e"
        href="/emissions"
        trend={10}
        trendDirection="up"
        higherIsBetter={false}
      />
    )

    // Up trend on a metric where lower is better should be red (negative)
    const trendEl = screen.getByText('↑ 10%')
    expect(trendEl.className).toContain('red')
  })
})
