-- Migration: Add LCA system boundary feature codes to tier features_enabled arrays
--
-- New feature codes:
--   lca_distribution  — Blossom+ (enables Cradle-to-Shelf)
--   lca_use_phase     — Canopy   (enables Cradle-to-Consumer)
--   lca_end_of_life   — Canopy   (enables Cradle-to-Grave)
--
-- Seed tier: Cradle-to-Gate only (no new codes needed)

-- ============================================================================
-- 1. Blossom: add lca_distribution
-- ============================================================================

UPDATE subscription_tier_limits
SET features_enabled = features_enabled || jsonb_build_array('lca_distribution')
WHERE tier_name = 'blossom'
  AND NOT features_enabled ? 'lca_distribution';

-- ============================================================================
-- 2. Canopy: add lca_distribution, lca_use_phase, lca_end_of_life
-- ============================================================================

UPDATE subscription_tier_limits
SET features_enabled = features_enabled || jsonb_build_array('lca_distribution')
WHERE tier_name = 'canopy'
  AND NOT features_enabled ? 'lca_distribution';

UPDATE subscription_tier_limits
SET features_enabled = features_enabled || jsonb_build_array('lca_use_phase')
WHERE tier_name = 'canopy'
  AND NOT features_enabled ? 'lca_use_phase';

UPDATE subscription_tier_limits
SET features_enabled = features_enabled || jsonb_build_array('lca_end_of_life')
WHERE tier_name = 'canopy'
  AND NOT features_enabled ? 'lca_end_of_life';
