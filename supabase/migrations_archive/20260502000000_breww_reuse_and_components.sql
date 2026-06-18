-- Container reuse factor + product component stock items.
--
-- Reusable containers (firkins, kegs) amortise packaging impact across many
-- trips. For LCA, a firkin with 100 trips has 1/100th the per-use impact of a
-- single-use can. Breww exposes `keg_single_use` and container type, from which
-- we derive an `expected_trips` default.
--
-- `breww_sku_components` captures secondary-packaging stock items (cardboard
-- sleeves, shrink wrap) that Breww tracks against the product record.

ALTER TABLE public.breww_container_types
  ADD COLUMN IF NOT EXISTS single_use boolean,
  ADD COLUMN IF NOT EXISTS expected_trips integer,
  ADD COLUMN IF NOT EXISTS sub_type text;

CREATE TABLE IF NOT EXISTS public.breww_sku_components (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku_external_id text NOT NULL,
  stock_item_external_id text,
  stock_item_name text NOT NULL,
  quantity numeric(14, 4),
  unit text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sku_external_id, stock_item_name)
);

ALTER TABLE public.breww_sku_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view breww sku components" ON public.breww_sku_components;
CREATE POLICY "Org members can view breww sku components"
  ON public.breww_sku_components FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "Service role manages breww sku components" ON public.breww_sku_components;
CREATE POLICY "Service role manages breww sku components"
  ON public.breww_sku_components FOR ALL TO service_role
  USING (true) WITH CHECK (true);
