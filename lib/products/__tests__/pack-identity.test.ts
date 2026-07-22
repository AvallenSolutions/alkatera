import { describe, it, expect } from 'vitest';
import {
  packFingerprint,
  findIdenticalPacks,
  suggestPackSurvivor,
  type PackFormatLike,
} from '../pack-identity';

/**
 * Pack identity. Exact for the same reason liquid identity is: a pack's class,
 * variant and weight select and scale a real emission factor, so proposing
 * that someone collapse two packs that differ is worse than missing a pair
 * they can still merge by hand.
 */

function pack(over: Partial<PackFormatLike> = {}): PackFormatLike {
  return {
    id: 'p1',
    name: '700ml flint bottle',
    productCount: 1,
    components: [
      {
        material_name: '700ml Flint Glass Bottle',
        packaging_category: 'container',
        packaging_material_class: 'glass',
        packaging_material_variant: 'flint',
        net_weight_g: 480,
        recycled_content_percentage: 51,
      },
      {
        material_name: 'Front label',
        packaging_category: 'label',
        packaging_material_class: 'paper',
        net_weight_g: 3,
      },
    ],
    ...over,
  };
}

describe('packFingerprint', () => {
  it('ignores the order components were entered in', () => {
    const reversed = pack({ components: [...pack().components].reverse() });
    expect(packFingerprint(pack())).toBe(packFingerprint(reversed));
  });

  it('ignores the component name, which users rewrite freely', () => {
    // "700ml Flint Bottle" and "Flint bottle 700ml" are the same bottle.
    const renamed = pack({
      components: pack().components.map((c) => ({ ...c, material_name: 'Something else' })),
    });
    expect(packFingerprint(pack())).toBe(packFingerprint(renamed));
  });

  it('treats numeric strings and numbers alike', () => {
    const asStrings = pack({
      components: pack().components.map((c) => ({
        ...c,
        net_weight_g: String(c.net_weight_g),
        recycled_content_percentage:
          c.recycled_content_percentage === undefined
            ? undefined
            : String(c.recycled_content_percentage),
      })),
    });
    expect(packFingerprint(pack())).toBe(packFingerprint(asStrings));
  });

  it('separates packs that differ by weight', () => {
    const heavier = pack({
      components: [{ ...pack().components[0], net_weight_g: 550 }, pack().components[1]],
    });
    expect(packFingerprint(pack())).not.toBe(packFingerprint(heavier));
  });

  it('separates packs that differ by material class or variant', () => {
    const green = pack({
      components: [
        { ...pack().components[0], packaging_material_variant: 'green' },
        pack().components[1],
      ],
    });
    const plastic = pack({
      components: [
        { ...pack().components[0], packaging_material_class: 'plastic_rigid' },
        pack().components[1],
      ],
    });
    expect(packFingerprint(pack())).not.toBe(packFingerprint(green));
    expect(packFingerprint(pack())).not.toBe(packFingerprint(plastic));
  });

  it('separates packs that differ by recycled content', () => {
    // Recycled content modifies the derived factor, so it is part of identity.
    const virgin = pack({
      components: [
        { ...pack().components[0], recycled_content_percentage: 0 },
        pack().components[1],
      ],
    });
    expect(packFingerprint(pack())).not.toBe(packFingerprint(virgin));
  });

  it('separates the same material in a different role', () => {
    // A 3 g paper label and a 3 g paper wrap on a case are not interchangeable.
    const asSecondary = pack({
      components: [
        pack().components[0],
        { ...pack().components[1], packaging_category: 'secondary' },
      ],
    });
    expect(packFingerprint(pack())).not.toBe(packFingerprint(asSecondary));
  });

  it('separates a single from a shared pack', () => {
    const sixPack = pack({
      components: [{ ...pack().components[0], units_per_group: 6 }, pack().components[1]],
    });
    expect(packFingerprint(pack())).not.toBe(packFingerprint(sixPack));
  });

  it('separates packs that differ by a whole component', () => {
    const withClosure = pack({
      components: [
        ...pack().components,
        {
          material_name: 'Cork',
          packaging_category: 'closure',
          packaging_material_class: 'cork',
          net_weight_g: 5,
        },
      ],
    });
    expect(packFingerprint(pack())).not.toBe(packFingerprint(withClosure));
  });

  it('is empty for a pack with nothing specified', () => {
    expect(packFingerprint(pack({ components: [] }))).toBe('');
    // A blank row says nothing and must not make two packs look different.
    expect(
      packFingerprint(
        pack({
          components: [
            { material_name: null, packaging_category: null, net_weight_g: null },
          ],
        })
      )
    ).toBe('');
  });
});

describe('findIdenticalPacks', () => {
  it('finds the case the 1:1 backfill creates: two products, one bottle', () => {
    const groups = findIdenticalPacks([
      pack({ id: 'a', name: 'Gin 700ml' }),
      pack({ id: 'b', name: 'Vodka 700ml' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.id)).toEqual(['a', 'b']);
    expect(groups[0].productCount).toBe(2);
  });

  it('proposes nothing when the packs genuinely differ', () => {
    const groups = findIdenticalPacks([
      pack({ id: 'a' }),
      pack({
        id: 'b',
        components: [{ ...pack().components[0], net_weight_g: 550 }],
      }),
    ]);
    expect(groups).toEqual([]);
  });

  it('never groups packs with nothing specified', () => {
    expect(
      findIdenticalPacks([
        pack({ id: 'a', components: [] }),
        pack({ id: 'b', components: [] }),
      ])
    ).toEqual([]);
  });
});

describe('suggestPackSurvivor', () => {
  it('keeps the pack already used by the most products', () => {
    const group = findIdenticalPacks([
      pack({ id: 'few', name: 'B format', productCount: 1 }),
      pack({ id: 'many', name: 'A format', productCount: 5 }),
    ])[0];
    expect(suggestPackSurvivor(group).id).toBe('many');
  });
});
