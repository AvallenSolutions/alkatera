-- Performance: indexes for the hottest authenticated query paths.
--
-- From the 2026-05-30 performance audit. These three tables are read on
-- essentially every authenticated request and on every Rosa hub load, but
-- lacked indexes that could serve their most common filters.
--
-- All statements use IF NOT EXISTS so this migration is safe to re-run. When
-- applying against production via the Supabase SQL editor, prefer the
-- CONCURRENTLY variants (documented alongside this migration) if any table is
-- large, so the index build does not take a write lock.

-- 1. organization_members.user_id
--    The single most-frequently-run query in the app: membership is resolved by
--    user_id alone on every authenticated request (resolve-organization,
--    verify-org-access, and every Rosa / Pulse / Stripe route). The only
--    existing index is UNIQUE(organization_id, user_id) — organization_id leads,
--    so it cannot serve a user_id-only lookup and Postgres falls back to a
--    sequential scan.
CREATE INDEX IF NOT EXISTS idx_org_members_user_id
  ON organization_members (user_id);

-- 2. products.(organization_id, created_at DESC)
--    The products table had NO organization_id index at all. The products list
--    page and the Rosa signal pack both filter products by org; the list also
--    orders by created_at DESC, so a composite covers both the filter and sort.
CREATE INDEX IF NOT EXISTS idx_products_org_created
  ON products (organization_id, created_at DESC);

-- 3. product_carbon_footprints.(organization_id, status)
--    The Rosa hub fires ~6 (organization_id + status) queries against this table
--    on every load. Existing indexes cover (organization_id, ghg) and a
--    standalone status, but not the general (organization_id, status)
--    combination these filters need.
CREATE INDEX IF NOT EXISTS idx_pcf_org_status
  ON product_carbon_footprints (organization_id, status);
