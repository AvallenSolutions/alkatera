import { describe, it, expect } from 'vitest'
import { computeReadiness, type ReadinessInputs } from '../priority-signals'

const base: ReadinessInputs = {
  facilityCount: 3,
  staleCount: 0,
  neverEnteredCount: 0,
  selfGrownCount: 0,
  linkedToProfileCount: 0,
  productsWithUnmatchedCount: 0,
  totalMaterialsCount: 10,
  completedLcasCount: 3,
  productCount: 3,
  draftLcasCount: 0,
  unmatchedRatioPct: 0,
  hasTargets: true,
}

describe('computeReadiness', () => {
  describe('facility_data status', () => {
    it('ready when all facilities have recent data', () => {
      const r = computeReadiness(base)
      expect(r.foundation.facility_data).toBe('ready')
    })

    it('missing when facilityCount is 0', () => {
      const r = computeReadiness({ ...base, facilityCount: 0, staleCount: 0, neverEnteredCount: 0 })
      expect(r.foundation.facility_data).toBe('missing')
      expect(r.next_layer_to_address).toBe('foundation')
    })

    it('missing when all facilities are stale (staleCount === facilityCount)', () => {
      const r = computeReadiness({ ...base, facilityCount: 5, staleCount: 5, neverEnteredCount: 0 })
      expect(r.foundation.facility_data).toBe('missing')
      expect(r.next_layer_to_address).toBe('foundation')
    })

    it('stale when some but not all facilities are stale', () => {
      const r = computeReadiness({ ...base, facilityCount: 5, staleCount: 2, neverEnteredCount: 0 })
      expect(r.foundation.facility_data).toBe('stale')
      expect(r.next_layer_to_address).toBe('foundation')
    })

    it('blocked_reasons mentions stale count', () => {
      const r = computeReadiness({ ...base, facilityCount: 9, staleCount: 9, neverEnteredCount: 0 })
      expect(r.lcas.blocked_reasons.some(s => s.includes('facilities are missing recent data'))).toBe(true)
    })
  })

  describe('agricultural_data status', () => {
    it('not_applicable when no self-grown materials', () => {
      const r = computeReadiness(base)
      expect(r.foundation.agricultural_data).toBe('not_applicable')
    })

    it('ready when all self-grown are linked', () => {
      const r = computeReadiness({ ...base, selfGrownCount: 4, linkedToProfileCount: 4 })
      expect(r.foundation.agricultural_data).toBe('ready')
    })

    it('partial when some are linked', () => {
      const r = computeReadiness({ ...base, selfGrownCount: 4, linkedToProfileCount: 2 })
      expect(r.foundation.agricultural_data).toBe('partial')
      expect(r.next_layer_to_address).toBe('foundation')
    })

    it('missing when none are linked', () => {
      const r = computeReadiness({ ...base, selfGrownCount: 4, linkedToProfileCount: 0 })
      expect(r.foundation.agricultural_data).toBe('missing')
      expect(r.next_layer_to_address).toBe('foundation')
    })
  })

  describe('recipes status', () => {
    it('ready when no unmatched products', () => {
      const r = computeReadiness(base)
      expect(r.recipes.status).toBe('ready')
    })

    it('partial when some products have unmatched materials', () => {
      const r = computeReadiness({ ...base, productsWithUnmatchedCount: 2 })
      expect(r.recipes.status).toBe('partial')
      expect(r.next_layer_to_address).toBe('recipes')
    })

    it('missing only when totalMaterials=0 AND completedLcas=0', () => {
      const r = computeReadiness({ ...base, totalMaterialsCount: 0, completedLcasCount: 0, productCount: 2 })
      expect(r.recipes.status).toBe('missing')
    })

    it('ready (not missing) when completedLcas>0 even with empty materials table', () => {
      const r = computeReadiness({ ...base, totalMaterialsCount: 0, completedLcasCount: 3 })
      expect(r.recipes.status).toBe('ready')
    })
  })

  describe('lcas status', () => {
    it('complete when all products have LCAs', () => {
      const r = computeReadiness(base)
      expect(r.lcas.status).toBe('complete')
    })

    it('blocked when facility data is stale', () => {
      const r = computeReadiness({ ...base, staleCount: 2, completedLcasCount: 0 })
      expect(r.lcas.status).toBe('blocked')
      expect(r.lcas.blocked_reasons.length).toBeGreaterThan(0)
    })

    it('in_progress when drafts exist and no blocks', () => {
      const r = computeReadiness({ ...base, completedLcasCount: 1, draftLcasCount: 2 })
      expect(r.lcas.status).toBe('in_progress')
    })

    it('computable when foundation+recipes ready but no LCAs started', () => {
      const r = computeReadiness({ ...base, completedLcasCount: 0, draftLcasCount: 0 })
      expect(r.lcas.status).toBe('computable')
      expect(r.next_layer_to_address).toBe('lcas')
    })

    it('computable_now_count is 0 when facility data is stale', () => {
      const r = computeReadiness({ ...base, staleCount: 3 })
      expect(r.lcas.computable_now_count).toBe(0)
    })

    it('computable_now_count equals products minus unmatched when ready', () => {
      const r = computeReadiness({ ...base, productCount: 5, productsWithUnmatchedCount: 1 })
      expect(r.lcas.computable_now_count).toBe(4)
    })
  })

  describe('next_layer_to_address waterfall', () => {
    it('foundation wins over recipes when both broken', () => {
      const r = computeReadiness({
        ...base,
        staleCount: 1,
        productsWithUnmatchedCount: 3,
        completedLcasCount: 0,
      })
      expect(r.next_layer_to_address).toBe('foundation')
    })

    it('recipes when foundation is ready but ingredients unmatched', () => {
      const r = computeReadiness({ ...base, productsWithUnmatchedCount: 2, completedLcasCount: 0 })
      expect(r.next_layer_to_address).toBe('recipes')
    })

    it('lcas when foundation+recipes ready but LCAs not complete', () => {
      const r = computeReadiness({ ...base, completedLcasCount: 1, productCount: 3 })
      expect(r.next_layer_to_address).toBe('lcas')
    })

    it('targets when all ready but no targets set', () => {
      const r = computeReadiness({ ...base, hasTargets: false })
      expect(r.next_layer_to_address).toBe('targets')
    })

    it('targets when everything is complete', () => {
      const r = computeReadiness(base)
      expect(r.next_layer_to_address).toBe('targets')
    })
  })

  describe('facility_detail counts', () => {
    it('calculates with_recent_entry_60d correctly', () => {
      const r = computeReadiness({ ...base, facilityCount: 9, staleCount: 3, neverEnteredCount: 1 })
      expect(r.foundation.facility_detail.total).toBe(9)
      expect(r.foundation.facility_detail.with_recent_entry_60d).toBe(6)
      expect(r.foundation.facility_detail.stale_60d).toBe(2)
      expect(r.foundation.facility_detail.never_entered).toBe(1)
    })
  })
})
