-- Fix vehicles_fuel_type_check + vehicles_propulsion_type_check
--
-- The initial schema declared these CHECK constraints with capitalized values
-- ('Diesel', 'Petrol', 'ICE', 'BEV', ...), but:
--   • The form in components/fleet/FleetVehicleRegistry.tsx submits lowercase
--     values ('petrol', 'diesel', 'electric', 'ice', 'bev', 'hybrid', ...).
--   • The trigger auto_calculate_vehicle_scope() pattern-matches on lowercase.
--   • The companion table fleet_emission_sources uses lowercase fuel_type.
--   • Activity-entry dropdowns in components/fleet/FleetActivityEntry.tsx
--     compare against lowercase ('electric', etc.).
--
-- Result: every "Add Vehicle" insert raised
-- 'new row for relation "vehicles" violates check constraint
--  "vehicles_fuel_type_check"'.
--
-- This migration normalises any existing rows to lowercase and replaces the
-- two CHECK constraints with lowercase value sets that include 'electric'
-- (which was missing entirely) and 'hybrid' as a fuel type.

-- 1. Drop the stale constraints so we can rewrite the data underneath them.
ALTER TABLE "public"."vehicles"
  DROP CONSTRAINT IF EXISTS "vehicles_fuel_type_check";

ALTER TABLE "public"."vehicles"
  DROP CONSTRAINT IF EXISTS "vehicles_propulsion_type_check";

-- 2. Normalise existing rows. The demo seed and any historical data inserted
--    capitalized values; lower-case them so they pass the new constraints
--    and so the trigger's lowercase comparisons start working for them.
UPDATE "public"."vehicles"
SET "fuel_type" = lower("fuel_type")
WHERE "fuel_type" IS NOT NULL
  AND "fuel_type" <> lower("fuel_type");

UPDATE "public"."vehicles"
SET "propulsion_type" = lower("propulsion_type")
WHERE "propulsion_type" IS NOT NULL
  AND "propulsion_type" <> lower("propulsion_type");

-- 3. Re-apply CHECK constraints with the lowercase canonical set.
ALTER TABLE "public"."vehicles"
  ADD CONSTRAINT "vehicles_fuel_type_check"
  CHECK (
    "fuel_type" IS NULL OR "fuel_type" = ANY (ARRAY[
      'diesel'::text,
      'petrol'::text,
      'electric'::text,
      'lpg'::text,
      'cng'::text,
      'hybrid'::text,
      'biodiesel'::text,
      'hydrogen'::text,
      'unknown'::text
    ])
  );

ALTER TABLE "public"."vehicles"
  ADD CONSTRAINT "vehicles_propulsion_type_check"
  CHECK (
    "propulsion_type" = ANY (ARRAY[
      'ice'::text,
      'bev'::text,
      'phev'::text,
      'hev'::text,
      'hybrid'::text
    ])
  );

-- 4. Refresh the column comment so it matches the new accepted values.
COMMENT ON COLUMN "public"."vehicles"."fuel_type" IS
  'Fuel type for ICE/hybrid vehicles. Lowercase: diesel, petrol, electric, lpg, cng, hybrid, biodiesel, hydrogen, unknown. NULL allowed for pure BEV rows.';

COMMENT ON COLUMN "public"."vehicles"."propulsion_type" IS
  'Propulsion method (lowercase): ice (Internal Combustion), bev (Battery Electric), phev (Plug-in Hybrid), hev (Hybrid Electric), hybrid (generic hybrid).';
