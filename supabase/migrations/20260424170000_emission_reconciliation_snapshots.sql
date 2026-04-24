-- Reconciliation audit trail.
--
-- Every time we ship a change to the emissions pipeline that could move a
-- customer's published corporate footprint (resolver rule change, new
-- suppression source, inventory-ledger re-booking, integration swap), we
-- capture a row here with the prior total, the new total, the delta, and a
-- JSON blob of the scope breakdown. If the delta is material (>5%), we also
-- notify the customer with a link to the provenance panel.
--
-- This turns otherwise-silent calculation changes into a transparent audit
-- event, which the GHG Protocol expects for any methodology update.

CREATE TABLE IF NOT EXISTS public.emission_reconciliation_snapshots (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year               integer NOT NULL,
  previous_total_kg  numeric,
  new_total_kg       numeric NOT NULL,
  delta_kg           numeric,
  delta_pct          numeric,
  previous_breakdown jsonb,
  new_breakdown      jsonb NOT NULL,
  reason             text,
  captured_at        timestamptz NOT NULL DEFAULT now(),
  notified_at        timestamptz,
  notified_to        text,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_emission_recon_org_year
  ON public.emission_reconciliation_snapshots (organization_id, year DESC, captured_at DESC);

ALTER TABLE public.emission_reconciliation_snapshots ENABLE ROW LEVEL SECURITY;

-- Only alkatera admins read/write these. The API route enforces role as well.
CREATE POLICY "Admins manage reconciliation snapshots" ON public.emission_reconciliation_snapshots
  FOR ALL
  USING (public.is_alkatera_admin())
  WITH CHECK (public.is_alkatera_admin());

COMMENT ON TABLE public.emission_reconciliation_snapshots IS
  'Audit trail for emissions methodology changes. Captures pre/post totals so customers can be notified when a recalculation moves their published footprint materially.';
