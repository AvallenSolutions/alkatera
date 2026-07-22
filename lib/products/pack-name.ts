// What to call a pack format.
//
// The L1/L2 backfill named every pack after the product it was lifted from, so
// an organisation ends up with a pack called "Bath Gin" and another called
// "Highland Reserve 12 Year Old Single Malt" which are both a 700 ml flint
// bottle with a wooden stopper, differing only in whether the case is a
// six-pack or a gift box. That defeats the entire point of L2 — one glass
// weight correction reaching every product in that bottle — because nobody can
// tell which pack IS the 700 ml flint bottle. It also made the composition
// surface offer "Bath Gin" as a pack format to someone making vodka.
//
// So a pack is named after what it is. The container is the defining component
// and leads the name; everything else only appears when it is needed to tell
// two packs apart.
//
// A derived name is a DEFAULT, never a decree. Producers have internal names
// for their packs ("the squat 70") and `pack_formats.name_is_custom` protects
// those: once a human names a pack, nothing here overwrites it.

import type { PackComponent } from './pack-identity';

/** A pack as this module needs to see it. */
export interface NameablePack {
  id: string;
  name: string;
  /** False when the current name is still a machine-generated default. */
  name_is_custom?: boolean;
  components: PackComponent[];
}

const numeric = (value: number | string | null | undefined): number => {
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return typeof parsed === 'number' && isFinite(parsed) ? parsed : 0;
};

/**
 * The component a pack is named after: its container, or failing that its
 * heaviest part. A pack with no components at all cannot be named.
 */
export function definingComponent(components: PackComponent[]): PackComponent | null {
  if (!components || components.length === 0) return null;

  const byWeightDesc = (a: PackComponent, b: PackComponent) =>
    numeric(b.net_weight_g) - numeric(a.net_weight_g);

  const containers = components
    .filter((c) => (c.packaging_category ?? '').trim().toLowerCase() === 'container')
    .sort(byWeightDesc);
  if (containers.length > 0) return containers[0];

  return [...components].sort(byWeightDesc)[0] ?? null;
}

/** How one component reads as a name. */
export function describeComponent(component: PackComponent | null): string | null {
  if (!component) return null;

  // Prefer the structured fields when they are there: they are the parametric
  // packaging data, they are what the factor is selected from, and they will
  // become the norm as packs are re-specified. Most rows predate them.
  const klass = (component.packaging_material_class ?? '').trim();
  const variant = (component.packaging_material_variant ?? '').trim();
  if (klass) {
    const parts = [variant, klass].filter(Boolean).join(' ');
    if (parts) return parts.toLowerCase();
  }

  const name = (component.material_name ?? '').trim();
  return name || null;
}

/**
 * The name a pack would have if nobody had named it.
 *
 * Returns null when there is nothing to go on, so callers keep whatever the
 * pack is currently called rather than renaming it to something empty.
 */
export function derivePackFormatName(components: PackComponent[]): string | null {
  return describeComponent(definingComponent(components));
}

/**
 * Name a set of packs. Returns only the ones that should change.
 *
 * Packs whose name is custom are left out entirely: a producer's internal name
 * ("the squat 70") outranks anything derivable, which is the whole reason
 * `name_is_custom` exists.
 *
 * Two packs CAN come out with the same name — a 700 ml flint bottle in a
 * six-pack case and the same bottle in a gift box genuinely share a container.
 * That is deliberately not disguised with a suffix. A suffix would make the
 * stored name diverge from what the SQL backfill writes, and it would hide the
 * more useful signal: those two are near-duplicates, `pack-identity` proposes
 * the merge, and the shelf shows each pack's components and the products using
 * it underneath, which distinguishes them far better than a trailing clause.
 */
export function assignPackFormatNames(packs: NameablePack[]): Map<string, string> {
  const derived = new Map<string, string>();

  for (const pack of packs) {
    if (pack.name_is_custom) continue;
    const name = derivePackFormatName(pack.components);
    if (!name || name === pack.name) continue;
    derived.set(pack.id, name);
  }

  return derived;
}
