-- Footprint Agent v1 — exception queue.
--
-- The Footprint Agent ingests documents (uploads, emails, integrations) and
-- runs the existing classifier + parsers. Anything it isn't 100% sure about
-- lands in `agent_exceptions` for human sign-off. The agent console reads
-- this table; the existing forms keep working as a fallback for advanced
-- users who'd rather type.
--
-- Why a separate table from `ingest_jobs`:
--   - Not every exception comes from an upload (Xero classifications, proxy
--     suggestions, anomaly explanations all flow into the same queue).
--   - We keep the audit trail of approval/edit/reject independent of the
--     job lifecycle. ingest_jobs are short-lived; exceptions are forever.

CREATE TABLE IF NOT EXISTS public.agent_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- What the agent thinks this is. Mirrors classifier result types plus
  -- the agent-internal kinds (xero_classification, supplier_proxy, …).
  kind text NOT NULL,

  -- Where the agent first saw the data. 'upload' = dropzone, 'email' =
  -- inbound forwarding, 'xero_sync' / 'integration_sync' = pulled from a
  -- live integration, 'agent_run' = produced by a scheduled run.
  source text NOT NULL DEFAULT 'upload'
    CHECK (source IN ('upload','email','xero_sync','integration_sync','agent_run','manual')),

  -- Backreferences so we can deep-link from the queue back to the doc /
  -- transaction / supplier the agent acted on. JSONB rather than typed FKs
  -- because the shape varies by `kind` and it keeps the schema flat for
  -- the v1 cut.
  source_ref jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- The thing the agent wants the user to confirm. For a utility bill
  -- this is the ExtractedBillData. For a Xero classification it's
  -- { txn_id, suggested_account_code, … }. For a proxy advisor call it's
  -- { ingredient_id, proposed_factor_id, alternative_factor_ids }.
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Where the data should ultimately land if approved. Optional — the
  -- approve endpoint can derive this from payload if missing, but pre-
  -- populating it lets the queue UI pick the right facility/supplier
  -- without a second round-trip.
  suggested_facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,
  suggested_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,

  -- 0-1. NULL means the agent didn't compute one for this kind.
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  -- Human-readable display strings. The queue UI shows these directly so
  -- it doesn't have to render JSONB. Filled by the agent at insert time.
  title text NOT NULL,
  summary text,

  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','approved','edited','rejected','deferred','superseded')),

  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,

  -- After approval, the agent records what got written (which row in
  -- which table) so we have a full audit trail of agent → user → DB.
  applied_to jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_exceptions_org_status_idx
  ON public.agent_exceptions (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_exceptions_org_kind_idx
  ON public.agent_exceptions (organization_id, kind, created_at DESC);

-- The agent dedups by source_ref->>'ingestJobId' before inserting; this
-- partial unique index makes the dedup race-safe.
CREATE UNIQUE INDEX IF NOT EXISTS agent_exceptions_unique_ingest_job
  ON public.agent_exceptions ((source_ref->>'ingestJobId'))
  WHERE source_ref->>'ingestJobId' IS NOT NULL;

ALTER TABLE public.agent_exceptions ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's queue.
DROP POLICY IF EXISTS "org members read agent exceptions" ON public.agent_exceptions;
CREATE POLICY "org members read agent exceptions"
  ON public.agent_exceptions FOR SELECT
  USING (public.user_has_organization_access(organization_id));

-- Org members can update (approve / edit / reject) — the API still gates
-- on role server-side so this is just the floor, not the ceiling.
DROP POLICY IF EXISTS "org members update agent exceptions" ON public.agent_exceptions;
CREATE POLICY "org members update agent exceptions"
  ON public.agent_exceptions FOR UPDATE
  USING (public.user_has_organization_access(organization_id))
  WITH CHECK (public.user_has_organization_access(organization_id));

-- No insert/delete policy: writes happen via service-role key (agent runs,
-- email-in webhook, ingest-job sweeper). Keeps the agent's authorship
-- distinct from a human typing into the queue.

CREATE OR REPLACE FUNCTION public.touch_agent_exception_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_exceptions_touch_updated_at ON public.agent_exceptions;
CREATE TRIGGER agent_exceptions_touch_updated_at
  BEFORE UPDATE ON public.agent_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_agent_exception_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- Managed-tier flag on organizations.
--
-- This is the bit-flag that turns the Agent Console / queue mode on for a
-- given org. Off by default; for the pilot we toggle it manually for the
-- one brand we're working with. Once we validate the model and price it,
-- we'll wire it to a Stripe subscription tier.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS managed_footprint_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS agent_inbox_address text;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_agent_inbox_idx
  ON public.organizations (agent_inbox_address)
  WHERE agent_inbox_address IS NOT NULL;

NOTIFY pgrst, 'reload schema';
