-- Phase 1 of the product data-duplication remediation: give three groups of
-- facts a home at the level they actually belong to, so they stop being
-- retyped on every product and every LCA run.
--
-- Root cause F1 from tasks/product-data-duplication-plan.md: facts that belong
-- to an organisation or a facility are stored on the product row, so a producer
-- with 12 SKUs enters the same fact 12 times.
--
-- Columns only. All three tables already carry RLS policies that cover new
-- columns, so nothing here creates or replaces a policy.

-- ---------------------------------------------------------------------------
-- 1. Household status gets an organisation-level default
-- ---------------------------------------------------------------------------
-- epr_organization_settings already defaults packaging activity and UK nation
-- (default_packaging_activity, default_uk_nation) but not household status, so
-- that one field alone stayed a per-row question. Defaulting to true matches
-- the fallback the submission generator has always applied.

ALTER TABLE "public"."epr_organization_settings"
  ADD COLUMN IF NOT EXISTS "default_is_household" boolean DEFAULT true NOT NULL;

COMMENT ON COLUMN "public"."epr_organization_settings"."default_is_household" IS
  'Organisation default for whether packaging reaches a household. Inherited by every packaging row that does not override it. Completes the default_packaging_activity / default_uk_nation pair.';

-- ---------------------------------------------------------------------------
-- 2. Hybrid energy overrides get a facility-level home
-- ---------------------------------------------------------------------------
-- The four per-unit overrides (electricity, natural gas, thermal fuel, water)
-- had no column anywhere. They were entered per product per LCA run and buried
-- in product_carbon_footprints.draft_data, and the facility data-sourcing
-- dialog dropped them on save. facilities already carries
-- default_data_collection_mode / default_archetype_id /
-- default_proxy_justification, so this completes that pattern.

ALTER TABLE "public"."facilities"
  ADD COLUMN IF NOT EXISTS "default_hybrid_overrides" "jsonb";

COMMENT ON COLUMN "public"."facilities"."default_hybrid_overrides" IS
  'Facility defaults for the hybrid data-collection mode, seeding every LCA allocation for this facility. Keys: electricity_kwh_per_unit, natural_gas_kwh_per_unit, thermal_fuel_kwh_per_unit, water_litres_per_unit. NULL means the archetype value stands unmodified.';

-- Reject anything that is not a JSON object, so a stray array or scalar cannot
-- reach the allocation seeder.
ALTER TABLE "public"."facilities"
  DROP CONSTRAINT IF EXISTS "facilities_default_hybrid_overrides_object";

ALTER TABLE "public"."facilities"
  ADD CONSTRAINT "facilities_default_hybrid_overrides_object"
  CHECK ("default_hybrid_overrides" IS NULL OR "jsonb_typeof"("default_hybrid_overrides") = 'object');

-- ---------------------------------------------------------------------------
-- 3. The maturation warehouse gets a facility link (bug X4)
-- ---------------------------------------------------------------------------
-- maturation_profiles had no facility FK, so warehouse country and warehouse
-- energy were retyped per product with no way to resolve them from the
-- facility that already holds them. Worse, the same warehouse's electricity is
-- also logged as facility utility data, and the calculator could only warn
-- about the resulting double-count because it had no way to tell whether the
-- warehouse was one of the linked production facilities. This link is what
-- makes that answerable.

ALTER TABLE "public"."maturation_profiles"
  ADD COLUMN IF NOT EXISTS "warehouse_facility_id" "uuid";

ALTER TABLE "public"."maturation_profiles"
  DROP CONSTRAINT IF EXISTS "maturation_profiles_warehouse_facility_id_fkey";

ALTER TABLE "public"."maturation_profiles"
  ADD CONSTRAINT "maturation_profiles_warehouse_facility_id_fkey"
  FOREIGN KEY ("warehouse_facility_id") REFERENCES "public"."facilities"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_maturation_profiles_warehouse_facility"
  ON "public"."maturation_profiles" USING "btree" ("warehouse_facility_id")
  WHERE ("warehouse_facility_id" IS NOT NULL);

COMMENT ON COLUMN "public"."maturation_profiles"."warehouse_facility_id" IS
  'The facility used as the maturation warehouse. Resolves warehouse country and warehouse energy from the facility record rather than asking per product, and lets the calculator detect when that facility''s utility data already accounts for the same electricity.';
