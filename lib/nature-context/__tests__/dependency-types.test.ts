import { describe, expect, it } from 'vitest'
import {
  computeDependenciesSubScore,
  DRINKS_MATERIAL_DEPENDENCIES,
  getDependencyMeta,
  NATURE_DEPENDENCIES,
} from '../dependency-types'

describe('DRINKS_MATERIAL_DEPENDENCIES', () => {
  it('flags freshwater_supply as drinks-material', () => {
    expect(DRINKS_MATERIAL_DEPENDENCIES).toContain('freshwater_supply')
  })

  it('flags soil/climate/pollination as drinks-material', () => {
    expect(DRINKS_MATERIAL_DEPENDENCIES).toContain('soil_quality_regulation')
    expect(DRINKS_MATERIAL_DEPENDENCIES).toContain('climate_regulation')
    expect(DRINKS_MATERIAL_DEPENDENCIES).toContain('pollination')
  })

  it('does NOT flag noise_attenuation as drinks-material', () => {
    expect(DRINKS_MATERIAL_DEPENDENCIES).not.toContain('noise_attenuation')
  })
})

describe('getDependencyMeta', () => {
  it('returns meta for every enum value', () => {
    for (const d of NATURE_DEPENDENCIES) {
      expect(getDependencyMeta(d.value)).toEqual(d)
    }
  })
  it('returns null for unknown', () => {
    expect(getDependencyMeta(null)).toBeNull()
    expect(getDependencyMeta('unknown')).toBeNull()
  })
})

describe('computeDependenciesSubScore', () => {
  it('returns null when no declarations', () => {
    expect(computeDependenciesSubScore([])).toBeNull()
  })

  it('rewards full coverage of drinks-material dependencies', () => {
    const decls = DRINKS_MATERIAL_DEPENDENCIES.map(t => ({
      dependency_type: t,
      materiality: 'medium' as const,
      has_notes: false,
    }))
    const score = computeDependenciesSubScore(decls)
    // 100% coverage × 0.9 weight + 0 bonus = 90
    expect(score).toBe(90)
  })

  it('rewards depth — high/critical with notes earns the full 100', () => {
    const decls = DRINKS_MATERIAL_DEPENDENCIES.map(t => ({
      dependency_type: t,
      materiality: 'critical' as const,
      has_notes: true,
    }))
    expect(computeDependenciesSubScore(decls)).toBe(100)
  })

  it('partial coverage scores proportionally', () => {
    // Half the drinks-material dependencies declared
    const half = DRINKS_MATERIAL_DEPENDENCIES.slice(0, Math.floor(DRINKS_MATERIAL_DEPENDENCIES.length / 2))
    const decls = half.map(t => ({
      dependency_type: t,
      materiality: 'low' as const,
      has_notes: false,
    }))
    const score = computeDependenciesSubScore(decls)!
    // Coverage ~50% × 0.9 = ~45
    expect(score).toBeGreaterThanOrEqual(40)
    expect(score).toBeLessThanOrEqual(50)
  })

  it('does not reward gaming via non-material dependencies', () => {
    // Declare 5 NON-material ones — coverage of material set is still 0
    const decls: Array<{ dependency_type: string; materiality: 'low'; has_notes: false }> = [
      { dependency_type: 'noise_attenuation', materiality: 'low', has_notes: false },
      { dependency_type: 'recreation_tourism', materiality: 'low', has_notes: false },
      { dependency_type: 'spiritual_artistic_inspiration', materiality: 'low', has_notes: false },
      { dependency_type: 'air_filtration', materiality: 'low', has_notes: false },
      { dependency_type: 'flood_storm_protection', materiality: 'low', has_notes: false },
    ]
    expect(computeDependenciesSubScore(decls)).toBe(0)
  })
})
