-- Hospitality improvements (2026-07, Tier 3) — events venue type + events.
--
-- Adds 'events' to the venue-type CHECK and an episodic events table. An event's
-- footprint = attendee travel (modal split) + temporary power (generator diesel +
-- temporary grid electricity) + optional catering carbon, computed in app code
-- (lib/hospitality/event-service.ts). Attendee travel uses DESNZ factors.

-- 1. Allow 'events' as a venue type.
ALTER TABLE "public"."hospitality_venues"
  DROP CONSTRAINT IF EXISTS "hospitality_venues_venue_type_check";
ALTER TABLE "public"."hospitality_venues"
  ADD CONSTRAINT "hospitality_venues_venue_type_check"
  CHECK (("venue_type" IN ('restaurant', 'bar', 'accommodation', 'events')));

-- 2. Events.
CREATE TABLE IF NOT EXISTS "public"."hospitality_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "venue_id" "uuid",
    "name" "text" NOT NULL,
    "event_type" "text" DEFAULT 'other' NOT NULL,
    "event_date_start" "date",
    "event_date_end" "date",
    "attendee_count" integer DEFAULT 0 NOT NULL,
    "avg_distance_km" numeric DEFAULT 0 NOT NULL,
    "travel_split" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "generator_litres" numeric DEFAULT 0 NOT NULL,
    "temp_electricity_kwh" numeric DEFAULT 0 NOT NULL,
    "catering_co2e" numeric DEFAULT 0 NOT NULL,
    "country" "text" DEFAULT 'GB' NOT NULL,
    "status" "text" DEFAULT 'planned' NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    CONSTRAINT "hospitality_events_event_type_check" CHECK (("event_type" IN ('festival', 'wedding', 'corporate', 'private', 'other'))),
    CONSTRAINT "hospitality_events_status_check" CHECK (("status" IN ('planned', 'completed'))),
    CONSTRAINT "hospitality_events_attendee_check" CHECK (("attendee_count" >= 0)),
    CONSTRAINT "hospitality_events_generator_check" CHECK (("generator_litres" >= (0)::numeric)),
    CONSTRAINT "hospitality_events_electricity_check" CHECK (("temp_electricity_kwh" >= (0)::numeric))
);

ALTER TABLE "public"."hospitality_events" OWNER TO "postgres";

ALTER TABLE ONLY "public"."hospitality_events"
    ADD CONSTRAINT "hospitality_events_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."hospitality_events"
    ADD CONSTRAINT "hospitality_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."hospitality_events"
    ADD CONSTRAINT "hospitality_events_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."hospitality_venues"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."hospitality_events"
    ADD CONSTRAINT "hospitality_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "hospitality_events_org_idx" ON "public"."hospitality_events" USING "btree" ("organization_id", "event_date_start");

CREATE OR REPLACE FUNCTION "public"."update_hospitality_events_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$
BEGIN NEW."updated_at" = "now"(); RETURN NEW; END; $$;
CREATE OR REPLACE TRIGGER "hospitality_events_updated_at" BEFORE UPDATE ON "public"."hospitality_events"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_hospitality_events_updated_at"();

ALTER TABLE "public"."hospitality_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospitality_events_select_own_org" ON "public"."hospitality_events" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_events_insert_own_org" ON "public"."hospitality_events" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_events_update_own_org" ON "public"."hospitality_events" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_events_delete_own_org" ON "public"."hospitality_events" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));

GRANT ALL ON FUNCTION "public"."update_hospitality_events_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_hospitality_events_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_hospitality_events_updated_at"() TO "service_role";
GRANT ALL ON TABLE "public"."hospitality_events" TO "anon";
GRANT ALL ON TABLE "public"."hospitality_events" TO "authenticated";
GRANT ALL ON TABLE "public"."hospitality_events" TO "service_role";
