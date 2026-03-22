-- Xero accounting integration tables
-- Supports OAuth 2.0 connections, transaction sync, classification,
-- spend-based emission baselines, and data quality upgrade tracking.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. xero_connections — OAuth tokens per organisation/tenant
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "public"."xero_connections" (
  "id"                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"         UUID NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "xero_tenant_id"          TEXT NOT NULL,
  "xero_tenant_name"        TEXT,
  "access_token_encrypted"  TEXT NOT NULL,
  "refresh_token_encrypted" TEXT NOT NULL,
  "token_expires_at"        TIMESTAMPTZ NOT NULL,
  "scopes"                  TEXT[],
  "connected_by"            UUID REFERENCES "auth"."users"("id"),
  "connected_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "last_sync_at"            TIMESTAMPTZ,
  "sync_status"             TEXT NOT NULL DEFAULT 'idle'
                              CHECK ("sync_status" IN ('idle', 'syncing', 'error')),
  "sync_error"              TEXT,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("organization_id", "xero_tenant_id")
);

COMMENT ON TABLE "public"."xero_connections"
  IS 'Stores encrypted OAuth 2.0 tokens for Xero API connections. One row per organisation per connected Xero tenant.';
COMMENT ON COLUMN "public"."xero_connections"."access_token_encrypted"
  IS 'AES-256-GCM encrypted access token. Format: iv:authTag:ciphertext.';
COMMENT ON COLUMN "public"."xero_connections"."refresh_token_encrypted"
  IS 'AES-256-GCM encrypted refresh token. Each refresh issues a new token; always persist the latest.';
COMMENT ON COLUMN "public"."xero_connections"."sync_status"
  IS 'Current sync state: idle (ready), syncing (in progress), error (last sync failed).';

CREATE INDEX IF NOT EXISTS "idx_xero_connections_org"
  ON "public"."xero_connections"("organization_id");

ALTER TABLE "public"."xero_connections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view xero connections"
  ON "public"."xero_connections"
  FOR SELECT
  TO "authenticated"
  USING ("public"."user_has_organization_access"("organization_id"));

CREATE POLICY "Members can manage xero connections"
  ON "public"."xero_connections"
  FOR ALL
  TO "authenticated"
  USING ("public"."user_has_organization_access"("organization_id"))
  WITH CHECK ("public"."user_has_organization_access"("organization_id"));


-- ═══════════════════════════════════════════════════════════════════════
-- 2. xero_account_mappings — Xero expense accounts → emission categories
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "public"."xero_account_mappings" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"   UUID NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "xero_account_id"   TEXT NOT NULL,
  "xero_account_code" TEXT,
  "xero_account_name" TEXT NOT NULL,
  "xero_account_type" TEXT,
  "emission_category" TEXT,
  "is_excluded"       BOOLEAN NOT NULL DEFAULT false,
  "mapped_by"         UUID REFERENCES "auth"."users"("id"),
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("organization_id", "xero_account_id")
);

COMMENT ON TABLE "public"."xero_account_mappings"
  IS 'Maps Xero chart-of-accounts entries to emission categories for transaction classification.';
COMMENT ON COLUMN "public"."xero_account_mappings"."emission_category"
  IS 'Emission category ID (e.g. grid_electricity, natural_gas, air_travel). NULL if unmapped.';
COMMENT ON COLUMN "public"."xero_account_mappings"."is_excluded"
  IS 'If true, transactions coded to this account are excluded from emission calculations.';

CREATE INDEX IF NOT EXISTS "idx_xero_account_mappings_org"
  ON "public"."xero_account_mappings"("organization_id");

ALTER TABLE "public"."xero_account_mappings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view xero account mappings"
  ON "public"."xero_account_mappings"
  FOR SELECT
  TO "authenticated"
  USING ("public"."user_has_organization_access"("organization_id"));

CREATE POLICY "Members can manage xero account mappings"
  ON "public"."xero_account_mappings"
  FOR ALL
  TO "authenticated"
  USING ("public"."user_has_organization_access"("organization_id"))
  WITH CHECK ("public"."user_has_organization_access"("organization_id"));


-- ═══════════════════════════════════════════════════════════════════════
-- 3. xero_transactions — Synced and classified transactions
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "public"."xero_transactions" (
  "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"          UUID NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "xero_transaction_id"      TEXT NOT NULL,
  "xero_transaction_type"    TEXT NOT NULL
                               CHECK ("xero_transaction_type" IN ('invoice', 'bank_transaction', 'credit_note')),
  "xero_contact_name"        TEXT,
  "xero_contact_id"          TEXT,
  "xero_account_id"          TEXT,
  "xero_account_code"        TEXT,
  "description"              TEXT,
  "amount"                   NUMERIC NOT NULL,
  "currency"                 TEXT NOT NULL DEFAULT 'GBP',
  "transaction_date"         DATE NOT NULL,
  "emission_category"        TEXT,
  "classification_source"    TEXT
                               CHECK ("classification_source" IN ('account_mapping', 'supplier_rule', 'manual', 'ai')),
  "classification_confidence" NUMERIC CHECK ("classification_confidence" >= 0 AND "classification_confidence" <= 1),
  "spend_based_emissions_kg" NUMERIC,
  "data_quality_tier"        INTEGER NOT NULL DEFAULT 4
                               CHECK ("data_quality_tier" BETWEEN 1 AND 4),
  "upgrade_status"           TEXT NOT NULL DEFAULT 'pending'
                               CHECK ("upgrade_status" IN ('pending', 'upgraded', 'dismissed', 'not_applicable')),
  "upgraded_entry_id"        UUID,
  "upgraded_entry_table"     TEXT,
  "sync_batch_id"            UUID,
  "reporting_year"           INTEGER,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("organization_id", "xero_transaction_id")
);

COMMENT ON TABLE "public"."xero_transactions"
  IS 'Synced Xero transactions classified into emission categories with spend-based baselines and upgrade tracking.';
COMMENT ON COLUMN "public"."xero_transactions"."data_quality_tier"
  IS 'GHG Protocol data quality tier: 4=spend-based, 3=average/proxy, 2=activity-based, 1=supplier-specific.';
COMMENT ON COLUMN "public"."xero_transactions"."upgrade_status"
  IS 'Whether the user has provided higher-quality activity data: pending, upgraded, dismissed, or not_applicable.';
COMMENT ON COLUMN "public"."xero_transactions"."upgraded_entry_id"
  IS 'FK to the record created when the user upgrades (e.g. utility_data_entries.id).';

CREATE INDEX IF NOT EXISTS "idx_xero_transactions_org"
  ON "public"."xero_transactions"("organization_id");

CREATE INDEX IF NOT EXISTS "idx_xero_transactions_category"
  ON "public"."xero_transactions"("organization_id", "emission_category");

CREATE INDEX IF NOT EXISTS "idx_xero_transactions_date"
  ON "public"."xero_transactions"("organization_id", "transaction_date");

CREATE INDEX IF NOT EXISTS "idx_xero_transactions_upgrade"
  ON "public"."xero_transactions"("organization_id", "upgrade_status")
  WHERE "upgrade_status" = 'pending';

ALTER TABLE "public"."xero_transactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view xero transactions"
  ON "public"."xero_transactions"
  FOR SELECT
  TO "authenticated"
  USING ("public"."user_has_organization_access"("organization_id"));

CREATE POLICY "Members can manage xero transactions"
  ON "public"."xero_transactions"
  FOR ALL
  TO "authenticated"
  USING ("public"."user_has_organization_access"("organization_id"))
  WITH CHECK ("public"."user_has_organization_access"("organization_id"));


-- ═══════════════════════════════════════════════════════════════════════
-- 4. xero_supplier_rules — Pattern-based transaction classification
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "public"."xero_supplier_rules" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"   UUID REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "supplier_pattern"  TEXT NOT NULL,
  "emission_category" TEXT NOT NULL,
  "priority"          INTEGER NOT NULL DEFAULT 0,
  "is_system_default" BOOLEAN NOT NULL DEFAULT false,
  "created_by"        UUID REFERENCES "auth"."users"("id"),
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE "public"."xero_supplier_rules"
  IS 'Supplier name patterns mapped to emission categories. System defaults (organization_id IS NULL) apply to all orgs.';
COMMENT ON COLUMN "public"."xero_supplier_rules"."supplier_pattern"
  IS 'Case-insensitive ILIKE pattern (e.g. %british airways%).';
COMMENT ON COLUMN "public"."xero_supplier_rules"."priority"
  IS 'Higher values are checked first. Org-specific rules always take precedence over system defaults.';

CREATE INDEX IF NOT EXISTS "idx_xero_supplier_rules_org"
  ON "public"."xero_supplier_rules"("organization_id");

ALTER TABLE "public"."xero_supplier_rules" ENABLE ROW LEVEL SECURITY;

-- System defaults (organization_id IS NULL) are readable by all authenticated users
CREATE POLICY "Anyone can view system default supplier rules"
  ON "public"."xero_supplier_rules"
  FOR SELECT
  TO "authenticated"
  USING ("organization_id" IS NULL AND "is_system_default" = true);

-- Org-specific rules use standard org access check
CREATE POLICY "Members can view org supplier rules"
  ON "public"."xero_supplier_rules"
  FOR SELECT
  TO "authenticated"
  USING ("organization_id" IS NOT NULL AND "public"."user_has_organization_access"("organization_id"));

CREATE POLICY "Members can manage org supplier rules"
  ON "public"."xero_supplier_rules"
  FOR ALL
  TO "authenticated"
  USING ("organization_id" IS NOT NULL AND "public"."user_has_organization_access"("organization_id"))
  WITH CHECK ("organization_id" IS NOT NULL AND "public"."user_has_organization_access"("organization_id"));


-- ── Seed system-default supplier rules ────────────────────────────────

INSERT INTO "public"."xero_supplier_rules"
  ("organization_id", "supplier_pattern", "emission_category", "priority", "is_system_default")
VALUES
  -- Airlines
  (NULL, '%british airways%',  'air_travel', 10, true),
  (NULL, '%easyjet%',          'air_travel', 10, true),
  (NULL, '%ryanair%',          'air_travel', 10, true),
  (NULL, '%jet2%',             'air_travel', 10, true),
  (NULL, '%wizz air%',         'air_travel', 10, true),
  (NULL, '%lufthansa%',        'air_travel', 10, true),
  (NULL, '%klm%',              'air_travel', 10, true),
  (NULL, '%air france%',       'air_travel', 10, true),
  (NULL, '%virgin atlantic%',  'air_travel', 10, true),
  (NULL, '%aer lingus%',       'air_travel', 10, true),
  (NULL, '%emirates%',         'air_travel', 10, true),
  -- Energy suppliers
  (NULL, '%edf energy%',       'grid_electricity', 10, true),
  (NULL, '%british gas%',      'natural_gas',      10, true),
  (NULL, '%octopus energy%',   'grid_electricity', 10, true),
  (NULL, '%ovo energy%',       'grid_electricity', 10, true),
  (NULL, '%scottish power%',   'grid_electricity', 10, true),
  (NULL, '%e.on%',             'grid_electricity', 10, true),
  (NULL, '%bulb%',             'grid_electricity', 10, true),
  (NULL, '%npower%',           'grid_electricity', 10, true),
  (NULL, '%sse%',              'grid_electricity',  5, true),
  -- Gas suppliers
  (NULL, '%calor gas%',        'lpg', 10, true),
  (NULL, '%flogas%',           'lpg', 10, true),
  -- Water utilities
  (NULL, '%thames water%',     'water', 10, true),
  (NULL, '%severn trent%',     'water', 10, true),
  (NULL, '%united utilities%', 'water', 10, true),
  (NULL, '%anglian water%',    'water', 10, true),
  (NULL, '%yorkshire water%',  'water', 10, true),
  (NULL, '%southern water%',   'water', 10, true),
  (NULL, '%welsh water%',      'water', 10, true),
  (NULL, '%northumbrian water%', 'water', 10, true),
  -- Waste contractors
  (NULL, '%biffa%',            'waste', 10, true),
  (NULL, '%veolia%',           'waste', 10, true),
  (NULL, '%suez%',             'waste', 10, true),
  (NULL, '%grundon%',          'waste', 10, true),
  (NULL, '%viridor%',          'waste', 10, true),
  -- Freight / logistics
  (NULL, '%dhl%',              'road_freight', 10, true),
  (NULL, '%ups%',              'road_freight', 10, true),
  (NULL, '%palletline%',       'road_freight', 10, true),
  (NULL, '%palletways%',       'road_freight', 10, true),
  (NULL, '%xpo logistics%',    'road_freight', 10, true),
  -- Courier / parcel
  (NULL, '%royal mail%',       'courier', 10, true),
  (NULL, '%dpd%',              'courier', 10, true),
  (NULL, '%hermes%',           'courier', 10, true),
  (NULL, '%evri%',             'courier', 10, true),
  (NULL, '%yodel%',            'courier', 10, true),
  -- Air freight
  (NULL, '%fedex%',            'air_freight', 10, true),
  -- Rail travel
  (NULL, '%trainline%',        'rail_travel', 10, true),
  (NULL, '%national rail%',    'rail_travel', 10, true),
  (NULL, '%eurostar%',         'rail_travel', 10, true),
  (NULL, '%lner%',             'rail_travel', 10, true),
  (NULL, '%gwr%',              'rail_travel', 10, true),
  (NULL, '%avanti%',           'rail_travel', 10, true),
  (NULL, '%crosscountry%',     'rail_travel', 10, true),
  -- Hotels
  (NULL, '%premier inn%',      'accommodation', 10, true),
  (NULL, '%travelodge%',       'accommodation', 10, true),
  (NULL, '%hilton%',           'accommodation', 10, true),
  (NULL, '%marriott%',         'accommodation', 10, true),
  (NULL, '%booking.com%',      'accommodation', 10, true),
  (NULL, '%airbnb%',           'accommodation', 10, true),
  -- Fuel stations
  (NULL, '%shell%',            'diesel_mobile', 5, true),
  (NULL, '%bp%',               'diesel_mobile', 5, true),
  (NULL, '%esso%',             'diesel_mobile', 5, true),
  (NULL, '%texaco%',           'diesel_mobile', 5, true),
  (NULL, '%total energies%',   'diesel_mobile', 5, true);


-- ═══════════════════════════════════════════════════════════════════════
-- 5. xero_sync_logs — Audit trail of sync operations
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "public"."xero_sync_logs" (
  "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"          UUID NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "sync_type"                TEXT NOT NULL CHECK ("sync_type" IN ('full', 'incremental', 'accounts_only')),
  "status"                   TEXT NOT NULL CHECK ("status" IN ('started', 'completed', 'failed')),
  "transactions_fetched"     INTEGER NOT NULL DEFAULT 0,
  "transactions_classified"  INTEGER NOT NULL DEFAULT 0,
  "accounts_fetched"         INTEGER NOT NULL DEFAULT 0,
  "error_message"            TEXT,
  "started_at"               TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at"             TIMESTAMPTZ,
  "triggered_by"             UUID REFERENCES "auth"."users"("id")
);

COMMENT ON TABLE "public"."xero_sync_logs"
  IS 'Audit trail of Xero data synchronisation operations.';

CREATE INDEX IF NOT EXISTS "idx_xero_sync_logs_org"
  ON "public"."xero_sync_logs"("organization_id", "started_at" DESC);

ALTER TABLE "public"."xero_sync_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view xero sync logs"
  ON "public"."xero_sync_logs"
  FOR SELECT
  TO "authenticated"
  USING ("public"."user_has_organization_access"("organization_id"));

CREATE POLICY "Members can create xero sync logs"
  ON "public"."xero_sync_logs"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ("public"."user_has_organization_access"("organization_id"));
