-- Fix advisor invitation RLS regression from security hardening
--
-- The 20260403000000_security_hardening.sql migration dropped the
-- "Anyone can view invitation by token" policy (USING (true)) and replaced
-- it with an email-match policy for authenticated users only. This broke
-- the public advisor invite page (/advisor-invite/[token]) because:
--   1. Unauthenticated users have no policy allowing access
--   2. Even authenticated users can only see invitations matching their email
--
-- Fix: Create a SECURITY DEFINER RPC function that safely looks up a single
-- invitation by its cryptographic token. This avoids exposing the full table
-- while still allowing the invite page to work for anyone with a valid link.

CREATE OR REPLACE FUNCTION public.get_advisor_invitation_by_token(p_token UUID)
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'id', ai.id,
    'advisor_email', ai.advisor_email,
    'access_notes', ai.access_notes,
    'invited_at', ai.invited_at,
    'expires_at', ai.expires_at,
    'status', ai.status,
    'organization_name', o.name
  )
  FROM advisor_invitations ai
  JOIN organizations o ON o.id = ai.organization_id
  WHERE ai.invitation_token = p_token;
$$;

-- Grant execute to both anon (unauthenticated) and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_advisor_invitation_by_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_advisor_invitation_by_token(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_advisor_invitation_by_token(UUID)
  IS 'Safely look up a single advisor invitation by its cryptographic token. Used by the public invite page.';
