-- Hospitality module — Phase 5: sales / service volumes.
--
-- Records how many of each hospitality product (meal / made-drink / room-night)
-- were served or sold over a period, so company totals reflect actual throughput
-- (per-unit Scope-3 impact × volume), not just per-unit recipes.
--
-- Only hospitality products are tracked here. Own-wine drinks served in the
-- venue are NOT recorded (they are tagged internal_consumption on the menu and
-- are already in the company's production figures), and venue energy/water is
-- captured via facility data — so summing these volumes adds no double count.

CREATE TABLE IF NOT EXISTS "public"."hospitality_service_volumes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" bigint NOT NULL,
    "venue_id" "uuid",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "units_sold" numeric DEFAULT 0 NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "hospitality_service_volumes_units_check" CHECK (("units_sold" >= (0)::numeric)),
    CONSTRAINT "hospitality_service_volumes_period_check" CHECK (("period_end" >= "period_start"))
);

ALTER TABLE "public"."hospitality_service_volumes" OWNER TO "postgres";
ALTER TABLE ONLY "public"."hospitality_service_volumes" ADD CONSTRAINT "hospitality_service_volumes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."hospitality_service_volumes" ADD CONSTRAINT "hospitality_service_volumes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."hospitality_service_volumes" ADD CONSTRAINT "hospitality_service_volumes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."hospitality_service_volumes" ADD CONSTRAINT "hospitality_service_volumes_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."hospitality_venues"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."hospitality_service_volumes" ADD CONSTRAINT "hospitality_service_volumes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
CREATE INDEX "hospitality_service_volumes_organization_id_idx" ON "public"."hospitality_service_volumes" USING "btree" ("organization_id");
CREATE INDEX "hospitality_service_volumes_org_period_idx" ON "public"."hospitality_service_volumes" USING "btree" ("organization_id", "period_start", "period_end");

CREATE OR REPLACE FUNCTION "public"."update_hospitality_service_volumes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$ BEGIN NEW."updated_at" = "now"(); RETURN NEW; END; $$;
ALTER FUNCTION "public"."update_hospitality_service_volumes_updated_at"() OWNER TO "postgres";
CREATE OR REPLACE TRIGGER "hospitality_service_volumes_updated_at" BEFORE UPDATE ON "public"."hospitality_service_volumes" FOR EACH ROW EXECUTE FUNCTION "public"."update_hospitality_service_volumes_updated_at"();

ALTER TABLE "public"."hospitality_service_volumes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospitality_service_volumes_select_own_org" ON "public"."hospitality_service_volumes" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_service_volumes_insert_own_org" ON "public"."hospitality_service_volumes" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_service_volumes_update_own_org" ON "public"."hospitality_service_volumes" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_service_volumes_delete_own_org" ON "public"."hospitality_service_volumes" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));

GRANT ALL ON FUNCTION "public"."update_hospitality_service_volumes_updated_at"() TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."hospitality_service_volumes" TO "anon", "authenticated", "service_role";
