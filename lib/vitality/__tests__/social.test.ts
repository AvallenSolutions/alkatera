import { describe, expect, it } from 'vitest'
import {
  computeSocialScore,
  computeSupplierSubScore,
  socialYoySubScore,
} from '../social'

describe('computeSupplierSubScore', () => {
  it('blends mapping (40%) + certifications (30%) + attestations (30%)', () => {
    // 100% mapping × 0.4 = 40
    // 50% certs × 0.3 = 15
    // 50% attestations × 0.3 = 15
    // → 70
    const out = computeSupplierSubScore({
      mapping_coverage_pct: 100,
      certifications_coverage_pct: 50,
      attestations_pct: 50,
      suppliers_with_esg_form: 0,
      suppliers_total: 0,
    })
    expect(out.score).toBe(70)
  })

  it('treats null sub-axes as 0 (penalises gaps per locked preference)', () => {
    const out = computeSupplierSubScore({
      mapping_coverage_pct: null,
      certifications_coverage_pct: null,
      attestations_pct: null,
      suppliers_with_esg_form: 0,
      suppliers_total: 0,
    })
    expect(out.score).toBe(0)
  })

  it('exposes the breakdown for the explainer', () => {
    const out = computeSupplierSubScore({
      mapping_coverage_pct: 80,
      certifications_coverage_pct: 60,
      attestations_pct: 100,
      suppliers_with_esg_form: 1,
      suppliers_total: 5,
    })
    expect(out.breakdown).toEqual({
      mapping_coverage_pct: 80,
      certifications_coverage_pct: 60,
      attestations_pct: 100,
      suppliers_with_esg_form: 1,
      suppliers_total: 5,
    })
  })
})

describe('socialYoySubScore', () => {
  it('rewards a 3% improvement (score going UP) with the top mark', () => {
    expect(socialYoySubScore(3)).toBe(100)
    expect(socialYoySubScore(20)).toBe(100)
  })

  it('a flat year scores 80', () => {
    expect(socialYoySubScore(0)).toBe(80)
  })

  it('a regressing year (score went DOWN) is penalised', () => {
    expect(socialYoySubScore(-5)).toBe(40)
    expect(socialYoySubScore(-20)).toBe(5)
  })
})

describe('computeSocialScore', () => {
  const baseInputs = {
    workforce_score: 70,
    community_score: 60,
    supplier_inputs: {
      mapping_coverage_pct: 100,
      certifications_coverage_pct: 50,
      attestations_pct: 50,
      suppliers_with_esg_form: 0,
      suppliers_total: 0,
    },
    yoy_total_pct: 0,
  }

  it('blends 50/25/15/10 weights when all axes present', () => {
    // workforce 70 × 0.5 = 35
    // community 60 × 0.25 = 15
    // supplier 70 × 0.15 = 10.5
    // yoy 80 × 0.1 = 8
    // → 68.5 → 69
    const out = computeSocialScore(baseInputs)
    expect(out.score).toBe(69)
    expect(out.axes.workforce_sub).toBe(70)
    expect(out.axes.community_sub).toBe(60)
    expect(out.axes.supplier_sub).toBe(70)
    expect(out.axes.yoy_sub).toBe(80)
    expect(out.mode).toBe('blended')
  })

  it('treats missing axes as 0 per locked preference (no redistribution)', () => {
    const out = computeSocialScore({
      workforce_score: 80,
      community_score: null, // missing → counted as 0
      supplier_inputs: {
        mapping_coverage_pct: 0,
        certifications_coverage_pct: 0,
        attestations_pct: 0,
        suppliers_with_esg_form: 0,
        suppliers_total: 0,
      },
      yoy_total_pct: 0,
    })
    // workforce 80 × 0.5 + community 0 × 0.25 + supplier 0 × 0.15 + yoy 80 × 0.1
    // = 40 + 0 + 0 + 8 = 48
    expect(out.score).toBe(48)
    expect(out.axes.community_sub).toBeNull() // null preserved in breakdown
  })

  it('drops YoY weight when no prior-year data (only redistribution exception)', () => {
    const out = computeSocialScore({
      workforce_score: 80,
      community_score: 60,
      supplier_inputs: {
        mapping_coverage_pct: 50,
        certifications_coverage_pct: 50,
        attestations_pct: 50,
        suppliers_with_esg_form: 0,
        suppliers_total: 0,
      },
      yoy_total_pct: null,
    })
    // Without YoY: weights normalised to 0.5/0.25/0.15 = 0.9 total
    // (80×0.5 + 60×0.25 + 50×0.15) / 0.9 = (40 + 15 + 7.5) / 0.9 = 69.4 → 69
    expect(out.score).toBe(69)
    expect(out.axes.yoy_sub).toBeNull()
    expect(out.weights.yoy).toBe(0)
  })

  it('returns null when every signal is null (preserves no-data semantics)', () => {
    const out = computeSocialScore({
      workforce_score: null,
      community_score: null,
      supplier_inputs: null,
      yoy_total_pct: null,
    })
    expect(out.score).toBeNull()
    expect(out.mode).toBe('no_data')
  })

  it('exposes CSRD/SASB framework citation in source', () => {
    const out = computeSocialScore(baseInputs)
    expect(out.source.name).toContain('CSRD')
    expect(out.source.name).toContain('SASB')
  })
})
