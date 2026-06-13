-- Ingredient -> supplier-product match suggestions.
--
-- Supplier-provided primary data is Priority 1 in the LCA impact waterfall, so
-- linking a bill-of-materials ingredient to a supplier product improves the
-- footprint. This table holds suggested links (from name/category/unit
-- similarity) for a brand to review; accepting one sets
-- product_materials.supplier_product_id. Suggest-only: nothing is auto-applied.
--
-- Standalone + idempotent.

CREATE TABLE IF NOT EXISTS "public"."ingredient_match_suggestions" (
  "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
  "organization_id" "uuid" NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "product_id" bigint,
  "product_material_id" "uuid" NOT NULL REFERENCES "public"."product_materials"("id") ON DELETE CASCADE,
  "supplier_product_id" "uuid" NOT NULL,
  -- Which pool the candidate came from, so accept resolves it correctly.
  "supplier_product_table" "text" NOT NULL DEFAULT 'supplier_products'
    CHECK ("supplier_product_table" IN ('supplier_products', 'platform_supplier_products')),
  "ingredient_name" "text",
  "supplier_product_name" "text",
  "supplier_name" "text",
  "match_confidence" numeric,
  "match_reason" "text",
  "matched_by" "text",
  "status" "text" NOT NULL DEFAULT 'suggested'
    CHECK ("status" IN ('suggested', 'accepted', 'dismissed')),
  "accepted_by" "uuid" REFERENCES "auth"."users"("id") ON DELETE SET NULL,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT "now"(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT "now"()
);

COMMENT ON TABLE "public"."ingredient_match_suggestions" IS
  'Suggested links from product_materials ingredients to supplier products. Accepting sets product_materials.supplier_product_id, moving the ingredient to Priority 1 (supplier data) in the LCA waterfall.';

CREATE INDEX IF NOT EXISTS "idx_ingredient_match_org_status"
  ON "public"."ingredient_match_suggestions" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "idx_ingredient_match_product"
  ON "public"."ingredient_match_suggestions" ("product_id");

-- Re-running generation must never clobber an accepted/dismissed verdict.
CREATE UNIQUE INDEX IF NOT EXISTS "ingredient_match_unique_key"
  ON "public"."ingredient_match_suggestions" (
    "organization_id", "product_material_id", "supplier_product_id"
  );

ALTER TABLE "public"."ingredient_match_suggestions" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ingredient_match_suggestions'
      AND policyname = 'Org members can view ingredient matches'
  ) THEN
    CREATE POLICY "Org members can view ingredient matches"
      ON "public"."ingredient_match_suggestions" FOR SELECT TO "authenticated"
      USING ("public"."user_has_organization_access"("organization_id"));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ingredient_match_suggestions'
      AND policyname = 'Org members can manage ingredient matches'
  ) THEN
    CREATE POLICY "Org members can manage ingredient matches"
      ON "public"."ingredient_match_suggestions" FOR ALL TO "authenticated"
      USING ("public"."user_has_organization_access"("organization_id"))
      WITH CHECK ("public"."user_has_organization_access"("organization_id"));
  END IF;
END $$;
