-- Migration: Fix accept_supplier_invitation to set user_id on platform_suppliers
--
-- Previously, when a supplier accepted an invitation, the platform_suppliers record
-- was created or found without linking user_id. This caused the admin portal to
-- fail its user_id-based lookup, showing "Supplier has not yet created an account"
-- even when the supplier had an active account.

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

  -- Create or find platform_suppliers record — now also sets user_id so the
  -- admin portal can locate the supplier's account and products.
  SELECT id INTO v_platform_supplier_id
  FROM public.platform_suppliers
  WHERE lower(contact_email) = lower(v_invitation.supplier_email);

  IF v_platform_supplier_id IS NULL THEN
    INSERT INTO public.platform_suppliers (
      name, contact_email, contact_name, is_verified, user_id
    ) VALUES (
      COALESCE(v_invitation.supplier_name, 'Unnamed Supplier'),
      v_invitation.supplier_email,
      v_invitation.contact_person_name,
      false,
      p_user_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_platform_supplier_id;
  ELSE
    -- Link user_id to existing platform supplier if not already set
    UPDATE public.platform_suppliers
    SET user_id = p_user_id
    WHERE id = v_platform_supplier_id AND user_id IS NULL;
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
  'Accepts a supplier invitation: creates supplier record, platform directory entry (with user_id), org link, and engagement. Removes any org membership to keep suppliers isolated.';

NOTIFY pgrst, 'reload schema';
