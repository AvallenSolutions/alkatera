import { describe, expect, it } from 'vitest'
import {
  buildIntensitySnapshot,
  strictBoundary,
  type PcfForIntensity,
  type ProductForIntensity,
} from '../product-intensity'
import type { PackFormatMaterialRow } from '../pack-format'

const AS_OF = new Date(Date.UTC(2026, 6, 24))

function pcf(o: Partial<PcfForIntensity> = {}): PcfForIntensity {
  return {
    id: 'pcf-1',
    organization_id: 'org-1',
    product_id: 42,
    status: 'completed',
    system_boundary: 'cradle-to-gate',
    lca_scope_type: 'cradle-to-gate',
    boundary_source: 'chosen',
    reference_year: 2026,
    aggregated_impacts: { climate_change_gwp100: 2.1 },
    ...o,
  }
}

function product(o: Partial<ProductForIntensity> = {}): ProductForIntensity {
  return {
    id: 42,
    product_category: 'Gin',
    product_kind: 'product',
    unit_size_value: 700,
    unit_size_unit: 'ml',
    is_multipack: false,
    ...o,
  }
}

const glassBottle: PackFormatMaterialRow[] = [
  { packaging_category: 'container', packaging_material_class: 'glass', container_format: 'bottle', net_weight_g: 460 },
]

describe('strictBoundary', () => {
  it('normalises the shapes that actually reach us', () => {
    expect(strictBoundary('cradle-to-grave')).toBe('cradle-to-grave')
    expect(strictBoundary('cradle_to_grave')).toBe('cradle-to-grave')
    expect(strictBoundary('Cradle-To-Grave')).toBe('cradle-to-grave')
  })

  it('returns null instead of assuming cradle-to-gate', () => {
    // normaliseBoundary falls back so a predicate never sees a value it cannot
    // match. A fallback here would put a cradle-to-grave figure into a
    // cradle-to-gate cohort, which is precisely what the benchmark exists to
    // avoid, so an unreadable boundary must block the peer rungs instead.
    expect(strictBoundary('gate-to-gate')).toBeNull()
    expect(strictBoundary(null)).toBeNull()
    expect(strictBoundary('')).toBeNull()
  })
})

describe('buildIntensitySnapshot', () => {
  it('converts a per-unit footprint to per litre', () => {
    // 2.1 kg per 700 ml bottle = 3.0 kg per litre.
    const out = buildIntensitySnapshot(pcf(), product(), glassBottle, AS_OF)
    expect(out.skipped).toBeNull()
    expect(out.row?.value).toBeCloseTo(3.0, 6)
    expect(out.row?.unit).toBe('kg CO2e/L')
    expect(out.row?.snapshot_date).toBe('2026-07-24')
  })

  it('reads centilitres correctly', () => {
    // The PCF's own bulk_volume_per_functional_unit branch treats cl as
    // litres, which would file a 70 cl gin at 0.03 kg/l and make it look like
    // the best product on the platform. The shared converter is used instead.
    const out = buildIntensitySnapshot(
      pcf(),
      product({ unit_size_value: 70, unit_size_unit: 'cl' }),
      glassBottle,
      AS_OF,
    )
    expect(out.row?.value).toBeCloseTo(3.0, 6)
  })

  it('records the bucket dimensions', () => {
    const out = buildIntensitySnapshot(pcf(), product(), glassBottle, AS_OF)
    expect(out.row?.category_group).toBe('Spirits')
    expect(out.row?.product_category).toBe('Gin')
    expect(out.row?.system_boundary).toBe('cradle-to-gate')
    expect(out.row?.pack_format).toBe('glass-bottle')
    expect(out.row?.dimensions).toMatchObject({ fill_volume_l: 0.7, boundary_source: 'chosen' })
  })

  it('still snapshots a product whose pack cannot be resolved', () => {
    // It reaches the category-only rung; it just cannot claim like-for-like.
    const out = buildIntensitySnapshot(pcf(), product(), [], AS_OF)
    expect(out.row).not.toBeNull()
    expect(out.row?.pack_format).toBeNull()
  })

  it.each([
    ['not_completed', pcf({ status: 'draft' }), product()],
    ['no_product', pcf(), null],
    ['hospitality', pcf(), product({ product_kind: 'hospitality_meal' })],
    ['multipack', pcf(), product({ is_multipack: true })],
    ['no_footprint', pcf({ aggregated_impacts: { climate_change_gwp100: 0 } }), product()],
    ['no_volume', pcf(), product({ unit_size_value: null, unit_size_unit: null })],
    ['unrecognised_boundary', pcf({ system_boundary: 'well-to-wheel', lca_scope_type: null }), product()],
  ])('states why it refused: %s', (reason, p, prod) => {
    const out = buildIntensitySnapshot(p, prod, glassBottle, AS_OF)
    expect(out.row).toBeNull()
    expect(out.skipped).toBe(reason)
  })

  it('excludes an implausible figure rather than letting it drag a percentile', () => {
    // A unit error in one product moves the median of a cohort of eight.
    const out = buildIntensitySnapshot(
      pcf({ aggregated_impacts: { climate_change_gwp100: 210000 } }),
      product(),
      glassBottle,
      AS_OF,
    )
    expect(out.skipped).toBe('implausible_value')
  })

  it('leaves category_group null for a category we do not recognise', () => {
    // Null keeps it out of every bucket, which is right: we cannot say what it
    // should be compared against.
    const out = buildIntensitySnapshot(
      pcf(),
      product({ product_category: 'Mystery Drink' }),
      glassBottle,
      AS_OF,
    )
    expect(out.row?.category_group).toBeNull()
  })
})
