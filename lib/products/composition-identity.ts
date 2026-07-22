/**
 * Grouping compositions that are the same thing entered twice.
 *
 * Shared by liquids and pack formats, because the shape of the problem is
 * identical: the 1:1 backfill gave every product its own, so a producer with
 * two formats of one gin now has two liquids holding one recipe, and two
 * products in the same bottle have two pack formats holding one spec.
 *
 * What differs between the two is only how a line is reduced to a string.
 * That is the parameter; everything else lives here once.
 *
 * Both are propose-only in the same way and for the same reason (decision 2 of
 * tasks/liquid-and-pack-plan.md): the platform detects, the user decides.
 */

export interface CompositionLike {
  id: string;
  name: string;
  /** Products using this composition, for showing what a merge would affect. */
  productCount: number;
}

export interface IdenticalGroup<T extends CompositionLike> {
  fingerprint: string;
  members: T[];
  /** How many products would end up sharing one composition if merged. */
  productCount: number;
}

/**
 * Group by fingerprint, keeping only real groups.
 *
 * An empty fingerprint means "nothing specified yet" and is skipped rather
 * than grouped: a shelf full of empty compositions is not evidence that they
 * are the same thing.
 */
export function groupByFingerprint<T extends CompositionLike>(
  items: T[],
  fingerprintOf: (item: T) => string
): IdenticalGroup<T>[] {
  const byFingerprint = new Map<string, T[]>();

  for (const item of items) {
    const fingerprint = fingerprintOf(item);
    if (!fingerprint) continue;
    const group = byFingerprint.get(fingerprint);
    if (group) group.push(item);
    else byFingerprint.set(fingerprint, [item]);
  }

  const groups: IdenticalGroup<T>[] = [];
  for (const [fingerprint, members] of Array.from(byFingerprint.entries())) {
    if (members.length < 2) continue;
    groups.push({
      fingerprint,
      members,
      productCount: members.reduce((n, m) => n + m.productCount, 0),
    });
  }

  return groups.sort((a, b) => b.members.length - a.members.length);
}

/**
 * Which member of a group to keep: the one already used by the most products,
 * so a merge repoints the fewest and the name most people recognise survives.
 * Ties break by name so the suggestion is stable. Only ever a suggestion.
 */
export function suggestSurvivor<T extends CompositionLike>(group: IdenticalGroup<T>): T {
  return [...group.members].sort(
    (a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name)
  )[0];
}

/**
 * Normalise a number that may arrive as a string from a form or as a numeric
 * from the database, so "480" and 480 fingerprint the same.
 */
export function numeric(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
