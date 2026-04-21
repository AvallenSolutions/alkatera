-- Breww packaging runs — per-SKU packaged quantities pulled from Breww's
-- /planned-packagings endpoint. One row per packaging event, dated so rows
-- can be aggregated by reporting period (month/quarter/year) and per SKU
-- for Scope 3 Category 1 allocation and facility emissions cascading.

CREATE TABLE IF NOT EXISTS public.breww_packaging_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  batch_external_id text,
  product_external_id text,
  product_name text,
  quantity_planned numeric(14, 3),
  quantity_packaged numeric(14, 3),
  volume_ml numeric(14, 2),
  packaged_at date,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_breww_packaging_runs_org_sku_date
  ON public.breww_packaging_runs(organization_id, product_external_id, packaged_at DESC);

CREATE INDEX IF NOT EXISTS idx_breww_packaging_runs_org_date
  ON public.breww_packaging_runs(organization_id, packaged_at DESC);

ALTER TABLE public.breww_packaging_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view breww packaging runs"
  ON public.breww_packaging_runs FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Service role manages breww packaging runs"
  ON public.breww_packaging_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
