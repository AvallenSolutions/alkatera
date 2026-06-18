-- Reduction initiatives: the action layer between sustainability targets and
-- execution. An initiative is a concrete project (who, what, by when, with
-- what budget) that attacks one or more targets. Initiatives go through an
-- approval workflow (draft -> pending_approval -> active -> completed) and,
-- once active, auto-evidence B Corp requirement IT5-Y3-002 (Emissions
-- Reduction Plan) via lib/certifications/platform-data.ts.
--
-- Standalone + idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.reduction_initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  title text NOT NULL,
  description text,

  -- Matches ABATEMENT_LEVERS[].id in lib/pulse/abatement-costs.ts (code-side
  -- registry, deliberately no FK so levers can evolve without migrations).
  lever_id text,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'active', 'completed', 'cancelled')),

  -- Approval trail (mirrors the circularity_targets approved_by/at precedent)
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,

  -- Ownership: a platform user when possible, free text otherwise (small
  -- producers often assign actions to people who are not platform users yet)
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name text,

  start_date date,
  end_date date,

  budget_estimated_gbp numeric,
  budget_approved_gbp numeric,
  budget_spent_gbp numeric,

  -- Expected impact, in the unit of the linked target's metric
  -- (prefilled 'tCO2e per year' when created from a MACC lever)
  expected_annual_reduction_value numeric,
  expected_annual_reduction_unit text,
  actual_impact_notes text,

  -- Progress. progress_updated_at is the freshness signal the B Corp
  -- IT5-Y3-002 rule keys on ("tracked progress").
  percent_complete integer NOT NULL DEFAULT 0
    CHECK (percent_complete BETWEEN 0 AND 100),
  progress_notes text,
  progress_updated_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.reduction_initiatives IS
  'Action-plan initiatives linked to sustainability_targets. Active/completed initiatives auto-evidence B Corp IT5-Y3-002.';

-- An initiative can serve several targets (e.g. lightweight glass reduces
-- both a CO2e target and a packaging waste target).
CREATE TABLE IF NOT EXISTS public.initiative_target_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL REFERENCES public.reduction_initiatives(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.sustainability_targets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT initiative_target_links_unique UNIQUE (initiative_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_reduction_initiatives_org_status
  ON public.reduction_initiatives (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_initiative_target_links_target
  ON public.initiative_target_links (target_id);
CREATE INDEX IF NOT EXISTS idx_initiative_target_links_initiative
  ON public.initiative_target_links (initiative_id);

-- ============================================================================
-- RLS (mirrors sustainability_targets policies; defence in depth — the API
-- routes use the service-role client and enforce org scoping + roles in code)
-- ============================================================================

ALTER TABLE public.reduction_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.initiative_target_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reduction_initiatives_member_read" ON public.reduction_initiatives;
CREATE POLICY "reduction_initiatives_member_read"
  ON public.reduction_initiatives FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Any member can draft an initiative and update progress; the approval
-- transition itself is enforced in the API layer.
DROP POLICY IF EXISTS "reduction_initiatives_member_insert" ON public.reduction_initiatives;
CREATE POLICY "reduction_initiatives_member_insert"
  ON public.reduction_initiatives FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reduction_initiatives_member_update" ON public.reduction_initiatives;
CREATE POLICY "reduction_initiatives_member_update"
  ON public.reduction_initiatives FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reduction_initiatives_admin_delete" ON public.reduction_initiatives;
CREATE POLICY "reduction_initiatives_admin_delete"
  ON public.reduction_initiatives FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "initiative_target_links_member_read" ON public.initiative_target_links;
CREATE POLICY "initiative_target_links_member_read"
  ON public.initiative_target_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reduction_initiatives ri
      WHERE ri.id = initiative_id
        AND ri.organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
    )
  );

-- ============================================================================
-- Approval-workflow guard. RLS lets any member UPDATE rows (so they can edit
-- drafts and log progress), but the status column is the approval gate, so
-- transitions are validated here, in the database, where a crafted direct
-- client call cannot bypass them. Mirrors canTransition() in
-- lib/pulse/initiative-status.ts.
-- The service-role client (auth.uid() IS NULL) is exempt: API routes
-- re-validate via canTransition() before writing.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_initiative_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_role text;
  is_initiative_owner boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Service-role / system paths have no auth context.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.name INTO viewer_role
  FROM public.organization_members om
  JOIN public.roles r ON r.id = om.role_id
  WHERE om.organization_id = OLD.organization_id
    AND om.user_id = auth.uid()
  LIMIT 1;

  is_initiative_owner := auth.uid() = OLD.owner_user_id OR auth.uid() = OLD.created_by;

  IF NOT (
    -- submit: any member
    (OLD.status = 'draft' AND NEW.status = 'pending_approval')
    -- approve / reject: owner or admin only
    OR (OLD.status = 'pending_approval' AND NEW.status = 'active' AND viewer_role IN ('owner', 'admin'))
    OR (OLD.status = 'pending_approval' AND NEW.status = 'draft' AND viewer_role IN ('owner', 'admin'))
    -- complete: admin or the initiative's owner
    OR (OLD.status = 'active' AND NEW.status = 'completed' AND (viewer_role IN ('owner', 'admin') OR is_initiative_owner))
    -- cancel: admin or the initiative's owner
    OR (OLD.status IN ('active', 'pending_approval') AND NEW.status = 'cancelled' AND (viewer_role IN ('owner', 'admin') OR is_initiative_owner))
  ) THEN
    RAISE EXCEPTION 'This status change is not allowed (from % to %)', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_initiative_status ON public.reduction_initiatives;
CREATE TRIGGER trg_enforce_initiative_status
  BEFORE UPDATE OF status ON public.reduction_initiatives
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_initiative_status_transition();

DROP POLICY IF EXISTS "initiative_target_links_member_write" ON public.initiative_target_links;
CREATE POLICY "initiative_target_links_member_write"
  ON public.initiative_target_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reduction_initiatives ri
      WHERE ri.id = initiative_id
        AND ri.organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reduction_initiatives ri
      WHERE ri.id = initiative_id
        AND ri.organization_id IN (
          SELECT om.organization_id FROM public.organization_members om
          WHERE om.user_id = auth.uid()
        )
    )
  );
