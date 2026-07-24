import { describe, expect, it } from 'vitest'
import {
  MINIMUM_COHORT_ORGANIZATIONS,
  emptyPeerCohorts,
  indexPeerCohorts,
  pickLiteratureBenchmark,
  resolveProductBenchmark,
  subjectGroup,
  summariseBenchmarkMix,
  type BenchmarkSubject,
  type PeerBucket,
} from '../ladder'

function bucket(overrides: Partial<PeerBucket>): PeerBucket {
  return {
    bucket_kind: 'category',
    metric_key: 'co2e_per_litre',
    category_group: 'Spirits',
    system_boundary: 'cradle-to-gate',
    pack_format: null,
    sample_size: 12,
    organization_count: 7,
    p25: 2.8,
    p50: 3.4,
    p75: 4.1,
    mean_value: 3.5,
    ...overrides,
  }
}

function subject(overrides: Partial<BenchmarkSubject> = {}): BenchmarkSubject {
  return {
    productCategory: 'Gin',
    productType: null,
    orgProductType: null,
    systemBoundary: 'cradle-to-gate',
    packFormat: 'glass-bottle',
    ...overrides,
  }
}

describe('subjectGroup', () => {
  it('resolves the specific category to its benchmark group', () => {
    expect(subjectGroup(subject({ productCategory: 'Gin' }))).toBe('Spirits')
    expect(subjectGroup(subject({ productCategory: 'IPA' }))).toBe('Beer & Cider')
  })

  it('falls back to the product type, then the organisation type', () => {
    expect(
      subjectGroup(subject({ productCategory: null, productType: 'Wine' })),
    ).toBe('Wine')
    expect(
      subjectGroup(
        subject({ productCategory: null, productType: null, orgProductType: 'Wine' }),
      ),
    ).toBe('Wine')
  })

  it('returns null when nothing says what the product is', () => {
    expect(
      subjectGroup(
        subject({ productCategory: null, productType: null, orgProductType: null }),
      ),
    ).toBeNull()
  })
})

describe('indexPeerCohorts', () => {
  it('drops buckets below the k-anonymity floor', () => {
    const index = indexPeerCohorts([
      bucket({ organization_count: MINIMUM_COHORT_ORGANIZATIONS - 1 }),
    ])
    expect(index.byCategory.size).toBe(0)
  })

  it('keeps a bucket exactly at the floor', () => {
    const index = indexPeerCohorts([
      bucket({ organization_count: MINIMUM_COHORT_ORGANIZATIONS }),
    ])
    expect(index.byCategory.size).toBe(1)
  })

  it('drops a bucket with a non-positive median', () => {
    // A zero p50 would produce a division by zero downstream and cannot be a
    // real drink's intensity.
    expect(indexPeerCohorts([bucket({ p50: 0 })]).byCategory.size).toBe(0)
  })

  it('ignores a like-for-like bucket that lost its pack format', () => {
    const index = indexPeerCohorts([
      bucket({ bucket_kind: 'category_format', pack_format: null }),
    ])
    expect(index.byCategoryFormat.size).toBe(0)
  })
})

describe('resolveProductBenchmark', () => {
  it('rung 1: prefers the like-for-like cohort', () => {
    const cohorts = indexPeerCohorts([
      bucket({ bucket_kind: 'category_format', pack_format: 'glass-bottle', p50: 3.0, sample_size: 9 }),
      bucket({ bucket_kind: 'category', p50: 3.4 }),
    ])
    const out = resolveProductBenchmark(subject(), cohorts)
    expect(out.rung).toBe('peer-like-for-like')
    expect(out.kgCO2ePerLitre).toBe(3.0)
    expect(out.cohortProducts).toBe(9)
    expect(out.label).toContain('glass bottles')
    expect(out.label).toContain('alkatera')
  })

  it('rung 2: falls to category-only when the pack format is unknown', () => {
    const cohorts = indexPeerCohorts([
      bucket({ bucket_kind: 'category_format', pack_format: 'glass-bottle', p50: 3.0 }),
      bucket({ bucket_kind: 'category', p50: 3.4 }),
    ])
    const out = resolveProductBenchmark(subject({ packFormat: null }), cohorts)
    expect(out.rung).toBe('peer-category')
    expect(out.kgCO2ePerLitre).toBe(3.4)
  })

  it('rung 2: falls to category-only when the pack format has no cohort of its own', () => {
    const cohorts = indexPeerCohorts([bucket({ bucket_kind: 'category', p50: 3.4 })])
    const out = resolveProductBenchmark(subject({ packFormat: 'aluminium-can' }), cohorts)
    expect(out.rung).toBe('peer-category')
  })

  it('refuses a peer cohort on a different system boundary', () => {
    // The whole claim of a peer benchmark is that it is boundary-consistent by
    // construction. Borrowing a gate cohort for a grave figure would throw
    // that away and reproduce the exact defect of the literature table.
    const cohorts = indexPeerCohorts([
      bucket({ bucket_kind: 'category', system_boundary: 'cradle-to-gate' }),
    ])
    const out = resolveProductBenchmark(
      subject({ systemBoundary: 'cradle-to-grave' }),
      cohorts,
    )
    expect(out.rung).not.toBe('peer-category')
  })

  it('refuses both peer rungs when the boundary could not be read at all', () => {
    const cohorts = indexPeerCohorts([bucket({ bucket_kind: 'category' })])
    const out = resolveProductBenchmark(subject({ systemBoundary: null }), cohorts)
    expect(out.rung).toBe('none') // Spirits' literature row is unsupported
  })

  it('rung 3: uses a literature row whose citation supports it, and surfaces the caveat', () => {
    const out = resolveProductBenchmark(
      subject({ productCategory: 'Red Wine' }),
      emptyPeerCohorts(),
    )
    expect(out.rung).toBe('literature')
    expect(out.kgCO2ePerLitre).toBe(1.6)
    // Wine is 'approximate', so the figure ships with its caveat attached.
    expect(out.caveat).toBeTruthy()
    expect(out.literature?.sourceName).toBeTruthy()
  })

  it('rung 4: refuses a literature row the citation does not support', () => {
    // Spirits' 3.0 is a per-750ml-bottle figure mislabelled per litre.
    const out = resolveProductBenchmark(
      subject({ productCategory: 'Gin' }),
      emptyPeerCohorts(),
    )
    expect(out.rung).toBe('none')
    expect(out.kgCO2ePerLitre).toBeNull()
    expect(out.label).toBe('We cannot benchmark this yet')
  })

  it('rung 4: an uncategorised product is unscored, not scored against the 1.0 default', () => {
    const out = resolveProductBenchmark(
      subject({ productCategory: null, productType: null, orgProductType: null }),
      emptyPeerCohorts(),
    )
    expect(out.rung).toBe('none')
    expect(out.kgCO2ePerLitre).toBeNull()
  })

  it('a peer cohort rescues a category the literature cannot support', () => {
    // This is the point of the whole plan: Spirits has no usable published
    // row, but eight real spirits on the platform do the job.
    const cohorts = indexPeerCohorts([bucket({ bucket_kind: 'category', p50: 3.4 })])
    const out = resolveProductBenchmark(subject({ packFormat: null }), cohorts)
    expect(out.rung).toBe('peer-category')
    expect(out.kgCO2ePerLitre).toBe(3.4)
  })
})

describe('pickLiteratureBenchmark', () => {
  it('no longer ends at the invented 1.0 default', () => {
    expect(
      pickLiteratureBenchmark(
        subject({ productCategory: null, productType: null, orgProductType: null }),
      ),
    ).toBeNull()
  })
})

describe('summariseBenchmarkMix', () => {
  const peer = { rung: 'peer-category' as const, kgCO2ePerLitre: 3.4, label: 'peers', cohortProducts: 11, cohortOrganizations: 6, literature: null, caveat: null }
  const none = { rung: 'none' as const, kgCO2ePerLitre: null, label: 'nope', cohortProducts: null, cohortOrganizations: null, literature: null, caveat: 'no cohort' }

  it('is empty for an empty portfolio', () => {
    expect(summariseBenchmarkMix([]).dominant_rung).toBeNull()
  })

  it('describes the rung most of the volume sits on, not the most numerous', () => {
    // Nine trial SKUs at a hundred units each against one flagship at a
    // million: the flagship is what the number describes.
    const entries = [
      { resolved: peer, weight: 1_000_000 },
      ...Array.from({ length: 9 }, () => ({ resolved: none, weight: 100 })),
    ]
    const mix = summariseBenchmarkMix(entries)
    expect(mix.dominant_rung).toBe('peer-category')
    expect(mix.by_rung['peer-category']).toBe(1)
    expect(mix.by_rung.none).toBe(9)
    expect(mix.cohort_organizations).toBe(6)
  })

  it('carries the caveat of the rung it reports', () => {
    const mix = summariseBenchmarkMix([{ resolved: none, weight: 10 }])
    expect(mix.dominant_rung).toBe('none')
    expect(mix.caveat).toBe('no cohort')
  })
})
