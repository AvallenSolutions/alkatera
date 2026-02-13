-- =============================================================================
-- EPR: Submissions table
-- =============================================================================
-- Tracks RPD (Report Packaging Data) submission batches.
-- Each submission covers a reporting period (H1, H2, or P0 for small producers)
-- and contains multiple line items (epr_submission_lines).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.epr_submissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Submission metadata
  submission_period text NOT NULL,        -- '2025-H1', '2025-H2', '2025-P0'
  fee_year text NOT NULL,                 -- '2025-26', '2026-27'
  organization_size text NOT NULL         -- 'L' (Large) or 'S' (Small)
    CHECK (organization_size IN ('L', 'S')),
  status text DEFAULT 'draft' NOT NULL
    CHECK (status IN ('draft', 'ready', 'submitted', 'amended')),

  -- Computed totals (denormalized for dashboard display)
  total_packaging_weight_kg numeric DEFAULT 0 NOT NULL,
  total_estimated_fee_gbp numeric DEFAULT 0 NOT NULL,
  total_line_items integer DEFAULT 0 NOT NULL,

  -- Material breakdown (denormalized JSONB for quick dashboard rendering)
  material_summary jsonb DEFAULT '{}',

  -- CSV export tracking
  csv_generated_at timestamptz,
  csv_storage_path text,                  -- Supabase Storage path
  csv_checksum text,                      -- SHA-256 for integrity verification

  -- Submission tracking
  submitted_to_rpd_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id),
  notes text,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- One submission per org per period per fee year
  CONSTRAINT unique_submission UNIQUE (organization_id, submission_period, fee_year)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_epr_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_epr_submissions_updated_at
  BEFORE UPDATE ON public.epr_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_epr_submissions_updated_at();

-- RLS
ALTER TABLE public.epr_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view submissions"
  ON public.epr_submissions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_submissions.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can manage submissions"
  ON public.epr_submissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_submissions.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update submissions"
  ON public.epr_submissions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_submissions.organization_id
      AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_submissions.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete draft submissions"
  ON public.epr_submissions FOR DELETE TO authenticated
  USING (
    status = 'draft'
    AND EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = epr_submissions.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_epr_submissions_org ON public.epr_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_epr_submissions_period ON public.epr_submissions(submission_period, fee_year);

-- Comments
COMMENT ON TABLE public.epr_submissions IS
  'RPD submission batches. Each covers a reporting period (H1 Jan-Jun, H2 Jul-Dec for Large; P0 full year for Small).';
COMMENT ON COLUMN public.epr_submissions.csv_checksum IS
  'SHA-256 hash of the generated CSV file for integrity verification during audit.';
COMMENT ON COLUMN public.epr_submissions.material_summary IS
  'Denormalized JSONB: { "GL": { weight_kg: 1500, fee_gbp: 288, count: 5 }, ... } for dashboard charts.';
