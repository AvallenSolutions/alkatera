-- Packaging Templates: allow users to save and reuse packaging configurations across products
CREATE TABLE IF NOT EXISTS public.packaging_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  items jsonb NOT NULL DEFAULT '[]',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_template_name_per_org UNIQUE (organization_id, name)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_packaging_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_packaging_templates_updated_at
  BEFORE UPDATE ON public.packaging_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_packaging_templates_updated_at();

-- Index for org lookups
CREATE INDEX IF NOT EXISTS idx_packaging_templates_org
  ON public.packaging_templates(organization_id);

-- RLS
ALTER TABLE public.packaging_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view packaging templates"
  ON public.packaging_templates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = packaging_templates.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can create packaging templates"
  ON public.packaging_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = packaging_templates.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update packaging templates"
  ON public.packaging_templates FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = packaging_templates.organization_id
      AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = packaging_templates.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete packaging templates"
  ON public.packaging_templates FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = packaging_templates.organization_id
      AND organization_members.user_id = auth.uid()
  ));
