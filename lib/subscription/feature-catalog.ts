/**
 * Feature → tier catalog: the single source of truth for subscription gating.
 *
 * Everything that decides "which tier unlocks which feature" derives from this
 * file:
 *   - `getRequiredTierForFeature()` and the `hasFeature` fallback in
 *     `hooks/useSubscription.ts`
 *   - the `subscription_tier_limits.features_enabled` arrays in the DB, which
 *     are GENERATED from `featuresForTier()` via
 *     `scripts/gen-tier-features-sql.ts` (run `npx tsx` to regenerate the
 *     migration). The server RPC `check_feature_access` reads those arrays.
 *
 * To add/move a feature: edit `FEATURE_MIN_TIER` (or `BETA_FEATURES`) here,
 * then regenerate the migration. Do NOT hand-edit the DB arrays or the hook.
 */

import type { FeatureCode } from '@/hooks/useSubscription';

export type TierName = 'seed' | 'blossom' | 'canopy';
export type TierLevel = 1 | 2 | 3;

/** Numeric rank for each tier. Higher tiers inherit lower-tier features. */
export const TIER_LEVELS: Record<TierName, TierLevel> = {
  seed: 1,
  blossom: 2,
  canopy: 3,
};

export const TIER_NAMES: TierName[] = ['seed', 'blossom', 'canopy'];

/**
 * Every NON-BETA feature → the minimum tier that unlocks it.
 *
 * Inheritance is cumulative: a tier is granted every feature whose minimum-tier
 * level is ≤ its own level (see `featuresForTier`). Beta features are listed
 * separately in `BETA_FEATURES` and are never tier-inherited — they require an
 * explicit admin grant via `organizations.feature_flags`.
 */
export const FEATURE_MIN_TIER: Record<string, TierName> = {
  // ── Seed (level 1) ───────────────────────────────────────────────────────
  dashboard_vitality: 'seed',
  facilities_management: 'seed',
  fleet_overview: 'seed',
  supplier_directory: 'seed',
  company_emissions_current: 'seed',
  product_management: 'seed',
  product_passport: 'seed',
  carbon_footprint_ghg: 'seed',
  pdf_report_export: 'seed',
  rosa_ai_25: 'seed',
  greenwash_website: 'seed',
  knowledge_bank_read: 'seed',
  // Legacy seed-equivalent codes (kept for backward compat)
  ghg_emissions: 'seed',
  live_passport: 'seed',
  automated_verification: 'seed',
  email_support: 'seed',
  recipe_2016: 'seed',

  // ── Blossom (level 2) ────────────────────────────────────────────────────
  supply_chain_mapping: 'blossom',
  full_scope_3: 'blossom',
  water_footprint: 'blossom',
  waste_circularity: 'blossom',
  land_use_impact: 'blossom',
  resource_use_tracking: 'blossom',
  lca_distribution: 'blossom',
  rosa_ai_100: 'blossom',
  greenwash_documents: 'blossom',
  people_fair_work: 'blossom',
  people_diversity_inclusion: 'blossom',
  community_charitable_giving: 'blossom',
  community_volunteering: 'blossom',
  community_local_impact: 'blossom',
  bcorp_tracking: 'blossom',
  cdp_tracking: 'blossom',
  knowledge_bank_manage: 'blossom',
  vehicle_registry: 'blossom',
  fleet_reporting: 'blossom',
  // Legacy blossom-equivalent codes
  ef_31: 'blossom',
  monthly_analytics: 'blossom',
  product_comparison: 'blossom',

  // ── Canopy (level 3) ─────────────────────────────────────────────────────
  year_over_year: 'canopy',
  advanced_data_quality: 'canopy',
  ef_31_single_score: 'canopy',
  lca_use_phase: 'canopy',
  lca_end_of_life: 'canopy',
  rosa_ai_unlimited: 'canopy',
  greenwash_unlimited: 'canopy',
  people_wellbeing: 'canopy',
  people_training: 'canopy',
  governance_ethics: 'canopy',
  community_impact_stories: 'canopy',
  csrd_compliance: 'canopy',
  gri_standards: 'canopy',
  iso_14001: 'canopy',
  iso_50001: 'canopy',
  sbti_targets: 'canopy',
  gap_analysis: 'canopy',
  audit_packages: 'canopy',
  third_party_verification: 'canopy',
  // Legacy canopy-only codes
  custom_weighting: 'canopy',
  white_label: 'canopy',
  biodiversity_tracking: 'canopy',
  b_corp_assessment: 'canopy',
  sandbox_analytics: 'canopy',
  priority_chat: 'canopy',
  verified_data: 'canopy',
  pef_reports: 'canopy',
  api_access: 'canopy',
};

/**
 * Mutually-exclusive feature ladders: codes that are tier variants of ONE
 * capability (the Rosa monthly-query quota). A tier is granted only the single
 * highest variant at or below its level — not the whole ladder — so the DB
 * array reads "on the 100/mo plan", not "also has 25/mo".
 *
 * Greenwash codes are deliberately NOT here: website/documents/unlimited are
 * additive capabilities (a higher tier keeps the lower ones), not an exclusive
 * quota, so they inherit cumulatively like everything else.
 */
export const EXCLUSIVE_LADDERS: string[][] = [
  ['rosa_ai_25', 'rosa_ai_100', 'rosa_ai_unlimited'],
];

/**
 * Beta features. Admin-granted per-org via `organizations.feature_flags`; never
 * tier-inherited. Integration betas (`<slug>_integration_beta`) are matched by
 * suffix in `isBetaFeature` so adding a provider needs no change here.
 */
export const BETA_FEATURES: FeatureCode[] = [
  'impact_valuation_beta',
  'epr_beta',
  'viticulture_beta',
  'orchard_beta',
  'arable_beta',
  'hospitality_beta',
];

/** True for any beta feature (enumerated product betas or an integration beta). */
export function isBetaFeature(featureCode: FeatureCode): boolean {
  return (
    BETA_FEATURES.includes(featureCode) ||
    (typeof featureCode === 'string' && featureCode.endsWith('_integration_beta'))
  );
}

/**
 * Minimum tier required for a feature. Betas resolve to `canopy` (the paid
 * baseline shown in upsell copy) but still require an explicit admin grant —
 * `hasFeature` short-circuits betas before consulting this. Unknown codes
 * default to `seed`.
 */
export function getRequiredTierForFeature(featureCode: FeatureCode): TierName {
  if (isBetaFeature(featureCode)) return 'canopy';
  return FEATURE_MIN_TIER[featureCode] ?? 'seed';
}

/**
 * Cumulative list of non-beta features granted at a tier — every feature whose
 * minimum-tier level is ≤ the given tier's level. This generates the DB
 * `features_enabled` arrays. Sorted for stable, diffable output.
 */
export function featuresForTier(tier: TierName): string[] {
  const level = TIER_LEVELS[tier];
  const granted = new Set(
    Object.keys(FEATURE_MIN_TIER).filter(
      (code) => TIER_LEVELS[FEATURE_MIN_TIER[code]] <= level
    )
  );
  // Collapse each exclusive ladder to its single highest in-tier variant.
  for (const ladder of EXCLUSIVE_LADDERS) {
    const inTier = ladder.filter((code) => granted.has(code));
    if (inTier.length > 1) {
      const highest = inTier.reduce((a, b) =>
        TIER_LEVELS[FEATURE_MIN_TIER[b]] >= TIER_LEVELS[FEATURE_MIN_TIER[a]] ? b : a
      );
      for (const code of inTier) if (code !== highest) granted.delete(code);
    }
  }
  return Array.from(granted).sort();
}
