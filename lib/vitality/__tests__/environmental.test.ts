import { describe, expect, it } from 'vitest'
import {
  aggregateImpacts,
  computeWaterRiskLevel,
  computeCircularityPercentage,
  buildEnvironmentalSignals,
  toEnvironmentalInputs,
  computeClimateScore,
  climateIntensitySubScore,
  climateYoySubScore,
  buildClimateInputs,
  unitSizeToLitres,
  interpolate,
  computeWaterScore,
  waterIntensitySubScore,
  waterYoySubScore,
  buildWaterInputs,
  computeCircularityScore,
  circularityAxisSubScore,
  circularityIntensityYoySubScore,
  tierWeightedDiversionPct,
  buildCircularityInputs,
  computeNatureScore,
  natureAxisSubScore,
  natureYoySubScore,
  natureWeightedFootprint,
  naturePositiveSubScore,
  buildNatureInputs,
  buildNaturePositiveInputs,
  type ClimateProductRow,
  type PcfWithEol,
  type WaterProductRow,
  type WasteEntry,
} from '../environmental'

const ZERO = {
  climate_change_gwp100: 0,
  water_consumption: 0,
  water_scarcity_aware: 0,
  land_use: 0,
  terrestrial_ecotoxicity: 0,
  freshwater_eutrophication: 0,
  terrestrial_acidification: 0,
  fossil_resource_scarcity: 0,
}

function lca(overrides: Partial<PcfWithEol>): PcfWithEol {
  return {
    id: 'lca-1',
    status: 'completed',
    aggregated_impacts: { ...ZERO },
    production_volume: 1,
    ...overrides,
  }
}

describe('aggregateImpacts', () => {
  it('returns zeros when no LCAs', () => {
    expect(aggregateImpacts([])).toEqual(ZERO)
  })

  it('sums per-LCA impacts × production volume', () => {
    const out = aggregateImpacts([
      lca({
        production_volume: 2,
        aggregated_impacts: { ...ZERO, climate_change_gwp100: 5, water_consumption: 10 },
      }),
      lca({
        production_volume: 3,
        aggregated_impacts: { ...ZERO, climate_change_gwp100: 1, water_consumption: 4 },
      }),
    ])
    expect(out.climate_change_gwp100).toBe(13) // 5*2 + 1*3
    expect(out.water_consumption).toBe(32) // 10*2 + 4*3
  })

  it('treats missing production volume as 1 unit', () => {
    const out = aggregateImpacts([
      lca({
        production_volume: null,
        aggregated_impacts: { ...ZERO, climate_change_gwp100: 7 },
      }),
    ])
    expect(out.climate_change_gwp100).toBe(7)
  })

  it('skips LCAs without aggregated_impacts', () => {
    const out = aggregateImpacts([
      lca({ aggregated_impacts: null, production_volume: 5 }),
    ])
    expect(out.climate_change_gwp100).toBe(0)
  })
})

describe('computeWaterRiskLevel', () => {
  it('returns undefined when no water consumption', () => {
    expect(computeWaterRiskLevel(ZERO)).toBeUndefined()
  })

  it('flags low risk when avg scarcity ≤ 20', () => {
    expect(
      computeWaterRiskLevel({
        ...ZERO,
        water_consumption: 100,
        water_scarcity_aware: 1500,
      }),
    ).toBe('low')
  })

  it('flags medium risk when 20 < avg ≤ 40', () => {
    expect(
      computeWaterRiskLevel({
        ...ZERO,
        water_consumption: 100,
        water_scarcity_aware: 3000,
      }),
    ).toBe('medium')
  })

  it('flags high risk when avg > 40', () => {
    expect(
      computeWaterRiskLevel({
        ...ZERO,
        water_consumption: 100,
        water_scarcity_aware: 5000,
      }),
    ).toBe('high')
  })
})

describe('computeCircularityPercentage', () => {
  it('returns 0 when no waste data', () => {
    expect(computeCircularityPercentage([])).toBe(0)
  })

  it('uses EOL waste when present', () => {
    const out = computeCircularityPercentage([
      lca({
        production_volume: 1,
        aggregated_impacts: {
          ...ZERO,
          end_of_life_waste_kg: 100,
          recyclability_percentage: 60,
        },
      }),
    ])
    expect(out).toBe(60)
  })

  it('falls back to packaging heuristic when EOL data is missing', () => {
    const out = computeCircularityPercentage([
      lca({
        aggregated_impacts: {
          ...ZERO,
          breakdown: {
            by_material: [
              { name: 'Glass bottle', quantity: 200 },
              { name: 'Plastic packaging', quantity: 100 },
              { name: 'Paper label', quantity: 50 },
            ],
          },
        },
      }),
    ])
    // Packaging-class total: 200 (glass) + 100 (plastic packaging) + 50 (label, paper) = 350
    // Recyclable-class: 200 (glass) + 50 (paper) = 250
    expect(Math.round(out)).toBe(71)
  })
})

describe('climateIntensitySubScore (1% interpolated)', () => {
  it('returns 100 for climate-positive (negative ratio)', () => {
    expect(climateIntensitySubScore(-0.1)).toBe(100)
    expect(climateIntensitySubScore(-5)).toBe(100)
  })

  it('returns 100 for carbon-neutral (ratio = 0)', () => {
    expect(climateIntensitySubScore(0)).toBe(100)
  })

  it('hits anchor scores exactly at calibrated ratios', () => {
    expect(climateIntensitySubScore(0.5)).toBe(95)
    expect(climateIntensitySubScore(0.7)).toBe(90)
    expect(climateIntensitySubScore(0.85)).toBe(80)
    expect(climateIntensitySubScore(1.0)).toBe(70)
    expect(climateIntensitySubScore(1.15)).toBe(55)
    expect(climateIntensitySubScore(1.3)).toBe(40)
    expect(climateIntensitySubScore(1.5)).toBe(25)
  })

  it('interpolates smoothly between anchors (1% increments)', () => {
    // Halfway between (0.5, 95) and (0.7, 90) → 92.5 rounds to 93
    expect(climateIntensitySubScore(0.6)).toBe(93)
    // Halfway between (0.85, 80) and (1.0, 70) → 75 (cleanly)
    expect(climateIntensitySubScore(0.925)).toBe(75)
    // 75% between (1.0, 70) and (1.15, 55) → 70 + 0.75*(-15) = 58.75 → 59
    expect(climateIntensitySubScore(1.1125)).toBe(59)
  })

  it('clamps to 10 for ratios at or above 2x benchmark', () => {
    expect(climateIntensitySubScore(2)).toBe(10)
    expect(climateIntensitySubScore(3)).toBe(10)
  })
})

describe('climateYoySubScore (1% interpolated)', () => {
  it('returns 100 for a 10%+ reduction (Paris-aligned)', () => {
    expect(climateYoySubScore(-10)).toBe(100)
    expect(climateYoySubScore(-25)).toBe(100)
  })

  it('hits anchor scores exactly at calibrated deltas', () => {
    expect(climateYoySubScore(-5)).toBe(85)
    expect(climateYoySubScore(-2)).toBe(75)
    expect(climateYoySubScore(0)).toBe(65)
    expect(climateYoySubScore(2)).toBe(50)
    expect(climateYoySubScore(5)).toBe(35)
    expect(climateYoySubScore(10)).toBe(20)
  })

  it('interpolates smoothly between anchors', () => {
    // Halfway between (-5, 85) and (-2, 75) → 80
    expect(climateYoySubScore(-3.5)).toBe(80)
    // Halfway between (10, 20) and (20, 5) → 12.5 → rounds to 13
    expect(climateYoySubScore(15)).toBe(13)
  })

  it('clamps to 5 for delta >= +20%', () => {
    expect(climateYoySubScore(20)).toBe(5)
    expect(climateYoySubScore(50)).toBe(5)
  })
})

describe('computeClimateScore', () => {
  it('returns no_data when neither input is present', () => {
    const out = computeClimateScore({ intensity_ratio: null, yoy_delta_pct: null })
    expect(out.score).toBeNull()
    expect(out.mode).toBe('no_data')
    expect(out.intensity_sub).toBeNull()
    expect(out.yoy_sub).toBeNull()
    expect(out.weights).toEqual({ intensity: 0, yoy: 0 })
  })

  it('blends 60/40 when both inputs are present', () => {
    // intensity_ratio 1.0 → 70; yoy 0% → 65; blend = 0.6×70 + 0.4×65 = 68
    const out = computeClimateScore({ intensity_ratio: 1.0, yoy_delta_pct: 0 })
    expect(out.score).toBe(68)
    expect(out.intensity_sub).toBe(70)
    expect(out.yoy_sub).toBe(65)
    expect(out.mode).toBe('blended')
    expect(out.weights).toEqual({ intensity: 0.6, yoy: 0.4 })
  })

  it('falls back to intensity-only when YoY is null (first-year orgs)', () => {
    const out = computeClimateScore({ intensity_ratio: 0.85, yoy_delta_pct: null })
    expect(out.score).toBe(80)
    expect(out.intensity_sub).toBe(80)
    expect(out.yoy_sub).toBeNull()
    expect(out.mode).toBe('intensity_only')
    expect(out.weights).toEqual({ intensity: 1, yoy: 0 })
  })

  it('falls back to yoy-only when intensity is null (no benchmark coverage)', () => {
    const out = computeClimateScore({ intensity_ratio: null, yoy_delta_pct: -5 })
    expect(out.score).toBe(85)
    expect(out.intensity_sub).toBeNull()
    expect(out.yoy_sub).toBe(85)
    expect(out.mode).toBe('yoy_only')
    expect(out.weights).toEqual({ intensity: 0, yoy: 1 })
  })

  it('rewards climate-positive companies with the top intensity score', () => {
    // ratio < 0 → 100; yoy -10% → 100; blend = 100
    const out = computeClimateScore({ intensity_ratio: -0.05, yoy_delta_pct: -10 })
    expect(out.score).toBe(100)
    expect(out.intensity_sub).toBe(100)
    expect(out.yoy_sub).toBe(100)
  })

  it('penalises rising emissions even with a decent intensity', () => {
    // ratio 0.85 → 80; yoy +15% → 13 (interpolated halfway between (10,20) and (20,5))
    // blend = 0.6×80 + 0.4×13 = 48 + 5.2 = 53.2 → 53
    const out = computeClimateScore({ intensity_ratio: 0.85, yoy_delta_pct: 15 })
    expect(out.score).toBe(53)
    expect(out.intensity_sub).toBe(80)
    expect(out.yoy_sub).toBe(13)
  })
})

describe('interpolate', () => {
  const anchors: Array<[number, number]> = [
    [0, 100],
    [1, 70],
    [2, 10],
  ]

  it('returns the start anchor at or below the lowest x', () => {
    expect(interpolate(-1, anchors)).toBe(100)
    expect(interpolate(0, anchors)).toBe(100)
  })

  it('returns the end anchor at or above the highest x', () => {
    expect(interpolate(2, anchors)).toBe(10)
    expect(interpolate(5, anchors)).toBe(10)
  })

  it('linearly interpolates between adjacent anchors', () => {
    expect(interpolate(0.5, anchors)).toBe(85) // halfway between 100 and 70
    expect(interpolate(1.5, anchors)).toBe(40) // halfway between 70 and 10
    expect(interpolate(0.25, anchors)).toBe(92.5) // a quarter into the first segment
  })

  it('returns 0 when no anchors are provided', () => {
    expect(interpolate(1, [])).toBe(0)
  })
})

describe('waterIntensitySubScore (1% interpolated)', () => {
  it('hits anchor scores exactly', () => {
    expect(waterIntensitySubScore(0)).toBe(100)
    expect(waterIntensitySubScore(0.5)).toBe(95)
    expect(waterIntensitySubScore(0.7)).toBe(90)
    expect(waterIntensitySubScore(0.85)).toBe(80)
    expect(waterIntensitySubScore(1.0)).toBe(70)
    expect(waterIntensitySubScore(1.15)).toBe(55)
    expect(waterIntensitySubScore(1.3)).toBe(40)
    expect(waterIntensitySubScore(1.5)).toBe(25)
    expect(waterIntensitySubScore(2.0)).toBe(10)
  })

  it('clamps to 10 at or above 2x benchmark', () => {
    expect(waterIntensitySubScore(3)).toBe(10)
  })
})

describe('waterYoySubScore (lenient ladder, 1% interpolated)', () => {
  it('rewards a 5% reduction with the top score (lenient vs carbon)', () => {
    expect(waterYoySubScore(-5)).toBe(100)
    expect(waterYoySubScore(-20)).toBe(100)
  })

  it('hits anchor scores at calibrated deltas', () => {
    expect(waterYoySubScore(-2)).toBe(90)
    expect(waterYoySubScore(0)).toBe(75)
    expect(waterYoySubScore(2)).toBe(60)
    expect(waterYoySubScore(5)).toBe(45)
    expect(waterYoySubScore(10)).toBe(25)
    expect(waterYoySubScore(20)).toBe(10)
  })

  it('clamps to 10 at delta >= +20%', () => {
    expect(waterYoySubScore(50)).toBe(10)
  })

  it('a flat year still earns a healthy 75', () => {
    expect(waterYoySubScore(0)).toBe(75)
  })
})

describe('computeWaterScore', () => {
  it('returns no_data when neither input is present', () => {
    const out = computeWaterScore({
      intensity_ratio: null,
      yoy_delta_pct: null,
      avg_scarcity_factor: 25,
      source: null,
    })
    expect(out.score).toBeNull()
    expect(out.mode).toBe('no_data')
    // Scarcity context still surfaces even without a scored sub
    expect(out.avg_scarcity_factor).toBe(25)
  })

  it('blends 60/40 when both inputs are present', () => {
    // ratio 1.0 → 70; yoy 0% → 75; blend = 0.6×70 + 0.4×75 = 72
    const out = computeWaterScore({
      intensity_ratio: 1.0,
      yoy_delta_pct: 0,
      avg_scarcity_factor: 12,
      source: 'facility',
    })
    expect(out.score).toBe(72)
    expect(out.intensity_sub).toBe(70)
    expect(out.yoy_sub).toBe(75)
    expect(out.mode).toBe('blended')
    expect(out.source).toBe('facility')
    expect(out.weights).toEqual({ intensity: 0.6, yoy: 0.4 })
  })

  it('passes scarcity context through verbatim without affecting score', () => {
    const stressed = computeWaterScore({
      intensity_ratio: 0.7,
      yoy_delta_pct: -2,
      avg_scarcity_factor: 80,
      source: 'facility',
    })
    const lowStress = computeWaterScore({
      intensity_ratio: 0.7,
      yoy_delta_pct: -2,
      avg_scarcity_factor: 5,
      source: 'facility',
    })
    expect(stressed.score).toBe(lowStress.score) // location doesn't pull score
    expect(stressed.avg_scarcity_factor).toBe(80)
    expect(lowStress.avg_scarcity_factor).toBe(5)
  })

  it('falls back to intensity_only when YoY is null (first-year orgs)', () => {
    const out = computeWaterScore({
      intensity_ratio: 0.85,
      yoy_delta_pct: null,
      avg_scarcity_factor: null,
      source: 'lca',
    })
    expect(out.score).toBe(80)
    expect(out.mode).toBe('intensity_only')
  })
})

describe('buildWaterInputs', () => {
  function row(overrides: Partial<WaterProductRow>): WaterProductRow {
    return {
      product_id: 'p1',
      product_category: 'Lager',
      product_type: 'Beer & Cider',
      unit_size_l: 0.33,
      units_produced_current: 10000,
      units_produced_prior: 10000,
      per_unit_water_m3: 0.0017, // ~1.7L per 0.33L can ≈ 5x ratio
      per_unit_scarcity_m3: 0.034, // AWARE ~20
      ...overrides,
    }
  }

  it('returns nulls when no rows and no facility data', () => {
    const out = buildWaterInputs({
      products: [],
      facility_intake_current_l: null,
      facility_intake_prior_l: null,
      facility_scarcity_current_l: null,
    })
    expect(out.intensity_ratio).toBeNull()
    expect(out.yoy_delta_pct).toBeNull()
    expect(out.source).toBeNull()
  })

  it('prefers facility intake over LCA when present (no double-count)', () => {
    const out = buildWaterInputs({
      products: [row({ units_produced_current: 1000, per_unit_water_m3: 0.005 })],
      // 1000 cans × 0.0017 m³ LCA = 1.7 m³; facility says 2.0 m³.
      // Facility wins → per_unit_actual = 2000 L / 1000 = 2 L/can
      facility_intake_current_l: 2000,
      facility_intake_prior_l: 1500,
      facility_scarcity_current_l: 24000,
    })
    expect(out.source).toBe('facility')
    expect(out.diagnostics.per_unit_actual_l).toBeCloseTo(2, 4)
    // YoY = (2000 - 1500)/1500 × 100 ≈ 33.3
    expect(out.yoy_delta_pct).toBeCloseTo(33.33, 1)
    // Avg AWARE = 24000 / 2000 = 12
    expect(out.avg_scarcity_factor).toBeCloseTo(12, 4)
  })

  it('falls back to LCA water when facility data is absent', () => {
    const out = buildWaterInputs({
      products: [row({ units_produced_current: 1000, units_produced_prior: 800 })],
      facility_intake_current_l: null,
      facility_intake_prior_l: null,
      facility_scarcity_current_l: null,
    })
    expect(out.source).toBe('lca')
    // 1000 × 0.0017 m³ × 1000 L/m³ = 1700 L
    expect(out.diagnostics.current_year_intake_l).toBeCloseTo(1700, 1)
    // YoY = (1700 - 1360) / 1360 × 100 = 25
    expect(out.yoy_delta_pct).toBeCloseTo(25, 1)
  })

  it('computes a per-unit benchmark from BIER water ratios + units', () => {
    // 1000 lager cans (0.33L, BIER 5 L/L → 1.65 L/can)
    // 1000 whisky bottles (0.7L, override 50 L/L → 35 L/bottle)
    // Weighted benchmark = (1.65 × 1000 + 35 × 1000) / 2000 = 18.325 L/unit
    const out = buildWaterInputs({
      products: [
        row({
          product_id: 'beer',
          product_category: 'Lager',
          unit_size_l: 0.33,
          units_produced_current: 1000,
          per_unit_water_m3: 0.002,
        }),
        row({
          product_id: 'whisky',
          product_category: 'Whisky',
          unit_size_l: 0.7,
          units_produced_current: 1000,
          per_unit_water_m3: 0.04,
        }),
      ],
      facility_intake_current_l: null,
      facility_intake_prior_l: null,
      facility_scarcity_current_l: null,
    })
    expect(out.diagnostics.per_unit_benchmark_l).toBeCloseTo(18.325, 3)
  })
})

describe('circularityAxisSubScore (1% interpolated)', () => {
  it('hits anchor scores exactly', () => {
    expect(circularityAxisSubScore(0)).toBe(5)
    expect(circularityAxisSubScore(20)).toBe(25)
    expect(circularityAxisSubScore(40)).toBe(50)
    expect(circularityAxisSubScore(60)).toBe(75)
    expect(circularityAxisSubScore(80)).toBe(90)
    expect(circularityAxisSubScore(95)).toBe(98)
    expect(circularityAxisSubScore(100)).toBe(100)
  })

  it('interpolates smoothly', () => {
    // Halfway between (40, 50) and (60, 75) → 62.5 → 63
    expect(circularityAxisSubScore(50)).toBe(63)
  })
})

describe('circularityIntensityYoySubScore (lenient)', () => {
  it('rewards a 3% reduction with the top score', () => {
    expect(circularityIntensityYoySubScore(-3)).toBe(100)
    expect(circularityIntensityYoySubScore(-10)).toBe(100)
  })

  it('hits anchor scores at calibrated deltas', () => {
    expect(circularityIntensityYoySubScore(-1)).toBe(90)
    expect(circularityIntensityYoySubScore(0)).toBe(80)
    expect(circularityIntensityYoySubScore(2)).toBe(60)
    expect(circularityIntensityYoySubScore(5)).toBe(40)
    expect(circularityIntensityYoySubScore(10)).toBe(20)
    expect(circularityIntensityYoySubScore(20)).toBe(5)
  })
})

describe('tierWeightedDiversionPct (EU waste hierarchy)', () => {
  it('returns 0 for all-landfill', () => {
    expect(
      tierWeightedDiversionPct({
        reuse: 0,
        composting: 0,
        anaerobic_digestion: 0,
        recycling: 0,
        incineration_with_recovery: 0,
        landfill: 1,
        incineration_without_recovery: 0,
        other: 0,
      }),
    ).toBe(0)
  })

  it('returns 100 for all-reuse (highest tier)', () => {
    expect(
      tierWeightedDiversionPct({
        reuse: 1,
        composting: 0,
        anaerobic_digestion: 0,
        recycling: 0,
        incineration_with_recovery: 0,
        landfill: 0,
        incineration_without_recovery: 0,
        other: 0,
      }),
    ).toBe(100)
  })

  it('rewards reuse over energy recovery at the same diversion rate', () => {
    const reuseHeavy = tierWeightedDiversionPct({
      reuse: 0.8,
      composting: 0,
      anaerobic_digestion: 0,
      recycling: 0,
      incineration_with_recovery: 0,
      landfill: 0.2,
      incineration_without_recovery: 0,
      other: 0,
    })
    const energyHeavy = tierWeightedDiversionPct({
      reuse: 0,
      composting: 0,
      anaerobic_digestion: 0,
      recycling: 0,
      incineration_with_recovery: 0.8,
      landfill: 0.2,
      incineration_without_recovery: 0,
      other: 0,
    })
    expect(reuseHeavy).toBe(80) // 80×1.0
    expect(energyHeavy).toBeCloseTo(32, 1) // 80×0.4
    expect(reuseHeavy).toBeGreaterThan(energyHeavy)
  })
})

describe('computeCircularityScore', () => {
  const emptyMix = {
    reuse: 0,
    composting: 0,
    anaerobic_digestion: 0,
    recycling: 0,
    incineration_with_recovery: 0,
    landfill: 0,
    incineration_without_recovery: 0,
    other: 0,
  } as const

  it('returns no_data when nothing is provided', () => {
    const out = computeCircularityScore({
      recycled_content_pct: null,
      packaging_recyclability_pct: null,
      tier_weighted_diversion_pct: null,
      intensity_yoy_pct: null,
      treatment_mix: { ...emptyMix },
    })
    expect(out.score).toBeNull()
    expect(out.mode).toBe('no_data')
  })

  it('blends practices (60%) and YoY (40%) when both sides present', () => {
    // 3 axes all 60 → axisSub all 75; practices avg = 75
    // YoY 0% → 80
    // blend = 0.6×75 + 0.4×80 = 45 + 32 = 77
    const out = computeCircularityScore({
      recycled_content_pct: 60,
      packaging_recyclability_pct: 60,
      tier_weighted_diversion_pct: 60,
      intensity_yoy_pct: 0,
      treatment_mix: { ...emptyMix, reuse: 0.5, recycling: 0.5 },
    })
    expect(out.practices_sub).toBe(75)
    expect(out.intensity_yoy_sub).toBe(80)
    expect(out.score).toBe(77)
    expect(out.mode).toBe('blended')
  })

  it('redistributes practices across available axes', () => {
    // Only one axis present → practices = that single sub
    const out = computeCircularityScore({
      recycled_content_pct: 80,
      packaging_recyclability_pct: null,
      tier_weighted_diversion_pct: null,
      intensity_yoy_pct: null,
      treatment_mix: { ...emptyMix },
    })
    expect(out.practices_sub).toBe(90) // 80% → 90
    expect(out.score).toBe(90)
    expect(out.mode).toBe('practices_only')
  })

  it('falls back to yoy_only when no practice axes are known', () => {
    const out = computeCircularityScore({
      recycled_content_pct: null,
      packaging_recyclability_pct: null,
      tier_weighted_diversion_pct: null,
      intensity_yoy_pct: -3,
      treatment_mix: { ...emptyMix },
    })
    expect(out.score).toBe(100)
    expect(out.mode).toBe('yoy_only')
  })
})

describe('buildCircularityInputs', () => {
  function entry(mass_kg: number, treatment_method: string | null): WasteEntry {
    return { mass_kg, treatment_method }
  }

  it('returns nulls for empty waste', () => {
    const out = buildCircularityInputs({
      current_waste: [],
      prior_waste: [],
      current_year_units: 0,
      prior_year_units: 0,
      recycled_content_pct: null,
      packaging_recyclability_pct: null,
    })
    expect(out.tier_weighted_diversion_pct).toBeNull()
    expect(out.intensity_yoy_pct).toBeNull()
  })

  it('computes treatment_mix proportions and tier-weighted diversion', () => {
    // 80 kg reuse + 20 kg landfill = 100 kg total
    // Mix: reuse 0.8, landfill 0.2 → diversion = 80×1.0 + 20×0 = 80
    const out = buildCircularityInputs({
      current_waste: [
        entry(80, 'reuse'),
        entry(20, 'landfill'),
      ],
      prior_waste: [],
      current_year_units: 1000,
      prior_year_units: 0,
      recycled_content_pct: null,
      packaging_recyclability_pct: null,
    })
    expect(out.treatment_mix.reuse).toBeCloseTo(0.8, 4)
    expect(out.treatment_mix.landfill).toBeCloseTo(0.2, 4)
    expect(out.tier_weighted_diversion_pct).toBe(80)
  })

  it('computes waste-intensity YoY from per-unit ratios', () => {
    // Current: 1000 kg / 10000 units = 0.1 kg/unit
    // Prior:   1500 kg / 10000 units = 0.15 kg/unit
    // YoY = (0.1 - 0.15) / 0.15 × 100 = -33.33% (improvement!)
    const out = buildCircularityInputs({
      current_waste: [entry(1000, 'recycling')],
      prior_waste: [entry(1500, 'recycling')],
      current_year_units: 10000,
      prior_year_units: 10000,
      recycled_content_pct: null,
      packaging_recyclability_pct: null,
    })
    expect(out.intensity_yoy_pct).toBeCloseTo(-33.33, 1)
    expect(out.diagnostics.current_year_intensity).toBeCloseTo(0.1, 4)
    expect(out.diagnostics.prior_year_intensity).toBeCloseTo(0.15, 4)
  })

  it('routes unknown treatment methods to "other"', () => {
    const out = buildCircularityInputs({
      current_waste: [
        entry(50, 'mystery_method'),
        entry(50, 'reuse'),
      ],
      prior_waste: [],
      current_year_units: 100,
      prior_year_units: 0,
      recycled_content_pct: null,
      packaging_recyclability_pct: null,
    })
    expect(out.treatment_mix.other).toBeCloseTo(0.5, 4)
    expect(out.treatment_mix.reuse).toBeCloseTo(0.5, 4)
    // Reuse 1.0 + other 0.2 → 50×1.0 + 50×0.2 = 60
    expect(out.tier_weighted_diversion_pct).toBeCloseTo(60, 1)
  })
})

describe('natureAxisSubScore (1% interpolated against thresholds)', () => {
  const landThresh = { excellent: 500, good: 2000 }

  it('returns 100 at zero impact', () => {
    expect(natureAxisSubScore(0, landThresh)).toBe(100)
  })

  it('hits anchor scores at calibrated thresholds', () => {
    expect(natureAxisSubScore(500, landThresh)).toBe(90) // excellent
    expect(natureAxisSubScore(2000, landThresh)).toBe(70) // good
    expect(natureAxisSubScore(4000, landThresh)).toBe(25) // 2× good
    expect(natureAxisSubScore(8000, landThresh)).toBe(10) // 4× good
  })

  it('clamps to 10 above 4× good', () => {
    expect(natureAxisSubScore(20000, landThresh)).toBe(10)
  })

  it('returns 0 for invalid input', () => {
    expect(natureAxisSubScore(NaN, landThresh)).toBe(0)
    expect(natureAxisSubScore(-100, landThresh)).toBe(0)
  })
})

describe('natureYoySubScore (lenient ladder, mirrors water/circularity)', () => {
  it('rewards a 3% reduction with the top score', () => {
    expect(natureYoySubScore(-3)).toBe(100)
    expect(natureYoySubScore(-10)).toBe(100)
  })
  it('hits anchor scores', () => {
    expect(natureYoySubScore(0)).toBe(80)
    expect(natureYoySubScore(5)).toBe(40)
    expect(natureYoySubScore(20)).toBe(5)
  })
})

describe('natureWeightedFootprint (EF 3.1 normalisation + weighting)', () => {
  it('returns 0 for zero impacts', () => {
    expect(
      natureWeightedFootprint({
        land_use: 0,
        terrestrial_acidification: 0,
        freshwater_eutrophication: 0,
        terrestrial_ecotoxicity: 0,
      }),
    ).toBe(0)
  })

  it('normalises each impact to person-equivalents and weights by EF 3.1 factors', () => {
    // 819,000 m²a (1 PE land) × 0.0794 weight = 0.0794
    const out = natureWeightedFootprint({
      land_use: 819000,
      terrestrial_acidification: 0,
      freshwater_eutrophication: 0,
      terrestrial_ecotoxicity: 0,
    })
    expect(out).toBeCloseTo(0.0794, 4)
  })

  it('combines all four axes correctly', () => {
    // Each at 1 person-equivalent → sum of EF 3.1 weights = 0.1882
    const out = natureWeightedFootprint({
      land_use: 819000,
      terrestrial_acidification: 55.6,
      freshwater_eutrophication: 1.61,
      terrestrial_ecotoxicity: 28700,
    })
    expect(out).toBeCloseTo(0.1882, 4)
  })
})

describe('computeNatureScore (EF 3.1 weighted blend)', () => {
  const ZERO_PER_UNIT = {
    land_use: null,
    terrestrial_acidification: null,
    freshwater_eutrophication: null,
    terrestrial_ecotoxicity: null,
  }

  it('returns no_data when nothing is provided', () => {
    const out = computeNatureScore({
      per_unit_impacts: ZERO_PER_UNIT,
      yoy_total_pct: null,
    })
    expect(out.score).toBeNull()
    expect(out.mode).toBe('no_data')
  })

  it('weights axes via EF 3.1 (land use dominates over ecotoxicity)', () => {
    // Land-use axis at "good" (70/100), all others zero impact → 100/100.
    // EF 3.1 weights: land 0.0794, acid 0.0621, eut 0.028, ecot 0.0187
    // Practices = (70×0.0794 + 100×0.0621 + 100×0.028 + 100×0.0187) / 0.1882
    //          = (5.558 + 6.21 + 2.8 + 1.87) / 0.1882 = 16.438 / 0.1882 ≈ 87
    const out = computeNatureScore({
      per_unit_impacts: {
        land_use: 2000, // good → 70
        terrestrial_acidification: 0, // 100
        freshwater_eutrophication: 0, // 100
        terrestrial_ecotoxicity: 0, // 100
      },
      yoy_total_pct: null,
    })
    expect(out.axes.land_use_sub).toBe(70)
    expect(out.practices_sub).toBe(87)
    expect(out.mode).toBe('practices_only')
    expect(out.weights).toEqual({ practices: 1, yoy: 0, positive: 0, dependencies: 0 })
  })

  it('blends 60/40 with YoY when both sides present', () => {
    // All axes at "good" → all 70; weighted avg = 70.
    // YoY 0% → 80. Blend = 0.6×70 + 0.4×80 = 74.
    const out = computeNatureScore({
      per_unit_impacts: {
        land_use: 2000,
        terrestrial_acidification: 3.0,
        freshwater_eutrophication: 0.7,
        terrestrial_ecotoxicity: 15,
      },
      yoy_total_pct: 0,
    })
    expect(out.practices_sub).toBe(70)
    expect(out.yoy_sub).toBe(80)
    expect(out.score).toBe(74)
    expect(out.mode).toBe('blended')
  })

  it('redistributes weights when some axes are absent', () => {
    // Only land_use present → practices = land_use sub alone
    const out = computeNatureScore({
      per_unit_impacts: {
        land_use: 500, // excellent → 90
        terrestrial_acidification: null,
        freshwater_eutrophication: null,
        terrestrial_ecotoxicity: null,
      },
      yoy_total_pct: null,
    })
    expect(out.practices_sub).toBe(90)
    expect(out.score).toBe(90)
  })

  it('redistributes weights to 50/30/20 when nature-positive actions are present', () => {
    // All axes "good" → practices 70; YoY 0% → 80; positive 5 m²/unit → 60
    // Blend = 0.5×70 + 0.3×80 + 0.2×60 = 35 + 24 + 12 = 71
    const out = computeNatureScore({
      per_unit_impacts: {
        land_use: 2000,
        terrestrial_acidification: 3.0,
        freshwater_eutrophication: 0.7,
        terrestrial_ecotoxicity: 15,
      },
      yoy_total_pct: 0,
      effective_sq_m_per_unit: 5,
      effective_hectares: 1.5,
    })
    expect(out.nature_positive_sub).toBe(60)
    expect(out.score).toBe(71)
    expect(out.weights.practices).toBeCloseTo(0.5, 4)
    expect(out.weights.yoy).toBeCloseTo(0.3, 4)
    expect(out.weights.positive).toBeCloseTo(0.2, 4)
    expect(out.effective_hectares).toBe(1.5)
  })

  it('keeps 60/40 practices/yoy when no nature-positive data', () => {
    const out = computeNatureScore({
      per_unit_impacts: {
        land_use: 2000,
        terrestrial_acidification: 3.0,
        freshwater_eutrophication: 0.7,
        terrestrial_ecotoxicity: 15,
      },
      yoy_total_pct: 0,
    })
    expect(out.weights.practices).toBeCloseTo(0.6, 4)
    expect(out.weights.yoy).toBeCloseTo(0.4, 4)
    expect(out.weights.positive).toBe(0)
  })

  it('falls back to positive_only when only nature-positive data is present', () => {
    const out = computeNatureScore({
      per_unit_impacts: {
        land_use: null,
        terrestrial_acidification: null,
        freshwater_eutrophication: null,
        terrestrial_ecotoxicity: null,
      },
      yoy_total_pct: null,
      effective_sq_m_per_unit: 10,
      effective_hectares: 2,
    })
    expect(out.score).toBe(80) // 10 m²/unit anchor
    expect(out.mode).toBe('positive_only')
  })

  it('applies country biodiversity multiplier to land use BEFORE banding', () => {
    // Land use 1500 m²a/unit, multiplier 1.4 → effective 2100, just above
    // "good" 2000 → score drops from ~74 (interpolated) to ~67
    const noMultiplier = computeNatureScore({
      per_unit_impacts: {
        land_use: 1500,
        terrestrial_acidification: null,
        freshwater_eutrophication: null,
        terrestrial_ecotoxicity: null,
      },
      yoy_total_pct: null,
    })
    const withMultiplier = computeNatureScore({
      per_unit_impacts: {
        land_use: 1500,
        terrestrial_acidification: null,
        freshwater_eutrophication: null,
        terrestrial_ecotoxicity: null,
      },
      yoy_total_pct: null,
      country_biodiversity_multiplier: 1.4,
    })
    expect(withMultiplier.score).toBeLessThan(noMultiplier.score!)
    expect(withMultiplier.country_biodiversity_multiplier).toBe(1.4)
  })

  it('applies dependencies sub as a 10% modifier on the core blend', () => {
    // Core blend: all axes at "good" → 70. Deps 100 → final = 0.9×70 + 0.1×100 = 73
    const out = computeNatureScore({
      per_unit_impacts: {
        land_use: 2000,
        terrestrial_acidification: 3.0,
        freshwater_eutrophication: 0.7,
        terrestrial_ecotoxicity: 15,
      },
      yoy_total_pct: null,
      dependencies_sub: 100,
      dependencies_declared_count: 7,
    })
    expect(out.score).toBe(73)
    expect(out.dependencies_sub).toBe(100)
    expect(out.dependencies_declared_count).toBe(7)
    expect(out.weights.dependencies).toBe(0.1)
  })

  it('falls back to dependencies-only when no LCA/positive data but deps are declared', () => {
    const out = computeNatureScore({
      per_unit_impacts: {
        land_use: null,
        terrestrial_acidification: null,
        freshwater_eutrophication: null,
        terrestrial_ecotoxicity: null,
      },
      yoy_total_pct: null,
      dependencies_sub: 60,
      dependencies_declared_count: 4,
    })
    expect(out.score).toBe(60)
    expect(out.weights.dependencies).toBe(1)
  })

  it('exposes EF 3.1 source citation in the breakdown', () => {
    const out = computeNatureScore({
      per_unit_impacts: { land_use: 0, terrestrial_acidification: null, freshwater_eutrophication: null, terrestrial_ecotoxicity: null },
      yoy_total_pct: null,
    })
    expect(out.source.name).toContain('EF 3.1')
    expect(out.source.doi).toContain('10.2760/14875')
  })
})

describe('naturePositiveSubScore', () => {
  it('returns 0 for no contribution', () => {
    expect(naturePositiveSubScore(0)).toBe(0)
  })
  it('hits anchor scores', () => {
    expect(naturePositiveSubScore(1)).toBe(30)
    expect(naturePositiveSubScore(5)).toBe(60)
    expect(naturePositiveSubScore(10)).toBe(80)
    expect(naturePositiveSubScore(25)).toBe(95)
    expect(naturePositiveSubScore(50)).toBe(100)
  })
  it('clamps at 100 for very large contributions', () => {
    expect(naturePositiveSubScore(500)).toBe(100)
  })
})

describe('buildNaturePositiveInputs', () => {
  const scoringStatuses = new Set(['in_progress', 'established'])
  const valueLookup = (type: string) => {
    if (type === 'peatland_restoration') return 1.0
    if (type === 'regenerative_agriculture') return 0.6
    return 0
  }

  it('returns null when no actions are scoring', () => {
    const out = buildNaturePositiveInputs({
      actions: [
        { hectares_active: 5, action_type: 'peatland_restoration', status: 'planned' },
      ],
      type_value_per_hectare: valueLookup,
      scoring_statuses: scoringStatuses,
      current_year_units: 1000,
    })
    expect(out.effective_hectares).toBeNull()
    expect(out.effective_sq_m_per_unit).toBeNull()
  })

  it('type-weights hectares and computes m² per unit', () => {
    // 2 ha peatland (×1.0) + 5 ha regen ag (×0.6) = 2 + 3 = 5 effective ha
    // 5 ha × 10000 m²/ha / 10000 units = 5 m²/unit
    const out = buildNaturePositiveInputs({
      actions: [
        { hectares_active: 2, action_type: 'peatland_restoration', status: 'established' },
        { hectares_active: 5, action_type: 'regenerative_agriculture', status: 'in_progress' },
      ],
      type_value_per_hectare: valueLookup,
      scoring_statuses: scoringStatuses,
      current_year_units: 10000,
    })
    expect(out.effective_hectares).toBeCloseTo(5, 4)
    expect(out.effective_sq_m_per_unit).toBeCloseTo(5, 4)
  })

  it('excludes planned and ended actions', () => {
    const out = buildNaturePositiveInputs({
      actions: [
        { hectares_active: 2, action_type: 'peatland_restoration', status: 'planned' },
        { hectares_active: 3, action_type: 'peatland_restoration', status: 'established' },
        { hectares_active: 100, action_type: 'peatland_restoration', status: 'ended' },
      ],
      type_value_per_hectare: valueLookup,
      scoring_statuses: scoringStatuses,
      current_year_units: 1000,
    })
    // Only the established 3 ha counts → 3 effective hectares
    expect(out.effective_hectares).toBeCloseTo(3, 4)
  })
})

describe('buildNatureInputs', () => {
  const zeroImpacts = {
    climate_change_gwp100: 0,
    water_consumption: 0,
    water_scarcity_aware: 0,
    land_use: 0,
    terrestrial_ecotoxicity: 0,
    freshwater_eutrophication: 0,
    terrestrial_acidification: 0,
    fossil_resource_scarcity: 0,
  }

  it('computes per-unit impacts from current-year totals + units', () => {
    const out = buildNatureInputs({
      current_year_impacts: { ...zeroImpacts, land_use: 100000 },
      prior_year_impacts: null,
      current_year_units: 1000,
      prior_year_units: 0,
    })
    expect(out.per_unit_impacts.land_use).toBe(100) // 100000 / 1000
    expect(out.yoy_total_pct).toBeNull()
  })

  it('computes YoY on the EF 3.1 weighted footprint', () => {
    // Current: 1 PE land = 0.0794 weighted
    // Prior:   2 PE land = 0.1588 weighted
    // YoY = (0.0794 - 0.1588) / 0.1588 × 100 = -50%
    const out = buildNatureInputs({
      current_year_impacts: { ...zeroImpacts, land_use: 819000 },
      prior_year_impacts: { ...zeroImpacts, land_use: 1638000 },
      current_year_units: 1000,
      prior_year_units: 1000,
    })
    expect(out.yoy_total_pct).toBeCloseTo(-50, 1)
  })

  it('returns null per-unit when current units = 0', () => {
    const out = buildNatureInputs({
      current_year_impacts: { ...zeroImpacts, land_use: 100 },
      prior_year_impacts: null,
      current_year_units: 0,
      prior_year_units: 0,
    })
    expect(out.per_unit_impacts.land_use).toBeNull()
  })
})

describe('unitSizeToLitres', () => {
  it('converts ml to litres', () => {
    expect(unitSizeToLitres(700, 'ml')).toBe(0.7)
    expect(unitSizeToLitres(330, 'ml')).toBe(0.33)
  })
  it('passes litres through unchanged', () => {
    expect(unitSizeToLitres(1, 'L')).toBe(1)
    expect(unitSizeToLitres(0.5, 'litres')).toBe(0.5)
  })
  it('handles cl', () => {
    expect(unitSizeToLitres(75, 'cl')).toBe(0.75)
  })
  it('returns null for non-positive or non-finite input', () => {
    expect(unitSizeToLitres(0, 'ml')).toBeNull()
    expect(unitSizeToLitres(-100, 'ml')).toBeNull()
    expect(unitSizeToLitres(null, 'ml')).toBeNull()
  })
  it('falls back to assuming litres for unknown unit', () => {
    expect(unitSizeToLitres(2, 'unknown')).toBe(2)
  })
})

describe('buildClimateInputs', () => {
  function row(overrides: Partial<ClimateProductRow>): ClimateProductRow {
    return {
      product_id: 'p1',
      product_category: 'Lager',
      product_type: 'Beer & Cider',
      unit_size_l: 0.33,
      units_produced_current: 1000,
      units_produced_prior: 1000,
      per_unit_emissions_kgco2e: 0.2,
      ...overrides,
    }
  }

  it('returns nulls when no rows', () => {
    const out = buildClimateInputs([])
    expect(out.intensity_ratio).toBeNull()
    expect(out.yoy_delta_pct).toBeNull()
  })

  it('computes a per-unit benchmark weighted by current-year units across mixed portfolios', () => {
    // 1000 cans of Lager @ 0.33L (benchmark 0.85 kg/L → 0.2805 kg/can)
    // 1000 bottles of Whisky @ 0.7L (benchmark 3.8 kg/L → 2.66 kg/bottle)
    // Both benchmarks weighted equally by units_current.
    // Expected per-unit benchmark = (0.2805*1000 + 2.66*1000) / 2000 = 1.47025 kg/unit
    const out = buildClimateInputs([
      row({
        product_id: 'beer',
        product_category: 'Lager',
        unit_size_l: 0.33,
        units_produced_current: 1000,
        units_produced_prior: 1000,
        per_unit_emissions_kgco2e: 0.25, // beer
      }),
      row({
        product_id: 'whisky',
        product_category: 'Whisky',
        unit_size_l: 0.7,
        units_produced_current: 1000,
        units_produced_prior: 1000,
        per_unit_emissions_kgco2e: 2.5, // whisky
      }),
    ])
    expect(out.diagnostics.per_unit_benchmark_kgco2e).toBeCloseTo(1.47025, 4)
    // Per-unit actual = (0.25*1000 + 2.5*1000) / 2000 = 1.375 kg/unit
    expect(out.diagnostics.per_unit_actual_kgco2e).toBeCloseTo(1.375, 4)
    // Intensity ratio = 1.375 / 1.47025 ≈ 0.935
    expect(out.intensity_ratio).toBeCloseTo(0.935, 2)
  })

  it('computes YoY delta from prior-year totals using the same per-unit emissions', () => {
    // Current 1000 units × 0.2 = 200 kg
    // Prior 800 units × 0.2 = 160 kg
    // Delta = (200 - 160) / 160 = 25%
    const out = buildClimateInputs([
      row({ units_produced_current: 1000, units_produced_prior: 800 }),
    ])
    expect(out.yoy_delta_pct).toBeCloseTo(25, 2)
    expect(out.diagnostics.current_year_emissions_kgco2e).toBeCloseTo(200, 2)
    expect(out.diagnostics.prior_year_emissions_kgco2e).toBeCloseTo(160, 2)
  })

  it('returns null intensity when no benchmark coverage but keeps YoY', () => {
    const out = buildClimateInputs([
      row({
        product_category: null,
        product_type: null,
        unit_size_l: null,
        units_produced_current: 100,
        units_produced_prior: 50,
      }),
    ])
    expect(out.intensity_ratio).toBeNull()
    expect(out.yoy_delta_pct).toBeCloseTo(100, 2) // emissions doubled
  })

  it('returns null YoY when no prior-year units', () => {
    const out = buildClimateInputs([
      row({ units_produced_current: 1000, units_produced_prior: 0 }),
    ])
    expect(out.yoy_delta_pct).toBeNull()
    expect(out.intensity_ratio).not.toBeNull() // intensity still works
  })

  it('skips products without per-unit emissions from the actual side', () => {
    const out = buildClimateInputs([
      row({ product_id: 'a', per_unit_emissions_kgco2e: null }),
      row({ product_id: 'b', units_produced_current: 500, units_produced_prior: 500 }),
    ])
    // Only product b contributes to current-year emissions
    expect(out.diagnostics.products_in_actual).toBe(1)
    expect(out.diagnostics.current_year_emissions_kgco2e).toBeCloseTo(500 * 0.2, 4)
  })
})

describe('buildEnvironmentalSignals + toEnvironmentalInputs', () => {
  it('returns null intensity when no products', () => {
    const signals = buildEnvironmentalSignals({
      lcas: [],
      productType: 'Beer & Cider',
      productCategories: [],
    })
    expect(signals.totalEmissions).toBe(0)
    expect(signals.emissionsIntensity).toBeNull()
  })

  it('builds intensity from total / count', () => {
    const signals = buildEnvironmentalSignals({
      lcas: [
        lca({ aggregated_impacts: { ...ZERO, climate_change_gwp100: 10 } }),
        lca({ id: 'lca-2', aggregated_impacts: { ...ZERO, climate_change_gwp100: 30 } }),
      ],
      productType: 'Beer & Cider',
      productCategories: [],
    })
    expect(signals.totalEmissions).toBe(40)
    expect(signals.emissionsIntensity).toBe(20)
  })

  it('produces inputs that activate the climate pillar', () => {
    const signals = buildEnvironmentalSignals({
      lcas: [
        lca({
          aggregated_impacts: {
            ...ZERO,
            climate_change_gwp100: 1,
            water_consumption: 100,
            water_scarcity_aware: 1500,
          },
        }),
      ],
      productType: 'Beer & Cider',
      productCategories: [],
    })
    const inputs = toEnvironmentalInputs(signals)
    expect(inputs.totalEmissions).toBeGreaterThan(0)
    if (signals.industryBenchmark !== null) {
      expect(inputs.emissionsIntensity).toBeDefined()
      expect(inputs.industryBenchmark).toBeDefined()
    }
    expect(inputs.waterRiskLevel).toBe('low')
  })
})
