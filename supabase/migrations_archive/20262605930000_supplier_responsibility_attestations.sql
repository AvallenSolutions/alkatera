-- Supplier responsibility attestations.
--
-- Producer-level declarations about supply-chain due-diligence practices.
-- Sourced from a curated subset of CSRD ESRS S2 (Workers in the value
-- chain), UK Modern Slavery Act, and B Corp Workers/Community impact areas.
--
-- These are things the producer controls — written codes of conduct,
-- supplier audits, Living Wage requirements — none requiring suppliers
-- to engage with the platform. Used by the Social pillar's supplier
-- responsibility sub-score (which combines mapping coverage + certs
-- coverage + attestation completeness).

CREATE TABLE IF NOT EXISTS "public"."supplier_responsibility_attestations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "attestation_type" "text" NOT NULL,
    "is_attested" boolean DEFAULT true NOT NULL,
    "evidence_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "supplier_responsibility_attestation_type_check"
        CHECK (("attestation_type" = ANY (ARRAY[
            'supplier_code_of_conduct'::"text",
            'annual_supplier_risk_assessment'::"text",
            'supplier_audits_last_12_months'::"text",
            'living_wage_in_contracts'::"text",
            'modern_slavery_policy'::"text",
            'supplier_diversity_programme'::"text"
        ]))),
    CONSTRAINT "supplier_responsibility_unique_per_org"
        UNIQUE ("organization_id", "attestation_type")
);

ALTER TABLE "public"."supplier_responsibility_attestations" OWNER TO "postgres";
ALTER TABLE ONLY "public"."supplier_responsibility_attestations"
    ADD CONSTRAINT "supplier_responsibility_attestations_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."supplier_responsibility_attestations"
    ADD CONSTRAINT "supplier_responsibility_attestations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."supplier_responsibility_attestations"
    ADD CONSTRAINT "supplier_responsibility_attestations_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE INDEX "supplier_responsibility_attestations_organization_id_idx"
    ON "public"."supplier_responsibility_attestations" ("organization_id");

CREATE OR REPLACE FUNCTION "public"."update_supplier_responsibility_attestations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."update_supplier_responsibility_attestations_updated_at"() OWNER TO "postgres";

CREATE TRIGGER "supplier_responsibility_attestations_updated_at"
    BEFORE UPDATE ON "public"."supplier_responsibility_attestations"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_supplier_responsibility_attestations_updated_at"();

ALTER TABLE "public"."supplier_responsibility_attestations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_responsibility_select_own_org"
    ON "public"."supplier_responsibility_attestations" FOR SELECT
    USING ("organization_id" IN (SELECT "organization_id" FROM "public"."organization_members" WHERE "user_id" = "auth"."uid"()));
CREATE POLICY "supplier_responsibility_insert_own_org"
    ON "public"."supplier_responsibility_attestations" FOR INSERT
    WITH CHECK ("organization_id" IN (SELECT "organization_id" FROM "public"."organization_members" WHERE "user_id" = "auth"."uid"()));
CREATE POLICY "supplier_responsibility_update_own_org"
    ON "public"."supplier_responsibility_attestations" FOR UPDATE
    USING ("organization_id" IN (SELECT "organization_id" FROM "public"."organization_members" WHERE "user_id" = "auth"."uid"()));
CREATE POLICY "supplier_responsibility_delete_own_org"
    ON "public"."supplier_responsibility_attestations" FOR DELETE
    USING ("organization_id" IN (SELECT "organization_id" FROM "public"."organization_members" WHERE "user_id" = "auth"."uid"()));

GRANT ALL ON TABLE "public"."supplier_responsibility_attestations" TO "anon";
GRANT ALL ON TABLE "public"."supplier_responsibility_attestations" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_responsibility_attestations" TO "service_role";
GRANT ALL ON FUNCTION "public"."update_supplier_responsibility_attestations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_supplier_responsibility_attestations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_supplier_responsibility_attestations_updated_at"() TO "service_role";
