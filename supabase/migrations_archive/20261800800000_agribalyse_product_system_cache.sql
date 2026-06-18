-- Agribalyse Product System Cache
--
-- Agribalyse processes in OpenLCA often require an explicit product system to
-- calculate impacts (the "calculate directly from Process" shortcut returns
-- empty impacts for many Agribalyse processes because their inputs lack
-- default providers). Building a product system via data/create-system runs
-- the full linker and produces a calculable graph.
--
-- Product systems are stable per process, so we cache the (process_id ->
-- product_system_id) mapping to pay the ~5-10s build cost only once per
-- ingredient across the whole platform.

CREATE TABLE IF NOT EXISTS agribalyse_product_systems (
  process_id        text PRIMARY KEY,
  product_system_id text NOT NULL,
  process_name      text,
  linking_config    jsonb,
  build_duration_ms integer,
  last_verified_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agribalyse_product_systems_updated
  ON agribalyse_product_systems(updated_at DESC);

-- Row Level Security: global reference data, readable by any authenticated
-- user. Writes happen server-side only (service role bypasses RLS).
ALTER TABLE agribalyse_product_systems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_agribalyse_product_systems"
  ON agribalyse_product_systems;
CREATE POLICY "authenticated_read_agribalyse_product_systems"
  ON agribalyse_product_systems
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE agribalyse_product_systems IS
  'Maps Agribalyse process UUIDs to pre-built product system UUIDs in the OpenLCA gdt-server. Populated on first calculation or via the backfill script in scripts/backfill-agribalyse-product-systems.ts.';
