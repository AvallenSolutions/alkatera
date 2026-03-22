import { describe, it, expect } from 'vitest'
import {
  CATEGORY_LABELS,
  EMISSION_CATEGORY_OPTIONS,
  CLASSIFICATION_SOURCE_LABELS,
  UPGRADE_STATUS_LABELS,
  TIER_CONFIG,
} from '../category-labels'

describe('CATEGORY_LABELS', () => {
  it('contains all expected emission categories', () => {
    const expectedKeys = [
      'grid_electricity', 'natural_gas', 'air_travel', 'rail_travel',
      'accommodation', 'road_freight', 'packaging', 'raw_materials',
      'water', 'waste', 'other',
    ]
    for (const key of expectedKeys) {
      expect(CATEGORY_LABELS[key]).toBeDefined()
    }
  })

  it('has human-readable labels', () => {
    expect(CATEGORY_LABELS.grid_electricity).toBe('Electricity')
    expect(CATEGORY_LABELS.air_travel).toBe('Air Travel')
    expect(CATEGORY_LABELS.raw_materials).toBe('Raw Materials')
  })
})

describe('EMISSION_CATEGORY_OPTIONS', () => {
  it('has same length as CATEGORY_LABELS', () => {
    expect(EMISSION_CATEGORY_OPTIONS.length).toBe(Object.keys(CATEGORY_LABELS).length)
  })

  it('each option has value and label properties', () => {
    for (const option of EMISSION_CATEGORY_OPTIONS) {
      expect(option).toHaveProperty('value')
      expect(option).toHaveProperty('label')
      expect(typeof option.value).toBe('string')
      expect(typeof option.label).toBe('string')
    }
  })
})

describe('CLASSIFICATION_SOURCE_LABELS', () => {
  it('covers all classification sources', () => {
    expect(CLASSIFICATION_SOURCE_LABELS).toHaveProperty('account_mapping')
    expect(CLASSIFICATION_SOURCE_LABELS).toHaveProperty('supplier_rule')
    expect(CLASSIFICATION_SOURCE_LABELS).toHaveProperty('manual')
    expect(CLASSIFICATION_SOURCE_LABELS).toHaveProperty('ai')
  })
})

describe('UPGRADE_STATUS_LABELS', () => {
  it('covers all upgrade statuses', () => {
    expect(UPGRADE_STATUS_LABELS).toHaveProperty('pending')
    expect(UPGRADE_STATUS_LABELS).toHaveProperty('upgraded')
    expect(UPGRADE_STATUS_LABELS).toHaveProperty('dismissed')
    expect(UPGRADE_STATUS_LABELS).toHaveProperty('not_applicable')
  })
})

describe('TIER_CONFIG', () => {
  it('has tiers 1 through 4', () => {
    expect(TIER_CONFIG[1]).toBeDefined()
    expect(TIER_CONFIG[2]).toBeDefined()
    expect(TIER_CONFIG[3]).toBeDefined()
    expect(TIER_CONFIG[4]).toBeDefined()
  })

  it('each tier has label and colour properties', () => {
    for (let tier = 1; tier <= 4; tier++) {
      expect(TIER_CONFIG[tier]).toHaveProperty('label')
      expect(TIER_CONFIG[tier]).toHaveProperty('colour')
    }
  })

  it('tier labels follow quality hierarchy', () => {
    expect(TIER_CONFIG[1].label).toContain('Supplier')
    expect(TIER_CONFIG[2].label).toContain('Activity')
    expect(TIER_CONFIG[3].label).toContain('Proxy')
    expect(TIER_CONFIG[4].label).toContain('Spend')
  })
})
