-- ESG survey requests
--
-- Lets a brand send the ESG self-assessment ("survey") directly to a supplier.
-- Two changes support the feature:
--   1. A `request_kind` discriminator on supplier_invitations so an ESG survey
--      request is distinguishable from a material/data request or a general invite.
--   2. accept_supplier_invitation now ADOPTS a pre-created supplier record (one the
--      brand created at send time, with no user_id yet) instead of creating a
--      duplicate. This is what makes "auto-create the supplier record now, link it
--      on signup" work without leaving orphan rows.
--   3. get_supplier_invitations returns request_kind so the supplier portal can
--      surface ESG survey requests distinctly.

-- ==========================================================================
-- 1. request_kind discriminator
-- ==========================================================================
ALTER TABLE public.supplier_invitations
  ADD COLUMN IF NOT EXISTS request_kind text NOT NULL DEFAULT 'data'
    CHECK (request_kind IN ('data', 'esg_assessment'));

COMMENT ON COLUMN public.supplier_invitations.request_kind IS
  'Type of request: ''data'' (material/general data request, the default) or ''esg_assessment'' (brand has asked the supplier to complete the ESG self-assessment).';

CREATE INDEX IF NOT EXISTS idx_supplier_invitations_request_kind
  ON public.supplier_invitations(organization_id, request_kind);

-- ==========================================================================
-- 2. accept_supplier_invitation — adopt a pre-created supplier record
--    Based on 20261800300000 (latest), with supplier resolution extended.
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.accept_supplier_invitation(
  p_token text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $fn_accept$
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

  -- Resolve the supplier record, in priority order.
  -- (a) Invitation already points at a supplier record (e.g. one the brand
  --     auto-created when sending an ESG survey). Adopt it.
  IF v_invitation.supplier_id IS NOT NULL THEN
    v_supplier_id := v_invitation.supplier_id;
    UPDATE public.suppliers
    SET user_id = COALESCE(user_id, p_user_id),
        contact_name = COALESCE(contact_name, v_invitation.contact_person_name)
    WHERE id = v_supplier_id;
  END IF;

  -- (b) This user already has a supplier record in this org.
  IF v_supplier_id IS NULL THEN
    SELECT id INTO v_supplier_id
    FROM public.suppliers
    WHERE user_id = p_user_id
      AND organization_id = v_invitation.organization_id;
  END IF;

  -- (c) An org-scoped record exists for this email but has no user yet
  --     (brand created it at send time). Adopt it.
  IF v_supplier_id IS NULL THEN
    SELECT id INTO v_supplier_id
    FROM public.suppliers
    WHERE organization_id = v_invitation.organization_id
      AND user_id IS NULL
      AND lower(contact_email) = lower(v_invitation.supplier_email)
    ORDER BY created_at
    LIMIT 1;

    IF v_supplier_id IS NOT NULL THEN
      UPDATE public.suppliers
      SET user_id = p_user_id,
          contact_name = COALESCE(contact_name, v_invitation.contact_person_name)
      WHERE id = v_supplier_id;
    END IF;
  END IF;

  -- (d) Nothing to adopt — create a fresh record.
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

  -- Create or find platform_suppliers record (with user_id so the admin portal
  -- can locate the account).
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
    UPDATE public.platform_suppliers
    SET user_id = p_user_id
    WHERE id = v_platform_supplier_id AND user_id IS NULL;
  END IF;

  -- Link the organization to the platform supplier. If the link already exists
  -- (e.g. created with status 'invited' when the brand sent the survey), promote
  -- it to 'active' so the brand's supplier list reflects that the supplier joined.
  IF v_platform_supplier_id IS NOT NULL THEN
    INSERT INTO public.organization_suppliers (
      organization_id, platform_supplier_id, engagement_status
    ) VALUES (
      v_invitation.organization_id, v_platform_supplier_id, 'active'
    )
    ON CONFLICT (organization_id, platform_supplier_id)
    DO UPDATE SET engagement_status = 'active';
  END IF;

  -- SECURITY: Do NOT add suppliers to organization_members.
  DELETE FROM public.organization_members
  WHERE organization_id = v_invitation.organization_id
    AND user_id = p_user_id;

  -- Create or activate engagement record (a record may already exist from
  -- send time with status 'invited').
  INSERT INTO public.supplier_engagements (
    supplier_id, status, invited_date, accepted_date
  ) VALUES (
    v_supplier_id, 'active', v_invitation.invited_at::date, now()::date
  )
  ON CONFLICT (supplier_id) DO UPDATE SET
    status = 'active',
    accepted_date = COALESCE(public.supplier_engagements.accepted_date, now()::date);

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
$fn_accept$;

COMMENT ON FUNCTION public.accept_supplier_invitation(text, uuid) IS
  'Accepts a supplier invitation: adopts any pre-created supplier record (or creates one), links the platform directory entry, org link, and engagement. Removes any org membership to keep suppliers isolated.';

GRANT EXECUTE ON FUNCTION public.accept_supplier_invitation(text, uuid) TO service_role;

-- ==========================================================================
-- 3. get_supplier_invitations — expose request_kind
--    Based on 20260602300000 (latest), with request_kind added.
-- ==========================================================================
DROP FUNCTION IF EXISTS public.get_supplier_invitations(text);

CREATE OR REPLACE FUNCTION public.get_supplier_invitations(
  p_status text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  material_name text,
  material_type text,
  request_kind text,
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
AS $fn_get$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    COALESCE(si.material_name, 'General invitation') AS material_name,
    COALESCE(si.material_type, 'general') AS material_type,
    si.request_kind,
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
$fn_get$;

COMMENT ON FUNCTION public.get_supplier_invitations(text) IS
  'Returns supplier invitations scoped to the authenticated user, including request response status and request_kind.';

NOTIFY pgrst, 'reload schema';
