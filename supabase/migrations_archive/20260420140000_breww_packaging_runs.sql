-- Breww packaging runs — the batch → SKU → quantity link.
-- Sourced from /planned-packagings (quantity_packaged_so_far gives actuals)
-- and enriched with /drink-batch-actions volume_lost figures for yield metrics.

CREATE TABLE IF NOT EXISTS public.breww_packaging_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  batch_external_id text,
  product_external_id text,
  product_name text,
  quantity_planned numeric(14, 2),
  quantity_packaged numeric(14, 2),
  volume_ml numeric(14, 2),
  packaged_at date,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_breww_packaging_runs_org_batch
  ON public.breww_packaging_runs(organization_id, batch_external_id);

CREATE INDEX IF NOT EXISTS idx_breww_packaging_runs_org_product
  ON public.breww_packaging_runs(organization_id, product_external_id);

ALTER TABLE public.breww_packaging_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view breww packaging runs"
  ON public.breww_packaging_runs FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Service role manages breww packaging runs"
  ON public.breww_packaging_runs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
