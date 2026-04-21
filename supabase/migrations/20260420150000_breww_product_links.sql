-- Breww SKU <-> alkatera product link table.
-- Each Breww SKU (from breww_products_skus) is linked to one alkatera product,
-- but one alkatera product can pull data from multiple SKUs (e.g. the same
-- recipe sold in both bottles and kegs).

CREATE TABLE IF NOT EXISTS public.breww_product_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  breww_sku_external_id text NOT NULL,
  alkatera_product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (organization_id, breww_sku_external_id)
);

CREATE INDEX IF NOT EXISTS idx_breww_product_links_org_product
  ON public.breww_product_links(organization_id, alkatera_product_id);

ALTER TABLE public.breww_product_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view breww product links"
  ON public.breww_product_links FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Org members can manage breww product links"
  ON public.breww_product_links FOR ALL TO authenticated
  USING (public.user_has_organization_access(organization_id))
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Service role manages breww product links"
  ON public.breww_product_links FOR ALL TO service_role
  USING (true) WITH CHECK (true);
