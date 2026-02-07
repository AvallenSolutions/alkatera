-- ============================================================================
-- Emission Factor Data Strategy — Phase 1A + 1C
-- ============================================================================
-- Creates:
--   1. emission_factor_requests — tracks search misses, user requests, quality concerns
--   2. emission_factor_audit_log — change history for all factor modifications
--   3. New columns on staging_emission_factors — versioning, review cycle, status
--   4. Helper function for logging factor misses (fire-and-forget)
--   5. Backfill review dates on existing 25 Global Drinks Library factors
-- ============================================================================

-- ============================================================================
-- 1. EMISSION FACTOR REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.emission_factor_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What was searched for
  search_query text NOT NULL,
  material_name text NOT NULL,
  material_type text CHECK (material_type IN ('ingredient', 'packaging', 'process', 'other')),
  context text NOT NULL DEFAULT 'user_request' CHECK (context IN ('search_miss', 'calculation_failure', 'user_request', 'quality_concern')),

  -- Where the request originated
  source_page text,
  product_id integer REFERENCES public.products(id) ON DELETE SET NULL,

  -- Resolution tracking
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'researching', 'resolved', 'rejected', 'duplicate')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_factor_id uuid REFERENCES public.staging_emission_factors(id) ON DELETE SET NULL,
  resolution_notes text,

  -- Priority scoring (auto-calculated)
  request_count integer NOT NULL DEFAULT 1,
  unique_org_count integer NOT NULL DEFAULT 1,
  priority_score numeric NOT NULL DEFAULT 0,

  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_efr_status ON public.emission_factor_requests(status);
CREATE INDEX IF NOT EXISTS idx_efr_priority ON public.emission_factor_requests(priority_score DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_efr_material_name ON public.emission_factor_requests(LOWER(material_name));
CREATE INDEX IF NOT EXISTS idx_efr_org ON public.emission_factor_requests(organization_id);

-- Deduplicate: when same material is requested again, increment count instead of creating new row
CREATE OR REPLACE FUNCTION public.log_emission_factor_request(
  p_search_query text,
  p_material_name text,
  p_material_type text DEFAULT NULL,
  p_context text DEFAULT 'search_miss',
  p_organization_id uuid DEFAULT NULL,
  p_requested_by uuid DEFAULT NULL,
  p_source_page text DEFAULT NULL,
  p_product_id integer DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
) RETURNS uuid AS $$
DECLARE
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Check for existing pending request with same material name
  SELECT id INTO v_existing_id
  FROM public.emission_factor_requests
  WHERE LOWER(material_name) = LOWER(p_material_name)
    AND status IN ('pending', 'researching')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Increment counts
    UPDATE public.emission_factor_requests
    SET
      request_count = request_count + 1,
      unique_org_count = (
        SELECT COUNT(DISTINCT org_id) FROM (
          SELECT p_organization_id AS org_id
          UNION
          SELECT organization_id FROM public.emission_factor_requests WHERE id = v_existing_id
        ) orgs WHERE org_id IS NOT NULL
      ),
      priority_score = (request_count + 1) * COALESCE(unique_org_count, 1),
      updated_at = now(),
      metadata = metadata || p_metadata
    WHERE id = v_existing_id;

    RETURN v_existing_id;
  ELSE
    -- Create new request
    INSERT INTO public.emission_factor_requests (
      search_query, material_name, material_type, context,
      organization_id, requested_by, source_page, product_id, metadata,
      priority_score
    ) VALUES (
      p_search_query, p_material_name, p_material_type, p_context,
      p_organization_id, p_requested_by, p_source_page, p_product_id, p_metadata,
      1
    )
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: Anyone authenticated can insert requests, only admins can update
ALTER TABLE public.emission_factor_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create factor requests"
  ON public.emission_factor_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own requests"
  ON public.emission_factor_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'owner')
    )
  );

-- ============================================================================
-- 2. EMISSION FACTOR AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.emission_factor_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_id uuid NOT NULL REFERENCES public.staging_emission_factors(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_type text NOT NULL CHECK (change_type IN ('created', 'updated', 'deprecated', 'upgraded', 'reviewed')),
  previous_values jsonb,
  new_values jsonb,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_efal_factor ON public.emission_factor_audit_log(factor_id);
CREATE INDEX IF NOT EXISTS idx_efal_created ON public.emission_factor_audit_log(created_at DESC);

ALTER TABLE public.emission_factor_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit logs"
  ON public.emission_factor_audit_log FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Anyone can view audit logs"
  ON public.emission_factor_audit_log FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 3. STAGING_EMISSION_FACTORS — VERSIONING & REVIEW COLUMNS
-- ============================================================================
ALTER TABLE public.staging_emission_factors
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS review_due_date date,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.staging_emission_factors(id),
  ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 70;

-- Add check constraints (safe with IF NOT EXISTS pattern)
DO $$ BEGIN
  ALTER TABLE public.staging_emission_factors
    ADD CONSTRAINT staging_ef_status_check CHECK (status IN ('active', 'deprecated', 'under_review', 'draft'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.staging_emission_factors
    ADD CONSTRAINT staging_ef_confidence_check CHECK (confidence_score >= 0 AND confidence_score <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. BACKFILL: Set review dates on existing 25 Global Drinks Library factors
-- ============================================================================
-- HIGH quality: review in 24 months
UPDATE public.staging_emission_factors
SET
  review_due_date = CURRENT_DATE + INTERVAL '24 months',
  last_reviewed_at = now(),
  confidence_score = 85,
  status = 'active',
  version = 1
WHERE organization_id IS NULL
  AND metadata->>'data_quality_grade' = 'HIGH'
  AND review_due_date IS NULL;

-- MEDIUM quality: review in 12 months
UPDATE public.staging_emission_factors
SET
  review_due_date = CURRENT_DATE + INTERVAL '12 months',
  last_reviewed_at = now(),
  confidence_score = 70,
  status = 'active',
  version = 1
WHERE organization_id IS NULL
  AND metadata->>'data_quality_grade' = 'MEDIUM'
  AND review_due_date IS NULL;

-- LOW quality: review in 6 months
UPDATE public.staging_emission_factors
SET
  review_due_date = CURRENT_DATE + INTERVAL '6 months',
  last_reviewed_at = now(),
  confidence_score = 50,
  status = 'active',
  version = 1
WHERE organization_id IS NULL
  AND metadata->>'data_quality_grade' = 'LOW'
  AND review_due_date IS NULL;

-- ============================================================================
-- 5. HELPER VIEW: Factor request summary for admin dashboard
-- ============================================================================
CREATE OR REPLACE VIEW public.emission_factor_request_summary AS
SELECT
  LOWER(material_name) as material_name_lower,
  MAX(material_name) as material_name,
  MAX(material_type) as material_type,
  SUM(request_count) as total_requests,
  COUNT(DISTINCT organization_id) as unique_orgs,
  MAX(priority_score) as max_priority,
  MIN(created_at) as first_requested,
  MAX(updated_at) as last_requested,
  MAX(status) as status,
  array_agg(DISTINCT context) as request_contexts
FROM public.emission_factor_requests
WHERE status IN ('pending', 'researching')
GROUP BY LOWER(material_name)
ORDER BY max_priority DESC, total_requests DESC;
