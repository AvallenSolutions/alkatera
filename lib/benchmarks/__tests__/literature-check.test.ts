import { describe, expect, it } from 'vitest'
import {
  boundaryRelation,
  checkBucketsAgainstLiterature,
  compareBucketToLiterature,
} from '../literature-check'
import type { PeerBucket } from '../ladder'

function bucket(o: Partial<PeerBucket> = {}): PeerBucket {
  return {
    bucket_kind: 'category',
    metric_key: 'co2e_per_litre',
    category_group: 'Wine',
    system_boundary: 'cradle-to-gate',
    pack_format: null,
    sample_size: 14,
    organization_count: 6,
    p25: 1.4,
    p50: 1.6,
    p75: 1.9,
    mean_value: 1.63,
    ...o,
  }
}

describe('boundaryRelation', () => {
  it('recognises a matching boundary', () => {
    expect(boundaryRelation('cradle-to-gate', 'cradle-to-gate')).toBe('same')
  })

  it('ranks a narrower boundary against a wider published one', () => {
    expect(boundaryRelation('cradle-to-gate', 'cradle-to-grave')).toBe('ours-narrower')
    expect(boundaryRelation('cradle-to-grave', 'cradle-to-gate')).toBe('ours-wider')
    expect(boundaryRelation('cradle-to-shelf', 'cradle-to-grave')).toBe('ours-narrower')
  })

  it('refuses to rank against a boundary that is not a product footprint', () => {
    // An operational facility study and a per-litre-of-pure-alcohol figure to
    // end of distillation cannot be set against a packaged product at all.
    expect(boundaryRelation('cradle-to-gate', 'operational-scope-1-2')).toBe('incomparable')
    expect(boundaryRelation('cradle-to-gate', 'cradle-to-distillation')).toBe('incomparable')
    expect(boundaryRelation('cradle-to-gate', 'mixed-or-unknown')).toBe('incomparable')
  })
})

describe('compareBucketToLiterature', () => {
  it('agrees when the cohort lands near the published figure', () => {
    // Wine publishes 1.6 on a mixed boundary; the relation is incomparable, so
    // use a category whose published boundary is readable.
    const out = compareBucketToLiterature(
      bucket({ category_group: 'Ready-to-Drink & Cocktails', p50: 0.6 }),
    )
    expect(out.verdict).toBe('agrees')
    expect(out.ratio).toBeCloseTo(0.6 / 0.55, 3)
  })

  it('flags a cohort reading materially higher', () => {
    const out = compareBucketToLiterature(
      bucket({ category_group: 'Ready-to-Drink & Cocktails', p50: 1.2 }),
    )
    expect(out.verdict).toBe('ours-higher')
    expect(out.finding).toContain('ABOVE')
    expect(out.finding).toContain('over-counting')
  })

  it('flags a cohort reading materially lower', () => {
    const out = compareBucketToLiterature(
      bucket({ category_group: 'Ready-to-Drink & Cocktails', p50: 0.2 }),
    )
    expect(out.verdict).toBe('ours-lower')
    expect(out.finding).toContain('BELOW')
  })

  it('says which side of the comparison is the weak one', () => {
    // Beer & Cider's published row cites a facility study that publishes no
    // absolute figures. A divergence there is evidence about the row, not
    // about the engine, and the finding must say so before anybody rewrites a
    // calculator on the strength of it.
    const out = compareBucketToLiterature(
      bucket({ category_group: 'Beer & Cider', system_boundary: 'cradle-to-gate', p50: 1.8 }),
    )
    expect(out.literature_source_supports).toBe('no')
    // Beer's published boundary is operational scope 1+2, so it cannot be
    // compared at all — which is itself the honest answer.
    expect(out.verdict).toBe('not-comparable')
  })

  it('reports honestly when there is nothing external to check against', () => {
    const out = compareBucketToLiterature(bucket({ category_group: 'Cheese' }))
    // An unrecognised group falls back to the default row, which has a
    // mixed-or-unknown boundary and so cannot be compared.
    expect(['no-literature-row', 'not-comparable']).toContain(out.verdict)
  })

  it('states the direction the boundary gap should push the figure', () => {
    const out = compareBucketToLiterature(
      bucket({ category_group: 'Ready-to-Drink & Cocktails', system_boundary: 'cradle-to-gate', p50: 0.6 }),
    )
    // Published RTD is cradle-to-grave; ours is gate, so ours should be lower.
    expect(out.boundary_relation).toBe('ours-narrower')
    expect(out.finding).toContain('BELOW it before any judgement')
  })
})

describe('checkBucketsAgainstLiterature', () => {
  it('checks only buckets that clear the k-anonymity floor', () => {
    // A bucket of three has a median but not a meaningful one. Treating it as
    // evidence about the engine is the same mistake in the other direction.
    const out = checkBucketsAgainstLiterature([
      { ...bucket({ organization_count: 3 }), clears_k_anonymity: false },
      { ...bucket({ organization_count: 6 }), clears_k_anonymity: true },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].organization_count).toBe(6)
  })
})
