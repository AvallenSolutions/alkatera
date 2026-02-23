-- Migration: Self-service supplier registration (org-independent)
--
-- Allows suppliers to register via a generic shareable URL (/supplier-register)
-- without being linked to any specific organisation. Suppliers are globally
-- visible to all organisations via platform_suppliers.
--
-- Changes:
-- 1. Make suppliers.organization_id nullable (allow org-independent suppliers)
-- 2. Make supplier_products.organization_id nullable
-- 3. Add user_id column to platform_suppliers (links auth users to global directory)
-- 4. Update get_supplier_context() to use LEFT JOIN (handles null org)
-- 5. Create register_supplier_public() RPC for self-service registration
-- 6. Add RLS on platform_suppliers for all authenticated users


-- ==========================================================================
-- 1. Make suppliers.organization_id nullable
-- ==========================================================================
ALTER TABLE public.suppliers
  ALTER COLUMN organization_id DROP NOT NULL;


-- ==========================================================================
-- 2. Make supplier_products.organization_id nullable
-- ==========================================================================
ALTER TABLE public.supplier_products
  ALTER COLUMN organization_id DROP NOT NULL;


-- ==========================================================================
-- 3. Add user_id to platform_suppliers
-- ==========================================================================
ALTER TABLE public.platform_suppliers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_platform_suppliers_user_id
  ON public.platform_suppliers(user_id) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.platform_suppliers.user_id IS
  'Links platform supplier record to an auth user. Set during self-service registration or invitation acceptance.';


-- ==========================================================================
-- 4. Update get_supplier_context() to handle null organisation
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
  LEFT JOIN public.organizations o ON o.id = s.organization_id
  WHERE s.user_id = auth.uid()
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_supplier_context() IS
  'Returns supplier context for the current user. Uses LEFT JOIN so suppliers without an organisation still return a row. SECURITY DEFINER to bypass RLS during bootstrap.';


-- ==========================================================================
-- 5. Create register_supplier_public() RPC
-- ==========================================================================
-- Drop old org-specific version if it exists
DROP FUNCTION IF EXISTS public.register_supplier_self_service(uuid, uuid, text, text);

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
  'Self-service supplier registration: creates supplier record (no org), engagement, and platform_suppliers entry (visible to all orgs, pending verification). Passwords handled client-side.';

GRANT EXECUTE ON FUNCTION public.register_supplier_public(uuid, text, text) TO service_role;


-- ==========================================================================
-- 6. RLS on platform_suppliers: all authenticated users can view
-- ==========================================================================
ALTER TABLE public.platform_suppliers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view all platform suppliers
DROP POLICY IF EXISTS "Authenticated users can view platform suppliers" ON public.platform_suppliers;
CREATE POLICY "Authenticated users can view platform suppliers"
ON public.platform_suppliers FOR SELECT TO authenticated
USING (true);

-- Suppliers can update their own platform supplier record
DROP POLICY IF EXISTS "Suppliers can update own platform supplier" ON public.platform_suppliers;
CREATE POLICY "Suppliers can update own platform supplier"
ON public.platform_suppliers FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());


-- ==========================================================================
-- 7. Backfill: link existing platform_suppliers to auth users
-- ==========================================================================
UPDATE public.platform_suppliers ps
SET user_id = s.user_id
FROM public.suppliers s
WHERE lower(ps.contact_email) = lower(s.contact_email)
  AND s.user_id IS NOT NULL
  AND ps.user_id IS NULL;


-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
