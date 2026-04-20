-- Integration framework
--
-- Generic storage for third-party integrations other than Xero. Xero stays on
-- its own xero_connections table until a future refactor — this is additive.
-- Each row represents one connected provider per organisation (e.g. Breww).
-- `encrypted_config` is AES-256-GCM ciphertext of whatever the provider needs
-- (API key, OAuth tokens, base URL override) as a JSON blob.

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_slug text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'error', 'disconnected')),
  encrypted_config jsonb NOT NULL,
  last_sync_at timestamptz,
  sync_status text CHECK (sync_status IN ('idle', 'syncing', 'error')) DEFAULT 'idle',
  sync_error text,
  connected_by uuid NOT NULL REFERENCES auth.users(id),
  connected_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (organization_id, provider_slug)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_org
  ON public.integration_connections(organization_id);

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view integration connections"
  ON public.integration_connections FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Org admins can manage integration connections"
  ON public.integration_connections FOR ALL TO authenticated
  USING (public.user_has_organization_access(organization_id))
  WITH CHECK (public.user_has_organization_access(organization_id));

-- Demand-signal table — "Request access" clicks on not-yet-built providers so
-- Tim can prioritise what to build next by popularity.
CREATE TABLE IF NOT EXISTS public.integration_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_slug text NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_requests_provider
  ON public.integration_requests(provider_slug, created_at DESC);

ALTER TABLE public.integration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their own requests"
  ON public.integration_requests FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Org members can create requests"
  ON public.integration_requests FOR INSERT TO authenticated
  WITH CHECK (public.user_has_organization_access(organization_id));
