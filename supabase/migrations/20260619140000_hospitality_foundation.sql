-- Hospitality module — Phase 1 foundation.
--
-- Adds a `product_kind` discriminator to `products` so hospitality meals and
-- made-drinks can reuse the existing LCA engine + PCF storage while staying out
-- of the wine Products list, plus a `serves_per_container` column used to derive
-- per-serve impact for own-wine drinks. Creates the `hospitality_venues` table
-- (restaurant / bar / accommodation) that anchors per-venue reporting.
--
-- Everything is org-scoped with RLS mirroring the `byproducts` pattern.

-- ── products: hospitality discriminator + serves-per-container ──────────────
ALTER TABLE "public"."products"
  ADD COLUMN IF NOT EXISTS "product_kind" "text" NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS "serves_per_container" numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "pg_constraint" WHERE "conname" = 'products_product_kind_check'
  ) THEN
    ALTER TABLE "public"."products"
      ADD CONSTRAINT "products_product_kind_check"
      CHECK (("product_kind" = ANY (ARRAY[
        'product'::"text",
        'hospitality_meal'::"text",
        'hospitality_drink'::"text",
        'hospitality_room_night'::"text"
      ])));
  END IF;
END$$;

COMMENT ON COLUMN "public"."products"."product_kind" IS
  'Discriminates wine/spirit products (''product'') from hospitality items so meals/drinks reuse the engine but stay out of the Products list.';
COMMENT ON COLUMN "public"."products"."serves_per_container" IS
  'Servings per container (e.g. glasses per bottle). Used to derive per-serve impact for own-product drinks.';

-- Index so the Products list filter (product_kind = 'product') stays cheap.
CREATE INDEX IF NOT EXISTS "products_organization_id_product_kind_idx"
  ON "public"."products" USING "btree" ("organization_id", "product_kind");

-- ── hospitality_venues ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."hospitality_venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "facility_id" "uuid",
    "name" "text" NOT NULL,
    "venue_type" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "hospitality_venues_venue_type_check" CHECK (("venue_type" = ANY (ARRAY['restaurant'::"text", 'bar'::"text", 'accommodation'::"text"]))),
    CONSTRAINT "hospitality_venues_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);

ALTER TABLE "public"."hospitality_venues" OWNER TO "postgres";

ALTER TABLE ONLY "public"."hospitality_venues"
    ADD CONSTRAINT "hospitality_venues_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."hospitality_venues"
    ADD CONSTRAINT "hospitality_venues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."hospitality_venues"
    ADD CONSTRAINT "hospitality_venues_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."hospitality_venues"
    ADD CONSTRAINT "hospitality_venues_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "hospitality_venues_organization_id_idx" ON "public"."hospitality_venues" USING "btree" ("organization_id");
CREATE INDEX "hospitality_venues_organization_id_status_idx" ON "public"."hospitality_venues" USING "btree" ("organization_id", "status");

-- updated_at trigger (mirrors the per-table trigger-fn convention used elsewhere).
CREATE OR REPLACE FUNCTION "public"."update_hospitality_venues_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW."updated_at" = "now"();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_hospitality_venues_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "hospitality_venues_updated_at" BEFORE UPDATE ON "public"."hospitality_venues"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_hospitality_venues_updated_at"();

-- ── RLS (org-scoped, mirrors byproducts) ────────────────────────────────────
ALTER TABLE "public"."hospitality_venues" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospitality_venues_select_own_org" ON "public"."hospitality_venues" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "hospitality_venues_insert_own_org" ON "public"."hospitality_venues" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "hospitality_venues_update_own_org" ON "public"."hospitality_venues" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "hospitality_venues_delete_own_org" ON "public"."hospitality_venues" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

GRANT ALL ON FUNCTION "public"."update_hospitality_venues_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_hospitality_venues_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_hospitality_venues_updated_at"() TO "service_role";

GRANT ALL ON TABLE "public"."hospitality_venues" TO "anon";
GRANT ALL ON TABLE "public"."hospitality_venues" TO "authenticated";
GRANT ALL ON TABLE "public"."hospitality_venues" TO "service_role";
