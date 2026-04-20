-- Brewery production runs — data pulled from Breww and future brewery-
-- management integrations. One row per (org, provider, product, month).
-- The sync aggregates batches into monthly totals so the table stays small
-- and user-meaningful (emissions-per-hectolitre needs monthly volume,
-- not every batch ID).

CREATE TABLE IF NOT EXISTS public.brewery_production_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_slug text NOT NULL,
  product_external_id text NOT NULL,
  product_name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  volume_hl numeric(14, 3) NOT NULL DEFAULT 0,
  batches_count integer NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  source_hash text,
  UNIQUE (organization_id, provider_slug, product_external_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_brewery_production_runs_org_period
  ON public.brewery_production_runs(organization_id, period_start DESC);

ALTER TABLE public.brewery_production_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view brewery production runs"
  ON public.brewery_production_runs FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

-- Writes only via service-role (the sync service), never directly by users.
CREATE POLICY "Service role manages brewery production runs"
  ON public.brewery_production_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
