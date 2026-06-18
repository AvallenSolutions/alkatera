-- Breww finished-goods SKUs ("IPA 500ml bottle", "IPA 30L keg").
-- This is the link target for alkatera products — Tim chose SKU-level
-- linking so packaging data stays accurate per pack-size.

CREATE TABLE IF NOT EXISTS public.breww_products_skus (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  sku text,
  container_external_id text,
  container_name text,
  liquid_volume_ml numeric(14, 2),
  liquid_volume_taxable_ml numeric(14, 2),
  net_weight_g numeric(14, 2),
  gross_weight_g numeric(14, 2),
  total_packaged_quantity numeric(14, 2),
  primary_drink_external_id text,
  primary_drink_name text,
  obsolete boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_breww_products_skus_org_drink
  ON public.breww_products_skus(organization_id, primary_drink_external_id);

ALTER TABLE public.breww_products_skus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view breww product SKUs"
  ON public.breww_products_skus FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Service role manages breww product SKUs"
  ON public.breww_products_skus FOR ALL TO service_role
  USING (true) WITH CHECK (true);
