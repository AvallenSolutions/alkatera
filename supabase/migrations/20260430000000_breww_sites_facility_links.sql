-- Breww sites + facility mapping. Enables splitting brewing (site A) from
-- packaging (site B) across separate alkatera facilities, so scope-1/2
-- emissions can be allocated to the site that actually produced the volume.

-- Cache of Breww sites for the org.
CREATE TABLE IF NOT EXISTS public.breww_sites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

ALTER TABLE public.breww_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view breww sites"
  ON public.breww_sites FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Service role manages breww sites"
  ON public.breww_sites FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Breww site → alkatera facility mapping.
CREATE TABLE IF NOT EXISTS public.breww_facility_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  breww_site_external_id text NOT NULL,
  alkatera_facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (organization_id, breww_site_external_id)
);

ALTER TABLE public.breww_facility_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view breww facility links"
  ON public.breww_facility_links FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Org admins can manage breww facility links"
  ON public.breww_facility_links FOR ALL TO authenticated
  USING (public.user_has_organization_access(organization_id))
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Service role manages breww facility links"
  ON public.breww_facility_links FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Site on brewing production runs. Nullable because older synced rows may
-- predate site capture; new syncs populate it.
ALTER TABLE public.brewery_production_runs
  ADD COLUMN IF NOT EXISTS site_external_id text,
  ADD COLUMN IF NOT EXISTS site_name text;

CREATE INDEX IF NOT EXISTS idx_brewery_production_runs_org_site
  ON public.brewery_production_runs(organization_id, site_external_id);

-- Extend the uniqueness constraint to include site so we can store one row
-- per (product, period, site). Default site_external_id to '_none' so rows
-- with no site still have a concrete value and PostgREST onConflict works
-- on a plain column list.
ALTER TABLE public.brewery_production_runs
  ALTER COLUMN site_external_id SET DEFAULT '_none';

UPDATE public.brewery_production_runs
  SET site_external_id = '_none' WHERE site_external_id IS NULL;

ALTER TABLE public.brewery_production_runs
  ALTER COLUMN site_external_id SET NOT NULL;

ALTER TABLE public.brewery_production_runs
  DROP CONSTRAINT IF EXISTS brewery_production_runs_organization_id_provider_slug_prod_key;

ALTER TABLE public.brewery_production_runs
  ADD CONSTRAINT brewery_production_runs_unique_with_site UNIQUE
  (organization_id, provider_slug, product_external_id, period_start, site_external_id);

-- Site on packaging runs.
ALTER TABLE public.breww_packaging_runs
  ADD COLUMN IF NOT EXISTS site_external_id text,
  ADD COLUMN IF NOT EXISTS site_name text;

CREATE INDEX IF NOT EXISTS idx_breww_packaging_runs_org_site
  ON public.breww_packaging_runs(organization_id, site_external_id);
