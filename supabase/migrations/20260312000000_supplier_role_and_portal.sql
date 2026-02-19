-- ==========================================================================
-- Supplier Role & Portal Migration
-- Adds supplier role, updates invitation schema, creates acceptance RPC,
-- and sets up RLS for supplier-portal access.
-- ==========================================================================

-- 1a. Add 'supplier' role
-- ==========================================================================
INSERT INTO public.roles (id, name, description)
VALUES (
  gen_random_uuid(),
  'supplier',
  'Limited supplier role. Can only view/edit own supplier profile and respond to data requests.'
)
ON CONFLICT (name) DO NOTHING;

-- 1b. Add contact_person_name to supplier_invitations
-- ==========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invitations'
      AND column_name = 'contact_person_name'
  ) THEN
    ALTER TABLE public.supplier_invitations ADD COLUMN contact_person_name text;
  END IF;
END$$;

-- 1c. Add user_id to suppliers table (links auth user to their supplier record)
-- ==========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.suppliers
      ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    CREATE INDEX idx_suppliers_user_id ON public.suppliers (user_id);
  END IF;
END$$;

-- 1d. Update validate_supplier_invitation_token RPC
-- Now returns: organization_name, contact_person_name, personal_message, inviter_name
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.validate_supplier_invitation_token(p_token text)
RETURNS TABLE(
  invitation_id uuid,
  organization_id uuid,
  organization_name text,
  product_id bigint,
  material_id uuid,
  material_name text,
  material_type text,
  supplier_email text,
  supplier_name text,
  contact_person_name text,
  invited_at timestamptz,
  expires_at timestamptz,
  personal_message text,
  inviter_name text,
  is_valid boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.organization_id,
    o.name,
    si.product_id,
    si.material_id,
    si.material_name,
    si.material_type,
    si.supplier_email,
    si.supplier_name,
    si.contact_person_name,
    si.invited_at,
    si.expires_at,
    si.personal_message,
    COALESCE(p.full_name, p.email) AS inviter_name,
    (si.status = 'pending' AND si.expires_at > now()) AS is_valid
  FROM public.supplier_invitations si
  JOIN public.organizations o ON o.id = si.organization_id
  LEFT JOIN public.profiles p ON p.id = si.invited_by
  WHERE si.invitation_token = p_token;
END;
$$;

COMMENT ON FUNCTION public.validate_supplier_invitation_token(text) IS
  'Validates supplier invitation token and returns full invitation context including org name and inviter.';

-- 1e. Create accept_supplier_invitation RPC
-- Transactional: creates supplier record, org membership, engagement, marks accepted
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
  );

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
  'Accepts a supplier invitation: creates supplier record and engagement. Removes any org membership to keep suppliers isolated.';

-- Grant execute to service_role (called from API routes)
GRANT EXECUTE ON FUNCTION public.accept_supplier_invitation(text, uuid) TO service_role;

-- 1f. RLS policies for supplier-role users
-- ==========================================================================

-- Suppliers can view their own supplier record (via user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'suppliers'
      AND policyname = 'Suppliers can view own record via user_id'
  ) THEN
    CREATE POLICY "Suppliers can view own record via user_id"
    ON public.suppliers FOR SELECT TO authenticated
    USING (user_id = auth.uid());
  END IF;
END$$;

-- Suppliers can update their own supplier record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'suppliers'
      AND policyname = 'Suppliers can update own record via user_id'
  ) THEN
    CREATE POLICY "Suppliers can update own record via user_id"
    ON public.suppliers FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- Suppliers can view the organization they belong to (via suppliers table)
-- This is needed because suppliers are NOT in organization_members,
-- so the standard "Allow members to view their organizations" policy won't apply.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'organizations'
      AND policyname = 'Suppliers can view their organization'
  ) THEN
    CREATE POLICY "Suppliers can view their organization"
    ON public.organizations FOR SELECT TO authenticated
    USING (
      id IN (
        SELECT s.organization_id FROM public.suppliers s
        WHERE s.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Suppliers can view their own invitations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_invitations'
      AND policyname = 'Suppliers can view own invitations by email'
  ) THEN
    CREATE POLICY "Suppliers can view own invitations by email"
    ON public.supplier_invitations FOR SELECT TO authenticated
    USING (lower(supplier_email) = lower((auth.jwt() ->> 'email')));
  END IF;
END$$;

-- Suppliers can view own supplier_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_products'
      AND policyname = 'Suppliers can view own supplier products'
  ) THEN
    CREATE POLICY "Suppliers can view own supplier products"
    ON public.supplier_products FOR SELECT TO authenticated
    USING (
      supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
    );
  END IF;
END$$;

-- Suppliers can insert own supplier_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_products'
      AND policyname = 'Suppliers can insert own supplier products'
  ) THEN
    CREATE POLICY "Suppliers can insert own supplier products"
    ON public.supplier_products FOR INSERT TO authenticated
    WITH CHECK (
      supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
    );
  END IF;
END$$;

-- Suppliers can update own supplier_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_products'
      AND policyname = 'Suppliers can update own supplier products'
  ) THEN
    CREATE POLICY "Suppliers can update own supplier products"
    ON public.supplier_products FOR UPDATE TO authenticated
    USING (
      supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
    )
    WITH CHECK (
      supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
    );
  END IF;
END$$;

-- Suppliers can view own data submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_data_submissions'
      AND policyname = 'Suppliers can view own data submissions'
  ) THEN
    CREATE POLICY "Suppliers can view own data submissions"
    ON public.supplier_data_submissions FOR SELECT TO authenticated
    USING (
      supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
    );
  END IF;
END$$;

-- Suppliers can create own data submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_data_submissions'
      AND policyname = 'Suppliers can create own data submissions'
  ) THEN
    CREATE POLICY "Suppliers can create own data submissions"
    ON public.supplier_data_submissions FOR INSERT TO authenticated
    WITH CHECK (
      supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
    );
  END IF;
END$$;

-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
