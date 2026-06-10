import { describe, it, expect } from 'vitest';
import {
  CONTAINER_FORMATS,
  CLOSURE_OPTIONS,
  LABEL_OPTIONS,
  MULTIPACK_OPTIONS,
  accessoryOptionsForFormat,
  containerDisplayName,
  getFormat,
  getMaterial,
  getTypicalWeight,
} from '@/lib/constants/packaging-catalogue';
import { getMaterialFactorKey } from '@/lib/end-of-life-factors';
import { checkPackagingWeight } from '@/lib/constants/packaging-weight-ranges';
import { sourceTypeToDataSource } from '@/lib/products/ef-auto-match';

describe('packaging catalogue structure', () => {
  it('every format has at least one material and one size preset', () => {
    for (const format of CONTAINER_FORMATS) {
      expect(format.materials.length).toBeGreaterThan(0);
      expect(format.sizePresets.length).toBeGreaterThan(0);
    }
  });

  it('every material weight band list ends with an open-ended band', () => {
    for (const format of CONTAINER_FORMATS) {
      for (const material of format.materials) {
        if (!material.weightBands) continue;
        const last = material.weightBands[material.weightBands.length - 1];
        expect(last.maxSizeMl).toBe(Infinity);
        for (const band of material.weightBands) {
          expect(band.minG).toBeLessThanOrEqual(band.medianG);
          expect(band.medianG).toBeLessThanOrEqual(band.maxG);
        }
      }
    }
  });

  it('every catalogue material key resolves to its declared end-of-life key', () => {
    // This is the property that makes the 6x EoL misclassification class
    // structurally impossible for wizard rows: container_material must hit
    // MATERIAL_TYPE_MAP directly, never the keyword fallback or 'other'.
    const allMaterials = [
      ...CONTAINER_FORMATS.flatMap((f) => f.materials.map((m) => ({ key: m.key, eolKey: m.eolKey }))),
      ...[...CLOSURE_OPTIONS, ...LABEL_OPTIONS, ...MULTIPACK_OPTIONS].map((o) => ({ key: o.materialKey, eolKey: o.eolKey })),
    ];
    for (const { key, eolKey } of allMaterials) {
      expect(getMaterialFactorKey(key), `material key '${key}'`).toBe(eolKey);
    }
  });

  it('every material has a non-empty emission factor search query', () => {
    for (const format of CONTAINER_FORMATS) {
      for (const material of format.materials) {
        expect(material.efSearchQuery.trim().length).toBeGreaterThan(0);
      }
    }
    for (const option of [...CLOSURE_OPTIONS, ...LABEL_OPTIONS, ...MULTIPACK_OPTIONS]) {
      expect(option.efSearchQuery.trim().length).toBeGreaterThan(0);
    }
  });

  it('catalogue typical weights pass the plausibility check', () => {
    // The wizard pre-fills the catalogue median; it must never trigger the
    // amber implausible-weight warning it sits next to.
    for (const format of CONTAINER_FORMATS) {
      for (const material of format.materials) {
        for (const preset of format.sizePresets) {
          const typical = getTypicalWeight(material, preset.ml);
          if (!typical) continue;
          const result = checkPackagingWeight({
            packagingCategory: 'container',
            materialName: containerDisplayName(format, material, preset.ml),
            containerSizeMl: preset.ml,
            weightG: typical.medianG,
          });
          expect(
            result.level,
            `${format.key}/${material.key} @ ${preset.ml} ml (median ${typical.medianG} g)`
          ).toBe('ok');
        }
      }
    }
  });
});

describe('catalogue helpers', () => {
  it('looks up formats and materials', () => {
    expect(getFormat('bottle')?.label).toBe('Bottle');
    expect(getFormat('spaceship')).toBeNull();
    expect(getMaterial('bottle', 'glass')?.eolKey).toBe('glass');
    expect(getMaterial('bottle', 'aluminium')).toBeNull(); // not a bottle material
  });

  it('returns size-banded typical weights', () => {
    const glass = getMaterial('bottle', 'glass')!;
    const small = getTypicalWeight(glass, 330);
    const large = getTypicalWeight(glass, 750);
    expect(small!.medianG).toBeLessThan(large!.medianG);

    const can = getMaterial('can', 'aluminium')!;
    expect(getTypicalWeight(can, 330)!.medianG).toBe(13);
  });

  it('filters accessory options by format', () => {
    const bottleClosures = accessoryOptionsForFormat(CLOSURE_OPTIONS, 'bottle');
    expect(bottleClosures.some((o) => o.key === 'crown_cap')).toBe(true);
    const cartonClosures = accessoryOptionsForFormat(CLOSURE_OPTIONS, 'carton');
    expect(cartonClosures.some((o) => o.key === 'crown_cap')).toBe(false);
    expect(cartonClosures.some((o) => o.key === 'screw_cap_plastic')).toBe(true);
  });

  it('builds human-readable container names', () => {
    const format = getFormat('bottle')!;
    const glass = getMaterial('bottle', 'glass')!;
    expect(containerDisplayName(format, glass, 750)).toBe('750 ml glass bottle');
    expect(containerDisplayName(format, glass, 1000)).toBe('1 litre glass bottle');
  });
});

describe('emission factor source mapping', () => {
  it('maps source types to DB-valid data_source values', () => {
    expect(sourceTypeToDataSource('primary')).toBe('supplier');
    expect(sourceTypeToDataSource('staging')).toBe('openlca');
    expect(sourceTypeToDataSource('ecoinvent_live')).toBe('openlca');
    expect(sourceTypeToDataSource('agribalyse_live')).toBe('openlca');
    expect(sourceTypeToDataSource(undefined, 'Some Supplier')).toBe('supplier');
    expect(sourceTypeToDataSource(undefined, undefined)).toBe('openlca');
  });
});
