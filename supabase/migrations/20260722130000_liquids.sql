-- L1 of tasks/liquid-and-pack-plan.md: the liquid becomes an entity.
--
-- A product is a composition: one liquid, at a fill volume, in one pack
-- format, sold through one or more routes to market. The liquid, the thing a
-- distillery actually makes, has had no home of its own. It lived as rows on
-- one product, and the only reuse mechanism was `ingredients_templates`: a
-- stamp, not a link. Apply a template to three bottle formats and you have
-- three copies that drift the moment one is corrected.
--
-- `product_materials` stays exactly what it is. The liquid is an
-- authoring-layer entity that WRITES those rows, the same mirror pattern the
-- end-use scenarios table uses. No engine change, no golden-number risk.
--
-- The backfill is 1:1: every product with a recipe gets a liquid of its own,
-- so nothing anyone sees changes on day one. Identical-liquid detection then
-- PROPOSES merges (decision 2 in the plan): the platform detects, the user
-- holds the authority, nothing is rewritten silently.

CREATE TABLE IF NOT EXISTS "public"."liquids" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "organization_id" "uuid" NOT NULL,
  "name" "text" NOT NULL,
  "description" "text",
  -- The scale the producer actually measures at. Batch-first recipe entry
  -- already exists end to end (RecipeModePicker, computeBottlesPerBatch); this
  -- moves the answer off the product, where every format repeated it, and onto
  -- the liquid, where it is true once.
  "recipe_scale_mode" "text" DEFAULT 'per_unit' NOT NULL,
  "batch_yield_value" numeric,
  "batch_yield_unit" "text",
  -- Provenance, not a link: which product this liquid was lifted from by the
  -- 1:1 backfill. Once liquids are shared it stops being the whole story, but
  -- it is what makes the migration auditable.
  "created_from_product_id" bigint,
  "created_at" timestamp with time zone DEFAULT "now"(),
  "updated_at" timestamp with time zone DEFAULT "now"(),
  CONSTRAINT "liquids_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "liquids_recipe_scale_mode_check"
    CHECK ("recipe_scale_mode" = ANY (ARRAY['per_unit'::"text", 'per_batch'::"text", 'per_chain'::"text"])),
  -- Mirrors the products CHECK: a batch mode is meaningless without a yield to
  -- divide by, and computeBottlesPerBatch would divide by nothing.
  CONSTRAINT "liquids_batch_yield_required"
    CHECK ("recipe_scale_mode" <> 'per_batch' OR ("batch_yield_value" IS NOT NULL AND "batch_yield_value" > 0))
);

ALTER TABLE "public"."liquids"
  DROP CONSTRAINT IF EXISTS "liquids_organization_id_fkey";
ALTER TABLE "public"."liquids"
  ADD CONSTRAINT "liquids_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

COMMENT ON TABLE "public"."liquids" IS
  'The recipe as an entity: what the producer makes, owned once and linked into every product that bottles it. Correcting an ingredient here reaches every format. Products link via products.liquid_id.';

CREATE INDEX IF NOT EXISTS "idx_liquids_organization" ON "public"."liquids" USING "btree" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_liquids_org_lower_name" ON "public"."liquids" USING "btree" ("organization_id", "lower"("name"));

-- ---------------------------------------------------------------------------
-- The link
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."products" ADD COLUMN IF NOT EXISTS "liquid_id" "uuid";

ALTER TABLE "public"."products" DROP CONSTRAINT IF EXISTS "products_liquid_id_fkey";
ALTER TABLE "public"."products"
  ADD CONSTRAINT "products_liquid_id_fkey"
  FOREIGN KEY ("liquid_id") REFERENCES "public"."liquids"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_products_liquid_id"
  ON "public"."products" USING "btree" ("liquid_id") WHERE ("liquid_id" IS NOT NULL);

COMMENT ON COLUMN "public"."products"."liquid_id" IS
  'The liquid this product bottles. Several products (different fill volumes or pack formats) share one liquid; editing it fans derived product_materials rows out to all of them.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."liquids" ENABLE ROW LEVEL SECURITY;

-- Postgres has no CREATE POLICY IF NOT EXISTS, so each is dropped first or a
-- re-run fails on the second one.
DROP POLICY IF EXISTS "Org members can view liquids" ON "public"."liquids";
DROP POLICY IF EXISTS "Org members can insert liquids" ON "public"."liquids";
DROP POLICY IF EXISTS "Org members can update liquids" ON "public"."liquids";
DROP POLICY IF EXISTS "Org members can delete liquids" ON "public"."liquids";

CREATE POLICY "Org members can view liquids" ON "public"."liquids"
  FOR SELECT TO "authenticated"
  USING ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

CREATE POLICY "Org members can insert liquids" ON "public"."liquids"
  FOR INSERT TO "authenticated"
  WITH CHECK ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

CREATE POLICY "Org members can update liquids" ON "public"."liquids"
  FOR UPDATE TO "authenticated"
  USING ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ))
  WITH CHECK ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

CREATE POLICY "Org members can delete liquids" ON "public"."liquids"
  FOR DELETE TO "authenticated"
  USING ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

GRANT ALL ON TABLE "public"."liquids" TO "anon";
GRANT ALL ON TABLE "public"."liquids" TO "authenticated";
GRANT ALL ON TABLE "public"."liquids" TO "service_role";

DROP TRIGGER IF EXISTS "update_liquids_updated_at" ON "public"."liquids";
CREATE TRIGGER "update_liquids_updated_at"
  BEFORE UPDATE ON "public"."liquids"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- ---------------------------------------------------------------------------
-- The 1:1 backfill
-- ---------------------------------------------------------------------------
-- Every product that has a recipe gets a liquid of its own, carrying the
-- product's own name and its existing batch settings. Nothing moves, nothing
-- recomputes, and no two products share a liquid until a user says so.
--
-- Re-runnable: only products with no liquid_id and at least one ingredient row
-- are considered, so a second run inserts nothing.

WITH lifted AS (
  INSERT INTO "public"."liquids" (
    "organization_id", "name", "recipe_scale_mode", "batch_yield_value",
    "batch_yield_unit", "created_from_product_id"
  )
  SELECT
    p."organization_id",
    p."name",
    COALESCE(p."recipe_scale_mode", 'per_unit'),
    -- Honour the same CHECK this table declares: a per_batch product with no
    -- usable yield is lifted as per_unit rather than failing the migration.
    CASE WHEN COALESCE(p."recipe_scale_mode", 'per_unit') = 'per_batch'
           AND COALESCE(p."batch_yield_value", 0) > 0
         THEN p."batch_yield_value" END,
    CASE WHEN COALESCE(p."recipe_scale_mode", 'per_unit') = 'per_batch'
           AND COALESCE(p."batch_yield_value", 0) > 0
         THEN p."batch_yield_unit" END,
    p."id"
  FROM "public"."products" p
  WHERE p."liquid_id" IS NULL
    AND EXISTS (
      SELECT 1 FROM "public"."product_materials" pm
      WHERE pm."product_id" = p."id" AND pm."material_type" = 'ingredient'
    )
  RETURNING "id", "created_from_product_id"
)
UPDATE "public"."products" p
SET "liquid_id" = lifted."id"
FROM lifted
WHERE p."id" = lifted."created_from_product_id";

-- Correct the mode for anything lifted down to per_unit above, so the liquid
-- and the product do not disagree about how the recipe is measured.
UPDATE "public"."liquids" l
SET "recipe_scale_mode" = 'per_unit'
WHERE l."recipe_scale_mode" = 'per_batch'
  AND (l."batch_yield_value" IS NULL OR l."batch_yield_value" <= 0);
