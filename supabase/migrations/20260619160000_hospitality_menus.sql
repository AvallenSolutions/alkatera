-- Hospitality module — Phase 3: menus + drinks.
--
-- Made-drinks reuse the meal machinery: they are `products` rows
-- (product_kind='hospitality_drink') with a `hospitality_meal_meta` row, so no
-- new table is needed for them.
--
-- This migration adds menus. A menu collects items, each of which references a
-- product:
--   * meal / made_drink  → a hospitality product (recipe), impact per cover.
--   * own_product_drink   → an existing wine/spirit product; impact is read LIVE
--     from that product's latest PCF ÷ serves_per_container (never copied). These
--     are tagged internal_consumption so the company total doesn't double-count
--     wine already in production figures (see Phase 5).

CREATE TABLE IF NOT EXISTS "public"."hospitality_menus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "venue_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "public_slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "hospitality_menus_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);

ALTER TABLE "public"."hospitality_menus" OWNER TO "postgres";
ALTER TABLE ONLY "public"."hospitality_menus" ADD CONSTRAINT "hospitality_menus_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."hospitality_menus" ADD CONSTRAINT "hospitality_menus_public_slug_key" UNIQUE ("public_slug");
ALTER TABLE ONLY "public"."hospitality_menus" ADD CONSTRAINT "hospitality_menus_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."hospitality_menus" ADD CONSTRAINT "hospitality_menus_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."hospitality_venues"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."hospitality_menus" ADD CONSTRAINT "hospitality_menus_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
CREATE INDEX "hospitality_menus_organization_id_idx" ON "public"."hospitality_menus" USING "btree" ("organization_id");

CREATE TABLE IF NOT EXISTS "public"."hospitality_menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "menu_id" "uuid" NOT NULL,
    "product_id" bigint NOT NULL,
    "item_kind" "text" NOT NULL,
    "serves_per_container" numeric,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "internal_consumption" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hospitality_menu_items_item_kind_check" CHECK (("item_kind" = ANY (ARRAY['meal'::"text", 'made_drink'::"text", 'own_product_drink'::"text"]))),
    CONSTRAINT "hospitality_menu_items_serves_check" CHECK (("serves_per_container" IS NULL OR "serves_per_container" > (0)::numeric))
);

ALTER TABLE "public"."hospitality_menu_items" OWNER TO "postgres";
ALTER TABLE ONLY "public"."hospitality_menu_items" ADD CONSTRAINT "hospitality_menu_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."hospitality_menu_items" ADD CONSTRAINT "hospitality_menu_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."hospitality_menu_items" ADD CONSTRAINT "hospitality_menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "public"."hospitality_menus"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."hospitality_menu_items" ADD CONSTRAINT "hospitality_menu_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;
CREATE INDEX "hospitality_menu_items_menu_id_idx" ON "public"."hospitality_menu_items" USING "btree" ("menu_id");
CREATE INDEX "hospitality_menu_items_organization_id_idx" ON "public"."hospitality_menu_items" USING "btree" ("organization_id");

-- updated_at triggers (shared pattern).
CREATE OR REPLACE FUNCTION "public"."update_hospitality_menus_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$
BEGIN NEW."updated_at" = "now"(); RETURN NEW; END; $$;
ALTER FUNCTION "public"."update_hospitality_menus_updated_at"() OWNER TO "postgres";
CREATE OR REPLACE TRIGGER "hospitality_menus_updated_at" BEFORE UPDATE ON "public"."hospitality_menus" FOR EACH ROW EXECUTE FUNCTION "public"."update_hospitality_menus_updated_at"();
CREATE OR REPLACE TRIGGER "hospitality_menu_items_updated_at" BEFORE UPDATE ON "public"."hospitality_menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_hospitality_menus_updated_at"();

-- ── RLS (org-scoped) ────────────────────────────────────────────────────────
ALTER TABLE "public"."hospitality_menus" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospitality_menus_select_own_org" ON "public"."hospitality_menus" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_menus_insert_own_org" ON "public"."hospitality_menus" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_menus_update_own_org" ON "public"."hospitality_menus" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_menus_delete_own_org" ON "public"."hospitality_menus" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));

ALTER TABLE "public"."hospitality_menu_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospitality_menu_items_select_own_org" ON "public"."hospitality_menu_items" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_menu_items_insert_own_org" ON "public"."hospitality_menu_items" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_menu_items_update_own_org" ON "public"."hospitality_menu_items" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_menu_items_delete_own_org" ON "public"."hospitality_menu_items" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));

GRANT ALL ON FUNCTION "public"."update_hospitality_menus_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_hospitality_menus_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_hospitality_menus_updated_at"() TO "service_role";
GRANT ALL ON TABLE "public"."hospitality_menus" TO "anon";
GRANT ALL ON TABLE "public"."hospitality_menus" TO "authenticated";
GRANT ALL ON TABLE "public"."hospitality_menus" TO "service_role";
GRANT ALL ON TABLE "public"."hospitality_menu_items" TO "anon";
GRANT ALL ON TABLE "public"."hospitality_menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."hospitality_menu_items" TO "service_role";
