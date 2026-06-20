-- Hospitality module — per-org function selection.
--
-- On first open, a venue chooses which hospitality functions it needs (food,
-- drinks, rooms) so the nav only shows the relevant sections. One row per org;
-- `configured` flips true once they've made a choice (until then the UI shows
-- the setup chooser and the nav shows everything).

CREATE TABLE IF NOT EXISTS "public"."hospitality_settings" (
    "organization_id" "uuid" NOT NULL,
    "meals" boolean DEFAULT true NOT NULL,
    "drinks" boolean DEFAULT true NOT NULL,
    "rooms" boolean DEFAULT true NOT NULL,
    "configured" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."hospitality_settings" OWNER TO "postgres";
ALTER TABLE ONLY "public"."hospitality_settings" ADD CONSTRAINT "hospitality_settings_pkey" PRIMARY KEY ("organization_id");
ALTER TABLE ONLY "public"."hospitality_settings" ADD CONSTRAINT "hospitality_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION "public"."update_hospitality_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$ BEGIN NEW."updated_at" = "now"(); RETURN NEW; END; $$;
ALTER FUNCTION "public"."update_hospitality_settings_updated_at"() OWNER TO "postgres";
CREATE OR REPLACE TRIGGER "hospitality_settings_updated_at" BEFORE UPDATE ON "public"."hospitality_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_hospitality_settings_updated_at"();

ALTER TABLE "public"."hospitality_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospitality_settings_select_own_org" ON "public"."hospitality_settings" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_settings_insert_own_org" ON "public"."hospitality_settings" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_settings_update_own_org" ON "public"."hospitality_settings" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_settings_delete_own_org" ON "public"."hospitality_settings" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));

GRANT ALL ON FUNCTION "public"."update_hospitality_settings_updated_at"() TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."hospitality_settings" TO "anon", "authenticated", "service_role";
