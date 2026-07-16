-- Hospitality improvements (2026-07) — import finish-line.
--
-- Imported menu recipes are seeded with placeholder ingredient quantities of 1
-- (the product_materials quantity > 0 CHECK forbids a blank amount). This column
-- tracks whether a recipe still holds those placeholders so the UI can badge it,
-- block a misleading Calculate, and drive the bulk-quantity grid.
--
--   confirmed   — quantities are real (default; all existing recipes are untouched)
--   unconfirmed — import placeholders, needs the user to enter real amounts
--   estimated   — AI-proposed amounts the user accepted without editing

ALTER TABLE "public"."hospitality_meal_meta"
  ADD COLUMN IF NOT EXISTS "quantities_status" "text" DEFAULT 'confirmed' NOT NULL;

ALTER TABLE "public"."hospitality_meal_meta"
  DROP CONSTRAINT IF EXISTS "hospitality_meal_meta_quantities_status_check";

ALTER TABLE "public"."hospitality_meal_meta"
  ADD CONSTRAINT "hospitality_meal_meta_quantities_status_check"
  CHECK (("quantities_status" IN ('confirmed', 'unconfirmed', 'estimated')));
