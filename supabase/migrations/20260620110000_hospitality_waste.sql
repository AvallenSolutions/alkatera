-- Hospitality module — waste log.
--
-- A periodic, per-venue record of waste sent off site, split into two streams the
-- sector manages separately: FOOD waste (compost / anaerobic digestion / landfill)
-- and DRY waste (recycling / reuse / landfill, etc.). Each row is a measured mass
-- for a period with its treatment route; CO2e is derived in app from the DEFRA
-- waste factors (lib/calculations/waste-circularity.ts) and rolls into the
-- hospitality Scope 3 contribution (GHG Protocol Cat 5, waste generated in ops).
--
-- RLS + shape mirror hospitality_service_volumes.

CREATE TABLE IF NOT EXISTS "public"."hospitality_waste" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "venue_id" "uuid",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "waste_stream" "text" NOT NULL,
    "treatment_method" "text" NOT NULL,
    "mass_kg" numeric NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "hospitality_waste_mass_check" CHECK (("mass_kg" >= (0)::numeric)),
    CONSTRAINT "hospitality_waste_period_check" CHECK (("period_end" >= "period_start")),
    CONSTRAINT "hospitality_waste_stream_check" CHECK (("waste_stream" = ANY (ARRAY['food'::"text", 'dry'::"text"]))),
    CONSTRAINT "hospitality_waste_treatment_check" CHECK (("treatment_method" = ANY (ARRAY[
        'composting'::"text",
        'anaerobic_digestion'::"text",
        'recycling'::"text",
        'reuse'::"text",
        'incineration_with_recovery'::"text",
        'incineration_without_recovery'::"text",
        'landfill'::"text"
    ])))
);

ALTER TABLE "public"."hospitality_waste" OWNER TO "postgres";

ALTER TABLE ONLY "public"."hospitality_waste" ADD CONSTRAINT "hospitality_waste_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."hospitality_waste"
    ADD CONSTRAINT "hospitality_waste_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."hospitality_waste"
    ADD CONSTRAINT "hospitality_waste_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."hospitality_venues"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."hospitality_waste"
    ADD CONSTRAINT "hospitality_waste_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "hospitality_waste_organization_id_idx" ON "public"."hospitality_waste" USING "btree" ("organization_id");
CREATE INDEX "hospitality_waste_org_period_idx" ON "public"."hospitality_waste" USING "btree" ("organization_id", "period_start", "period_end");
CREATE INDEX "hospitality_waste_venue_id_idx" ON "public"."hospitality_waste" USING "btree" ("venue_id");

CREATE OR REPLACE FUNCTION "public"."update_hospitality_waste_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$ BEGIN NEW."updated_at" = "now"(); RETURN NEW; END; $$;
ALTER FUNCTION "public"."update_hospitality_waste_updated_at"() OWNER TO "postgres";
CREATE TRIGGER "hospitality_waste_updated_at" BEFORE UPDATE ON "public"."hospitality_waste"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_hospitality_waste_updated_at"();

ALTER TABLE "public"."hospitality_waste" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospitality_waste_select_own_org" ON "public"."hospitality_waste" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_waste_insert_own_org" ON "public"."hospitality_waste" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_waste_update_own_org" ON "public"."hospitality_waste" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_waste_delete_own_org" ON "public"."hospitality_waste" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));

GRANT ALL ON FUNCTION "public"."update_hospitality_waste_updated_at"() TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."hospitality_waste" TO "anon", "authenticated", "service_role";
