-- Fix: get_supplier_invitations() must scope results to the authenticated
-- supplier's own records, not just email matching.
--
-- Previously, the RPC filtered only by email address, meaning any user
-- whose email matched an invitation would see it — even self-registered
-- suppliers who were never formally invited. This caused data requests
-- from other organisations to leak across suppliers.
--
-- The fix:
-- - Accepted invitations: filter by supplier_id linked to the current user
-- - Pending invitations: filter by email match (genuinely for this user)

CREATE OR REPLACE FUNCTION public.get_supplier_invitations(
  p_status text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  material_name text,
  material_type text,
  status public.supplier_invitation_status,
  invited_at timestamptz,
  accepted_at timestamptz,
  organization_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    COALESCE(si.material_name, 'General invitation') AS material_name,
    COALESCE(si.material_type, 'general') AS material_type,
    si.status,
    si.invited_at,
    si.accepted_at,
    o.name AS organization_name
  FROM public.supplier_invitations si
  JOIN public.organizations o ON o.id = si.organization_id
  WHERE (
    -- Accepted invitations: linked to this user's supplier record(s)
    si.supplier_id IN (
      SELECT s.id FROM public.suppliers s WHERE s.user_id = auth.uid()
    )
    OR (
      -- Pending invitations: not yet linked, match by email
      si.supplier_id IS NULL
      AND lower(si.supplier_email) = lower(
        (SELECT email FROM auth.users WHERE auth.users.id = auth.uid())
      )
    )
  )
  AND (p_status IS NULL OR si.status::text = p_status)
  ORDER BY si.invited_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_supplier_invitations(text) IS
  'Returns supplier invitations scoped to the authenticated user. Accepted invitations filter by supplier_id; pending invitations filter by email match.';

-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
