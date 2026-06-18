-- Nature-Positive Actions module.
--
-- Producers' regenerative-agriculture, restoration, and habitat-creation
-- partnerships. Distinct from impact tracking (LCAs) — this is the "what
-- you put back" side of the nature pillar, aligned with TNFD/SBTN's
-- nature-positive framing and the Nature Positive Initiative's call for
-- measurable contributions, not just impact reduction.
--
-- Hectares logged on `nature_action_flows` feed into the nature score's
-- `nature_positive_sub` axis: action_type maps to a restoration-value
-- weight (peatland highest, regen ag medium-high, etc.), then total
-- effective hectares is normalised per unit produced.

-- ---------------------------------------------------------------------------
-- nature_actions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."nature_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "facility_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "action_type" "text" NOT NULL,
    "hectares" numeric NOT NULL,
    "partner_name" "text",
    "partner_url" "text",
    "location" "text",
    "contract_started" "date",
    "status" "text" DEFAULT 'in_progress' NOT NULL,
    "visibility" "text" DEFAULT 'private' NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "nature_actions_action_type_check" CHECK (("action_type" = ANY (ARRAY[
        'peatland_restoration'::"text",
        'woodland_restoration'::"text",
        'wetland_creation'::"text",
        'biodiversity_corridor'::"text",
        'pollinator_habitat'::"text",
        'water_management'::"text",
        'hedgerow_agroforestry'::"text",
        'regenerative_agriculture'::"text",
        'soil_health'::"text",
        'other'::"text"
    ]))),
    CONSTRAINT "nature_actions_hectares_check" CHECK (("hectares" >= (0)::numeric)),
    CONSTRAINT "nature_actions_status_check" CHECK (("status" = ANY (ARRAY[
        'planned'::"text",
        'in_progress'::"text",
        'established'::"text",
        'paused'::"text",
        'ended'::"text"
    ]))),
    CONSTRAINT "nature_actions_visibility_check" CHECK (("visibility" = ANY (ARRAY[
        'private'::"text",
        'platform'::"text",
        'public'::"text"
    ])))
);

ALTER TABLE "public"."nature_actions" OWNER TO "postgres";
ALTER TABLE ONLY "public"."nature_actions" ADD CONSTRAINT "nature_actions_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."nature_actions"
    ADD CONSTRAINT "nature_actions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."nature_actions"
    ADD CONSTRAINT "nature_actions_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."nature_actions"
    ADD CONSTRAINT "nature_actions_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "nature_actions_organization_id_idx" ON "public"."nature_actions" ("organization_id");
CREATE INDEX "nature_actions_organization_id_status_idx"
    ON "public"."nature_actions" ("organization_id", "status");

-- ---------------------------------------------------------------------------
-- nature_action_flows
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."nature_action_flows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nature_action_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "reporting_period_start" "date" NOT NULL,
    "reporting_period_end" "date" NOT NULL,
    "hectares_active" numeric NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "nature_action_flows_hectares_check" CHECK (("hectares_active" >= (0)::numeric)),
    CONSTRAINT "nature_action_flows_period_check" CHECK (("reporting_period_end" >= "reporting_period_start"))
);

ALTER TABLE "public"."nature_action_flows" OWNER TO "postgres";
ALTER TABLE ONLY "public"."nature_action_flows" ADD CONSTRAINT "nature_action_flows_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."nature_action_flows"
    ADD CONSTRAINT "nature_action_flows_action_id_fkey"
    FOREIGN KEY ("nature_action_id") REFERENCES "public"."nature_actions"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."nature_action_flows"
    ADD CONSTRAINT "nature_action_flows_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."nature_action_flows"
    ADD CONSTRAINT "nature_action_flows_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "nature_action_flows_action_id_idx"
    ON "public"."nature_action_flows" ("nature_action_id");
CREATE INDEX "nature_action_flows_organization_id_period_idx"
    ON "public"."nature_action_flows" ("organization_id", "reporting_period_start", "reporting_period_end");

-- ---------------------------------------------------------------------------
-- updated_at trigger on nature_actions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."update_nature_actions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_nature_actions_updated_at"() OWNER TO "postgres";

CREATE TRIGGER "nature_actions_updated_at"
    BEFORE UPDATE ON "public"."nature_actions"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_nature_actions_updated_at"();

-- ---------------------------------------------------------------------------
-- RLS policies (org-scoped, mirrors byproducts pattern)
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."nature_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."nature_action_flows" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nature_actions_select_own_org"
    ON "public"."nature_actions"
    FOR SELECT
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );
CREATE POLICY "nature_actions_insert_own_org"
    ON "public"."nature_actions"
    FOR INSERT
    WITH CHECK (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );
CREATE POLICY "nature_actions_update_own_org"
    ON "public"."nature_actions"
    FOR UPDATE
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );
CREATE POLICY "nature_actions_delete_own_org"
    ON "public"."nature_actions"
    FOR DELETE
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "nature_action_flows_select_own_org"
    ON "public"."nature_action_flows"
    FOR SELECT
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );
CREATE POLICY "nature_action_flows_insert_own_org"
    ON "public"."nature_action_flows"
    FOR INSERT
    WITH CHECK (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );
CREATE POLICY "nature_action_flows_update_own_org"
    ON "public"."nature_action_flows"
    FOR UPDATE
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = "auth"."uid"()
        )
    );
CREATE POLICY "nature_action_flows_delete_own_org"
    ON "public"."nature_action_flows"
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

GRANT ALL ON TABLE "public"."nature_actions" TO "anon";
GRANT ALL ON TABLE "public"."nature_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."nature_actions" TO "service_role";

GRANT ALL ON TABLE "public"."nature_action_flows" TO "anon";
GRANT ALL ON TABLE "public"."nature_action_flows" TO "authenticated";
GRANT ALL ON TABLE "public"."nature_action_flows" TO "service_role";

GRANT ALL ON FUNCTION "public"."update_nature_actions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_nature_actions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_nature_actions_updated_at"() TO "service_role";
