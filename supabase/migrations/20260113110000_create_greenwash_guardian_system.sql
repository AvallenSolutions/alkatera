/*
  # Create Greenwash Guardian System

  1. New Table: `greenwash_assessments`
    - Stores assessment metadata and results
    - Links to organization

  2. New Table: `greenwash_assessment_claims`
    - Individual claims identified in the assessment
    - RAG rating per claim
    - Legislation references

  3. Security
    - RLS policies for organization-scoped access
*/

-- ============================================================================
-- STEP 1: Create greenwash_assessments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.greenwash_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Input metadata
  title TEXT NOT NULL,
  input_type TEXT NOT NULL CHECK (input_type IN ('url', 'document', 'text', 'social_media')),
  input_source TEXT, -- URL, filename, or 'manual_input'
  input_content TEXT, -- Stored content for reference

  -- Analysis results
  overall_risk_level TEXT CHECK (overall_risk_level IN ('low', 'medium', 'high')),
  overall_risk_score INTEGER CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
  summary TEXT,
  recommendations JSONB DEFAULT '[]'::jsonb,

  -- Legislation applied
  legislation_applied JSONB DEFAULT '[]'::jsonb,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_greenwash_assessments_org_id
ON public.greenwash_assessments(organization_id);

CREATE INDEX IF NOT EXISTS idx_greenwash_assessments_created_by
ON public.greenwash_assessments(created_by);

CREATE INDEX IF NOT EXISTS idx_greenwash_assessments_status
ON public.greenwash_assessments(status);

CREATE INDEX IF NOT EXISTS idx_greenwash_assessments_created_at
ON public.greenwash_assessments(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_greenwash_assessments_updated_at
BEFORE UPDATE ON public.greenwash_assessments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.greenwash_assessments IS 'Stores greenwash risk assessments for marketing content analysis';
COMMENT ON COLUMN public.greenwash_assessments.input_type IS 'Type of input: url, document, text, or social_media';
COMMENT ON COLUMN public.greenwash_assessments.overall_risk_level IS 'RAG rating: low (green), medium (amber), high (red)';
COMMENT ON COLUMN public.greenwash_assessments.overall_risk_score IS 'Numeric risk score 0-100 (higher = more risk)';

-- ============================================================================
-- STEP 2: Create greenwash_assessment_claims table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.greenwash_assessment_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.greenwash_assessments(id) ON DELETE CASCADE,

  -- Claim details
  claim_text TEXT NOT NULL,
  claim_context TEXT, -- Surrounding context from source

  -- Risk assessment
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),

  -- Issue analysis
  issue_type TEXT, -- e.g., 'vague_claim', 'unsubstantiated', 'misleading_comparison'
  issue_description TEXT NOT NULL,

  -- Legislation reference
  legislation_name TEXT NOT NULL,
  legislation_article TEXT, -- Specific article/section reference
  legislation_jurisdiction TEXT CHECK (legislation_jurisdiction IN ('uk', 'eu', 'both')),

  -- Remediation
  suggestion TEXT NOT NULL,
  suggested_revision TEXT, -- Optional rewritten version of the claim

  -- Ordering
  display_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_greenwash_claims_assessment_id
ON public.greenwash_assessment_claims(assessment_id);

CREATE INDEX IF NOT EXISTS idx_greenwash_claims_risk_level
ON public.greenwash_assessment_claims(risk_level);

-- Add comments
COMMENT ON TABLE public.greenwash_assessment_claims IS 'Individual claims identified in a greenwash assessment with RAG ratings';
COMMENT ON COLUMN public.greenwash_assessment_claims.risk_level IS 'RAG rating: low (green), medium (amber), high (red)';
COMMENT ON COLUMN public.greenwash_assessment_claims.legislation_jurisdiction IS 'Which jurisdiction the legislation applies to: uk, eu, or both';

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.greenwash_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.greenwash_assessment_claims ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: RLS Policies for greenwash_assessments
-- ============================================================================

-- SELECT policy
CREATE POLICY "Users can view assessments in their organization"
ON public.greenwash_assessments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = greenwash_assessments.organization_id
    AND om.user_id = auth.uid()
  )
);

-- INSERT policy
CREATE POLICY "Users can create assessments in their organization"
ON public.greenwash_assessments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = greenwash_assessments.organization_id
    AND om.user_id = auth.uid()
  )
);

-- UPDATE policy
CREATE POLICY "Users can update assessments in their organization"
ON public.greenwash_assessments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = greenwash_assessments.organization_id
    AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = greenwash_assessments.organization_id
    AND om.user_id = auth.uid()
  )
);

-- DELETE policy
CREATE POLICY "Users can delete assessments in their organization"
ON public.greenwash_assessments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = greenwash_assessments.organization_id
    AND om.user_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 5: RLS Policies for greenwash_assessment_claims
-- ============================================================================

-- SELECT policy (via assessment)
CREATE POLICY "Users can view claims for assessments in their organization"
ON public.greenwash_assessment_claims
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.greenwash_assessments ga
    JOIN public.organization_members om ON ga.organization_id = om.organization_id
    WHERE ga.id = greenwash_assessment_claims.assessment_id
    AND om.user_id = auth.uid()
  )
);

-- INSERT policy
CREATE POLICY "Users can create claims for assessments in their organization"
ON public.greenwash_assessment_claims
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.greenwash_assessments ga
    JOIN public.organization_members om ON ga.organization_id = om.organization_id
    WHERE ga.id = greenwash_assessment_claims.assessment_id
    AND om.user_id = auth.uid()
  )
);

-- DELETE policy
CREATE POLICY "Users can delete claims for assessments in their organization"
ON public.greenwash_assessment_claims
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.greenwash_assessments ga
    JOIN public.organization_members om ON ga.organization_id = om.organization_id
    WHERE ga.id = greenwash_assessment_claims.assessment_id
    AND om.user_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 6: Create storage bucket for uploaded documents
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'greenwash-documents',
  'greenwash-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users can upload greenwash documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'greenwash-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view greenwash documents in their org"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'greenwash-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete greenwash documents in their org"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'greenwash-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);
