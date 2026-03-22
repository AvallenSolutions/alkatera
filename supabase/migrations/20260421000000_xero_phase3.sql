-- Phase 3: Supplier matching + duplicate detection columns
-- =========================================================

-- 1. Xero supplier links - maps Xero contacts to alkatera suppliers
CREATE TABLE IF NOT EXISTS "public"."xero_supplier_links" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" uuid NOT NULL,
    "xero_contact_id" text NOT NULL,
    "xero_contact_name" text NOT NULL,
    "supplier_id" uuid,
    "match_type" text NOT NULL DEFAULT 'unmatched',
    "match_confidence" numeric(3,2) DEFAULT 0,
    "total_spend" numeric DEFAULT 0,
    "transaction_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "xero_supplier_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "xero_supplier_links_org_contact_key" UNIQUE ("organization_id", "xero_contact_id"),
    CONSTRAINT "xero_supplier_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "xero_supplier_links_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL,
    CONSTRAINT "xero_supplier_links_match_type_check" CHECK ("match_type" IN ('auto_exact', 'auto_fuzzy', 'manual', 'unmatched', 'ignored')),
    CONSTRAINT "xero_supplier_links_confidence_check" CHECK ("match_confidence" >= 0 AND "match_confidence" <= 1)
);

-- RLS
ALTER TABLE "public"."xero_supplier_links" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org supplier links"
    ON "public"."xero_supplier_links"
    FOR SELECT
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = auth.uid()
        )
    );

CREATE POLICY "Users can manage their org supplier links"
    ON "public"."xero_supplier_links"
    FOR ALL
    USING (
        "organization_id" IN (
            SELECT "organization_id" FROM "public"."organization_members"
            WHERE "user_id" = auth.uid()
        )
    );

-- Index for efficient joins
CREATE INDEX IF NOT EXISTS "idx_xero_supplier_links_org" ON "public"."xero_supplier_links" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_xero_supplier_links_supplier" ON "public"."xero_supplier_links" ("supplier_id") WHERE "supplier_id" IS NOT NULL;

-- 2. Duplicate detection flag on xero_transactions
ALTER TABLE "public"."xero_transactions"
    ADD COLUMN IF NOT EXISTS "duplicate_flag" text DEFAULT 'none';

-- Constraint for valid values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'xero_transactions_duplicate_flag_check'
    ) THEN
        ALTER TABLE "public"."xero_transactions"
            ADD CONSTRAINT "xero_transactions_duplicate_flag_check"
            CHECK ("duplicate_flag" IN ('none', 'probable_overlap', 'acknowledged'));
    END IF;
END $$;
