import { describe, it, expect } from 'vitest'

/**
 * Tests for the DataQualityProgress computation logic.
 *
 * We extract and test the pure aggregation logic rather than rendering
 * the full React component (which depends on Supabase and org context).
 * This mirrors the pattern used in rosa-greeting.test.ts.
 */

// ── Extracted computation logic (mirrors DataQualityProgress.tsx) ─────────

interface QualityStats {
  total: number
  pending: number
  upgraded: number
  dismissed: number
  notApplicable: number
  tier1: number
  tier2: number
  tier3: number
  tier4: number
  baselineKg: number
  upgradedKg: number
}

interface TransactionRow {
  upgrade_status: string
  data_quality_tier: number | null
  spend_based_emissions_kg: number | null
}

function computeQualityStats(data: TransactionRow[]): QualityStats {
  const result: QualityStats = {
    total: data.length,
    pending: 0,
    upgraded: 0,
    dismissed: 0,
    notApplicable: 0,
    tier1: 0,
    tier2: 0,
    tier3: 0,
    tier4: 0,
    baselineKg: 0,
    upgradedKg: 0,
  }

  for (const tx of data) {
    switch (tx.upgrade_status) {
      case 'pending': result.pending++; break
      case 'upgraded': result.upgraded++; break
      case 'dismissed': result.dismissed++; break
      case 'not_applicable': result.notApplicable++; break
    }

    switch (tx.data_quality_tier) {
      case 1: result.tier1++; break
      case 2: result.tier2++; break
      case 3: result.tier3++; break
      case 4: result.tier4++; break
    }

    const emissions = Math.abs(tx.spend_based_emissions_kg || 0)
    if (tx.upgrade_status === 'upgraded') {
      result.upgradedKg += emissions
    } else if (tx.upgrade_status === 'pending') {
      result.baselineKg += emissions
    }
  }

  return result
}

function calculateQualityPercent(stats: QualityStats): number {
  const upgradeable = stats.pending + stats.upgraded
  return upgradeable > 0
    ? Math.round((stats.upgraded / upgradeable) * 100)
    : 0
}

function formatEmissions(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
  return `${Math.round(kg)} kg`
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('computeQualityStats', () => {
  it('counts upgrade statuses correctly', () => {
    const data: TransactionRow[] = [
      { upgrade_status: 'pending', data_quality_tier: 4, spend_based_emissions_kg: 100 },
      { upgrade_status: 'pending', data_quality_tier: 4, spend_based_emissions_kg: 200 },
      { upgrade_status: 'upgraded', data_quality_tier: 2, spend_based_emissions_kg: 150 },
      { upgrade_status: 'dismissed', data_quality_tier: 4, spend_based_emissions_kg: 50 },
      { upgrade_status: 'not_applicable', data_quality_tier: null, spend_based_emissions_kg: 0 },
    ]

    const stats = computeQualityStats(data)
    expect(stats.total).toBe(5)
    expect(stats.pending).toBe(2)
    expect(stats.upgraded).toBe(1)
    expect(stats.dismissed).toBe(1)
    expect(stats.notApplicable).toBe(1)
  })

  it('counts tiers correctly', () => {
    const data: TransactionRow[] = [
      { upgrade_status: 'pending', data_quality_tier: 4, spend_based_emissions_kg: 100 },
      { upgrade_status: 'upgraded', data_quality_tier: 2, spend_based_emissions_kg: 200 },
      { upgrade_status: 'upgraded', data_quality_tier: 1, spend_based_emissions_kg: 300 },
      { upgrade_status: 'pending', data_quality_tier: 3, spend_based_emissions_kg: 50 },
    ]

    const stats = computeQualityStats(data)
    expect(stats.tier1).toBe(1)
    expect(stats.tier2).toBe(1)
    expect(stats.tier3).toBe(1)
    expect(stats.tier4).toBe(1)
  })

  it('sums baseline and upgraded emissions separately', () => {
    const data: TransactionRow[] = [
      { upgrade_status: 'pending', data_quality_tier: 4, spend_based_emissions_kg: 100 },
      { upgrade_status: 'pending', data_quality_tier: 4, spend_based_emissions_kg: 200 },
      { upgrade_status: 'upgraded', data_quality_tier: 2, spend_based_emissions_kg: 500 },
    ]

    const stats = computeQualityStats(data)
    expect(stats.baselineKg).toBe(300)
    expect(stats.upgradedKg).toBe(500)
  })

  it('uses absolute value of negative emissions', () => {
    const data: TransactionRow[] = [
      { upgrade_status: 'pending', data_quality_tier: 4, spend_based_emissions_kg: -100 },
    ]

    const stats = computeQualityStats(data)
    expect(stats.baselineKg).toBe(100)
  })

  it('handles null emissions (treats as 0)', () => {
    const data: TransactionRow[] = [
      { upgrade_status: 'pending', data_quality_tier: 4, spend_based_emissions_kg: null },
    ]

    const stats = computeQualityStats(data)
    expect(stats.baselineKg).toBe(0)
  })

  it('handles empty data array', () => {
    const stats = computeQualityStats([])
    expect(stats.total).toBe(0)
    expect(stats.pending).toBe(0)
    expect(stats.baselineKg).toBe(0)
  })
})

describe('calculateQualityPercent', () => {
  it('returns correct percentage when some are upgraded', () => {
    const stats = computeQualityStats([
      { upgrade_status: 'pending', data_quality_tier: 4, spend_based_emissions_kg: 100 },
      { upgrade_status: 'upgraded', data_quality_tier: 2, spend_based_emissions_kg: 100 },
    ])
    expect(calculateQualityPercent(stats)).toBe(50)
  })

  it('returns 100 when all are upgraded', () => {
    const stats = computeQualityStats([
      { upgrade_status: 'upgraded', data_quality_tier: 2, spend_based_emissions_kg: 100 },
      { upgrade_status: 'upgraded', data_quality_tier: 1, spend_based_emissions_kg: 200 },
    ])
    expect(calculateQualityPercent(stats)).toBe(100)
  })

  it('returns 0 when none are upgraded', () => {
    const stats = computeQualityStats([
      { upgrade_status: 'pending', data_quality_tier: 4, spend_based_emissions_kg: 100 },
    ])
    expect(calculateQualityPercent(stats)).toBe(0)
  })

  it('returns 0 when no upgradeable transactions', () => {
    const stats = computeQualityStats([
      { upgrade_status: 'dismissed', data_quality_tier: 4, spend_based_emissions_kg: 100 },
      { upgrade_status: 'not_applicable', data_quality_tier: null, spend_based_emissions_kg: 0 },
    ])
    expect(calculateQualityPercent(stats)).toBe(0)
  })

  it('rounds to nearest integer', () => {
    const stats: QualityStats = {
      total: 3, pending: 2, upgraded: 1, dismissed: 0, notApplicable: 0,
      tier1: 0, tier2: 1, tier3: 0, tier4: 2, baselineKg: 0, upgradedKg: 0,
    }
    expect(calculateQualityPercent(stats)).toBe(33) // 1/3 = 33.33...
  })
})

describe('formatEmissions', () => {
  it('formats values >= 1000 kg as tonnes', () => {
    expect(formatEmissions(1500)).toBe('1.5 t')
  })

  it('formats values < 1000 kg as kg', () => {
    expect(formatEmissions(500)).toBe('500 kg')
  })

  it('formats 1000 kg as 1.0 t', () => {
    expect(formatEmissions(1000)).toBe('1.0 t')
  })

  it('formats 0 kg', () => {
    expect(formatEmissions(0)).toBe('0 kg')
  })

  it('rounds kg values to nearest integer', () => {
    expect(formatEmissions(499.7)).toBe('500 kg')
  })
})
