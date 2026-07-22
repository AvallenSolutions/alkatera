-- Phase 2 of the product data-duplication remediation: make the org-level
-- `ingredients` table a real record instead of a bare name.
--
-- The table has existed all along as seven columns (id, organization_id, name,
-- description, timestamps, lca_sub_stage_id) and the recipe editor never wrote
-- to it, so it sat empty. Every fact about an ingredient (which emission
-- factor it matched, whether its carbon is biogenic, whether it is organic,
-- whether it comes from your own vineyard) was stored on each
-- `product_materials` row instead, and retyped for every SKU using it. That is
-- root cause F1 from tasks/product-data-duplication-plan.md.
--
-- product_materials keeps every column it has. This is an authoring-layer
-- record that those rows inherit from; the calculator's contract is untouched.

-- ---------------------------------------------------------------------------
-- 1. The ingredient's own facts
-- ---------------------------------------------------------------------------

-- The unit an ingredient is normally measured in. Note this column is already
-- assumed to exist by app/api/emissions/inventory/route.ts, which selects
-- 'id, name, unit' and therefore fails with PostgREST 42703 on every call.
-- That is why the Xero inventory linker shows "No ingredients yet. Add one
-- from the Products page first", advice that could not be followed because the
-- Products page never created one either.
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "unit" "text";

-- Emission factor match. A fact about the ingredient and its factor, not about
-- any one product that uses it.
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "matched_source_name" "text";
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "match_status" "text";
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "data_source" "text";
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "data_source_id" "text";
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "openlca_database" "text";
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "cached_co2_factor" numeric;
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "ef_source" "text";
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "ef_source_type" "text";
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "ef_data_quality_grade" "text";
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "ef_uncertainty_percent" numeric;
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "ef_reference_unit" "text";

ALTER TABLE "public"."ingredients"
  DROP CONSTRAINT IF EXISTS "ingredients_match_status_check";
ALTER TABLE "public"."ingredients"
  ADD CONSTRAINT "ingredients_match_status_check"
  CHECK ("match_status" IS NULL OR "match_status" = ANY (ARRAY['verified'::"text", 'auto_matched'::"text", 'needs_review'::"text"]));

-- Biogenic carbon and organic certification. Fermentation CO2 is fermentation
-- CO2 whichever SKU it ends up in.
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "is_biogenic_carbon" boolean DEFAULT false NOT NULL;
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "is_organic_certified" boolean DEFAULT false NOT NULL;

-- Self-grown farm links. Your grapes come from your vineyard for every wine
-- you make from them.
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "is_self_grown" boolean DEFAULT false NOT NULL;
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "vineyard_id" "uuid";
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "orchard_id" "uuid";
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "arable_field_id" "uuid";

ALTER TABLE "public"."ingredients" DROP CONSTRAINT IF EXISTS "ingredients_vineyard_id_fkey";
ALTER TABLE "public"."ingredients" ADD CONSTRAINT "ingredients_vineyard_id_fkey"
  FOREIGN KEY ("vineyard_id") REFERENCES "public"."vineyards"("id") ON DELETE SET NULL;

ALTER TABLE "public"."ingredients" DROP CONSTRAINT IF EXISTS "ingredients_orchard_id_fkey";
ALTER TABLE "public"."ingredients" ADD CONSTRAINT "ingredients_orchard_id_fkey"
  FOREIGN KEY ("orchard_id") REFERENCES "public"."orchards"("id") ON DELETE SET NULL;

ALTER TABLE "public"."ingredients" DROP CONSTRAINT IF EXISTS "ingredients_arable_field_id_fkey";
ALTER TABLE "public"."ingredients" ADD CONSTRAINT "ingredients_arable_field_id_fkey"
  FOREIGN KEY ("arable_field_id") REFERENCES "public"."arable_fields"("id") ON DELETE SET NULL;

-- The supplier product this ingredient is normally bought as. Origin address,
-- coordinates, country and the inbound delivery container are the supplier's
-- facts; supplier_products.origin_address has carried the comment "Default
-- origin address for this supplier product. Can be overridden at material
-- level" since it was created, and nothing implemented the default half.
ALTER TABLE "public"."ingredients" ADD COLUMN IF NOT EXISTS "default_supplier_product_id" "uuid";

ALTER TABLE "public"."ingredients" DROP CONSTRAINT IF EXISTS "ingredients_default_supplier_product_id_fkey";
ALTER TABLE "public"."ingredients" ADD CONSTRAINT "ingredients_default_supplier_product_id_fkey"
  FOREIGN KEY ("default_supplier_product_id") REFERENCES "public"."supplier_products"("id") ON DELETE SET NULL;

COMMENT ON TABLE "public"."ingredients" IS
  'Organisation-level ingredient records. Holds the facts that belong to the ingredient itself (emission factor match, biogenic carbon, organic certification, self-grown farm link, default supplier product) so they are entered once rather than on every product_materials row that uses it.';

-- ---------------------------------------------------------------------------
-- 2. Find-or-create support
-- ---------------------------------------------------------------------------
-- Deliberately NOT a unique index. Existing organisations may already hold
-- case-insensitive duplicates: the URL importer's own comment notes that
-- maybeSingle() "errors when case-insensitive duplicates already exist". A
-- unique index would fail the migration on those organisations, and forcing
-- uniqueness would mean silently renaming or deleting customer data.
--
-- Duplicate ingredients get the same treatment the liquid-and-pack plan
-- settled for duplicate liquids: detect and propose the merge, never rewrite
-- it underneath the user. This index just makes the lookup cheap.
CREATE INDEX IF NOT EXISTS "idx_ingredients_org_lower_name"
  ON "public"."ingredients" USING "btree" ("organization_id", "lower"("name"));

-- ---------------------------------------------------------------------------
-- 3. RLS: the policy had no WITH CHECK, so nothing could insert
-- ---------------------------------------------------------------------------
-- The single existing policy is an unqualified ALL with a USING clause only.
-- USING is not applied to INSERT, so writing an ingredient from the browser
-- client was never actually permitted. Nothing noticed because only two
-- service-role paths ever wrote to this table. The recipe editor is about to,
-- so the policy is restated with a matching WITH CHECK.

-- Postgres has no CREATE POLICY IF NOT EXISTS, so every policy this migration
-- creates is dropped first, or a re-run fails on the second one.
DROP POLICY IF EXISTS "Allow members to access their own org's ingredients" ON "public"."ingredients";
DROP POLICY IF EXISTS "Org members can view ingredients" ON "public"."ingredients";
DROP POLICY IF EXISTS "Org members can insert ingredients" ON "public"."ingredients";
DROP POLICY IF EXISTS "Org members can update ingredients" ON "public"."ingredients";
DROP POLICY IF EXISTS "Org members can delete ingredients" ON "public"."ingredients";

CREATE POLICY "Org members can view ingredients" ON "public"."ingredients"
  FOR SELECT TO "authenticated"
  USING ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

CREATE POLICY "Org members can insert ingredients" ON "public"."ingredients"
  FOR INSERT TO "authenticated"
  WITH CHECK ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

CREATE POLICY "Org members can update ingredients" ON "public"."ingredients"
  FOR UPDATE TO "authenticated"
  USING ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ))
  WITH CHECK ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

CREATE POLICY "Org members can delete ingredients" ON "public"."ingredients"
  FOR DELETE TO "authenticated"
  USING ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

-- ---------------------------------------------------------------------------
-- 4. Keep updated_at honest
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS "update_ingredients_updated_at" ON "public"."ingredients";
CREATE TRIGGER "update_ingredients_updated_at"
  BEFORE UPDATE ON "public"."ingredients"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- ---------------------------------------------------------------------------
-- 5. Speed up the join from material rows back to the ingredient
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_product_materials_material_id"
  ON "public"."product_materials" USING "btree" ("material_id")
  WHERE ("material_id" IS NOT NULL);
