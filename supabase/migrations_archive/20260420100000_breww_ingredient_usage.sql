-- Ingredient usage data pulled from Breww per sync.
-- One row per (org, product, ingredient) aggregated across the 12-month window.
-- Upserted on every sync — idempotent by unique constraint.

CREATE TABLE IF NOT EXISTS public.breww_ingredient_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_external_id text NOT NULL,
  product_name text NOT NULL,
  ingredient_name text NOT NULL,
  total_quantity numeric(14, 3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  period_start date NOT NULL,
  period_end date NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, product_external_id, ingredient_name, period_start)
);

CREATE INDEX IF NOT EXISTS idx_breww_ingredient_usage_org
  ON public.breww_ingredient_usage(organization_id, product_external_id);

ALTER TABLE public.breww_ingredient_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view breww ingredient usage"
  ON public.breww_ingredient_usage FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

-- Writes only via service-role (the sync service).
CREATE POLICY "Service role manages breww ingredient usage"
  ON public.breww_ingredient_usage FOR ALL TO service_role
  USING (true) WITH CHECK (true);
