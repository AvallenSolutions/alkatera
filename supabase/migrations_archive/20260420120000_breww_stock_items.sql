-- Breww stock-item master data (malt, hops, yeast, adjuncts, packaging).
-- Used by the recipe-import flow to classify ingredients and map them
-- into alkatera's LCA stage taxonomy.

CREATE TABLE IF NOT EXISTS public.breww_stock_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  type text,
  sub_type text,
  unit text,
  obsolete boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_breww_stock_items_org_type
  ON public.breww_stock_items(organization_id, type);

ALTER TABLE public.breww_stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view breww stock items"
  ON public.breww_stock_items FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Service role manages breww stock items"
  ON public.breww_stock_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);
