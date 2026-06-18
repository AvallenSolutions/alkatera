-- Migration: Fix register_supplier_public to link platform_suppliers.user_id
-- even when the supplier was previously registered (already_registered = true).
--
-- Previously, if a suppliers record already existed for the user, the function
-- returned early without linking user_id on platform_suppliers. This meant the
-- admin portal could not find the supplier's products via user_id lookup.

CREATE OR REPLACE FUNCTION public.register_supplier_public(
  p_user_id uuid,
  p_supplier_name text,
  p_contact_name text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id uuid;
  v_user_email text;
  v_platform_supplier_id uuid;
BEGIN
  -- 1. Get user email
  SELECT email INTO v_user_email
  FROM auth.users WHERE id = p_user_id;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- 2. Check if supplier record already exists for this user (idempotency)
  SELECT id INTO v_supplier_id
  FROM public.suppliers
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_supplier_id IS NOT NULL THEN
    -- Ensure platform_suppliers.user_id is linked even for previously registered suppliers
    UPDATE public.platform_suppliers
    SET user_id = p_user_id
    WHERE lower(contact_email) = lower(v_user_email)
      AND user_id IS NULL;

    RETURN jsonb_build_object(
      'success', true,
      'supplier_id', v_supplier_id,
      'already_registered', true
    );
  END IF;

  -- 3. Create supplier record (no organisation link)
  INSERT INTO public.suppliers (
    name, contact_email, contact_name, user_id
  ) VALUES (
    COALESCE(NULLIF(TRIM(p_supplier_name), ''), 'Unnamed Supplier'),
    v_user_email,
    p_contact_name,
    p_user_id
  )
  RETURNING id INTO v_supplier_id;

  -- 4. SECURITY: Remove any org membership (suppliers are external users)
  DELETE FROM public.organization_members
  WHERE user_id = p_user_id;

  -- 5. Create engagement record
  INSERT INTO public.supplier_engagements (
    supplier_id, status, accepted_date
  ) VALUES (
    v_supplier_id, 'active', now()::date
  )
  ON CONFLICT (supplier_id) DO UPDATE SET
    status = 'active',
    accepted_date = COALESCE(supplier_engagements.accepted_date, now()::date);

  -- 6. Create or find platform_suppliers record (visible to all orgs)
  SELECT id INTO v_platform_supplier_id
  FROM public.platform_suppliers
  WHERE lower(contact_email) = lower(v_user_email);

  IF v_platform_supplier_id IS NULL THEN
    INSERT INTO public.platform_suppliers (
      name, contact_email, contact_name, is_verified, user_id
    ) VALUES (
      COALESCE(NULLIF(TRIM(p_supplier_name), ''), 'Unnamed Supplier'),
      v_user_email,
      p_contact_name,
      false,
      p_user_id
    )
    RETURNING id INTO v_platform_supplier_id;
  ELSE
    -- Link user_id to existing platform supplier if not already set
    UPDATE public.platform_suppliers
    SET user_id = p_user_id
    WHERE id = v_platform_supplier_id AND user_id IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'supplier_id', v_supplier_id,
    'platform_supplier_id', v_platform_supplier_id
  );
END;
$$;

COMMENT ON FUNCTION public.register_supplier_public(uuid, text, text) IS
  'Self-service supplier registration: creates supplier record (no org), engagement, and platform_suppliers entry. Now also links platform_suppliers.user_id when already_registered, ensuring admin portal can always locate the linked supplier.';

-- Backfill: link any existing platform_suppliers that are missing user_id
UPDATE public.platform_suppliers ps
SET user_id = s.user_id
FROM public.suppliers s
WHERE lower(ps.contact_email) = lower(s.contact_email)
  AND s.user_id IS NOT NULL
  AND ps.user_id IS NULL;

NOTIFY pgrst, 'reload schema';
