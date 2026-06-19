-- Hospitality module — Phase 2: meals.
--
-- A meal is a `products` row (product_kind='hospitality_meal') with its
-- ingredients stored in `product_materials` (material_type='ingredient'), so it
-- reuses the existing LCA engine + PCF storage unchanged. This table holds the
-- hospitality-only metadata: which venue serves it and how many covers the
-- recipe yields (so we can express impact per cover).

CREATE TABLE IF NOT EXISTS "public"."hospitality_meal_meta" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" bigint NOT NULL,
    "venue_id" "uuid",
    "covers" numeric DEFAULT 1 NOT NULL,
    "portion_note" "text",
    "prep_waste_pct" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "hospitality_meal_meta_covers_check" CHECK (("covers" > (0)::numeric)),
    CONSTRAINT "hospitality_meal_meta_prep_waste_pct_check" CHECK ((("prep_waste_pct" >= (0)::numeric) AND ("prep_waste_pct" <= (100)::numeric)))
);

ALTER TABLE "public"."hospitality_meal_meta" OWNER TO "postgres";

ALTER TABLE ONLY "public"."hospitality_meal_meta"
    ADD CONSTRAINT "hospitality_meal_meta_pkey" PRIMARY KEY ("id");

-- One meta row per meal product.
ALTER TABLE ONLY "public"."hospitality_meal_meta"
    ADD CONSTRAINT "hospitality_meal_meta_product_id_key" UNIQUE ("product_id");

ALTER TABLE ONLY "public"."hospitality_meal_meta"
    ADD CONSTRAINT "hospitality_meal_meta_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."hospitality_meal_meta"
    ADD CONSTRAINT "hospitality_meal_meta_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."hospitality_meal_meta"
    ADD CONSTRAINT "hospitality_meal_meta_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."hospitality_venues"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."hospitality_meal_meta"
    ADD CONSTRAINT "hospitality_meal_meta_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "hospitality_meal_meta_organization_id_idx" ON "public"."hospitality_meal_meta" USING "btree" ("organization_id");
CREATE INDEX "hospitality_meal_meta_venue_id_idx" ON "public"."hospitality_meal_meta" USING "btree" ("venue_id");

CREATE OR REPLACE FUNCTION "public"."update_hospitality_meal_meta_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW."updated_at" = "now"();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_hospitality_meal_meta_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "hospitality_meal_meta_updated_at" BEFORE UPDATE ON "public"."hospitality_meal_meta"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_hospitality_meal_meta_updated_at"();

-- ── RLS (org-scoped, mirrors hospitality_venues) ────────────────────────────
ALTER TABLE "public"."hospitality_meal_meta" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospitality_meal_meta_select_own_org" ON "public"."hospitality_meal_meta" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "hospitality_meal_meta_insert_own_org" ON "public"."hospitality_meal_meta" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "hospitality_meal_meta_update_own_org" ON "public"."hospitality_meal_meta" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

CREATE POLICY "hospitality_meal_meta_delete_own_org" ON "public"."hospitality_meal_meta" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));

GRANT ALL ON FUNCTION "public"."update_hospitality_meal_meta_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_hospitality_meal_meta_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_hospitality_meal_meta_updated_at"() TO "service_role";

GRANT ALL ON TABLE "public"."hospitality_meal_meta" TO "anon";
GRANT ALL ON TABLE "public"."hospitality_meal_meta" TO "authenticated";
GRANT ALL ON TABLE "public"."hospitality_meal_meta" TO "service_role";
