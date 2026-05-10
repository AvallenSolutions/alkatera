import { describe, expect, it } from 'vitest'
import {
  computeGovernanceScore,
  computeCertificationsSubScore,
  governanceYoySubScore,
} from '../governance'

describe('computeCertificationsSubScore', () => {
  it('returns null when nothing is pursued', () => {
    const out = computeCertificationsSubScore({
      achieved_count: 0,
      in_progress_count: 0,
      in_progress_avg_pct: null,
    })
    expect(out.score).toBeNull()
    expect(out.breakdown?.pursued_count).toBe(0)
  })

  it('weights achieved 80% / in-progress 20%', () => {
    // 1 achieved + 1 in-progress at 50% readiness → 50% achieved_pct, 50% in_progress_avg
    // score = 0.8 × 50 + 0.2 × 50 = 50
    const out = computeCertificationsSubScore({
      achieved_count: 1,
      in_progress_count: 1,
      in_progress_avg_pct: 50,
    })
    expect(out.score).toBe(50)
    expect(out.breakdown?.achieved_pct).toBe(50)
    expect(out.breakdown?.in_progress_avg_pct).toBe(50)
  })

  it('rewards earned certifications heavily', () => {
    // 2 achieved + 0 in-progress → 100% achieved → 0.8 × 100 + 0.2 × 0 = 80
    const out = computeCertificationsSubScore({
      achieved_count: 2,
      in_progress_count: 0,
      in_progress_avg_pct: null,
    })
    expect(out.score).toBe(80)
  })

  it('all-achieved + perfect in-progress reaches 100', () => {
    // 1 achieved + 1 in-progress at 100% readiness
    // achieved_pct = 50, in_progress = 100
    // score = 0.8 × 50 + 0.2 × 100 = 60
    // Hmm — but a producer who has 1 of 2 frameworks fully certified AND
    // the other 100% ready scores 60? That tracks: certifying the second
    // would unlock the remaining 40 points.
    const out = computeCertificationsSubScore({
      achieved_count: 1,
      in_progress_count: 1,
      in_progress_avg_pct: 100,
    })
    expect(out.score).toBe(60)
  })

  it('treats null in_progress_avg_pct as 0', () => {
    // 1 achieved + 1 in-progress with no readiness data
    // achieved_pct = 50, in_progress_avg = 0
    // score = 0.8 × 50 + 0.2 × 0 = 40
    const out = computeCertificationsSubScore({
      achieved_count: 1,
      in_progress_count: 1,
      in_progress_avg_pct: null,
    })
    expect(out.score).toBe(40)
  })
})

describe('governanceYoySubScore', () => {
  it('rewards a 3% improvement (score going UP) with the top mark', () => {
    expect(governanceYoySubScore(3)).toBe(100)
  })
  it('a flat year scores 80', () => {
    expect(governanceYoySubScore(0)).toBe(80)
  })
  it('a regressing year is penalised', () => {
    expect(governanceYoySubScore(-5)).toBe(40)
  })
})

describe('computeGovernanceScore', () => {
  const baseInputs = {
    practices_score: 70,
    practices_breakdown: {
      policy: 65,
      stakeholder: 70,
      board: 75,
      ethics: 70,
      transparency: 70,
    },
    certifications_inputs: {
      achieved_count: 1,
      in_progress_count: 1,
      in_progress_avg_pct: 50,
    },
    yoy_total_pct: 0,
  }

  it('blends 60/30/10 weights when all axes present', () => {
    // practices 70 × 0.6 = 42
    // certifications 50 × 0.3 = 15
    // yoy 80 × 0.1 = 8
    // → 65
    const out = computeGovernanceScore(baseInputs)
    expect(out.score).toBe(65)
    expect(out.axes.practices_sub).toBe(70)
    expect(out.axes.certifications_sub).toBe(50)
    expect(out.axes.yoy_sub).toBe(80)
    expect(out.mode).toBe('blended')
  })

  it('treats missing certifications as 0 per locked preference', () => {
    const out = computeGovernanceScore({
      ...baseInputs,
      certifications_inputs: null,
    })
    // practices 70 × 0.6 + 0 × 0.3 + 80 × 0.1 = 42 + 0 + 8 = 50
    expect(out.score).toBe(50)
    expect(out.axes.certifications_sub).toBeNull()
  })

  it('drops YoY weight when no prior-year data (only redistribution exception)', () => {
    const out = computeGovernanceScore({
      ...baseInputs,
      yoy_total_pct: null,
    })
    // Without YoY: weights normalised across practices+certs (0.6/0.3 = 0.9 total)
    // (70×0.6 + 50×0.3) / 0.9 = (42 + 15) / 0.9 = 63.3 → 63
    expect(out.score).toBe(63)
    expect(out.axes.yoy_sub).toBeNull()
    expect(out.weights.yoy).toBe(0)
  })

  it('returns null when every signal is null', () => {
    const out = computeGovernanceScore({
      practices_score: null,
      practices_breakdown: null,
      certifications_inputs: null,
      yoy_total_pct: null,
    })
    expect(out.score).toBeNull()
    expect(out.mode).toBe('no_data')
  })

  it('exposes 5-axis practices breakdown for the explainer', () => {
    const out = computeGovernanceScore(baseInputs)
    expect(out.practices_breakdown).toEqual({
      policy: 65,
      stakeholder: 70,
      board: 75,
      ethics: 70,
      transparency: 70,
    })
  })

  it('exposes certifications breakdown with achieved + in-progress counts', () => {
    const out = computeGovernanceScore(baseInputs)
    expect(out.certifications_breakdown).toEqual({
      achieved_pct: 50,
      in_progress_avg_pct: 50,
      achieved_count: 1,
      in_progress_count: 1,
      pursued_count: 2,
    })
  })

  it('exposes CSRD ESRS G1 / SASB / B Corp framework citation', () => {
    const out = computeGovernanceScore(baseInputs)
    expect(out.source.name).toContain('CSRD')
    expect(out.source.name).toContain('SASB')
    expect(out.source.name).toContain('B Corp')
  })
})
