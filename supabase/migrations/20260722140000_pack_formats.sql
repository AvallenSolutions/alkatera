-- L2 of tasks/liquid-and-pack-plan.md: the pack format becomes an entity.
--
-- The second half of the composition. A product is one liquid, at a fill
-- volume, in one pack format. L1 gave the liquid a home; this does the same
-- for the pack, promoting `packaging_templates` from stamp to link.
--
-- The template problem is identical to the recipe's: applying a template to
-- three products produces three copies of the same bottle spec that drift the
-- moment one glass weight is corrected. A pack format is owned once and
-- linked, so one correction reaches every product in that bottle.
--
-- `product_materials` stays exactly what it is. The pack format is an
-- authoring-layer entity that WRITES those rows, the same pattern L1 used and
-- the same reason it is safe: no engine change.
--
-- The backfill is 1:1, exactly as the liquids one was: every product that has
-- packaging gets a pack format of its own, so nothing anyone sees changes on
-- day one, and identical-pack detection then PROPOSES merges.

CREATE TABLE IF NOT EXISTS "public"."pack_formats" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "organization_id" "uuid" NOT NULL,
  "name" "text" NOT NULL,
  "description" "text",
  -- Deliberately thin. A pack format's specification IS its product_materials
  -- rows, exactly as a liquid's recipe is its rows. Copying container format,
  -- material, size or units_per_group onto this table would create a second
  -- home for facts that already have one, and it would drift the moment
  -- somebody corrected the row. That is root cause F1, which this programme
  -- exists to remove; reintroducing it in the migration meant to fix it would
  -- be a poor joke.
  -- Provenance, not a link: which product this format was lifted from by the
  -- 1:1 backfill. Once formats are shared it stops being the whole story, but
  -- it is what makes the migration auditable.
  "created_from_product_id" bigint,
  "created_at" timestamp with time zone DEFAULT "now"(),
  "updated_at" timestamp with time zone DEFAULT "now"(),
  CONSTRAINT "pack_formats_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."pack_formats"
  DROP CONSTRAINT IF EXISTS "pack_formats_organization_id_fkey";
ALTER TABLE "public"."pack_formats"
  ADD CONSTRAINT "pack_formats_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

COMMENT ON TABLE "public"."pack_formats" IS
  'The pack as an entity: bottle or can with its closure, label and secondary packaging, owned once and linked into every product packed in it. Correcting a glass weight here reaches every product in that bottle. The specification itself lives in product_materials, not here. Products link via products.pack_format_id.';

CREATE INDEX IF NOT EXISTS "idx_pack_formats_organization" ON "public"."pack_formats" USING "btree" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_pack_formats_org_lower_name" ON "public"."pack_formats" USING "btree" ("organization_id", "lower"("name"));

-- ---------------------------------------------------------------------------
-- The link
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."products" ADD COLUMN IF NOT EXISTS "pack_format_id" "uuid";

ALTER TABLE "public"."products" DROP CONSTRAINT IF EXISTS "products_pack_format_id_fkey";
ALTER TABLE "public"."products"
  ADD CONSTRAINT "products_pack_format_id_fkey"
  FOREIGN KEY ("pack_format_id") REFERENCES "public"."pack_formats"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_products_pack_format_id"
  ON "public"."products" USING "btree" ("pack_format_id") WHERE ("pack_format_id" IS NOT NULL);

COMMENT ON COLUMN "public"."products"."pack_format_id" IS
  'The pack format this product is packed in. Several products (different liquids in the same bottle) share one format; editing it fans derived product_materials rows out to all of them.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."pack_formats" ENABLE ROW LEVEL SECURITY;

-- Postgres has no CREATE POLICY IF NOT EXISTS, so each is dropped first or a
-- re-run fails on the second one.
DROP POLICY IF EXISTS "Org members can view pack formats" ON "public"."pack_formats";
DROP POLICY IF EXISTS "Org members can insert pack formats" ON "public"."pack_formats";
DROP POLICY IF EXISTS "Org members can update pack formats" ON "public"."pack_formats";
DROP POLICY IF EXISTS "Org members can delete pack formats" ON "public"."pack_formats";

CREATE POLICY "Org members can view pack formats" ON "public"."pack_formats"
  FOR SELECT TO "authenticated"
  USING ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

CREATE POLICY "Org members can insert pack formats" ON "public"."pack_formats"
  FOR INSERT TO "authenticated"
  WITH CHECK ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

CREATE POLICY "Org members can update pack formats" ON "public"."pack_formats"
  FOR UPDATE TO "authenticated"
  USING ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ))
  WITH CHECK ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

CREATE POLICY "Org members can delete pack formats" ON "public"."pack_formats"
  FOR DELETE TO "authenticated"
  USING ("organization_id" IN (
    SELECT "organization_members"."organization_id" FROM "public"."organization_members"
    WHERE "organization_members"."user_id" = "auth"."uid"()
  ));

GRANT ALL ON TABLE "public"."pack_formats" TO "anon";
GRANT ALL ON TABLE "public"."pack_formats" TO "authenticated";
GRANT ALL ON TABLE "public"."pack_formats" TO "service_role";

DROP TRIGGER IF EXISTS "update_pack_formats_updated_at" ON "public"."pack_formats";
CREATE TRIGGER "update_pack_formats_updated_at"
  BEFORE UPDATE ON "public"."pack_formats"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- ---------------------------------------------------------------------------
-- The 1:1 backfill
-- ---------------------------------------------------------------------------
-- Every product that has packaging gets a pack format of its own, named after
-- the product. Its specification stays where it already is, on the product
-- material rows. Nothing moves, nothing recomputes, and no two products share
-- a format until a user says so.
--
-- Re-runnable: only products with no pack_format_id and at least one packaging
-- row are considered, so a second run inserts nothing.

WITH lifted AS (
  INSERT INTO "public"."pack_formats" (
    "organization_id", "name", "created_from_product_id"
  )
  SELECT p."organization_id", p."name", p."id"
  FROM "public"."products" p
  WHERE p."pack_format_id" IS NULL
    AND EXISTS (
      SELECT 1 FROM "public"."product_materials" pm
      WHERE pm."product_id" = p."id" AND pm."material_type" = 'packaging'
    )
  RETURNING "id", "created_from_product_id"
)
UPDATE "public"."products" p
SET "pack_format_id" = lifted."id"
FROM lifted
WHERE p."id" = lifted."created_from_product_id";
