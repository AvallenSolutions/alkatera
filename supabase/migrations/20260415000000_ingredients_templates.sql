-- Ingredients Templates: allow users to save and reuse ingredient recipes across products,
-- with automatic volume-based scaling when applied to a product of a different size.
CREATE TABLE IF NOT EXISTS public.ingredients_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  source_volume_value numeric,
  source_volume_unit text,
  items jsonb NOT NULL DEFAULT '[]',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_ingredients_template_name_per_org UNIQUE (organization_id, name)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ingredients_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ingredients_templates_updated_at
  BEFORE UPDATE ON public.ingredients_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_ingredients_templates_updated_at();

-- Index for org lookups
CREATE INDEX IF NOT EXISTS idx_ingredients_templates_org
  ON public.ingredients_templates(organization_id);

-- RLS
ALTER TABLE public.ingredients_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view ingredients templates"
  ON public.ingredients_templates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = ingredients_templates.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can create ingredients templates"
  ON public.ingredients_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = ingredients_templates.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update ingredients templates"
  ON public.ingredients_templates FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = ingredients_templates.organization_id
      AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = ingredients_templates.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete ingredients templates"
  ON public.ingredients_templates FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = ingredients_templates.organization_id
      AND organization_members.user_id = auth.uid()
  ));
