-- Hospitality improvements (2026-07, Tier 2) — dietary + allergen tags.
--
-- Guest-facing labels shown as chips on the public QR menu and the recipe
-- editor. Stored per recipe (meal/drink) on hospitality_meal_meta. Values are
-- validated against controlled vocabularies in app code (lib/hospitality/dietary.ts),
-- so no DB CHECK/enum — arrays default to empty.

ALTER TABLE "public"."hospitality_meal_meta"
  ADD COLUMN IF NOT EXISTS "dietary_tags" "text"[] NOT NULL DEFAULT '{}';

ALTER TABLE "public"."hospitality_meal_meta"
  ADD COLUMN IF NOT EXISTS "allergens" "text"[] NOT NULL DEFAULT '{}';
