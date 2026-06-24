-- product_materials & packaging_material_components: extend write access to advisors
--
-- The `products` table policies already use user_has_organization_access(), so
-- advisors can view the recipe page. But the write policies on product_materials
-- and packaging_material_components only check organization_members, which blocks
-- advisors from saving packaging or ingredients — causing an RLS violation.
--
-- Fix: update those policies to use user_has_organization_access() (via a subquery
-- that resolves the org through the product). Also add restrictive advisor_ro_no_*
-- policies to block read-only advisors from writing to these tables.

-- ─── product_materials ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view materials for their organization's products" ON public.product_materials;
DROP POLICY IF EXISTS "Users can insert materials for their organization's products" ON public.product_materials;
DROP POLICY IF EXISTS "Users can update materials for their organization's products" ON public.product_materials;
DROP POLICY IF EXISTS "Users can delete materials for their organization's products" ON public.product_materials;

CREATE POLICY "Users can view materials for their organization's products"
  ON public.product_materials FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_materials.product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

CREATE POLICY "Users can insert materials for their organization's products"
  ON public.product_materials FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_materials.product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

CREATE POLICY "Users can update materials for their organization's products"
  ON public.product_materials FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_materials.product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_materials.product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

CREATE POLICY "Users can delete materials for their organization's products"
  ON public.product_materials FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_materials.product_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

-- Restrictive: block read-only advisors from writing
DROP POLICY IF EXISTS advisor_ro_no_insert ON public.product_materials;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.product_materials;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.product_materials;

CREATE POLICY advisor_ro_no_insert ON public.product_materials AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_materials.product_id
        AND public.is_readonly_advisor(p.organization_id)
    )
  );

CREATE POLICY advisor_ro_no_update ON public.product_materials AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_materials.product_id
        AND public.is_readonly_advisor(p.organization_id)
    )
  );

CREATE POLICY advisor_ro_no_delete ON public.product_materials AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_materials.product_id
        AND public.is_readonly_advisor(p.organization_id)
    )
  );

-- ─── packaging_material_components ─────────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage their packaging components" ON public.packaging_material_components;

CREATE POLICY "Users can manage their packaging components"
  ON public.packaging_material_components TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_materials pm
      JOIN public.products p ON p.id = pm.product_id
      WHERE pm.id = packaging_material_components.product_material_id
        AND public.user_has_organization_access(p.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.product_materials pm
      JOIN public.products p ON p.id = pm.product_id
      WHERE pm.id = packaging_material_components.product_material_id
        AND public.user_has_organization_access(p.organization_id)
    )
  );

-- Restrictive: block read-only advisors
DROP POLICY IF EXISTS advisor_ro_no_insert ON public.packaging_material_components;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.packaging_material_components;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.packaging_material_components;

CREATE POLICY advisor_ro_no_insert ON public.packaging_material_components AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1
      FROM public.product_materials pm
      JOIN public.products p ON p.id = pm.product_id
      WHERE pm.id = packaging_material_components.product_material_id
        AND public.is_readonly_advisor(p.organization_id)
    )
  );

CREATE POLICY advisor_ro_no_update ON public.packaging_material_components AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1
      FROM public.product_materials pm
      JOIN public.products p ON p.id = pm.product_id
      WHERE pm.id = packaging_material_components.product_material_id
        AND public.is_readonly_advisor(p.organization_id)
    )
  );

CREATE POLICY advisor_ro_no_delete ON public.packaging_material_components AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1
      FROM public.product_materials pm
      JOIN public.products p ON p.id = pm.product_id
      WHERE pm.id = packaging_material_components.product_material_id
        AND public.is_readonly_advisor(p.organization_id)
    )
  );
