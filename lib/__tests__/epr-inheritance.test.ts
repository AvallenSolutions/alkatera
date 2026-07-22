import { describe, it, expect } from 'vitest';
import {
  resolveEprActivity,
  resolveEprNation,
  resolveEprHousehold,
  resolveEprInheritedFields,
  hasEprOrgDefaults,
  eprSourcePhrase,
  EPR_PLATFORM_FALLBACKS,
  type EPROrgDefaults,
} from '../epr/inheritance';
import { checkMissingFields, assessDataCompleteness } from '../epr/validation';

/**
 * The EPR inheritance cascade and its effect on the gaps rule.
 *
 * The thing worth protecting here is that an unset packaging row is
 * *inheriting*, not incomplete. Getting that wrong in either direction is a
 * real bug: treat inherited values as gaps and a 20-product organisation sees
 * roughly 80 phantom gaps again; treat missing values as inherited when no
 * settings exist and a genuinely incomplete submission looks ready.
 */

const ORG_SETTINGS: EPROrgDefaults = {
  default_packaging_activity: 'imported',
  default_uk_nation: 'scotland',
  default_is_household: false,
};

function material(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    product_id: 1,
    material_name: 'Flint glass bottle',
    packaging_category: 'container',
    net_weight_g: 480,
    epr_packaging_activity: null,
    epr_packaging_level: 'primary',
    epr_uk_nation: null,
    epr_ram_rating: null,
    epr_is_household: null,
    epr_is_drinks_container: true,
    epr_material_type: 'glass',
    ...overrides,
  } as any;
}

describe('EPR inheritance cascade', () => {
  describe('row wins over the organisation', () => {
    it('takes the row value and reports it as an override', () => {
      const r = resolveEprActivity({ epr_packaging_activity: 'hired' }, ORG_SETTINGS);
      expect(r).toEqual({ value: 'hired', source: 'row' });
    });

    it('treats an empty string as unset rather than an override', () => {
      const r = resolveEprActivity({ epr_packaging_activity: '' }, ORG_SETTINGS);
      expect(r).toEqual({ value: 'imported', source: 'organisation' });
    });

    it('treats a false household value as a real override, not as unset', () => {
      // The trap: `false` is falsy but is a deliberate "non-household" answer.
      const r = resolveEprHousehold({ epr_is_household: false }, {
        ...ORG_SETTINGS,
        default_is_household: true,
      });
      expect(r).toEqual({ value: false, source: 'row' });
    });
  });

  describe('organisation answers an unset row', () => {
    it('resolves all three from settings when the row says nothing', () => {
      expect(resolveEprInheritedFields({}, ORG_SETTINGS)).toEqual({
        activity: { value: 'imported', source: 'organisation' },
        nation: { value: 'scotland', source: 'organisation' },
        isHousehold: { value: false, source: 'organisation' },
      });
    });
  });

  describe('platform fallback when nothing is configured', () => {
    it('falls back and says so, so the caller can point at EPR settings', () => {
      expect(resolveEprInheritedFields({}, null)).toEqual({
        activity: { value: 'brand', source: 'platform' },
        nation: { value: 'england', source: 'platform' },
        isHousehold: { value: true, source: 'platform' },
      });
    });

    it('matches the fallbacks the submission generator has always applied', () => {
      expect(EPR_PLATFORM_FALLBACKS).toEqual({
        activity: 'brand',
        nation: 'england',
        isHousehold: true,
      });
    });

    it('falls through a partially configured settings row field by field', () => {
      const partial: EPROrgDefaults = {
        default_packaging_activity: null,
        default_uk_nation: 'wales',
        default_is_household: null,
      };
      expect(resolveEprInheritedFields({}, partial)).toEqual({
        activity: { value: 'brand', source: 'platform' },
        nation: { value: 'wales', source: 'organisation' },
        isHousehold: { value: true, source: 'platform' },
      });
    });
  });

  describe('hasEprOrgDefaults', () => {
    it('is true only when all three defaults are present', () => {
      expect(hasEprOrgDefaults(ORG_SETTINGS)).toBe(true);
      expect(hasEprOrgDefaults(null)).toBe(false);
      expect(hasEprOrgDefaults({ ...ORG_SETTINGS, default_uk_nation: null })).toBe(false);
      expect(hasEprOrgDefaults({ ...ORG_SETTINGS, default_is_household: null })).toBe(false);
    });

    it('counts a false household default as present', () => {
      expect(hasEprOrgDefaults({ ...ORG_SETTINGS, default_is_household: false })).toBe(true);
    });
  });

  it('names the source in words the user can act on', () => {
    expect(eprSourcePhrase('organisation')).toBe('your EPR settings');
    expect(eprSourcePhrase('row')).toBe('your EPR settings');
    expect(eprSourcePhrase('platform')).toBe('the alkatera default');
  });
});

describe('the gaps rule respects inheritance', () => {
  it('reports no gaps for an untouched row once the organisation has defaults', () => {
    expect(checkMissingFields(material(), ORG_SETTINGS)).toEqual([]);
  });

  it('reports all three as gaps when no settings exist', () => {
    expect(checkMissingFields(material(), null)).toEqual([
      'Packaging Activity',
      'UK Nation',
      'Household/Non-household',
    ]);
  });

  it('still reports facts no higher level can answer', () => {
    // Net weight and material type belong to the packaging item itself, so
    // organisation defaults must not silence them.
    expect(
      checkMissingFields(material({ net_weight_g: null, epr_material_type: 'other' }), ORG_SETTINGS)
    ).toEqual(['Net Weight', 'EPR Material Type']);
  });

  it('still reports the drinks-container flag, which does not inherit', () => {
    expect(checkMissingFields(material({ epr_is_drinks_container: null }), ORG_SETTINGS)).toEqual([
      'Drinks Container flag',
    ]);
  });

  it('collapses a whole portfolio of phantom gaps to none', () => {
    // The headline number from the audit: 20 products x 4 packaging rows, none
    // of which has ever been asked these three questions.
    const items = Array.from({ length: 80 }, (_, i) => material({ id: i + 1, product_id: i + 1 }));

    const withoutSettings = assessDataCompleteness(items, null);
    expect(withoutSettings.incomplete_items).toBe(80);
    expect(withoutSettings.completeness_pct).toBe(0);
    expect(withoutSettings.gaps).toHaveLength(80);
    // Three phantom questions per row, 240 in total.
    expect(withoutSettings.gaps.reduce((n, g) => n + g.missing_fields.length, 0)).toBe(240);

    const withSettings = assessDataCompleteness(items, ORG_SETTINGS);
    expect(withSettings.incomplete_items).toBe(0);
    expect(withSettings.complete_items).toBe(80);
    expect(withSettings.completeness_pct).toBe(100);
    expect(withSettings.gaps).toEqual([]);
  });

  it('leaves a genuine per-row override untouched by inheritance', () => {
    const overridden = material({ epr_uk_nation: 'northern_ireland' });
    expect(checkMissingFields(overridden, ORG_SETTINGS)).toEqual([]);
    expect(resolveEprNation(overridden, ORG_SETTINGS)).toEqual({
      value: 'northern_ireland',
      source: 'row',
    });
  });
});
