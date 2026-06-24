-- packaging_templates: extend write access to advisors
--
-- Same gap as product_materials (fixed in 20260624100000): policies used
-- organization_members directly, blocking advisors from saving templates.
-- Switch to user_has_organization_access() and add restrictive advisor_ro_no_*
-- policies matching the pattern on the other org data tables.

DROP POLICY IF EXISTS "Org members can view packaging templates" ON public.packaging_templates;
DROP POLICY IF EXISTS "Org members can create packaging templates" ON public.packaging_templates;
DROP POLICY IF EXISTS "Org members can update packaging templates" ON public.packaging_templates;
DROP POLICY IF EXISTS "Org members can delete packaging templates" ON public.packaging_templates;

CREATE POLICY "Org members can view packaging templates"
  ON public.packaging_templates FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Org members can create packaging templates"
  ON public.packaging_templates FOR INSERT TO authenticated
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Org members can update packaging templates"
  ON public.packaging_templates FOR UPDATE TO authenticated
  USING (public.user_has_organization_access(organization_id))
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Org members can delete packaging templates"
  ON public.packaging_templates FOR DELETE TO authenticated
  USING (public.user_has_organization_access(organization_id));

-- Restrictive: block read-only advisors from writing
DROP POLICY IF EXISTS advisor_ro_no_insert ON public.packaging_templates;
DROP POLICY IF EXISTS advisor_ro_no_update ON public.packaging_templates;
DROP POLICY IF EXISTS advisor_ro_no_delete ON public.packaging_templates;

CREATE POLICY advisor_ro_no_insert ON public.packaging_templates AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_readonly_advisor(organization_id));

CREATE POLICY advisor_ro_no_update ON public.packaging_templates AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_readonly_advisor(organization_id));

CREATE POLICY advisor_ro_no_delete ON public.packaging_templates AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_readonly_advisor(organization_id));
