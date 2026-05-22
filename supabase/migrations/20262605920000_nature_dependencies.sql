-- Nature dependencies — what producers depend on from nature.
--
-- V2-c of the Nature pillar redesign. TNFD's LEAP framework treats
-- *dependencies* (ecosystem services you rely on) as equally important
-- as *impacts* (what you take). This table captures the dependency side.
--
-- Dependency types are sourced from ENCORE (Exploring Natural Capital
-- Opportunities, Risks and Exposure):
--   https://www.encorenature.org/en
--
-- ENCORE catalogues 21 ecosystem services across Provisioning,
-- Regulating & Maintenance, and Cultural categories. We curate a subset
-- most material to the drinks industry, with sector-aligned defaults.
--
-- Score integration: declared materiality on relevant dependencies feeds
-- the 6th axis (`nature_dependencies_sub`) of the Nature score at small
-- weight (~10% when present, redistributing).

CREATE TABLE IF NOT EXISTS "public"."nature_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "facility_id" "uuid",
    "dependency_type" "text" NOT NULL,
    "materiality" "text" NOT NULL,
    "notes" "text",
    "source" "text" DEFAULT 'self-declared' NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "nature_dependencies_dependency_type_check" CHECK (("dependency_type" = ANY (ARRAY[
        -- Provisioning services
        'freshwater_supply'::"text",
        'biomass_provisioning'::"text",
        'genetic_materials'::"text",
        -- Regulating & Maintenance services
        'pollination'::"text",
        'soil_quality_regulation'::"text",
        'water_flow_regulation'::"text",
        'water_quality_regulation'::"text",
        'climate_regulation'::"text",
        'pest_disease_control'::"text",
        'flood_storm_protection'::"text",
        'mass_stabilisation_erosion_control'::"text",
        'air_filtration'::"text",
        'noise_attenuation'::"text",
        -- Cultural services
        'cultural_heritage'::"text",
        'recreation_tourism'::"text",
        'spiritual_artistic_inspiration'::"text"
    ]))),
    CONSTRAINT "nature_dependencies_materiality_check" CHECK (("materiality" = ANY (ARRAY[
        'low'::"text",
        'medium'::"text",
        'high'::"text",
        'critical'::"text"
    ]))),
    CONSTRAINT "nature_dependencies_unique_per_org_type"
        UNIQUE ("organization_id", "facility_id", "dependency_type")
);

ALTER TABLE "public"."nature_dependencies" OWNER TO "postgres";
ALTER TABLE ONLY "public"."nature_dependencies" ADD CONSTRAINT "nature_dependencies_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."nature_dependencies"
    ADD CONSTRAINT "nature_dependencies_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."nature_dependencies"
    ADD CONSTRAINT "nature_dependencies_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."nature_dependencies"
    ADD CONSTRAINT "nature_dependencies_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "nature_dependencies_organization_id_idx"
    ON "public"."nature_dependencies" ("organization_id");

-- updated_at trigger
CREATE OR REPLACE FUNCTION "public"."update_nature_dependencies_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."update_nature_dependencies_updated_at"() OWNER TO "postgres";

CREATE TRIGGER "nature_dependencies_updated_at"
    BEFORE UPDATE ON "public"."nature_dependencies"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_nature_dependencies_updated_at"();

-- RLS — org-scoped, mirrors byproducts/nature_actions pattern
ALTER TABLE "public"."nature_dependencies" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nature_dependencies_select_own_org" ON "public"."nature_dependencies" FOR SELECT
    USING ("organization_id" IN (SELECT "organization_id" FROM "public"."organization_members" WHERE "user_id" = "auth"."uid"()));
CREATE POLICY "nature_dependencies_insert_own_org" ON "public"."nature_dependencies" FOR INSERT
    WITH CHECK ("organization_id" IN (SELECT "organization_id" FROM "public"."organization_members" WHERE "user_id" = "auth"."uid"()));
CREATE POLICY "nature_dependencies_update_own_org" ON "public"."nature_dependencies" FOR UPDATE
    USING ("organization_id" IN (SELECT "organization_id" FROM "public"."organization_members" WHERE "user_id" = "auth"."uid"()));
CREATE POLICY "nature_dependencies_delete_own_org" ON "public"."nature_dependencies" FOR DELETE
    USING ("organization_id" IN (SELECT "organization_id" FROM "public"."organization_members" WHERE "user_id" = "auth"."uid"()));

GRANT ALL ON TABLE "public"."nature_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."nature_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."nature_dependencies" TO "service_role";
GRANT ALL ON FUNCTION "public"."update_nature_dependencies_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_nature_dependencies_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_nature_dependencies_updated_at"() TO "service_role";
