import { describe, it, expect } from 'vitest'
import { scoreRecipeNature } from '@/lib/hospitality/nature-score'

describe('scoreRecipeNature', () => {
  it('flags beef as high risk and reports the hot-spot', () => {
    const s = scoreRecipeNature(['Beef mince', 'Onion', 'Tomato', 'Olive oil'])
    expect(s.risk_level).toBe('high')
    expect(s.high_risk.map((h) => h.name)).toContain('Beef mince')
    // 3 of 4 are plant-based
    expect(s.plant_forward_pct).toBe(75)
  })

  it('scores an all-plant recipe as low risk and 100% plant-forward', () => {
    const s = scoreRecipeNature(['Chickpeas', 'Spinach', 'Cumin', 'Lemon'])
    expect(s.risk_level).toBe('low')
    expect(s.plant_forward_pct).toBe(100)
    expect(s.high_risk).toHaveLength(0)
  })

  it('knocks a high-risk commodity down a band when certified', () => {
    const wild = scoreRecipeNature(['Cod fillet'])
    expect(wild.risk_level).toBe('high')
    const certified = scoreRecipeNature(['MSC certified cod fillet'])
    expect(certified.risk_level).toBe('medium')
  })

  it('handles an empty ingredient list', () => {
    const s = scoreRecipeNature([])
    expect(s.risk_level).toBe('low')
    expect(s.plant_forward_pct).toBe(100)
  })
})
