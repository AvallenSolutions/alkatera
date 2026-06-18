-- Byproducts / co-products module.
--
-- A first-class home for the circular destinations producers are proud of:
-- spent grain to animal feed, surplus yeast to extracts, CO₂ recapture, etc.
-- Distinct from the waste-entry pipeline so byproducts can be celebrated
-- (named partners, since-when, status) rather than buried in waste records.
--
-- The mass logged on `byproduct_flows` feeds into the circularity score:
-- destination_type maps to an EU waste-hierarchy tier so a partnership
-- routing 12 t/month spent grain to animal feed lifts the score the way
-- it should.

-- ---------------------------------------------------------------------------
-- byproducts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."byproducts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "facility_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "destination_type" "text" NOT NULL,
    "partner_name" "text",
    "partner_url" "text",
    "contract_started" "date",
    "status" "text" DEFAULT 'active' NOT NULL,
    "visibility" "text" DEFAULT 'private' NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "byproducts_destination_type_check" CHECK (("destination_type" = ANY (ARRAY[
        'animal_feed'::"text",
        'anaerobic_digestion'::"text",
        'composting'::"text",
        'food_or_beverage'::"text",
        'industrial_input'::"text",
        'fertiliser'::"text",
        'energy_recovery'::"text",
        'recycling'::"text",
        'reuse_internal'::"text",
        'other'::"text"
    ]))),
    CONSTRAINT "byproducts_status_check" CHECK (("status" = ANY (ARRAY[
        'active'::"text",
        'paused'::"text",
        'ended'::"text"
    ]))),
    CONSTRAINT "byproducts_visibility_check" CHECK (("visibility" = ANY (ARRAY[
        'private'::"text",
        'platform'::"text",
        'public'::"text"
    ])))
);

ALTER TABLE "public"."byproducts" OWNER TO "postgres";
ALTER TABLE ONLY "public"."byproducts" ADD CONSTRAINT "byproducts_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."byproducts"
    ADD CONSTRAINT "byproducts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."byproducts"
    ADD CONSTRAINT "byproducts_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."byproducts"
    ADD CONSTRAINT "byproducts_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "byproducts_organization_id_idx" ON "public"."byproducts" ("organization_id");
CREATE INDEX "byproducts_organization_id_status_idx"
    ON "public"."byproducts" ("organization_id", "status");

-- ---------------------------------------------------------------------------
-- byproduct_flows
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."byproduct_flows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "byproduct_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "reporting_period_start" "date" NOT NULL,
    "reporting_period_end" "date" NOT NULL,
    "mass_kg" numeric NOT NULL,
    "unit" "text" DEFAULT 'kg' NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "byproduct_flows_mass_kg_check" CHECK (("mass_kg" > (0)::numeric)),
    CONSTRAINT "byproduct_flows_period_check" CHECK (("reporting_period_end" >= "reporting_period_start"))
);

ALTER TABLE "public"."byproduct_flows" OWNER TO "postgres";
ALTER TABLE ONLY "public"."byproduct_flows" ADD CONSTRAINT "byproduct_flows_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."byproduct_flows"
    ADD CONSTRAINT "byproduct_flows_byproduct_id_fkey"
    FOREIGN KEY ("byproduct_id") REFERENCES "public"."byproducts"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."byproduct_flows"
    ADD CONSTRAINT "byproduct_flows_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."byproduct_flows"
    ADD CONSTRAINT "byproduct_flows_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "byproduct_flows_byproduct_id_idx" ON "public"."byproduct_flows" ("byproduct_id");
CREATE INDEX "byproduct_flows_organization_id_period_idx"
    ON "public"."byproduct_flows" ("organization_id", "reporting_period_start", "reporting_period_end");

-- ---------------------------------------------------------------------------
-- Trigger to maintain updated_at on byproducts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."update_byproducts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_byproducts_updated_at"() OWNER TO "postgres";

CREATE TRIGGER "byproducts_updated_at"
    BEFORE UPDATE ON "public"."byproducts"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_byproducts_updated_at"();

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."byproducts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."byproduct_flows" ENABLE ROW LEVEL SECURITY;

-- byproducts: org members read/write their own org's records.
CREATE POLICY "byproducts_select_own_org"
    ON "public"."byproducts"
    FOR SELECT
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "byproducts_insert_own_org"
    ON "public"."byproducts"
    FOR INSERT
    WITH CHECK (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "byproducts_update_own_org"
    ON "public"."byproducts"
    FOR UPDATE
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "byproducts_delete_own_org"
    ON "public"."byproducts"
    FOR DELETE
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );

-- byproduct_flows: same pattern.
CREATE POLICY "byproduct_flows_select_own_org"
    ON "public"."byproduct_flows"
    FOR SELECT
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "byproduct_flows_insert_own_org"
    ON "public"."byproduct_flows"
    FOR INSERT
    WITH CHECK (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "byproduct_flows_update_own_org"
    ON "public"."byproduct_flows"
    FOR UPDATE
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "byproduct_flows_delete_own_org"
    ON "public"."byproduct_flows"
    FOR DELETE
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT ALL ON TABLE "public"."byproducts" TO "anon";
GRANT ALL ON TABLE "public"."byproducts" TO "authenticated";
GRANT ALL ON TABLE "public"."byproducts" TO "service_role";

GRANT ALL ON TABLE "public"."byproduct_flows" TO "anon";
GRANT ALL ON TABLE "public"."byproduct_flows" TO "authenticated";
GRANT ALL ON TABLE "public"."byproduct_flows" TO "service_role";

GRANT ALL ON FUNCTION "public"."update_byproducts_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_byproducts_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_byproducts_updated_at"() TO "service_role";
