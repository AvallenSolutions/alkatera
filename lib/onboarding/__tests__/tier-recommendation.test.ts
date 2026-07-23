import { describe, it, expect } from 'vitest'
import { recommendTier, teamPhrase, buildRecommendationReason } from '../tier-recommendation'

describe('recommendTier', () => {
  it('recommends Seed for a typical small arrival', () => {
    expect(recommendTier({ productCount: 3, teamSize: '1-10' })).toBe('seed')
    expect(recommendTier({ productCount: 0, teamSize: undefined })).toBe('seed')
    expect(recommendTier({ productCount: 10, teamSize: '11-50' })).toBe('seed')
  })
  it('steps up to Blossom on more products or a mid-sized team', () => {
    expect(recommendTier({ productCount: 11, teamSize: '1-10' })).toBe('blossom')
    expect(recommendTier({ productCount: 2, teamSize: '51-200' })).toBe('blossom')
    expect(recommendTier({ productCount: 30, teamSize: '11-50' })).toBe('blossom') // 30 > 10 but not > 30: stays Blossom, not Canopy
  })
  it('reaches Canopy for a big range or a large team', () => {
    expect(recommendTier({ productCount: 31, teamSize: '1-10' })).toBe('canopy')
    expect(recommendTier({ productCount: 5, teamSize: '201-1000' })).toBe('canopy')
    expect(recommendTier({ productCount: 5, teamSize: '1000+' })).toBe('canopy')
  })
})

describe('teamPhrase', () => {
  it('maps known buckets', () => {
    expect(teamPhrase('1-10')).toBe('a small team')
    expect(teamPhrase('1000+')).toBe('a large organisation')
  })
  it('is null for unknown/absent', () => {
    expect(teamPhrase(undefined)).toBeNull()
    expect(teamPhrase('weird')).toBeNull()
  })
})

describe('buildRecommendationReason', () => {
  it('names products, site and team', () => {
    expect(buildRecommendationReason({ productCount: 3, hasFacility: true, teamSize: '1-10', tierName: 'Seed' }))
      .toBe('You have 3 products, one site and a small team. Seed covers it with room to grow.')
  })
  it('singular product, no site, no team', () => {
    expect(buildRecommendationReason({ productCount: 1, tierName: 'Seed' }))
      .toBe('You have 1 product. Seed covers it with room to grow.')
  })
  it('falls back gracefully with nothing found', () => {
    expect(buildRecommendationReason({ productCount: 0, tierName: 'Seed' }))
      .toBe('You have a fresh catalogue. Seed covers it with room to grow.')
  })
})
