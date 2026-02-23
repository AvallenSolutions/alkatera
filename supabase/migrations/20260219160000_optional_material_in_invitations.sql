-- Migration: Make product/material fields optional on supplier_invitations
-- Purpose: Allow "general" supplier invitations from the Suppliers page
--          that don't require a specific product or material context.
--          Material-specific invitations (from the Supply Chain Map) still work as before.

-- 1. Make columns nullable
ALTER TABLE public.supplier_invitations ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.supplier_invitations ALTER COLUMN material_id DROP NOT NULL;
ALTER TABLE public.supplier_invitations ALTER COLUMN material_name DROP NOT NULL;
ALTER TABLE public.supplier_invitations ALTER COLUMN material_type DROP NOT NULL;

-- 2. Update material_type check constraint to allow NULL
ALTER TABLE public.supplier_invitations DROP CONSTRAINT IF EXISTS supplier_invitations_material_type_check;
ALTER TABLE public.supplier_invitations ADD CONSTRAINT supplier_invitations_material_type_check
  CHECK (material_type IS NULL OR material_type = ANY (ARRAY['ingredient'::text, 'packaging'::text]));

-- 3. Update get_supplier_invitations RPC to handle nulls gracefully
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
  'Returns supplier invitations for the authenticated user. Handles nullable material fields for general invitations.';

-- 4. Update accept_supplier_invitation to also create a platform_suppliers record
--    so that accepted suppliers appear in the admin directory for verification.
CREATE OR REPLACE FUNCTION public.accept_supplier_invitation(
  p_token text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_supplier_id uuid;
  v_platform_supplier_id uuid;
  v_user_email text;
BEGIN
  -- Get and validate invitation (lock row to prevent race conditions)
  SELECT * INTO v_invitation
  FROM public.supplier_invitations
  WHERE invitation_token = p_token
    AND status = 'pending'
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Get user email for verification
  SELECT email INTO v_user_email
  FROM auth.users WHERE id = p_user_id;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check email matches invitation
  IF lower(v_user_email) != lower(v_invitation.supplier_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email does not match invitation');
  END IF;

  -- Create or find existing supplier record for this user+org
  SELECT id INTO v_supplier_id
  FROM public.suppliers
  WHERE user_id = p_user_id
    AND organization_id = v_invitation.organization_id;

  IF v_supplier_id IS NULL THEN
    INSERT INTO public.suppliers (
      organization_id, name, contact_email, contact_name, user_id
    ) VALUES (
      v_invitation.organization_id,
      COALESCE(v_invitation.supplier_name, 'Unnamed Supplier'),
      v_invitation.supplier_email,
      v_invitation.contact_person_name,
      p_user_id
    )
    RETURNING id INTO v_supplier_id;
  END IF;

  -- Create or find platform_suppliers record so supplier appears in admin directory
  SELECT id INTO v_platform_supplier_id
  FROM public.platform_suppliers
  WHERE contact_email = lower(v_invitation.supplier_email);

  IF v_platform_supplier_id IS NULL THEN
    INSERT INTO public.platform_suppliers (
      name, contact_email, contact_name, is_verified
    ) VALUES (
      COALESCE(v_invitation.supplier_name, 'Unnamed Supplier'),
      v_invitation.supplier_email,
      v_invitation.contact_person_name,
      false
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_platform_supplier_id;
  END IF;

  -- Link the organization to the platform supplier if not already linked
  IF v_platform_supplier_id IS NOT NULL THEN
    INSERT INTO public.organization_suppliers (
      organization_id, platform_supplier_id, engagement_status
    ) VALUES (
      v_invitation.organization_id, v_platform_supplier_id, 'active'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- SECURITY: Do NOT add suppliers to organization_members.
  DELETE FROM public.organization_members
  WHERE organization_id = v_invitation.organization_id
    AND user_id = p_user_id;

  -- Create engagement record
  INSERT INTO public.supplier_engagements (
    supplier_id, status, invited_date, accepted_date
  ) VALUES (
    v_supplier_id, 'active', v_invitation.invited_at::date, now()::date
  )
  ON CONFLICT DO NOTHING;

  -- Mark invitation as accepted
  UPDATE public.supplier_invitations
  SET status = 'accepted',
      accepted_at = now(),
      supplier_id = v_supplier_id
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'supplier_id', v_supplier_id,
    'organization_id', v_invitation.organization_id
  );
END;
$$;

COMMENT ON FUNCTION public.accept_supplier_invitation(text, uuid) IS
  'Accepts a supplier invitation: creates supplier record, platform directory entry, org link, and engagement. Removes any org membership to keep suppliers isolated.';
