-- Add request response tracking to supplier_invitations.
--
-- The existing `status` column tracks invitation acceptance (joining the platform).
-- The new `request_status` column tracks whether the supplier has agreed to
-- provide data for the specific material/product requested.

ALTER TABLE supplier_invitations
  ADD COLUMN IF NOT EXISTS request_status text NOT NULL DEFAULT 'pending'
    CHECK (request_status IN ('pending', 'accepted', 'declined', 'completed')),
  ADD COLUMN IF NOT EXISTS request_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS request_decline_reason text;

-- Backfill: mark general invitations (no material) as 'accepted' since
-- there's nothing specific to respond to.
UPDATE supplier_invitations
SET request_status = 'accepted', request_responded_at = accepted_at
WHERE material_id IS NULL AND status = 'accepted';

-- Index for filtering by request_status
CREATE INDEX IF NOT EXISTS idx_supplier_invitations_request_status
  ON supplier_invitations(supplier_id, request_status);

-- Drop existing function first (return type is changing)
DROP FUNCTION IF EXISTS public.get_supplier_invitations(text);

-- Recreate the RPC with the new return fields
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
  organization_name text,
  request_status text,
  request_responded_at timestamptz,
  request_decline_reason text,
  personal_message text
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
    o.name AS organization_name,
    si.request_status,
    si.request_responded_at,
    si.request_decline_reason,
    si.personal_message
  FROM public.supplier_invitations si
  JOIN public.organizations o ON o.id = si.organization_id
  WHERE (
    si.supplier_id IN (
      SELECT s.id FROM public.suppliers s WHERE s.user_id = auth.uid()
    )
    OR (
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
  'Returns supplier invitations scoped to the authenticated user, including request response status.';

NOTIFY pgrst, 'reload schema';
