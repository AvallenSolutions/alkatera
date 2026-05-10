import { describe, expect, it } from 'vitest'
import {
  SUPPLIER_ATTESTATIONS,
  computeAttestationsScore,
  getAttestationMeta,
} from '../attestation-types'

describe('SUPPLIER_ATTESTATIONS', () => {
  it('has 6 attestation types', () => {
    expect(SUPPLIER_ATTESTATIONS).toHaveLength(6)
  })

  it('every attestation has a non-empty label, description, framework, emoji', () => {
    for (const a of SUPPLIER_ATTESTATIONS) {
      expect(a.label).not.toBe('')
      expect(a.description).not.toBe('')
      expect(a.framework).not.toBe('')
      expect(a.emoji).not.toBe('')
    }
  })

  it('includes UK Modern Slavery Act in at least one framework citation', () => {
    const hasModernSlavery = SUPPLIER_ATTESTATIONS.some(a =>
      a.framework.toLowerCase().includes('modern slavery'),
    )
    expect(hasModernSlavery).toBe(true)
  })
})

describe('getAttestationMeta', () => {
  it('returns meta for every enum value', () => {
    for (const a of SUPPLIER_ATTESTATIONS) {
      expect(getAttestationMeta(a.value)).toEqual(a)
    }
  })

  it('returns null for unknown / empty', () => {
    expect(getAttestationMeta(null)).toBeNull()
    expect(getAttestationMeta('unknown')).toBeNull()
  })
})

describe('computeAttestationsScore', () => {
  it('returns 0 when no attestations declared (penalises gaps)', () => {
    expect(computeAttestationsScore([])).toBe(0)
  })

  it('returns 100 when all 6 attestations declared', () => {
    const all = SUPPLIER_ATTESTATIONS.map(a => a.value)
    expect(computeAttestationsScore(all)).toBe(100)
  })

  it('scores proportionally', () => {
    const half = SUPPLIER_ATTESTATIONS.slice(0, 3).map(a => a.value)
    expect(computeAttestationsScore(half)).toBe(50)
  })

  it('ignores duplicates (deduped by Set)', () => {
    const value = SUPPLIER_ATTESTATIONS[0].value
    expect(computeAttestationsScore([value, value, value])).toBe(17)
    // 1/6 ≈ 16.67 → rounds to 17
  })

  it('ignores invalid attestation types', () => {
    const valid = SUPPLIER_ATTESTATIONS[0].value
    expect(
      computeAttestationsScore([valid, 'not_a_type' as any, 'another_bad' as any]),
    ).toBe(17)
  })
})
