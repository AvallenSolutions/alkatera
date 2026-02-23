-- Fix: get_supplier_context() must use LEFT JOIN so self-registered suppliers
-- (with NULL organization_id) still return a row.
--
-- Migration 20260312 inadvertently overwrote the LEFT JOIN from 20260223
-- with an INNER JOIN, causing self-registered suppliers to be treated as
-- regular users and redirected to /create-organization.

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

-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
