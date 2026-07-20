import { describe, it, expect } from 'vitest';
import {
  MATERIAL_CLASSES,
  MATERIAL_CLASS_LIST,
  CONTAINER_MATERIAL_TO_CLASS,
  getMaterialClass,
  isParametricClass,
  isGapFillerClass,
  resolveVariant,
  inferMaterialClassFromLegacyRow,
} from '@/lib/constants/packaging-material-classes';
import {
  CONTAINER_FORMATS,
  CLOSURE_OPTIONS,
  LABEL_OPTIONS,
  MULTIPACK_OPTIONS,
} from '@/lib/constants/packaging-catalogue';
import { getMaterialFactorKey } from '@/lib/end-of-life-factors';

describe('vocabulary integrity', () => {
  it('every class has at least one variant and a valid default variant', () => {
    for (const def of MATERIAL_CLASS_LIST) {
      expect(def.variants.length).toBeGreaterThanOrEqual(1);
      expect(def.variants.some((v) => v.key === def.defaultVariant)).toBe(true);
    }
  });

  it('every gap-filler names a pinned curated factor', () => {
    for (const def of MATERIAL_CLASS_LIST.filter((d) => d.kind === 'gap_filler')) {
      expect(def.gapFillerFactorId, def.key).toBeTruthy();
      expect(def.gapFillerFactorName, def.key).toBeTruthy();
    }
  });

  it('glass carries the three colour variants', () => {
    expect(MATERIAL_CLASSES.glass.variants.map((v) => v.key)).toEqual(['flint', 'green', 'amber']);
  });
});

describe('catalogue coverage', () => {
  it('every catalogue container material maps to a class', () => {
    for (const format of CONTAINER_FORMATS) {
      for (const material of format.materials) {
        expect(getMaterialClass(material.materialClass), `${format.key}/${material.key}`).not.toBeNull();
      }
    }
  });

  it('every closure/label/multipack option except printed-direct maps to a class', () => {
    const options = [...CLOSURE_OPTIONS, ...LABEL_OPTIONS, ...MULTIPACK_OPTIONS];
    for (const option of options) {
      if (option.key === 'printed_direct') {
        expect(option.materialClass).toBeUndefined();
        continue;
      }
      expect(getMaterialClass(option.materialClass), option.key).not.toBeNull();
    }
  });

  it('every CONTAINER_MATERIAL_TO_CLASS target is a real class', () => {
    for (const [containerMaterial, mapping] of Object.entries(CONTAINER_MATERIAL_TO_CLASS)) {
      expect(getMaterialClass(mapping.class), containerMaterial).not.toBeNull();
      if (mapping.variant) {
        expect(resolveVariant(mapping.class, mapping.variant)).toBe(mapping.variant);
      }
    }
  });
});

describe('kind helpers', () => {
  it('classifies parametric vs gap-filler', () => {
    expect(isParametricClass('glass')).toBe(true);
    expect(isParametricClass('bib_composite')).toBe(false);
    expect(isGapFillerClass('bib_composite')).toBe(true);
    expect(isParametricClass(null)).toBe(false);
    expect(isParametricClass('not-a-class')).toBe(false);
  });

  it('resolveVariant falls back to the default for unknown variants', () => {
    expect(resolveVariant('glass', 'green')).toBe('green');
    expect(resolveVariant('glass', 'chartreuse')).toBe('flint');
    expect(resolveVariant('aluminium', null)).toBe('standard');
    expect(resolveVariant(null, null)).toBe('standard');
  });
});

describe('legacy row inference (admin mapping tool)', () => {
  it('exact: container_material from the guided wizard wins', () => {
    const result = inferMaterialClassFromLegacyRow(
      { container_material: 'glass', material_name: 'Bottle', packaging_category: 'container' },
      getMaterialFactorKey,
    );
    expect(result).toMatchObject({ class: 'glass', confidence: 'exact' });
  });

  it('inferred: the prod factor name "Green Glass Bottle 750ml (80% recycled)" maps to glass/green', () => {
    const result = inferMaterialClassFromLegacyRow(
      {
        container_material: null,
        packaging_category: 'container',
        material_name: '500ml TEO bottle',
        matched_source_name: 'Green Glass Bottle 750ml (80% recycled)',
      },
      getMaterialFactorKey,
    );
    expect(result.class).toBe('glass');
    expect(result.variant).toBe('green');
    expect(result.confidence).toBe('inferred');
  });

  it('inferred: an aluminium can maps from its name', () => {
    const result = inferMaterialClassFromLegacyRow(
      { packaging_category: 'container', material_name: '330ml Aluminium Can' },
      getMaterialFactorKey,
    );
    expect(result).toMatchObject({ class: 'aluminium', confidence: 'inferred' });
  });

  it('none: an unrecognisable row proposes nothing', () => {
    const result = inferMaterialClassFromLegacyRow(
      { packaging_category: 'container', material_name: 'Mystery item' },
      getMaterialFactorKey,
    );
    expect(result).toMatchObject({ class: null, confidence: 'none' });
  });
});
