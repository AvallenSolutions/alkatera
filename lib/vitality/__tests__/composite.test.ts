import { describe, expect, it } from 'vitest'
import {
  composeVitality,
  computeEnvironmentalPillar,
  computeGovernancePillar,
  computeSocialPillar,
  DEFAULT_VITALITY_WEIGHTS,
  normaliseWeights,
  scoreBand,
} from '../composite'

describe('normaliseWeights', () => {
  it('returns defaults when given null', () => {
    expect(normaliseWeights(null)).toEqual(DEFAULT_VITALITY_WEIGHTS)
  })

  it('returns defaults when given undefined', () => {
    expect(normaliseWeights(undefined)).toEqual(DEFAULT_VITALITY_WEIGHTS)
  })

  it('rescales weights so they sum to 1', () => {
    const w = normaliseWeights({ e: 0.6, s: 0.6, g: 0.6 })
    expect(w.e + w.s + w.g).toBeCloseTo(1, 5)
    expect(w.e).toBeCloseTo(1 / 3, 5)
  })

  it('clamps negative values to 0 then rescales', () => {
    const w = normaliseWeights({ e: -0.5, s: 0.5, g: 0.5 })
    expect(w.e).toBe(0)
    expect(w.s).toBeCloseTo(0.5, 5)
    expect(w.g).toBeCloseTo(0.5, 5)
  })

  it('clamps values above 1 to 1 then rescales', () => {
    const w = normaliseWeights({ e: 5, s: 0, g: 0 })
    expect(w.e).toBe(1)
    expect(w.s).toBe(0)
    expect(w.g).toBe(0)
  })

  it('falls back to default when total is zero', () => {
    expect(normaliseWeights({ e: 0, s: 0, g: 0 })).toEqual(DEFAULT_VITALITY_WEIGHTS)
  })

  it('handles partial input by filling defaults', () => {
    const w = normaliseWeights({ e: 0.7 })
    // s and g default to 0.25/0.25; total = 0.7 + 0.25 + 0.25 = 1.2 → rescaled
    expect(w.e + w.s + w.g).toBeCloseTo(1, 5)
    expect(w.e).toBeGreaterThan(w.s)
  })
})

describe('scoreBand', () => {
  it.each([
    [null, 'AWAITING DATA'],
    [85, 'EXCELLENT'],
    [99, 'EXCELLENT'],
    [70, 'HEALTHY'],
    [84, 'HEALTHY'],
    [50, 'DEVELOPING'],
    [69, 'DEVELOPING'],
    [30, 'EMERGING'],
    [49, 'EMERGING'],
    [29, 'NEEDS ATTENTION'],
    [0, 'NEEDS ATTENTION'],
  ])('score %p maps to band %s', (score, band) => {
    expect(scoreBand(score as number | null)).toBe(band)
  })
})

describe('computeEnvironmentalPillar', () => {
  it('returns null score with has_data=false when no inputs', () => {
    const r = computeEnvironmentalPillar({})
    expect(r.score).toBeNull()
    expect(r.has_data).toBe(false)
  })

  it('computes climate from intensity ratio', () => {
    const r = computeEnvironmentalPillar({
      totalEmissions: 10,
      emissionsIntensity: 0.5, // 50% of benchmark — well below 0.7x
      industryBenchmark: 1,
    })
    expect(r.sub.climate).toBe(90)
  })

  it('applies water risk levels', () => {
    expect(computeEnvironmentalPillar({ waterRiskLevel: 'low' }).sub.water).toBe(85)
    expect(computeEnvironmentalPillar({ waterRiskLevel: 'medium' }).sub.water).toBe(60)
    expect(computeEnvironmentalPillar({ waterRiskLevel: 'high' }).sub.water).toBe(35)
  })

  it('redistributes weights when only some sub-pillars have data', () => {
    const r = computeEnvironmentalPillar({
      waterRiskLevel: 'low', // 85
      biodiversityRisk: 'low', // 80
    })
    // Only water (25%) and nature (20%) — totalWeight 45
    // 85 * (25/45) + 80 * (20/45) = 47.22 + 35.56 = 82.78 → 83
    expect(r.score).toBe(83)
    expect(r.has_data).toBe(true)
  })

  it('prefers a precomputed climate_breakdown over the legacy ratio inputs', () => {
    const r = computeEnvironmentalPillar({
      // Legacy fields would say climate=70 (ratio=1.0); breakdown overrides.
      totalEmissions: 10,
      emissionsIntensity: 1.0,
      industryBenchmark: 1.0,
      climate_breakdown: {
        score: 88,
        intensity_sub: 90,
        yoy_sub: 85,
        mode: 'blended',
        weights: { intensity: 0.6, yoy: 0.4 },
      },
    })
    expect(r.sub.climate).toBe(88)
    expect(r.climate_breakdown).toEqual({
      score: 88,
      intensity_sub: 90,
      yoy_sub: 85,
      mode: 'blended',
      weights: { intensity: 0.6, yoy: 0.4 },
    })
  })

  it('honours a no_data climate_breakdown (no fallback to legacy)', () => {
    const r = computeEnvironmentalPillar({
      totalEmissions: 10,
      emissionsIntensity: 0.5,
      industryBenchmark: 1.0,
      climate_breakdown: {
        score: null,
        intensity_sub: null,
        yoy_sub: null,
        mode: 'no_data',
        weights: { intensity: 0, yoy: 0 },
      },
    })
    // Even though legacy fields say "great", an explicit no_data breakdown wins.
    expect(r.sub.climate).toBeNull()
    expect(r.climate_breakdown?.mode).toBe('no_data')
  })

  it('prefers a precomputed water_breakdown over the legacy waterRiskLevel', () => {
    const r = computeEnvironmentalPillar({
      // Legacy says "low risk → 85"; breakdown overrides with 65.
      waterRiskLevel: 'low',
      water_breakdown: {
        score: 65,
        intensity_sub: 70,
        yoy_sub: 60,
        mode: 'blended',
        weights: { intensity: 0.6, yoy: 0.4 },
        avg_scarcity_factor: 25,
        source: 'facility',
      },
    })
    expect(r.sub.water).toBe(65)
    expect(r.water_breakdown?.score).toBe(65)
    expect(r.water_breakdown?.avg_scarcity_factor).toBe(25)
    expect(r.water_breakdown?.source).toBe('facility')
  })

  it('honours a no_data water_breakdown (no fallback to legacy waterRiskLevel)', () => {
    const r = computeEnvironmentalPillar({
      waterRiskLevel: 'low',
      water_breakdown: {
        score: null,
        intensity_sub: null,
        yoy_sub: null,
        mode: 'no_data',
        weights: { intensity: 0, yoy: 0 },
        avg_scarcity_factor: null,
        source: null,
      },
    })
    expect(r.sub.water).toBeNull()
    expect(r.water_breakdown?.mode).toBe('no_data')
  })

  it('prefers a precomputed circularity_breakdown over the legacy ladder', () => {
    const emptyMix = {
      reuse: 0,
      composting: 0,
      anaerobic_digestion: 0,
      recycling: 0,
      incineration_with_recovery: 0,
      landfill: 0,
      incineration_without_recovery: 0,
      other: 0,
    }
    const r = computeEnvironmentalPillar({
      // Legacy says circularityRate 90 → score 95; breakdown overrides with 70.
      circularityRate: 90,
      hasWasteData: true,
      circularity_breakdown: {
        score: 70,
        practices_sub: 75,
        intensity_yoy_sub: 65,
        axes: {
          recycled_content_sub: 75,
          packaging_recyclability_sub: 75,
          diversion_sub: 75,
        },
        mode: 'blended',
        weights: { practices: 0.6, yoy: 0.4 },
        treatment_mix: { ...emptyMix, reuse: 0.6, recycling: 0.4 },
      },
    })
    expect(r.sub.circularity).toBe(70)
    expect(r.circularity_breakdown?.score).toBe(70)
    expect(r.circularity_breakdown?.practices_sub).toBe(75)
  })

  it('honours a no_data circularity_breakdown (no fallback to legacy ladder)', () => {
    const emptyMix = {
      reuse: 0,
      composting: 0,
      anaerobic_digestion: 0,
      recycling: 0,
      incineration_with_recovery: 0,
      landfill: 0,
      incineration_without_recovery: 0,
      other: 0,
    }
    const r = computeEnvironmentalPillar({
      circularityRate: 90,
      hasWasteData: true,
      circularity_breakdown: {
        score: null,
        practices_sub: null,
        intensity_yoy_sub: null,
        axes: {
          recycled_content_sub: null,
          packaging_recyclability_sub: null,
          diversion_sub: null,
        },
        mode: 'no_data',
        weights: { practices: 0, yoy: 0 },
        treatment_mix: emptyMix,
      },
    })
    expect(r.sub.circularity).toBeNull()
    expect(r.circularity_breakdown?.mode).toBe('no_data')
  })
})

describe('computeSocialPillar', () => {
  it('returns null when all sub-scores are null', () => {
    const r = computeSocialPillar({
      community_score: null,
      people_culture_score: null,
      supplier_esg_pct: null,
    })
    expect(r.score).toBeNull()
    expect(r.has_data).toBe(false)
  })

  it('averages available sub-scores', () => {
    const r = computeSocialPillar({
      community_score: 60,
      people_culture_score: 80,
      supplier_esg_pct: null,
    })
    expect(r.score).toBe(70)
  })

  it('treats supplier_esg_pct as a 0-100 score', () => {
    const r = computeSocialPillar({
      community_score: null,
      people_culture_score: null,
      supplier_esg_pct: 40,
    })
    expect(r.score).toBe(40)
  })
})

describe('computeGovernancePillar', () => {
  it('returns null when both inputs are null', () => {
    const r = computeGovernancePillar({
      governance_score: null,
      cert_progress_pct: null,
    })
    expect(r.score).toBeNull()
    expect(r.has_data).toBe(false)
  })

  it('weights governance 85% and certifications 15%', () => {
    const r = computeGovernancePillar({
      governance_score: 80,
      cert_progress_pct: 0,
    })
    expect(r.score).toBe(68) // 80 * 0.85 = 68
  })

  it('uses cert progress alone when governance is missing', () => {
    const r = computeGovernancePillar({
      governance_score: null,
      cert_progress_pct: 60,
    })
    expect(r.score).toBe(60)
  })

  it('uses governance alone when certifications are missing', () => {
    const r = computeGovernancePillar({
      governance_score: 70,
      cert_progress_pct: null,
    })
    expect(r.score).toBe(70)
  })
})

describe('composeVitality', () => {
  const baseE = computeEnvironmentalPillar({
    totalEmissions: 10,
    emissionsIntensity: 0.6,
    industryBenchmark: 1,
  })
  const baseS = computeSocialPillar({
    community_score: 60,
    people_culture_score: 60,
    supplier_esg_pct: 60,
  })
  const baseG = computeGovernancePillar({
    governance_score: 80,
    cert_progress_pct: 40,
  })

  it('combines pillars by weighted average', () => {
    const out = composeVitality({
      e: baseE,
      s: baseS,
      g: baseG,
      weights: { e: 0.5, s: 0.25, g: 0.25 },
    })
    // E = 90 (climate ratio 0.6 → climate 90; only climate has data so score = 90)
    // S = 60
    // G = 80 * 0.85 + 40 * 0.15 = 74
    // composite = 90 * 0.5 + 60 * 0.25 + 74 * 0.25 = 45 + 15 + 18.5 = 78.5 → 79
    expect(out.composite).toBe(79)
    expect(out.band).toBe('HEALTHY')
  })

  it('redistributes when a pillar has no data', () => {
    const out = composeVitality({
      e: { score: null, has_data: false, sub: {} as never },
      s: baseS,
      g: baseG,
      weights: { e: 0.5, s: 0.25, g: 0.25 },
    })
    // E missing → S and G share. totalWeight 0.5 → S 60 * 0.5 + G 74 * 0.5 = 67
    expect(out.composite).toBe(67)
  })

  it('returns null composite when no pillars have data', () => {
    const out = composeVitality({
      e: { score: null, has_data: false, sub: {} as never },
      s: { score: null, has_data: false, sub: {} as never },
      g: { score: null, has_data: false, sub: {} as never },
    })
    expect(out.composite).toBeNull()
    expect(out.band).toBe('AWAITING DATA')
  })

  it('uses default weights when none provided', () => {
    const out = composeVitality({ e: baseE, s: baseS, g: baseG })
    expect(out.weights).toEqual(DEFAULT_VITALITY_WEIGHTS)
  })
})
