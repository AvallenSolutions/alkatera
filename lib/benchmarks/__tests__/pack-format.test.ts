import { describe, expect, it } from 'vitest'
import {
  canonicalContainerMaterial,
  definingContainerRow,
  packFormatLabel,
  packFormatToken,
  type PackFormatMaterialRow,
} from '../pack-format'

const row = (o: Partial<PackFormatMaterialRow>): PackFormatMaterialRow => ({ ...o })

describe('definingContainerRow', () => {
  it('picks the container role over a heavier non-container row', () => {
    const found = definingContainerRow([
      row({ packaging_category: 'secondary', material_name: 'Gift box', net_weight_g: 400 }),
      row({ packaging_category: 'container', material_name: 'Flint bottle', net_weight_g: 380 }),
    ])
    expect(found?.material_name).toBe('Flint bottle')
  })

  it('accepts the legacy "primary" role spelling', () => {
    const found = definingContainerRow([
      row({ packaging_category: 'primary', material_name: 'Bottle', net_weight_g: 300 }),
    ])
    expect(found?.material_name).toBe('Bottle')
  })

  it('falls back to the heaviest row when nothing is marked a container', () => {
    const found = definingContainerRow([
      row({ material_name: 'Label', net_weight_g: 2 }),
      row({ material_name: 'Can', net_weight_g: 13 }),
    ])
    expect(found?.material_name).toBe('Can')
  })

  it('returns null for an empty pack', () => {
    expect(definingContainerRow([])).toBeNull()
  })
})

describe('canonicalContainerMaterial', () => {
  it('prefers the parametric class the calculator actually uses', () => {
    expect(
      canonicalContainerMaterial(
        row({ packaging_material_class: 'glass', material_name: 'Aluminium sleeve' }),
      ),
    ).toBe('glass')
  })

  it('folds colour and polymer variants into one comparable bucket', () => {
    // Two businesses in green and flint glass are in the same bottle for
    // benchmark purposes; splitting them would empty both cohorts.
    expect(canonicalContainerMaterial(row({ packaging_material_class: 'kraft' }))).toBe('paperboard')
    expect(canonicalContainerMaterial(row({ packaging_material_class: 'corrugated' }))).toBe('paperboard')
    expect(canonicalContainerMaterial(row({ packaging_material_class: 'pp' }))).toBe('hdpe')
  })

  it('infers from free text on rows that predate the structured fields', () => {
    expect(canonicalContainerMaterial(row({ material_name: '700ml Flint Glass Bottle' }))).toBe('glass')
    expect(canonicalContainerMaterial(row({ material_name: '330ml Alu Can' }))).toBe('aluminium')
    expect(canonicalContainerMaterial(row({ material_name: 'rPET bottle' }))).toBe('pet')
  })

  it('returns null rather than guessing at an unreadable row', () => {
    expect(canonicalContainerMaterial(row({ material_name: 'Component 4' }))).toBeNull()
    expect(canonicalContainerMaterial(null)).toBeNull()
  })
})

describe('packFormatToken', () => {
  it('builds a token from the structured fields', () => {
    expect(
      packFormatToken([
        row({
          packaging_category: 'container',
          packaging_material_class: 'glass',
          container_format: 'bottle',
          net_weight_g: 380,
        }),
      ]),
    ).toBe('glass-bottle')
  })

  it('gives two businesses in the same bottle the same token', () => {
    const a = packFormatToken([
      row({ packaging_category: 'container', packaging_material_class: 'glass', container_format: 'bottle' }),
    ])
    const b = packFormatToken([
      row({ packaging_category: 'container', material_name: 'Green glass bottle 750ml' }),
    ])
    expect(a).toBe(b)
  })

  it('does not conflate a can with a bottle', () => {
    const bottle = packFormatToken([row({ material_name: 'Glass bottle' })])
    const can = packFormatToken([row({ material_name: 'Aluminium can' })])
    expect(bottle).toBe('glass-bottle')
    expect(can).toBe('aluminium-can')
  })

  it('reads an aluminium bottle as a bottle, not a can', () => {
    expect(packFormatToken([row({ material_name: 'Aluminium bottle 500ml' })])).toBe(
      'aluminium-bottle',
    )
  })

  it('returns null when the container cannot be resolved', () => {
    // Null drops the product to the category-only rung. An unknown pack is a
    // reason not to claim like-for-like, not a reason to say nothing.
    expect(packFormatToken([])).toBeNull()
    expect(packFormatToken([row({ material_name: 'Unknown part' })])).toBeNull()
  })

  it('resolves a bag-in-box before its paper outer misleads it', () => {
    expect(
      packFormatToken([row({ packaging_category: 'container', material_name: 'Bag-in-box 3L' })]),
    ).toBe('composite-bag_in_box')
  })
})

describe('packFormatLabel', () => {
  it('reads as plain language for the cohort line', () => {
    expect(packFormatLabel('glass-bottle')).toBe('glass bottles')
    expect(packFormatLabel('aluminium-can')).toBe('aluminium cans')
    expect(packFormatLabel('composite-bag_in_box')).toBe('composite bag-in-box')
  })

  it('returns null for anything it does not recognise', () => {
    expect(packFormatLabel(null)).toBeNull()
    expect(packFormatLabel('unobtanium-flask')).toBeNull()
  })
})
