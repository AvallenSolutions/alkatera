-- Data access control: per-member section locks.
--
-- Until now, membership of an organisation meant read access to everything it
-- owned. The SELECT policy on people_employee_compensation is the clearest
-- case: "organization_id IN (the orgs you belong to)" and nothing more, so
-- every member could read every salary.
--
-- This migration adds the missing layer between "you are in the org" and "you
-- may read this". It is deliberately SPARSE and DEFAULT-OPEN: a row exists
-- only where someone has switched a section off for a named person, so nobody
-- loses access the moment this ships.
--
-- The app-side twin of can_access_section() is lib/auth/section-access.ts.
-- Both are needed: service-role API routes bypass RLS entirely, and direct
-- browser queries bypass the API routes. Neither layer is a backstop for the
-- other.

-- Wrong-database guard. This belongs to the alkatera schema (local dev now,
-- alkatera-staging at cutover). It drops and recreates policies, so failing
-- loudly in the wrong project beats half-applying there.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'people_employee_compensation'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spend_import_batches'
  ) THEN
    RAISE EXCEPTION 'WRONG DATABASE: this migration belongs to the alkatera schema';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.organization_section_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_key text NOT NULL CHECK (section_key IN ('pulse', 'financial', 'compensation')),
  granted boolean NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_section_access_unique UNIQUE (organization_id, user_id, section_key)
);

COMMENT ON TABLE public.organization_section_access IS
  'Per-member overrides for restrictable sections (see lib/access/sections.ts). Sparse and default-open: no row means allowed.';
COMMENT ON COLUMN public.organization_section_access.granted IS
  'FALSE denies the section for this user in this org. TRUE rows are redundant with the default but are kept so the UI can show a deliberate re-grant.';

CREATE INDEX IF NOT EXISTS idx_section_access_org_user
  ON public.organization_section_access (organization_id, user_id);

ALTER TABLE public.organization_section_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_section_access FORCE ROW LEVEL SECURITY;


-- ── The predicate ──────────────────────────────────────────────────────────
--
-- STABLE so Postgres may cache it per statement inside a policy. SECURITY
-- DEFINER so it can read organization_members and roles regardless of the
-- caller's own policies on those tables (the same shape as the existing
-- get_my_organization_role).
--
-- The owner is never restrictable. Without that, an org could lock itself out
-- of its own data with no way back in.

CREATE OR REPLACE FUNCTION public.can_access_section(org_id uuid, section text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  role_name text;
  is_granted boolean;
BEGIN
  IF org_id IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT r.name INTO role_name
  FROM organization_members om
  JOIN roles r ON r.id = om.role_id
  WHERE om.organization_id = org_id
    AND om.user_id = auth.uid();

  -- The owner always sees everything.
  IF role_name = 'owner' THEN
    RETURN true;
  END IF;

  SELECT sa.granted INTO is_granted
  FROM organization_section_access sa
  WHERE sa.organization_id = org_id
    AND sa.user_id = auth.uid()
    AND sa.section_key = section;

  -- No row means allowed.
  RETURN COALESCE(is_granted, true);
END;
$$;

ALTER FUNCTION public.can_access_section(uuid, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.can_access_section(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.can_access_section(uuid, text) IS
  'Default-open per-member section check. TRUE for the org owner always, else the stored grant, else TRUE.';


-- ── Who may read and write the overrides ───────────────────────────────────
--
-- Everyone may read their OWN rows (the client needs them to filter the
-- navigation). Owners and admins may read the whole org's rows to render the
-- Team settings grid.
--
-- Writes are NOT granted here to anyone: they go through
-- PATCH /api/team-members/[id]/section-access, which enforces the rules RLS
-- cannot express cleanly (an admin may not edit themselves, the owner, or
-- another admin). With no INSERT/UPDATE/DELETE policy, a direct browser write
-- is refused outright.

DROP POLICY IF EXISTS "Users can read their own section access" ON public.organization_section_access;
DROP POLICY IF EXISTS "Org admins can read section access for their organisation" ON public.organization_section_access;

CREATE POLICY "Users can read their own section access"
  ON public.organization_section_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Org admins can read section access for their organisation"
  ON public.organization_section_access
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.organization_id = organization_section_access.organization_id
        AND om.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
    )
  );

GRANT SELECT ON TABLE public.organization_section_access TO authenticated;
GRANT ALL ON TABLE public.organization_section_access TO service_role;


-- ── Close the compensation hole at the database ────────────────────────────
--
-- The existing SELECT policy checked org membership only. Replace it with the
-- same membership test AND the section predicate, so a restricted member gets
-- zero rows even on a direct PostgREST query that never touches our API.

DROP POLICY IF EXISTS "Users can view compensation data for their organization"
  ON public.people_employee_compensation;

CREATE POLICY "Users can view compensation data for their organization"
  ON public.people_employee_compensation
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    AND public.can_access_section(organization_id, 'compensation')
  );

-- A restricted member must not be able to write what they cannot read, or
-- they could overwrite pay data blind.
DROP POLICY IF EXISTS "Users can insert compensation data for their organization"
  ON public.people_employee_compensation;

CREATE POLICY "Users can insert compensation data for their organization"
  ON public.people_employee_compensation
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    AND public.can_access_section(organization_id, 'compensation')
  );

DROP POLICY IF EXISTS "Users can update compensation data for their organization"
  ON public.people_employee_compensation;

CREATE POLICY "Users can update compensation data for their organization"
  ON public.people_employee_compensation
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    AND public.can_access_section(organization_id, 'compensation')
  );

DROP POLICY IF EXISTS "Users can delete compensation data for their organization"
  ON public.people_employee_compensation;

CREATE POLICY "Users can delete compensation data for their organization"
  ON public.people_employee_compensation
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    AND public.can_access_section(organization_id, 'compensation')
  );


-- ── The advisor pass's broad SELECT policies ───────────────────────────────
--
-- 20260624120000_advisor_rls_comprehensive.sql swept ~17 org tables and added a
-- `<table>_select` policy to each, permitting anything
-- `user_has_organization_access(organization_id)` allows. Those are PERMISSIVE,
-- so they OR with the policies above and would let a restricted member straight
-- back in — the tightening below the fold would have been decoration.
--
-- Keep the advisor semantics (members AND active advisors) and add the section
-- predicate on top.

DROP POLICY IF EXISTS "people_employee_compensation_select" ON public.people_employee_compensation;

CREATE POLICY "people_employee_compensation_select"
  ON public.people_employee_compensation
  FOR SELECT TO authenticated
  USING (
    public.user_has_organization_access(organization_id)
    AND public.can_access_section(organization_id, 'compensation')
  );

-- All four verbs, not just SELECT: the advisor pass added an INSERT/UPDATE/
-- DELETE trio as well, and a restricted member who could still write would be
-- overwriting pay data blind.
DROP POLICY IF EXISTS "people_employee_compensation_insert" ON public.people_employee_compensation;

CREATE POLICY "people_employee_compensation_insert"
  ON public.people_employee_compensation
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_organization_access(organization_id)
    AND public.can_access_section(organization_id, 'compensation')
  );

DROP POLICY IF EXISTS "people_employee_compensation_update" ON public.people_employee_compensation;

CREATE POLICY "people_employee_compensation_update"
  ON public.people_employee_compensation
  FOR UPDATE TO authenticated
  USING (
    public.user_has_organization_access(organization_id)
    AND public.can_access_section(organization_id, 'compensation')
  )
  WITH CHECK (
    public.user_has_organization_access(organization_id)
    AND public.can_access_section(organization_id, 'compensation')
  );

DROP POLICY IF EXISTS "people_employee_compensation_delete" ON public.people_employee_compensation;

CREATE POLICY "people_employee_compensation_delete"
  ON public.people_employee_compensation
  FOR DELETE TO authenticated
  USING (
    public.user_has_organization_access(organization_id)
    AND public.can_access_section(organization_id, 'compensation')
  );

DROP POLICY IF EXISTS "spend_import_batches_select" ON public.spend_import_batches;

CREATE POLICY "spend_import_batches_select"
  ON public.spend_import_batches
  FOR SELECT TO authenticated
  USING (
    public.user_has_organization_access(organization_id)
    AND public.can_access_section(organization_id, 'financial')
  );

DROP POLICY IF EXISTS "spend_import_batches_insert" ON public.spend_import_batches;

CREATE POLICY "spend_import_batches_insert"
  ON public.spend_import_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_organization_access(organization_id)
    AND public.can_access_section(organization_id, 'financial')
  );

DROP POLICY IF EXISTS "spend_import_batches_update" ON public.spend_import_batches;

CREATE POLICY "spend_import_batches_update"
  ON public.spend_import_batches
  FOR UPDATE TO authenticated
  USING (
    public.user_has_organization_access(organization_id)
    AND public.can_access_section(organization_id, 'financial')
  )
  WITH CHECK (
    public.user_has_organization_access(organization_id)
    AND public.can_access_section(organization_id, 'financial')
  );

DROP POLICY IF EXISTS "spend_import_batches_delete" ON public.spend_import_batches;

CREATE POLICY "spend_import_batches_delete"
  ON public.spend_import_batches
  FOR DELETE TO authenticated
  USING (
    public.user_has_organization_access(organization_id)
    AND public.can_access_section(organization_id, 'financial')
  );


-- ── Close the spend ledger at the database ─────────────────────────────────
--
-- Both spend tables carry TWO overlapping permissive SELECT policies each,
-- left over from successive passes. Permissive policies OR together, so
-- adding the predicate to one of a pair would achieve nothing — the other
-- would still let the row through. Collapse each pair into a single policy
-- that carries the predicate.

DROP POLICY IF EXISTS "Users can view own organization spend imports" ON public.spend_import_batches;
DROP POLICY IF EXISTS "Users can view own organization's import batches" ON public.spend_import_batches;

CREATE POLICY "Users can view own organization spend imports"
  ON public.spend_import_batches
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM organization_members om
      WHERE om.user_id = auth.uid()
    )
    AND public.can_access_section(organization_id, 'financial')
  );

DROP POLICY IF EXISTS "Users can view own organization's import items" ON public.spend_import_items;
DROP POLICY IF EXISTS "Users can view spend import items for their batches" ON public.spend_import_items;

CREATE POLICY "Users can view spend import items for their batches"
  ON public.spend_import_items
  FOR SELECT TO authenticated
  USING (
    batch_id IN (
      SELECT b.id
      FROM spend_import_batches b
      WHERE b.organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
      AND public.can_access_section(b.organization_id, 'financial')
    )
  );

-- The item write policies check batch ownership but not the section, and the
-- subquery inside a policy is not itself RLS-filtered — so without this a
-- restricted member could still write line items into a batch they cannot see.
-- The importer route is already guarded, but the two layers must not disagree.
DROP POLICY IF EXISTS "Users can insert spend import items for their batches" ON public.spend_import_items;
DROP POLICY IF EXISTS "Users can insert import items for own organization" ON public.spend_import_items;

CREATE POLICY "Users can insert spend import items for their batches"
  ON public.spend_import_items
  FOR INSERT TO authenticated
  WITH CHECK (
    batch_id IN (
      SELECT b.id
      FROM spend_import_batches b
      WHERE b.organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
      AND public.can_access_section(b.organization_id, 'financial')
    )
  );

DROP POLICY IF EXISTS "Users can update spend import items for their batches" ON public.spend_import_items;

CREATE POLICY "Users can update spend import items for their batches"
  ON public.spend_import_items
  FOR UPDATE TO authenticated
  USING (
    batch_id IN (
      SELECT b.id
      FROM spend_import_batches b
      WHERE b.organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
      AND public.can_access_section(b.organization_id, 'financial')
    )
  );

DROP POLICY IF EXISTS "Users can delete spend import items for their batches" ON public.spend_import_items;
DROP POLICY IF EXISTS "Users can delete own organization's import items" ON public.spend_import_items;

CREATE POLICY "Users can delete spend import items for their batches"
  ON public.spend_import_items
  FOR DELETE TO authenticated
  USING (
    batch_id IN (
      SELECT b.id
      FROM spend_import_batches b
      WHERE b.organization_id IN (
        SELECT om.organization_id
        FROM organization_members om
        WHERE om.user_id = auth.uid()
      )
      AND public.can_access_section(b.organization_id, 'financial')
    )
  );
