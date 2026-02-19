-- Migration: Ensure accepted suppliers appear on Platform Suppliers page
--
-- Problem: When a supplier accepts an invitation, only a `suppliers` record is created.
-- The Platform Suppliers admin page queries `platform_suppliers`, so accepted suppliers
-- never appear there. This migration:
-- 1. Updates accept_supplier_invitation RPC to also create platform_suppliers + organization_suppliers records
-- 2. Backfills existing accepted suppliers who are missing from platform_suppliers

-- ==========================================================================
-- 1. Update accept_supplier_invitation RPC
-- ==========================================================================
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
  v_user_email text;
  v_platform_supplier_id uuid;
BEGIN
  -- Get and validate invitation
  SELECT * INTO v_invitation
  FROM public.supplier_invitations
  WHERE invitation_token = p_token
    AND status = 'pending'
    AND expires_at > now();

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

  -- SECURITY: Do NOT add suppliers to organization_members.
  -- Suppliers are external users — their access is via the suppliers table only.
  -- If they somehow already have an org membership, remove it to prevent
  -- them from appearing in the Team Members list or accessing org data.
  DELETE FROM public.organization_members
  WHERE organization_id = v_invitation.organization_id
    AND user_id = p_user_id;

  -- Create engagement record
  INSERT INTO public.supplier_engagements (
    supplier_id, status, invited_date, accepted_date
  ) VALUES (
    v_supplier_id, 'active', v_invitation.invited_at::date, now()::date
  )
  ON CONFLICT (supplier_id) DO UPDATE SET
    status = 'active',
    accepted_date = COALESCE(supplier_engagements.accepted_date, now()::date);

  -- Create or find platform_suppliers record so admin can see and verify them.
  -- New suppliers appear as "Pending Verification" until an admin verifies them.
  SELECT id INTO v_platform_supplier_id
  FROM public.platform_suppliers
  WHERE lower(contact_email) = lower(v_invitation.supplier_email);

  IF v_platform_supplier_id IS NULL THEN
    INSERT INTO public.platform_suppliers (
      name, contact_email, contact_name, is_verified
    ) VALUES (
      COALESCE(v_invitation.supplier_name, 'Unnamed Supplier'),
      v_invitation.supplier_email,
      v_invitation.contact_person_name,
      false  -- Pending verification by admin
    )
    RETURNING id INTO v_platform_supplier_id;
  END IF;

  -- Link the inviting organization to this platform supplier
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_suppliers
    WHERE organization_id = v_invitation.organization_id
      AND platform_supplier_id = v_platform_supplier_id
  ) THEN
    INSERT INTO public.organization_suppliers (
      organization_id, platform_supplier_id
    ) VALUES (
      v_invitation.organization_id, v_platform_supplier_id
    );
  END IF;

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
  'Accepts a supplier invitation: creates supplier record, engagement, platform_suppliers entry (pending verification), and org link. Removes any org membership to keep suppliers isolated.';

-- Grant execute to service_role (called from API routes)
GRANT EXECUTE ON FUNCTION public.accept_supplier_invitation(text, uuid) TO service_role;


-- ==========================================================================
-- 2. Backfill: Create platform_suppliers records for existing accepted suppliers
-- ==========================================================================

-- Create platform_suppliers records for suppliers who accepted but don't have one
INSERT INTO public.platform_suppliers (name, contact_email, contact_name, is_verified)
SELECT DISTINCT ON (lower(s.contact_email))
  s.name,
  s.contact_email,
  s.contact_name,
  false  -- Pending verification
FROM public.suppliers s
WHERE s.contact_email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.platform_suppliers ps
    WHERE lower(ps.contact_email) = lower(s.contact_email)
  );

-- Link organizations to their backfilled platform suppliers
INSERT INTO public.organization_suppliers (organization_id, platform_supplier_id)
SELECT s.organization_id, ps.id
FROM public.suppliers s
JOIN public.platform_suppliers ps ON lower(ps.contact_email) = lower(s.contact_email)
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_suppliers os
  WHERE os.organization_id = s.organization_id
    AND os.platform_supplier_id = ps.id
);
