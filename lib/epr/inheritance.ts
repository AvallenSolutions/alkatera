/**
 * The EPR inheritance cascade: packaging activity, UK nation and household
 * status resolve row → organisation → platform.
 *
 * These three facts belong to the organisation, not to each packaging row. A
 * producer with 20 SKUs was answering them roughly 80 times, and the gaps page
 * counted every unanswered row as its own gap. That is root cause F1 in
 * tasks/product-data-duplication-plan.md, and `BulkEditStep` (a screen whose
 * entire purpose was re-filling these fields in bulk) was the codebase's own
 * admission of the problem.
 *
 * The submission generator already resolved activity and nation this way
 * inline. This module is that rule, lifted out so the forms, the gaps page and
 * the generator cannot drift apart.
 */

import type { EPRPackagingActivity, EPRUKNation } from '@/lib/types/lca';

/**
 * The subset of `epr_organization_settings` that feeds the cascade. Every
 * column carries a NOT NULL database default, so a settings row always
 * supplies all three values.
 */
export interface EPROrgDefaults {
  default_packaging_activity: string | null;
  default_uk_nation: string | null;
  default_is_household: boolean | null;
}

/** The three fields as they sit on a `product_materials` row. */
export interface EPRRowValues {
  epr_packaging_activity?: string | null;
  epr_uk_nation?: string | null;
  epr_is_household?: boolean | null;
}

/**
 * Where a resolved value came from.
 *
 * - `row` — this packaging row overrides the organisation.
 * - `organisation` — the organisation's EPR settings supplied it.
 * - `platform` — no settings row exists yet, so alkatera's own fallback
 *   applied. The honest answer is to send the user to EPR settings once,
 *   rather than to every packaging row.
 */
export type EPRInheritSource = 'row' | 'organisation' | 'platform';

export interface Resolved<T> {
  value: T;
  source: EPRInheritSource;
}

/**
 * Platform fallbacks, applied only when an organisation has no EPR settings
 * row at all. These match what the submission generator has always used, so
 * lifting the rule out changes no existing submission.
 */
export const EPR_PLATFORM_FALLBACKS = {
  activity: 'brand' as EPRPackagingActivity,
  nation: 'england' as EPRUKNation,
  isHousehold: true,
} as const;

/**
 * `epr_is_household` carries a column default of false, so unlike the other
 * two it is rarely null. A row only counts as overriding when it holds a
 * boolean; null means "nobody has said", which inherits.
 */
function resolve<T>(
  rowValue: T | null | undefined,
  orgValue: T | null | undefined,
  fallback: T
): Resolved<T> {
  if (rowValue !== null && rowValue !== undefined && rowValue !== ('' as unknown as T)) {
    return { value: rowValue, source: 'row' };
  }
  if (orgValue !== null && orgValue !== undefined && orgValue !== ('' as unknown as T)) {
    return { value: orgValue, source: 'organisation' };
  }
  return { value: fallback, source: 'platform' };
}

export function resolveEprActivity(
  row: EPRRowValues,
  settings: EPROrgDefaults | null | undefined
): Resolved<EPRPackagingActivity> {
  return resolve(
    row.epr_packaging_activity as EPRPackagingActivity | null | undefined,
    settings?.default_packaging_activity as EPRPackagingActivity | null | undefined,
    EPR_PLATFORM_FALLBACKS.activity
  );
}

export function resolveEprNation(
  row: EPRRowValues,
  settings: EPROrgDefaults | null | undefined
): Resolved<EPRUKNation> {
  return resolve(
    row.epr_uk_nation as EPRUKNation | null | undefined,
    settings?.default_uk_nation as EPRUKNation | null | undefined,
    EPR_PLATFORM_FALLBACKS.nation
  );
}

export function resolveEprHousehold(
  row: EPRRowValues,
  settings: EPROrgDefaults | null | undefined
): Resolved<boolean> {
  return resolve(
    row.epr_is_household,
    settings?.default_is_household,
    EPR_PLATFORM_FALLBACKS.isHousehold
  );
}

/** All three at once, for callers that need the whole set. */
export function resolveEprInheritedFields(
  row: EPRRowValues,
  settings: EPROrgDefaults | null | undefined
): {
  activity: Resolved<EPRPackagingActivity>;
  nation: Resolved<EPRUKNation>;
  isHousehold: Resolved<boolean>;
} {
  return {
    activity: resolveEprActivity(row, settings),
    nation: resolveEprNation(row, settings),
    isHousehold: resolveEprHousehold(row, settings),
  };
}

/**
 * True when the organisation has EPR settings that can carry the three
 * inherited fields. When this is false every packaging row would otherwise be
 * reported as three separate gaps; the gaps surface should raise one
 * organisation-level gap instead.
 */
export function hasEprOrgDefaults(settings: EPROrgDefaults | null | undefined): boolean {
  return Boolean(
    settings &&
      settings.default_packaging_activity &&
      settings.default_uk_nation &&
      settings.default_is_household !== null &&
      settings.default_is_household !== undefined
  );
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const EPR_ACTIVITY_LABELS: Record<EPRPackagingActivity, string> = {
  brand: 'Supplied under your brand',
  packed_filled: 'Packed or filled',
  imported: 'Imported (first UK owner)',
  empty: 'Supplied as empty packaging',
  hired: 'Hired or loaned',
  marketplace: 'Online marketplace',
};

export const EPR_NATION_LABELS: Record<EPRUKNation, string> = {
  england: 'England',
  scotland: 'Scotland',
  wales: 'Wales',
  northern_ireland: 'Northern Ireland',
};

/** How to describe the source of an inherited value, for `InheritedField`. */
export function eprSourcePhrase(source: EPRInheritSource): string {
  return source === 'platform' ? 'the alkatera default' : 'your EPR settings';
}
