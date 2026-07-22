-- Phase 2, continued: how a supplier delivers a product is the supplier's
-- fact, not the buying product's.
--
-- `supplier_products` already holds origin_address, origin_lat, origin_lng and
-- origin_country_code, and origin_address has carried the comment "Default
-- origin address for this supplier product. Can be overridden at material
-- level" since the day it was created. Nothing ever implemented the default
-- half, and the two facts that travel with the origin (the transport route
-- from it, and the container it arrives in) had no supplier-level home at all.
-- Both were retyped on every product_materials row.
--
-- product_materials keeps its own copies as the per-product override. This
-- adds the level those overrides override.

ALTER TABLE "public"."supplier_products"
  ADD COLUMN IF NOT EXISTS "transport_legs" "jsonb";

COMMENT ON COLUMN "public"."supplier_products"."transport_legs" IS
  'Default inbound transport route from this product''s origin, as the same leg array product_materials.transport_legs uses. Overridable per material, since the same supplier may ship to more than one facility.';

-- The container the ingredient arrives in: a property of the supplier
-- relationship (how this supplier ships this product), re-entered per product
-- until now.
ALTER TABLE "public"."supplier_products"
  ADD COLUMN IF NOT EXISTS "inbound_container_type" "text";
ALTER TABLE "public"."supplier_products"
  ADD COLUMN IF NOT EXISTS "inbound_container_volume_l" numeric;
ALTER TABLE "public"."supplier_products"
  ADD COLUMN IF NOT EXISTS "inbound_container_tare_kg" numeric;
ALTER TABLE "public"."supplier_products"
  ADD COLUMN IF NOT EXISTS "inbound_container_reuse_cycles" integer;
ALTER TABLE "public"."supplier_products"
  ADD COLUMN IF NOT EXISTS "inbound_container_ef" numeric;
ALTER TABLE "public"."supplier_products"
  ADD COLUMN IF NOT EXISTS "inbound_container_material" "text";

COMMENT ON COLUMN "public"."supplier_products"."inbound_container_type" IS
  'Default delivery container for this supplier product (IBC, drum, sack). Seeds the material row, which keeps its own copy as the override.';

-- Mirrors product_materials' inbound_container_reuse_cycles_min: a reusable
-- container is used at least once, and a zero would divide the container's
-- footprint by nothing.
ALTER TABLE "public"."supplier_products"
  DROP CONSTRAINT IF EXISTS "supplier_products_inbound_reuse_cycles_min";
ALTER TABLE "public"."supplier_products"
  ADD CONSTRAINT "supplier_products_inbound_reuse_cycles_min"
  CHECK ("inbound_container_reuse_cycles" IS NULL OR "inbound_container_reuse_cycles" >= 1);

-- Reject a transport_legs value that is not an array, so a malformed object
-- cannot reach the leg loop in the distribution calculator.
ALTER TABLE "public"."supplier_products"
  DROP CONSTRAINT IF EXISTS "supplier_products_transport_legs_array";
ALTER TABLE "public"."supplier_products"
  ADD CONSTRAINT "supplier_products_transport_legs_array"
  CHECK ("transport_legs" IS NULL OR "jsonb_typeof"("transport_legs") = 'array');
