/**
 * Detecting ingredients that are probably the same thing entered twice.
 *
 * The `ingredients` table has no unique constraint on (organization_id, name),
 * deliberately: existing organisations may already hold case-insensitive
 * duplicates from the URL importer, and forcing uniqueness would mean silently
 * renaming or deleting customer data.
 *
 * So duplicates get the treatment the liquid-and-pack plan settled on for
 * duplicate liquids: the platform detects and proposes, the user holds the
 * authority to merge, and nothing is rewritten underneath them.
 */

export interface IngredientLike {
  id: string;
  name: string;
  matched_source_name?: string | null;
  unit?: string | null;
}

export interface DuplicateGroup {
  /** The normalised form the members share. */
  key: string;
  members: IngredientLike[];
  /** Why these were grouped, in words the user can judge. */
  reason: string;
}

/**
 * Reduce a name to what a human would call "the same ingredient".
 *
 * Case, punctuation, whitespace and a trailing plural all disappear, so
 * "Juniper Berries", "juniper berry" and "juniper-berries" collapse together.
 * Anything more aggressive than this starts merging things that are genuinely
 * different, which is a worse error than missing a duplicate: the user can
 * always merge two rows we failed to group, but cannot easily unpick a merge
 * we proposed wrongly and they accepted.
 */
export function normaliseIngredientName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Singularise the final word only, and only where it is unambiguous:
  // "-ies" becomes "-y", and a trailing "s" is dropped only after a consonant
  // that is not itself an s. So "berries" becomes "berry" and "seeds" becomes
  // "seed", while "molasses" and "lemongrass" are left alone. Deliberately
  // conservative: an English pluraliser that is clever enough to handle
  // "molasses" is also clever enough to merge two things that differ.
  return base
    .replace(/ies$/, 'y')
    .replace(/([^aeious])s$/, '$1');
}

/**
 * Group an organisation's ingredients into sets that look like the same thing.
 *
 * Only groups of two or more are returned, so an organisation with no
 * duplicates gets an empty array rather than a list of singletons.
 */
export function findDuplicateIngredients(ingredients: IngredientLike[]): DuplicateGroup[] {
  const byKey = new Map<string, IngredientLike[]>();

  for (const ingredient of ingredients) {
    const key = normaliseIngredientName(ingredient.name);
    if (!key) continue;
    const group = byKey.get(key);
    if (group) group.push(ingredient);
    else byKey.set(key, [ingredient]);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, members] of Array.from(byKey.entries())) {
    if (members.length < 2) continue;
    const names = new Set(members.map((m: IngredientLike) => m.name));
    groups.push({
      key,
      members,
      reason:
        names.size === 1
          ? 'Entered more than once under exactly the same name.'
          : 'The same name written differently.',
    });
  }

  // Biggest groups first: they are the most worthwhile to resolve.
  return groups.sort((a, b) => b.members.length - a.members.length || a.key.localeCompare(b.key));
}

/**
 * Which member of a duplicate group to keep.
 *
 * Prefers the record that knows the most, so merging loses the least: a
 * matched emission factor first, then a unit, then whichever was created
 * first as a stable tie-break. Only ever a suggestion; the user chooses.
 */
export function suggestSurvivor(group: DuplicateGroup): IngredientLike {
  const score = (i: IngredientLike) => (i.matched_source_name ? 2 : 0) + (i.unit ? 1 : 0);
  return [...group.members].sort((a, b) => score(b) - score(a))[0];
}
