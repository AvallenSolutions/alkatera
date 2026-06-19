-- Hospitality module — Phase 4: rooms (room-night impact).
--
-- A room-night reuses the recipe machinery: it is a `products` row
-- (product_kind='hospitality_room_night') whose ingredients are the PURCHASED
-- CONSUMABLES per night (linen/laundry service, amenities, breakfast). That
-- gives the Scope-3 portion via the shared engine, and a `hospitality_meal_meta`
-- row holds its venue (covers = 1 night).
--
-- This table adds the ENERGY/WATER allocation for a room-night. These are
-- already in the venue's facility Scope 1/2 figures, so the allocation is shown
-- for guest-facing per-night intensity only and is NOT re-added to the company
-- total (Phase 5 adds the consumables Scope 3 only).

CREATE TABLE IF NOT EXISTS "public"."hospitality_room_allocation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" bigint NOT NULL,
    "occupancy" integer DEFAULT 2 NOT NULL,
    "electricity_kwh" numeric DEFAULT 0 NOT NULL,
    "gas_kwh" numeric DEFAULT 0 NOT NULL,
    "water_litres" numeric DEFAULT 0 NOT NULL,
    "country" "text" DEFAULT 'GB' NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hospitality_room_allocation_occupancy_check" CHECK (("occupancy" > 0)),
    CONSTRAINT "hospitality_room_allocation_electricity_check" CHECK (("electricity_kwh" >= (0)::numeric)),
    CONSTRAINT "hospitality_room_allocation_gas_check" CHECK (("gas_kwh" >= (0)::numeric)),
    CONSTRAINT "hospitality_room_allocation_water_check" CHECK (("water_litres" >= (0)::numeric))
);

ALTER TABLE "public"."hospitality_room_allocation" OWNER TO "postgres";
ALTER TABLE ONLY "public"."hospitality_room_allocation" ADD CONSTRAINT "hospitality_room_allocation_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."hospitality_room_allocation" ADD CONSTRAINT "hospitality_room_allocation_product_id_key" UNIQUE ("product_id");
ALTER TABLE ONLY "public"."hospitality_room_allocation" ADD CONSTRAINT "hospitality_room_allocation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."hospitality_room_allocation" ADD CONSTRAINT "hospitality_room_allocation_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;
CREATE INDEX "hospitality_room_allocation_organization_id_idx" ON "public"."hospitality_room_allocation" USING "btree" ("organization_id");

CREATE OR REPLACE FUNCTION "public"."update_hospitality_room_allocation_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" AS $$ BEGIN NEW."updated_at" = "now"(); RETURN NEW; END; $$;
ALTER FUNCTION "public"."update_hospitality_room_allocation_updated_at"() OWNER TO "postgres";
CREATE OR REPLACE TRIGGER "hospitality_room_allocation_updated_at" BEFORE UPDATE ON "public"."hospitality_room_allocation" FOR EACH ROW EXECUTE FUNCTION "public"."update_hospitality_room_allocation_updated_at"();

ALTER TABLE "public"."hospitality_room_allocation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospitality_room_allocation_select_own_org" ON "public"."hospitality_room_allocation" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_room_allocation_insert_own_org" ON "public"."hospitality_room_allocation" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_room_allocation_update_own_org" ON "public"."hospitality_room_allocation" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));
CREATE POLICY "hospitality_room_allocation_delete_own_org" ON "public"."hospitality_room_allocation" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id" FROM "public"."organization_members" WHERE ("organization_members"."user_id" = "auth"."uid"()))));

GRANT ALL ON FUNCTION "public"."update_hospitality_room_allocation_updated_at"() TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."hospitality_room_allocation" TO "anon", "authenticated", "service_role";
