-- Supplier ESG Self-Assessment
-- Optional questionnaire that suppliers complete; verified by alkatera admins.

CREATE TABLE supplier_esg_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  -- Section completion flags
  labour_human_rights_completed boolean DEFAULT false,
  environment_completed boolean DEFAULT false,
  ethics_completed boolean DEFAULT false,
  health_safety_completed boolean DEFAULT false,
  management_systems_completed boolean DEFAULT false,

  -- Answers stored as JSONB (keyed by question_id → response value)
  answers jsonb DEFAULT '{}',

  -- Auto-calculated scores (0-100)
  score_labour integer,
  score_environment integer,
  score_ethics integer,
  score_health_safety integer,
  score_management integer,
  score_total integer,
  score_rating text, -- 'leader' | 'progressing' | 'needs_improvement'

  -- Submission
  submitted_at timestamptz,
  submitted boolean DEFAULT false,

  -- alkatera admin verification (same pattern as supplier_products)
  is_verified boolean DEFAULT false,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  verification_notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(supplier_id) -- one assessment per supplier
);

-- Add FK from suppliers to their assessment
ALTER TABLE suppliers ADD COLUMN esg_assessment_id uuid REFERENCES supplier_esg_assessments(id);

-- Enable RLS
ALTER TABLE supplier_esg_assessments ENABLE ROW LEVEL SECURITY;

-- Suppliers can view their own assessment
CREATE POLICY "Suppliers can view own ESG assessment"
  ON supplier_esg_assessments FOR SELECT
  USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
  );

-- Suppliers can insert their own assessment
CREATE POLICY "Suppliers can insert own ESG assessment"
  ON supplier_esg_assessments FOR INSERT
  WITH CHECK (
    supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
  );

-- Suppliers can update their own assessment
CREATE POLICY "Suppliers can update own ESG assessment"
  ON supplier_esg_assessments FOR UPDATE
  USING (
    supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    supplier_id IN (SELECT id FROM public.suppliers WHERE user_id = auth.uid())
  );

-- Org members can view assessments for suppliers in their org
CREATE POLICY "Org members can view supplier ESG assessments"
  ON supplier_esg_assessments FOR SELECT
  USING (
    supplier_id IN (
      SELECT s.id FROM public.suppliers s
      JOIN public.organization_members om ON om.organization_id = s.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Platform admins can view all assessments
CREATE POLICY "Admins can view all ESG assessments"
  ON supplier_esg_assessments FOR SELECT
  USING (is_alkatera_admin());

-- Platform admins can update all assessments (for verification)
CREATE POLICY "Admins can update all ESG assessments"
  ON supplier_esg_assessments FOR UPDATE
  USING (is_alkatera_admin())
  WITH CHECK (is_alkatera_admin());
