import { describe, it, expect } from 'vitest'
import { resolveSuppressions, computeAttributions } from '../coverage-resolver'
import type { EmissionSource, ResolvedEmissionRow, ScopeSlice } from '../types'

function row(
  source: EmissionSource,
  scopeSlice: ScopeSlice,
  period: string,
  kgCO2e: number,
  opts: { id?: string; suppressed?: boolean; suppressedBy?: EmissionSource | null } = {},
): ResolvedEmissionRow {
  return {
    source,
    sourceRowId: opts.id ?? `${source}-${scopeSlice}-${period}-${kgCO2e}`,
    scopeSlice,
    period,
    kgCO2e,
    suppressed: opts.suppressed ?? false,
    suppressedBy: opts.suppressedBy ?? null,
  }
}

describe('resolveSuppressions', () => {
  it('utility bill beats Xero for Scope 2 electricity same month', () => {
    const out = resolveSuppressions([
      row('utility_data_entries', 'scope2.electricity', '2026-03', 100),
      row('xero_transactions', 'scope2.electricity', '2026-03', 80),
    ])
    const xero = out.find((r) => r.source === 'xero_transactions')!
    const utility = out.find((r) => r.source === 'utility_data_entries')!
    expect(utility.suppressed).toBe(false)
    expect(xero.suppressed).toBe(true)
    expect(xero.suppressedBy).toBe('utility_data_entries')
  })

  it('corporate_overheads beats Xero for business travel same month', () => {
    const out = resolveSuppressions([
      row('xero_transactions', 'scope3.business_travel', '2026-03', 50),
      row('corporate_overheads', 'scope3.business_travel', '2026-03', 70),
    ])
    expect(out.find((r) => r.source === 'corporate_overheads')!.suppressed).toBe(false)
    expect(out.find((r) => r.source === 'xero_transactions')!.suppressed).toBe(true)
  })

  it('corporate_overheads beats Xero for downstream_logistics (freight)', () => {
    const out = resolveSuppressions([
      row('xero_transactions', 'scope3.downstream_logistics', '2026-02', 200),
      row('corporate_overheads', 'scope3.downstream_logistics', '2026-02', 180),
    ])
    expect(out.find((r) => r.source === 'xero_transactions')!.suppressed).toBe(true)
  })

  it('raw materials / packaging are warn-only (no rule, no suppression)', () => {
    const out = resolveSuppressions([
      row('xero_transactions', 'scope3.products', '2026-03', 500),
      row('product_lca', 'scope3.products', '2026-03', 900),
    ])
    expect(out.every((r) => !r.suppressed)).toBe(true)
  })

  it('slices not in SOURCE_PRIORITY pass through untouched', () => {
    const out = resolveSuppressions([
      row('fleet_activities', 'scope1.fleet', '2026-03', 100),
      row('xero_transactions', 'scope1.fleet', '2026-03', 50),
    ])
    expect(out.every((r) => !r.suppressed)).toBe(true)
  })

  it('does not cross-suppress across periods', () => {
    const out = resolveSuppressions([
      row('utility_data_entries', 'scope2.electricity', '2026-01', 100),
      row('xero_transactions', 'scope2.electricity', '2026-02', 80),
    ])
    expect(out.every((r) => !r.suppressed)).toBe(true)
  })

  it('preserves pre-existing suppression (upgrade_status=upgraded)', () => {
    const out = resolveSuppressions([
      row('xero_transactions', 'scope2.electricity', '2026-03', 80, {
        suppressed: true,
      }),
    ])
    expect(out[0].suppressed).toBe(true)
  })

  it('no winner: if only governed but non-listed sources present, pass through', () => {
    // Only xero present for electricity — xero IS in the rule, so it wins
    const out = resolveSuppressions([
      row('xero_transactions', 'scope2.electricity', '2026-03', 80),
    ])
    expect(out[0].suppressed).toBe(false)
  })

  it('keeps non-governed sources untouched alongside a winning rule', () => {
    // scope3.business_travel rule lists corporate_overheads, xero_transactions.
    // fleet_activities is not in the rule — should pass through neutral.
    const out = resolveSuppressions([
      row('corporate_overheads', 'scope3.business_travel', '2026-03', 100),
      row('xero_transactions', 'scope3.business_travel', '2026-03', 50),
      row('fleet_activities', 'scope3.business_travel', '2026-03', 20),
    ])
    expect(out.find((r) => r.source === 'fleet_activities')!.suppressed).toBe(false)
    expect(out.find((r) => r.source === 'xero_transactions')!.suppressed).toBe(true)
    expect(out.find((r) => r.source === 'corporate_overheads')!.suppressed).toBe(false)
  })
})

describe('computeAttributions', () => {
  it('aggregates winning kgCO2e and lists suppressed sources', () => {
    const resolved = resolveSuppressions([
      row('utility_data_entries', 'scope2.electricity', '2026-03', 100),
      row('xero_transactions', 'scope2.electricity', '2026-03', 80, { id: 'x1' }),
      row('xero_transactions', 'scope2.electricity', '2026-03', 20, { id: 'x2' }),
    ])
    const atts = computeAttributions(resolved)
    expect(atts).toHaveLength(1)
    expect(atts[0].winningSource).toBe('utility_data_entries')
    expect(atts[0].kgCO2e).toBe(100)
    expect(atts[0].suppressedSources).toHaveLength(1)
    expect(atts[0].suppressedSources[0]).toEqual({
      source: 'xero_transactions',
      rowCount: 2,
      kgCO2e: 100,
    })
  })

  it('sorts by slice then period', () => {
    const atts = computeAttributions([
      row('utility_data_entries', 'scope2.electricity', '2026-03', 10),
      row('utility_data_entries', 'scope1.natural_gas', '2026-02', 20),
      row('utility_data_entries', 'scope1.natural_gas', '2026-01', 15),
    ])
    expect(atts.map((a) => `${a.scopeSlice}|${a.period}`)).toEqual([
      'scope1.natural_gas|2026-01',
      'scope1.natural_gas|2026-02',
      'scope2.electricity|2026-03',
    ])
  })
})
