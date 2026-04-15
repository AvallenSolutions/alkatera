-- =============================================================================
-- LCA Wizard Permanence + Reusable Templates
-- =============================================================================
-- Context: a user generated two LCA reports for the same product and ended up
-- with methodologically inconsistent outputs because the wizard didn't remember
-- Goal & Scope settings between sessions. This migration adds:
--   1. products.last_wizard_settings (JSONB) - per-product "last used" prefill
--   2. lca_report_templates table - org-scoped reusable wizard configs with
--      one optional "org default" that auto-applies to new products
--   3. Backfill of last_wizard_settings from the most recent PCF per product
-- =============================================================================


-- =============================================================================
-- 1. Per-product "last used wizard settings"
-- =============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS last_wizard_settings jsonb;

COMMENT ON COLUMN public.products.last_wizard_settings IS
  'Subset of WizardFormData (Omit functionalUnit / hasInterpretation / interpretationId / dqiScore) '
  'used for the most recent LCA run on this product. Prefills the wizard on next open. '
  'Excludes functional_unit (kept on its own products.functional_unit column).';


-- =============================================================================
-- 2. Org-scoped reusable wizard templates
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lca_report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_org_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_lca_template_name_per_org UNIQUE (organization_id, name)
);

COMMENT ON TABLE public.lca_report_templates IS
  'Org-scoped reusable LCA wizard configurations. settings is a subset of WizardFormData '
  '(excludes functional_unit and derived outputs). One template per org may be marked as '
  'is_org_default, enforced by the idx_lca_templates_one_default_per_org partial unique index '
  'and the enforce_single_lca_template_default trigger.';

COMMENT ON COLUMN public.lca_report_templates.settings IS
  'JSONB blob matching LcaWizardSettings = Omit<WizardFormData, functionalUnit | hasInterpretation | interpretationId | dqiScore>';

-- Enforce: at most one default template per org (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS idx_lca_templates_one_default_per_org
  ON public.lca_report_templates(organization_id)
  WHERE is_org_default = true;

CREATE INDEX IF NOT EXISTS idx_lca_templates_org
  ON public.lca_report_templates(organization_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_lca_report_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lca_report_templates_updated_at ON public.lca_report_templates;
CREATE TRIGGER trigger_lca_report_templates_updated_at
  BEFORE UPDATE ON public.lca_report_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_lca_report_templates_updated_at();

-- Trigger: clear any existing default in the same org before setting a new one.
-- Prevents races against the partial unique index and removes the need for
-- app-side transaction ordering when switching defaults.
CREATE OR REPLACE FUNCTION public.enforce_single_lca_template_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_org_default = true THEN
    UPDATE public.lca_report_templates
       SET is_org_default = false
     WHERE organization_id = NEW.organization_id
       AND id <> NEW.id
       AND is_org_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_single_lca_template_default ON public.lca_report_templates;
CREATE TRIGGER trigger_enforce_single_lca_template_default
  BEFORE INSERT OR UPDATE OF is_org_default ON public.lca_report_templates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_lca_template_default();


-- =============================================================================
-- 3. Row Level Security
-- =============================================================================
ALTER TABLE public.lca_report_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view lca templates" ON public.lca_report_templates;
CREATE POLICY "Org members can view lca templates"
  ON public.lca_report_templates FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Org members can create lca templates" ON public.lca_report_templates;
CREATE POLICY "Org members can create lca templates"
  ON public.lca_report_templates FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Org members can update lca templates" ON public.lca_report_templates;
CREATE POLICY "Org members can update lca templates"
  ON public.lca_report_templates FOR UPDATE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Org members can delete lca templates" ON public.lca_report_templates;
CREATE POLICY "Org members can delete lca templates"
  ON public.lca_report_templates FOR DELETE TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));


-- =============================================================================
-- 4. Backfill last_wizard_settings from the most recent PCF per product
-- =============================================================================
-- One-time backfill so existing products open the wizard with their most
-- recent configuration instead of a blank form. Only populates products that
-- don't already have a value, so the migration is safe to re-run in branched
-- environments.
WITH latest_pcf AS (
  SELECT DISTINCT ON (product_id)
    product_id,
    intended_application,
    reasons_for_study,
    intended_audience,
    is_comparative_assertion,
    system_boundary,
    cutoff_criteria,
    assumptions_limitations,
    data_quality_requirements,
    reference_year,
    critical_review_type,
    critical_review_justification,
    distribution_config,
    use_phase_config,
    eol_config,
    product_loss_config
  FROM public.product_carbon_footprints
  ORDER BY product_id, created_at DESC
)
UPDATE public.products p
SET last_wizard_settings = jsonb_strip_nulls(jsonb_build_object(
  'intendedApplication',         l.intended_application,
  'reasonsForStudy',             l.reasons_for_study,
  'intendedAudience',            to_jsonb(COALESCE(l.intended_audience, ARRAY[]::text[])),
  'isComparativeAssertion',      COALESCE(l.is_comparative_assertion, false),
  'systemBoundary',              l.system_boundary,
  'cutoffCriteria',              l.cutoff_criteria,
  'assumptions',                 COALESCE(l.assumptions_limitations, '[]'::jsonb),
  'dataQuality',                 COALESCE(l.data_quality_requirements, '{}'::jsonb),
  'referenceYear',               l.reference_year,
  'criticalReviewType',          l.critical_review_type,
  'criticalReviewJustification', l.critical_review_justification,
  'distributionConfig',          l.distribution_config,
  'usePhaseConfig',              l.use_phase_config,
  'eolConfig',                   l.eol_config,
  'productLossConfig',           l.product_loss_config
))
FROM latest_pcf l
WHERE p.id = l.product_id
  AND p.last_wizard_settings IS NULL;
