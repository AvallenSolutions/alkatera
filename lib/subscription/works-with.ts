/**
 * The four "what do you work with?" modules — the single source of truth.
 *
 * Vineyards, orchards, arable fields and hospitality are not for every drinks
 * business, so the platform asks once (the arrival ritual's modules step) and
 * remembers the answer in `organizations.works_with`. Two separate questions,
 * deliberately kept apart:
 *
 *   declared  — does this business DO this? (`organizations.works_with`)
 *   entitled  — is this business on a plan that OPENS it? (Canopy)
 *
 * A declared module appears in the workbench whatever the tier: that is what
 * makes the Canopy upsell concrete rather than abstract. Only the tier decides
 * whether the surface actually works, and every gate below is tier-only.
 *
 * These were private betas (`viticulture_beta` and friends in
 * `organizations.feature_flags`) until 2026-07-24. The flags are gone; the
 * migration seeded `works_with` from them so no beta org lost its rooms.
 */

import type { FeatureCode } from '@/hooks/useSubscription';
import type { TierName } from './feature-catalog';

export const WORKS_WITH_MODULES = [
  'viticulture',
  'orchards',
  'arable_fields',
  'hospitality',
] as const;

export type WorksWithModule = (typeof WORKS_WITH_MODULES)[number];

/** The tier that opens every module. Also the one the onboarding step names. */
export const MODULE_TIER: TierName = 'canopy';

/**
 * Module → the feature code it gates on. They are the same string by design:
 * one name for the module, the catalog entry and the FeatureGate copy.
 */
export const MODULE_FEATURE: Record<WorksWithModule, FeatureCode> = {
  viticulture: 'viticulture',
  orchards: 'orchards',
  arable_fields: 'arable_fields',
  hospitality: 'hospitality',
};

/** Where each module lives once it is declared. */
export const MODULE_HREF: Record<WorksWithModule, string> = {
  viticulture: '/vineyards/',
  orchards: '/orchards/',
  arable_fields: '/arable-fields/',
  hospitality: '/hospitality/',
};

/** Band-tab labels: short, plain, no "beta". */
export const MODULE_LABEL: Record<WorksWithModule, string> = {
  viticulture: 'Vineyards',
  orchards: 'Orchards',
  arable_fields: 'Arable fields',
  hospitality: 'Hospitality',
};

/** True when the string is one of the four module keys. */
export function isWorksWithModule(value: unknown): value is WorksWithModule {
  return typeof value === 'string' && (WORKS_WITH_MODULES as readonly string[]).includes(value);
}

/**
 * Read `organizations.works_with` into a clean, de-duplicated module list.
 * Tolerates null, a JSON string, junk entries and legacy shapes — this column
 * is written by onboarding and by settings, and a bad row must never throw in
 * the middle of rendering a room band.
 */
export function parseWorksWith(value: unknown): WorksWithModule[] {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<WorksWithModule>();
  for (const entry of raw) if (isWorksWithModule(entry)) seen.add(entry);
  // Stable order: the canonical one, not whatever the user clicked first.
  return WORKS_WITH_MODULES.filter((m) => seen.has(m));
}

/** Does this tier open the modules? Canopy only. */
export function tierOpensModules(tier: string | null | undefined): boolean {
  return tier === MODULE_TIER;
}
