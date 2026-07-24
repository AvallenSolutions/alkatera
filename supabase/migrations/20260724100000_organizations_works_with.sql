-- The four "what do you work with?" modules.
--
-- Vineyards, orchards, arable fields and hospitality are not for every drinks
-- business, so the platform asks once (the arrival ritual's modules step) and
-- remembers the answer here. Two separate questions, deliberately kept apart:
--
--   declared  — does this business DO this?      organizations.works_with
--   entitled  — does its plan OPEN this?         organizations.subscription_tier
--
-- A declared module shows in the workbench whatever the tier, which is what
-- makes the Canopy upsell concrete. Only the tier decides whether it works.
--
-- Until now these four were private betas, admin-granted as boolean keys in
-- organizations.feature_flags. This migration retires those keys: it seeds
-- works_with from them first so no beta org loses its rooms, then strips them.
-- The companion migration (20260724110000_tier_features_single_source.sql)
-- moves the four feature codes into the canopy features_enabled array.
--
-- See lib/subscription/works-with.ts.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS works_with jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.organizations.works_with IS
  'Modules this organisation declares it works with: any of "viticulture", "orchards", "arable_fields", "hospitality". Declared need, not entitlement — the subscription tier decides whether they open. Written by the arrival ritual''s modules step and by Settings > Organisation.';

-- A JSON array of the four known keys, in any order, including empty. `<@`
-- is jsonb containment: every element of works_with must appear in the
-- allow-list, which rejects unknown keys, non-string elements and any
-- non-array shape in one go (a CHECK cannot hold a subquery).
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_works_with_valid;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_works_with_valid CHECK (
    jsonb_typeof(works_with) = 'array'
    AND works_with <@ '["viticulture", "orchards", "arable_fields", "hospitality"]'::jsonb
  );

-- Carry the retiring beta grants across, so every org that had a module keeps
-- it. Idempotent: re-running finds the flags already stripped and changes
-- nothing.
UPDATE public.organizations
SET works_with = (
  SELECT COALESCE(jsonb_agg(DISTINCT m ORDER BY m), '[]'::jsonb)
  FROM (
    SELECT jsonb_array_elements_text(works_with) AS m
    UNION
    SELECT 'viticulture'   WHERE feature_flags->>'viticulture_beta' = 'true'
    UNION
    SELECT 'orchards'      WHERE feature_flags->>'orchard_beta'     = 'true'
    UNION
    SELECT 'arable_fields' WHERE feature_flags->>'arable_beta'      = 'true'
    UNION
    SELECT 'hospitality'   WHERE feature_flags->>'hospitality_beta' = 'true'
  ) AS declared(m)
)
WHERE feature_flags ?| ARRAY['viticulture_beta', 'orchard_beta', 'arable_beta', 'hospitality_beta'];

-- The flags themselves are dead: the feature codes are ordinary canopy
-- features now, and /admin/beta-access no longer offers them.
UPDATE public.organizations
SET feature_flags = feature_flags - 'viticulture_beta' - 'orchard_beta' - 'arable_beta' - 'hospitality_beta'
WHERE feature_flags ?| ARRAY['viticulture_beta', 'orchard_beta', 'arable_beta', 'hospitality_beta'];
