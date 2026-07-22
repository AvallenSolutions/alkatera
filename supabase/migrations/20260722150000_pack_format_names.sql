-- A pack is named after what it is, not after the first product it was found on.
--
-- The L2 backfill named every pack format after the product it was lifted from.
-- That produced an organisation holding a pack called "Bath Gin" and another
-- called "Highland Reserve 12 Year Old Single Malt" which are both a 700 ml
-- flint bottle with a wooden stopper, differing only in six-pack case versus
-- gift box. It defeats the point of L2 — one glass-weight correction reaching
-- every product in that bottle — because nobody can tell which pack IS the
-- 700 ml flint bottle, and it made the composition surface offer "Bath Gin" as
-- a pack format to somebody making vodka.
--
-- Two rules, and the second is why this is safe:
--
--   1. A pack's default name is its container component's name.
--   2. Once a human names a pack, nothing overwrites it. Producers have
--      internal names ("the squat 70") and they outrank anything derivable.
--
-- Only names that are still the MACHINE-GENERATED placeholder are rewritten
-- here, detected by the name still being exactly the name of the product the
-- backfill lifted it from. That is precisely what `created_from_product_id` was
-- added for. A pack renamed by a user, or lifted from a since-renamed product,
-- is left alone — this corrects our own default, it does not overrule anyone.
--
-- The same rule lives in `lib/products/pack-name.ts`, which governs names from
-- here on (new packs, and re-deriving after a component changes). This is the
-- one-time catch-up for rows that predate it.

-- ---------------------------------------------------------------------------
-- The flag that protects a human's name
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."pack_formats"
  ADD COLUMN IF NOT EXISTS "name_is_custom" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "public"."pack_formats"."name_is_custom" IS
  'True once a person has named this pack. While false the name is a default derived from the container component, and may be re-derived when the components change. Never re-derive when true.';

-- ---------------------------------------------------------------------------
-- Rename the placeholders
-- ---------------------------------------------------------------------------

WITH placeholder AS (
  -- Packs still carrying the backfill's name: the name of the product they
  -- were lifted from. Anything else has been touched and is not ours to change.
  SELECT pf.id, pf.created_from_product_id
  FROM public.pack_formats pf
  JOIN public.products p ON p.id = pf.created_from_product_id
  WHERE pf.name_is_custom = false
    AND pf.name = p.name
),
defining AS (
  -- The container component, heaviest first so a bottle beats a miniature;
  -- failing that the heaviest component of any kind, which covers a
  -- shipper-only pack that has no container of its own.
  SELECT DISTINCT ON (ph.id)
         ph.id,
         NULLIF(btrim(pm.material_name), '') AS component_name
  FROM placeholder ph
  JOIN public.product_materials pm
    ON pm.product_id = ph.created_from_product_id
   AND pm.material_type = 'packaging'
  ORDER BY ph.id,
           (lower(btrim(coalesce(pm.packaging_category, ''))) = 'container') DESC,
           coalesce(pm.net_weight_g, 0) DESC,
           pm.material_name
)
UPDATE public.pack_formats pf
SET name = d.component_name,
    updated_at = now()
FROM defining d
WHERE pf.id = d.id
  -- A pack with no usable component name keeps whatever it is called: a bad
  -- name beats a blank one.
  AND d.component_name IS NOT NULL
  AND d.component_name <> pf.name;
