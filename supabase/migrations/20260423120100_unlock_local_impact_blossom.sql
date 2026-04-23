-- Unlock Community Local Impact feature for Blossom tier.
-- Previously Canopy-only; now included from Blossom upwards.

UPDATE subscription_tier_limits
SET features_enabled = features_enabled || '["community_local_impact"]'::jsonb
WHERE tier_name = 'blossom'
  AND NOT (features_enabled ? 'community_local_impact');
