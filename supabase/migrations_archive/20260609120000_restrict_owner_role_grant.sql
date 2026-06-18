-- ==========================================================================
-- Restrict GRANTING the 'owner' role to existing owners only.
--
-- The existing RLS policies on organization_members let any owner OR admin
-- insert/update membership rows, with NO guard on the *target* role. So an
-- admin could mint a new owner via a direct PostgREST call (privilege
-- escalation), bypassing the owner-only gating in the Team UI and the
-- invite-member edge function.
--
-- These ALTERs add one rule to each WITH CHECK: "if the resulting role is
-- 'owner', the acting user must themselves be an owner of that organisation."
-- Admins keep full control over admin/member roles.
--
-- Legitimate first-owner creation (create-organization) and invite acceptance
-- run with the service-role key, which bypasses RLS, so they are unaffected.
-- ==========================================================================

ALTER POLICY "Admins can update member roles"
  ON public.organization_members
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND r.name = ANY (ARRAY['owner', 'admin'])
    )
    AND (
      role_id <> (SELECT id FROM public.roles WHERE name = 'owner')
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
        WHERE om.organization_id = organization_members.organization_id
          AND om.user_id = auth.uid()
          AND r.name = 'owner'
      )
    )
  );

ALTER POLICY "Admins can add members to organization"
  ON public.organization_members
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND r.name = ANY (ARRAY['owner', 'admin'])
    )
    AND (
      role_id <> (SELECT id FROM public.roles WHERE name = 'owner')
      OR EXISTS (
        SELECT 1 FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
        WHERE om.organization_id = organization_members.organization_id
          AND om.user_id = auth.uid()
          AND r.name = 'owner'
      )
    )
  );
