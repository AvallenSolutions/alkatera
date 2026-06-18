-- Container type (packaging) master data pulled from Breww per sync.
-- One row per (org, external_id). Upserted on every sync — idempotent.

CREATE TABLE IF NOT EXISTS public.breww_container_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  name text NOT NULL,
  volume_ml numeric(10, 2),
  weight_g numeric(10, 2),
  material_type text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_breww_container_types_org
  ON public.breww_container_types(organization_id);

ALTER TABLE public.breww_container_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view breww container types"
  ON public.breww_container_types FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

-- Writes only via service-role (the sync service).
CREATE POLICY "Service role manages breww container types"
  ON public.breww_container_types FOR ALL TO service_role
  USING (true) WITH CHECK (true);
