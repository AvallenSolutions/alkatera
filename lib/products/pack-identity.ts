/**
 * Recognising two pack formats that are the same pack.
 *
 * The mirror of `liquid-identity`, and exact for the same reason: a pack
 * format drives real emission factors through its material class, variant and
 * weight, so proposing that someone collapse two packs that differ is worse
 * than missing a pair they can still merge by hand.
 */

import {
  groupByFingerprint,
  suggestSurvivor,
  numeric,
  type CompositionLike,
  type IdenticalGroup,
} from './composition-identity';

export interface PackComponent {
  material_name: string | null;
  packaging_category: string | null;
  packaging_material_class?: string | null;
  packaging_material_variant?: string | null;
  net_weight_g: number | string | null;
  recycled_content_percentage?: number | string | null;
  units_per_group?: number | string | null;
}

export interface PackFormatLike extends CompositionLike {
  /** The pack's specification, from the material rows of a product using it. */
  components: PackComponent[];
}

/**
 * A stable string for a pack's specification.
 *
 * Components are sorted, so the order they were entered in does not matter.
 * What goes in is what changes the number: the class and variant that select
 * the parametric factor, the weight it is multiplied by, the recycled content
 * that modifies it, and the group size that divides it. The component's NAME
 * is deliberately excluded, because "700ml Flint Bottle" and "Flint bottle
 * 700ml" are the same bottle and a name is the one part of a pack a user
 * rewrites freely.
 *
 * Packaging category is included: a 5 g paper label and a 5 g paper wrap round
 * a secondary case are not interchangeable.
 */
export function packFingerprint(pack: PackFormatLike): string {
  const parts = pack.components
    .map((c) => {
      const category = (c.packaging_category ?? '').trim().toLowerCase();
      const cls = (c.packaging_material_class ?? '').trim().toLowerCase();
      const variant = (c.packaging_material_variant ?? '').trim().toLowerCase();
      const weight = numeric(c.net_weight_g);
      const recycled = numeric(c.recycled_content_percentage);
      const group = numeric(c.units_per_group);
      return `${category}:${cls}:${variant}:${weight}:${recycled}:${group}`;
    })
    // A component with no category, class and no weight says nothing; drop it
    // rather than let a blank row make two packs look different.
    .filter((line) => !/^:{3}0:0:0$/.test(line))
    .sort();

  return parts.length > 0 ? parts.join('|') : '';
}

export function findIdenticalPacks(packs: PackFormatLike[]): IdenticalGroup<PackFormatLike>[] {
  return groupByFingerprint(packs, packFingerprint);
}

export const suggestPackSurvivor = suggestSurvivor<PackFormatLike>;
