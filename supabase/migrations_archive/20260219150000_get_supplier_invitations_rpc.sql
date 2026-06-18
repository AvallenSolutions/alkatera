-- ==========================================================================
-- Add SECURITY DEFINER RPC to fetch supplier invitations
-- Bypasses RLS on supplier_invitations (which blocks supplier users
-- due to conflicting policies from multiple migrations).
-- ==========================================================================

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
    si.material_name,
    si.material_type,
    si.status,
    si.invited_at,
    si.accepted_at,
    o.name AS organization_name
  FROM public.supplier_invitations si
  JOIN public.organizations o ON o.id = si.organization_id
  WHERE lower(si.supplier_email) = lower(
    (SELECT email FROM auth.users WHERE auth.users.id = auth.uid())
  )
  AND (p_status IS NULL OR si.status::text = p_status)
  ORDER BY si.invited_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_supplier_invitations(text) IS
  'Returns supplier invitations for the current user. SECURITY DEFINER to bypass RLS.';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_supplier_invitations(text) TO authenticated;
