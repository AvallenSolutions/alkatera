/*
  # Add Rosa Document Extraction Support

  This migration adds support for smart document extraction (Feature 4)
  and feedback pattern tracking (Feature 5).

  1. New Tables:
    - `rosa_document_extractions` - Stores document extraction jobs and results
    - `rosa_feedback_patterns` - Stores identified feedback patterns for learning

  2. Security:
    - RLS enabled on all tables
    - Users can only access their own organization's data
    - Admins can view all feedback patterns
*/

-- ============================================================================
-- Document Extraction Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rosa_document_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('utility_bill', 'invoice', 'waste_manifest', 'supplier_report', 'certificate', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'needs_review')),
  extracted_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  suggested_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_errors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Indexes for document extractions
CREATE INDEX IF NOT EXISTS idx_rosa_doc_extractions_org_id ON public.rosa_document_extractions(organization_id);
CREATE INDEX IF NOT EXISTS idx_rosa_doc_extractions_user_id ON public.rosa_document_extractions(user_id);
CREATE INDEX IF NOT EXISTS idx_rosa_doc_extractions_status ON public.rosa_document_extractions(status);
CREATE INDEX IF NOT EXISTS idx_rosa_doc_extractions_created_at ON public.rosa_document_extractions(created_at DESC);

-- Enable RLS
ALTER TABLE public.rosa_document_extractions ENABLE ROW LEVEL SECURITY;

-- Policies for document extractions
CREATE POLICY "Users can view own organization document extractions"
  ON public.rosa_document_extractions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create document extractions for own organization"
  ON public.rosa_document_extractions
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own document extractions"
  ON public.rosa_document_extractions
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own document extractions"
  ON public.rosa_document_extractions
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- Feedback Pattern Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rosa_feedback_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  pattern_hash TEXT GENERATED ALWAYS AS (md5(lower(pattern))) STORED,
  category TEXT NOT NULL,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN positive_count + negative_count > 0
      THEN (positive_count::numeric / (positive_count + negative_count)) * 100
      ELSE 0
    END
  ) STORED,
  last_occurrence TIMESTAMPTZ NOT NULL DEFAULT now(),
  suggested_knowledge_entry JSONB,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'addressed', 'ignored')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on pattern hash to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_rosa_feedback_patterns_hash ON public.rosa_feedback_patterns(pattern_hash);

-- Indexes for feedback patterns
CREATE INDEX IF NOT EXISTS idx_rosa_feedback_patterns_category ON public.rosa_feedback_patterns(category);
CREATE INDEX IF NOT EXISTS idx_rosa_feedback_patterns_status ON public.rosa_feedback_patterns(status);
CREATE INDEX IF NOT EXISTS idx_rosa_feedback_patterns_success_rate ON public.rosa_feedback_patterns(success_rate);
CREATE INDEX IF NOT EXISTS idx_rosa_feedback_patterns_negative_count ON public.rosa_feedback_patterns(negative_count DESC);

-- Enable RLS
ALTER TABLE public.rosa_feedback_patterns ENABLE ROW LEVEL SECURITY;

-- Policies for feedback patterns (admin only)
CREATE POLICY "Alkatera admins can view feedback patterns"
  ON public.rosa_feedback_patterns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organization_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND organization_id IN (
        SELECT id FROM public.organizations WHERE name = 'Alkatera'
      )
    )
  );

CREATE POLICY "Alkatera admins can manage feedback patterns"
  ON public.rosa_feedback_patterns
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organization_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
      AND organization_id IN (
        SELECT id FROM public.organizations WHERE name = 'Alkatera'
      )
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_rosa_feedback_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rosa_feedback_patterns_timestamp
  BEFORE UPDATE ON public.rosa_feedback_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_rosa_feedback_patterns_updated_at();

-- ============================================================================
-- Function to upsert feedback patterns
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_rosa_feedback_pattern(
  p_pattern TEXT,
  p_category TEXT,
  p_is_positive BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Try to insert or update the pattern
  INSERT INTO public.rosa_feedback_patterns (pattern, category, positive_count, negative_count)
  VALUES (
    p_pattern,
    p_category,
    CASE WHEN p_is_positive THEN 1 ELSE 0 END,
    CASE WHEN p_is_positive THEN 0 ELSE 1 END
  )
  ON CONFLICT (pattern_hash) DO UPDATE SET
    positive_count = rosa_feedback_patterns.positive_count + CASE WHEN p_is_positive THEN 1 ELSE 0 END,
    negative_count = rosa_feedback_patterns.negative_count + CASE WHEN p_is_positive THEN 0 ELSE 1 END,
    last_occurrence = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_rosa_feedback_pattern TO authenticated;

-- ============================================================================
-- Add comments
-- ============================================================================

COMMENT ON TABLE public.rosa_document_extractions IS 'Stores document extraction jobs and results for Rosa smart data entry';
COMMENT ON TABLE public.rosa_feedback_patterns IS 'Tracks feedback patterns for Rosa continuous learning and improvement';

COMMENT ON COLUMN public.rosa_document_extractions.extracted_fields IS 'Array of extracted field objects with value, confidence, and mapping suggestions';
COMMENT ON COLUMN public.rosa_document_extractions.suggested_actions IS 'Array of suggested database actions based on extracted data';
COMMENT ON COLUMN public.rosa_feedback_patterns.pattern IS 'Normalized question pattern for grouping similar questions';
COMMENT ON COLUMN public.rosa_feedback_patterns.suggested_knowledge_entry IS 'Auto-generated knowledge base entry suggestion based on this pattern';
