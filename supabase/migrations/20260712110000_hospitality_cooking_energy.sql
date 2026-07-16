-- Hospitality improvements (2026-07) — cooking energy.
--
-- A meal's PCF is cradle-to-gate (ingredient production only). Cooking energy is
-- shown as a per-cover display figure on top of the ingredient impact, but is
-- NOT added to the PCF or the company total: the kitchen's electricity/gas is
-- already captured in the venue's facility Scope 1/2, so re-adding it here would
-- double-count. These two columns hold the cooking method and its run time so the
-- display figure can be derived (see lib/hospitality/cooking-energy.ts).

ALTER TABLE "public"."hospitality_meal_meta"
  ADD COLUMN IF NOT EXISTS "cooking_method" "text";

ALTER TABLE "public"."hospitality_meal_meta"
  DROP CONSTRAINT IF EXISTS "hospitality_meal_meta_cooking_method_check";

ALTER TABLE "public"."hospitality_meal_meta"
  ADD CONSTRAINT "hospitality_meal_meta_cooking_method_check"
  CHECK (("cooking_method" IS NULL OR "cooking_method" IN (
    'oven_electric', 'oven_gas', 'hob_electric', 'hob_gas',
    'fryer', 'grill', 'microwave', 'sous_vide', 'no_cook'
  )));

ALTER TABLE "public"."hospitality_meal_meta"
  ADD COLUMN IF NOT EXISTS "cooking_minutes" numeric;

ALTER TABLE "public"."hospitality_meal_meta"
  DROP CONSTRAINT IF EXISTS "hospitality_meal_meta_cooking_minutes_check";

ALTER TABLE "public"."hospitality_meal_meta"
  ADD CONSTRAINT "hospitality_meal_meta_cooking_minutes_check"
  CHECK (("cooking_minutes" IS NULL OR "cooking_minutes" >= (0)::numeric));
