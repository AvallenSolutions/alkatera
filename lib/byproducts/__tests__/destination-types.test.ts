import { describe, expect, it } from 'vitest'
import {
  BYPRODUCT_DESTINATION_TYPES,
  destinationToTreatmentMethod,
  getDestinationMeta,
} from '../destination-types'
import { buildCircularityInputs, type WasteEntry } from '@/lib/vitality/environmental'

describe('destinationToTreatmentMethod', () => {
  it('maps animal_feed to reuse (highest tier)', () => {
    expect(destinationToTreatmentMethod('animal_feed')).toBe('reuse')
  })

  it('maps food_or_beverage and industrial_input to reuse', () => {
    expect(destinationToTreatmentMethod('food_or_beverage')).toBe('reuse')
    expect(destinationToTreatmentMethod('industrial_input')).toBe('reuse')
    expect(destinationToTreatmentMethod('reuse_internal')).toBe('reuse')
  })

  it('maps composting and fertiliser to composting', () => {
    expect(destinationToTreatmentMethod('composting')).toBe('composting')
    expect(destinationToTreatmentMethod('fertiliser')).toBe('composting')
  })

  it('maps anaerobic_digestion to anaerobic_digestion', () => {
    expect(destinationToTreatmentMethod('anaerobic_digestion')).toBe('anaerobic_digestion')
  })

  it('maps recycling to recycling', () => {
    expect(destinationToTreatmentMethod('recycling')).toBe('recycling')
  })

  it('maps energy_recovery to incineration_with_recovery', () => {
    expect(destinationToTreatmentMethod('energy_recovery')).toBe('incineration_with_recovery')
  })

  it('falls back to other for unknown values', () => {
    expect(destinationToTreatmentMethod(null)).toBe('other')
    expect(destinationToTreatmentMethod('mystery_destination')).toBe('other')
  })
})

describe('getDestinationMeta', () => {
  it('returns metadata for every enum value', () => {
    for (const d of BYPRODUCT_DESTINATION_TYPES) {
      expect(getDestinationMeta(d.value)).toEqual(d)
    }
  })

  it('returns null for unknown', () => {
    expect(getDestinationMeta(null)).toBeNull()
    expect(getDestinationMeta('unknown')).toBeNull()
  })
})

describe('byproduct flows lift the circularity score the same way as waste entries', () => {
  // Synthetic waste = 80 kg reuse + 20 kg landfill → diversion 80
  const matchingWaste: WasteEntry[] = [
    { mass_kg: 80, treatment_method: 'reuse' },
    { mass_kg: 20, treatment_method: 'landfill' },
  ]
  // Same 80 kg expressed as a byproduct (animal_feed → reuse) + 20 kg landfill
  const byproductRoute: WasteEntry[] = [
    { mass_kg: 80, treatment_method: destinationToTreatmentMethod('animal_feed') },
    { mass_kg: 20, treatment_method: 'landfill' },
  ]

  it('produces identical tier-weighted diversion regardless of source', () => {
    const a = buildCircularityInputs({
      current_waste: matchingWaste,
      prior_waste: [],
      current_year_units: 1000,
      prior_year_units: 0,
      recycled_content_pct: null,
      packaging_recyclability_pct: null,
    })
    const b = buildCircularityInputs({
      current_waste: byproductRoute,
      prior_waste: [],
      current_year_units: 1000,
      prior_year_units: 0,
      recycled_content_pct: null,
      packaging_recyclability_pct: null,
    })
    expect(a.tier_weighted_diversion_pct).toBe(b.tier_weighted_diversion_pct)
    expect(a.tier_weighted_diversion_pct).toBe(80)
  })
})
