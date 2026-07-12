-- Hospitality improvements (2026-07, Tier 2) — operating periods for intensity KPIs.
--
-- Covers served (footfall) and F&B revenue per period, so the dashboard can show
-- gCO2e per cover and per £ of revenue. Room-night intensity is derived from
-- service volumes, so it isn't stored here. Org-scoped, mirrors the RLS pattern
-- used across the hospitality_* tables.

CREATE TABLE IF NOT EXISTS "public"."hospitality_operating_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "venue_id" "uuid",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "covers" numeric DEFAULT 0 NOT NULL,
    "fnb_revenue" numeric DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'GBP' NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "hospitality_operating_periods_covers_check" CHECK (("covers" >= (0)::numeric)),
    CONSTRAINT "hospitality_operating_periods_revenue_check" CHECK (("fnb_revenue" >= (0)::numeric)),
    CONSTRAINT "hospitality_operating_periods_period_check" CHECK (("period_end" >= "period_start"))
);

ALTER TABLE "public"."hospitality_operating_periods" OWNER TO "postgres";

ALTER TABLE ONLY "public"."hospitality_operating_periods"
    ADD CONSTRAINT "hospitality_operating_periods_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."hospitality_operating_periods"
    ADD CONSTRAINT "hospitality_operating_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."hospitality_operating_periods"
    ADD CONSTRAINT "hospitality_operating_periods_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."hospitality_venues"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."hospitality_operating_periods"
    ADD CONSTRAINT "hospitality_operating_periods_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "hospitality_operating_periods_org_period_idx" ON "public"."hospitality_operating_periods" USING "btree" ("organization_id", "period_start", "period_end");

CREATE OR REPLACE FUNCTION "public"."update_hospitality_operating_periods_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$
BEGIN NEW."updated_at" = "now"(); RETURN NEW; END; $$;

CREATE OR REPLACE TRIGGER "hospitality_operating_periods_updated_at" BEFORE UPDATE ON "public"."hospitality_operating_periods"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_hospitality_operating_periods_updated_at"();

ALTER TABLE "public"."hospitality_operating_periods" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospitality_operating_periods_select_own_org" ON "public"."hospitality_operating_periods" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_operating_periods_insert_own_org" ON "public"."hospitality_operating_periods" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_operating_periods_update_own_org" ON "public"."hospitality_operating_periods" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_operating_periods_delete_own_org" ON "public"."hospitality_operating_periods" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));

GRANT ALL ON FUNCTION "public"."update_hospitality_operating_periods_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_hospitality_operating_periods_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_hospitality_operating_periods_updated_at"() TO "service_role";
GRANT ALL ON TABLE "public"."hospitality_operating_periods" TO "anon";
GRANT ALL ON TABLE "public"."hospitality_operating_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."hospitality_operating_periods" TO "service_role";
