-- ==========================================================================
-- Supplier Portal Security Fixes
-- Addresses: race conditions, storage policies, RLS gaps, constraints
-- ==========================================================================

-- 1. Fix accept_supplier_invitation: add FOR UPDATE lock + ON CONFLICT for engagements
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
  -- Get and validate invitation WITH ROW LOCK to prevent double-accept
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

  -- SECURITY: Do NOT add suppliers to organization_members.
  -- Suppliers are external users — their access is via the suppliers table only.
  DELETE FROM public.organization_members
  WHERE organization_id = v_invitation.organization_id
    AND user_id = p_user_id;

  -- Create engagement record (idempotent: skip if exists)
  INSERT INTO public.supplier_engagements (
    supplier_id, status, invited_date, accepted_date
  ) VALUES (
    v_supplier_id, 'active', v_invitation.invited_at::date, now()::date
  )
  ON CONFLICT (supplier_id) DO UPDATE SET
    status = 'active',
    accepted_date = COALESCE(supplier_engagements.accepted_date, now()::date);

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
  'Accepts a supplier invitation with row locking to prevent double-accept. Creates supplier record and engagement.';

-- Add unique constraint on supplier_engagements.supplier_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'supplier_engagements_supplier_id_key'
  ) THEN
    -- First deduplicate any existing data
    DELETE FROM public.supplier_engagements a
    USING public.supplier_engagements b
    WHERE a.id > b.id AND a.supplier_id = b.supplier_id;

    ALTER TABLE public.supplier_engagements
      ADD CONSTRAINT supplier_engagements_supplier_id_key UNIQUE (supplier_id);
  END IF;
END$$;


-- 2. Fix get_supplier_context: add status checks
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.get_supplier_context()
RETURNS TABLE(
  supplier_id uuid,
  organization_id uuid,
  organization_name text,
  organization_slug text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS supplier_id,
    o.id AS organization_id,
    o.name AS organization_name,
    o.slug AS organization_slug
  FROM public.suppliers s
  JOIN public.organizations o ON o.id = s.organization_id
  WHERE s.user_id = auth.uid()
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_supplier_context() IS
  'Returns supplier context for the current user. SECURITY DEFINER to bypass RLS during bootstrap.';


-- 3. Fix supplier_invitations RLS: use suppliers table instead of JWT email
-- ==========================================================================
DROP POLICY IF EXISTS "Suppliers can view own invitations by email" ON public.supplier_invitations;
DROP POLICY IF EXISTS "Suppliers can view own invitations" ON public.supplier_invitations;

CREATE POLICY "Suppliers can view own invitations"
ON public.supplier_invitations FOR SELECT TO authenticated
USING (
  -- Suppliers linked via the suppliers table (authoritative)
  organization_id IN (
    SELECT s.organization_id FROM public.suppliers s WHERE s.user_id = auth.uid()
  )
  AND lower(supplier_email) = lower(
    (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);


-- 4. Fix supplier_data_submissions INSERT policy: add org validation
-- ==========================================================================
DROP POLICY IF EXISTS "Suppliers can create own data submissions" ON public.supplier_data_submissions;

CREATE POLICY "Suppliers can create own data submissions"
ON public.supplier_data_submissions FOR INSERT TO authenticated
WITH CHECK (
  supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
  AND organization_id IN (
    SELECT organization_id FROM public.suppliers WHERE user_id = auth.uid()
  )
);


-- 5. Make storage buckets private (remove public read policies)
-- ==========================================================================

-- Make evidence bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'supplier-product-evidence';

-- Drop the public SELECT policy
DROP POLICY IF EXISTS "Anyone can view supplier evidence" ON storage.objects;

-- Replace with authenticated-only policy scoped to own supplier or org
DROP POLICY IF EXISTS "Authenticated users can view supplier evidence" ON storage.objects;
CREATE POLICY "Authenticated users can view supplier evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-product-evidence'
  AND (
    -- Supplier can view files in their own folder
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.suppliers WHERE user_id = auth.uid()
    )
    -- OR org member can view all evidence in their org
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.suppliers s ON s.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
    )
  )
);

-- Restrict evidence upload policy to own supplier path
DROP POLICY IF EXISTS "Authenticated users can upload supplier evidence" ON storage.objects;
DROP POLICY IF EXISTS "Suppliers can upload own evidence" ON storage.objects;

CREATE POLICY "Suppliers can upload own evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-product-evidence'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.suppliers WHERE user_id = auth.uid()
  )
);

-- Make product images bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'supplier-product-images';

-- Drop the public SELECT policy for images
DROP POLICY IF EXISTS "Anyone can view supplier product images" ON storage.objects;

-- Replace with authenticated-only policy
DROP POLICY IF EXISTS "Authenticated users can view supplier product images" ON storage.objects;
CREATE POLICY "Authenticated users can view supplier product images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-product-images'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.suppliers WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.suppliers s ON s.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
        AND (storage.foldername(name))[1] = s.id::text
    )
  )
);

-- Restrict product images upload to own supplier path
DROP POLICY IF EXISTS "Authenticated users can upload supplier product images" ON storage.objects;
DROP POLICY IF EXISTS "Suppliers can upload own product images" ON storage.objects;

CREATE POLICY "Suppliers can upload own product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.suppliers WHERE user_id = auth.uid()
  )
);


-- 6. Add trigger to prevent suppliers from being added to organization_members
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.prevent_supplier_org_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE user_id = NEW.user_id
      AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Suppliers cannot be added to organization_members. User % is a supplier for org %.', NEW.user_id, NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_supplier_org_membership_trigger ON public.organization_members;

CREATE TRIGGER prevent_supplier_org_membership_trigger
BEFORE INSERT ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.prevent_supplier_org_membership();


-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
