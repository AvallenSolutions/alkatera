-- Hospitality improvements (2026-07, Tier 3) — hotel laundry input.
--
-- Per-room-night laundry energy (a common hotel hot-spot) added to the display-
-- only room allocation, alongside electricity/gas/water. Treated as electricity
-- for the grid factor. Like the rest of the room allocation it is guest-facing
-- per-night intensity only and never re-added to the company total.

ALTER TABLE "public"."hospitality_room_allocation"
  ADD COLUMN IF NOT EXISTS "laundry_kwh" numeric DEFAULT 0 NOT NULL;

ALTER TABLE "public"."hospitality_room_allocation"
  DROP CONSTRAINT IF EXISTS "hospitality_room_allocation_laundry_check";
ALTER TABLE "public"."hospitality_room_allocation"
  ADD CONSTRAINT "hospitality_room_allocation_laundry_check" CHECK (("laundry_kwh" >= (0)::numeric));
