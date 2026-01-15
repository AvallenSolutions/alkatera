/*
  # Create Supplier Product Evidence System

  ## Overview
  This migration creates the evidence linkage system for supplier products,
  allowing product-level evidence attachment for compliance verification
  and audit trails.

  ## New Tables

  ### 1. verification_bodies
  Reference table for third-party verification bodies and accreditation organizations.

  ### 2. supplier_product_evidence
  Junction table linking evidence documents to specific supplier products.
  Supports both organization-specific and platform-wide supplier products.

  ## Features
  - Product-level evidence attachment
  - Multi-category impact coverage tracking
  - Third-party verifier information
  - Verification status workflow
  - Audit trail maintenance

  ## Security
  - RLS policies for organization-scoped access
  - Platform admin access for platform supplier products
  - Immutable audit trail for verified evidence
*/

-- ============================================================================
-- PART 1: Create verification_bodies reference table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.verification_bodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  accreditation_body TEXT,
  accreditation_number TEXT,
  website TEXT,
  country TEXT,
  specializations TEXT[], -- Array of specialization areas
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_verification_body_name UNIQUE (name)
);

COMMENT ON TABLE public.verification_bodies IS
  'Reference table of third-party verification bodies for LCA, EPD, and carbon verification.';

COMMENT ON COLUMN public.verification_bodies.accreditation_body IS
  'Accreditation body that certified this verifier (e.g., UKAS, DAkkS, ANAB).';

COMMENT ON COLUMN public.verification_bodies.specializations IS
  'Areas of specialization: ISO_14025, ISO_14064, ISO_14067, PEF, EN_15804, etc.';

-- Seed common verification bodies
INSERT INTO public.verification_bodies (name, short_name, website, country, specializations)
VALUES
  ('SGS SA', 'SGS', 'https://www.sgs.com', 'CH', ARRAY['ISO_14025', 'ISO_14064', 'ISO_14067', 'PEF', 'EN_15804']),
  ('Bureau Veritas', 'BV', 'https://www.bureauveritas.com', 'FR', ARRAY['ISO_14025', 'ISO_14064', 'ISO_14067', 'EN_15804']),
  ('DNV GL', 'DNV', 'https://www.dnv.com', 'NO', ARRAY['ISO_14064', 'ISO_14067', 'GHG_Protocol']),
  ('TÜV Rheinland', 'TÜV', 'https://www.tuv.com', 'DE', ARRAY['ISO_14025', 'ISO_14064', 'EN_15804']),
  ('DEKRA', 'DEKRA', 'https://www.dekra.com', 'DE', ARRAY['ISO_14064', 'ISO_14067']),
  ('Intertek', 'Intertek', 'https://www.intertek.com', 'UK', ARRAY['ISO_14025', 'ISO_14064', 'PAS_2050']),
  ('Carbon Trust', 'Carbon Trust', 'https://www.carbontrust.com', 'UK', ARRAY['PAS_2050', 'ISO_14067', 'GHG_Protocol']),
  ('NSF International', 'NSF', 'https://www.nsf.org', 'US', ARRAY['ISO_14025', 'ISO_14064']),
  ('UL Solutions', 'UL', 'https://www.ul.com', 'US', ARRAY['ISO_14025', 'ISO_14064', 'EN_15804']),
  ('RINA', 'RINA', 'https://www.rina.org', 'IT', ARRAY['ISO_14064', 'ISO_14067', 'EN_15804'])
ON CONFLICT (name) DO NOTHING;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_verification_bodies_active
  ON public.verification_bodies(is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_verification_bodies_country
  ON public.verification_bodies(country);

-- Enable RLS
ALTER TABLE public.verification_bodies ENABLE ROW LEVEL SECURITY;

-- Anyone can view verification bodies
CREATE POLICY "Anyone can view verification bodies"
  ON public.verification_bodies
  FOR SELECT
  TO authenticated
  USING (true);

-- Only platform admins can manage verification bodies
CREATE POLICY "Platform admins can manage verification bodies"
  ON public.verification_bodies
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    )
  );

-- Grant permissions
GRANT SELECT ON public.verification_bodies TO authenticated;

-- ============================================================================
-- PART 2: Create evidence type enum
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplier_evidence_type') THEN
    CREATE TYPE supplier_evidence_type AS ENUM (
      'epd',                      -- Environmental Product Declaration (ISO 14025)
      'lca_report',               -- Full Life Cycle Assessment report
      'carbon_certificate',       -- Carbon footprint certificate
      'water_certificate',        -- Water footprint certificate (ISO 14046)
      'third_party_verification', -- Independent verification statement
      'supplier_declaration',     -- Signed supplier attestation/declaration
      'test_report',              -- Laboratory or testing results
      'certification',            -- Eco-label or sustainability certification
      'invoice',                  -- Purchase invoice (for traceability)
      'specification_sheet',      -- Technical specification/data sheet
      'other'                     -- Other supporting documentation
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evidence_verification_status') THEN
    CREATE TYPE evidence_verification_status AS ENUM (
      'pending',   -- Awaiting review
      'verified',  -- Approved by reviewer
      'rejected',  -- Rejected with reason
      'expired'    -- Past validity date
    );
  END IF;
END $$;

-- ============================================================================
-- PART 3: Create supplier_product_evidence table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.supplier_product_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product linkage (one must be set)
  supplier_product_id UUID REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  platform_supplier_product_id UUID REFERENCES public.platform_supplier_products(id) ON DELETE CASCADE,

  -- Organization context (for org-specific products)
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Evidence details
  evidence_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_description TEXT,
  document_url TEXT,
  storage_object_path TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT,

  -- Impact category coverage
  covers_climate BOOLEAN DEFAULT false,
  covers_water BOOLEAN DEFAULT false,
  covers_waste BOOLEAN DEFAULT false,
  covers_land BOOLEAN DEFAULT false,

  -- Document validity
  document_date DATE,
  document_expiry DATE,
  document_reference_number TEXT, -- EPD registration number, certificate number, etc.

  -- Third-party verifier information
  verifier_body_id UUID REFERENCES public.verification_bodies(id),
  verifier_name TEXT, -- For custom verifiers not in reference table
  verifier_accreditation TEXT,
  verification_standard TEXT, -- ISO standard used
  verification_date DATE,
  verification_expiry DATE,

  -- Internal verification status
  verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
  internal_verified_by UUID REFERENCES public.profiles(id),
  internal_verified_at TIMESTAMPTZ,
  internal_verification_notes TEXT,
  rejection_reason TEXT,

  -- Audit trail
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT evidence_product_link_check CHECK (
    (supplier_product_id IS NOT NULL AND platform_supplier_product_id IS NULL) OR
    (supplier_product_id IS NULL AND platform_supplier_product_id IS NOT NULL)
  ),
  CONSTRAINT evidence_org_context_check CHECK (
    (supplier_product_id IS NOT NULL AND organization_id IS NOT NULL) OR
    (platform_supplier_product_id IS NOT NULL AND organization_id IS NULL)
  ),
  CONSTRAINT non_empty_document_name CHECK (length(trim(document_name)) > 0),
  CONSTRAINT valid_evidence_type CHECK (evidence_type IN (
    'epd', 'lca_report', 'carbon_certificate', 'water_certificate',
    'third_party_verification', 'supplier_declaration', 'test_report',
    'certification', 'invoice', 'specification_sheet', 'other'
  )),
  CONSTRAINT at_least_one_coverage CHECK (
    covers_climate = true OR covers_water = true OR
    covers_waste = true OR covers_land = true
  ),
  CONSTRAINT internal_verified_by_required CHECK (
    (verification_status NOT IN ('verified', 'rejected')) OR
    (verification_status IN ('verified', 'rejected') AND internal_verified_by IS NOT NULL)
  )
);

COMMENT ON TABLE public.supplier_product_evidence IS
  'Evidence documents linked to specific supplier products for compliance verification and audit trails.';

COMMENT ON COLUMN public.supplier_product_evidence.evidence_type IS
  'Type of evidence: epd, lca_report, carbon_certificate, water_certificate, third_party_verification, supplier_declaration, test_report, certification, invoice, specification_sheet, other.';

COMMENT ON COLUMN public.supplier_product_evidence.covers_climate IS
  'Whether this evidence supports the climate/GHG impact claims.';

COMMENT ON COLUMN public.supplier_product_evidence.covers_water IS
  'Whether this evidence supports the water impact claims.';

COMMENT ON COLUMN public.supplier_product_evidence.covers_waste IS
  'Whether this evidence supports the waste/circularity claims.';

COMMENT ON COLUMN public.supplier_product_evidence.covers_land IS
  'Whether this evidence supports the land/biodiversity impact claims.';

COMMENT ON COLUMN public.supplier_product_evidence.document_reference_number IS
  'External reference number: EPD registration ID, certificate number, report reference, etc.';

COMMENT ON COLUMN public.supplier_product_evidence.verification_status IS
  'Internal review status: pending (awaiting review), verified (approved), rejected (invalid), expired (past validity).';

-- ============================================================================
-- PART 4: Create indexes for supplier_product_evidence
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_supplier_product_evidence_product
  ON public.supplier_product_evidence(supplier_product_id)
  WHERE supplier_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_product_evidence_platform_product
  ON public.supplier_product_evidence(platform_supplier_product_id)
  WHERE platform_supplier_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_product_evidence_org
  ON public.supplier_product_evidence(organization_id)
  WHERE organization_id IS NOT NULL;

-- Filter indexes
CREATE INDEX IF NOT EXISTS idx_supplier_product_evidence_type
  ON public.supplier_product_evidence(evidence_type);

CREATE INDEX IF NOT EXISTS idx_supplier_product_evidence_status
  ON public.supplier_product_evidence(verification_status);

CREATE INDEX IF NOT EXISTS idx_supplier_product_evidence_verified
  ON public.supplier_product_evidence(supplier_product_id, verification_status)
  WHERE verification_status = 'verified';

-- Coverage indexes for filtering by impact category
CREATE INDEX IF NOT EXISTS idx_supplier_product_evidence_covers_climate
  ON public.supplier_product_evidence(supplier_product_id)
  WHERE covers_climate = true;

CREATE INDEX IF NOT EXISTS idx_supplier_product_evidence_covers_water
  ON public.supplier_product_evidence(supplier_product_id)
  WHERE covers_water = true;

-- Expiry tracking
CREATE INDEX IF NOT EXISTS idx_supplier_product_evidence_expiry
  ON public.supplier_product_evidence(document_expiry)
  WHERE document_expiry IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_product_evidence_verification_expiry
  ON public.supplier_product_evidence(verification_expiry)
  WHERE verification_expiry IS NOT NULL;

-- Audit trail
CREATE INDEX IF NOT EXISTS idx_supplier_product_evidence_uploaded_by
  ON public.supplier_product_evidence(uploaded_by);

-- ============================================================================
-- PART 5: Enable RLS and create policies
-- ============================================================================

ALTER TABLE public.supplier_product_evidence ENABLE ROW LEVEL SECURITY;

-- Organization members can view evidence for their supplier products
CREATE POLICY "Organization members can view their supplier product evidence"
  ON public.supplier_product_evidence
  FOR SELECT
  TO authenticated
  USING (
    -- Can view if evidence is for their organization's supplier product
    (organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    ))
    OR
    -- Can view platform supplier product evidence
    (platform_supplier_product_id IS NOT NULL)
  );

-- Organization members can upload evidence for their supplier products
CREATE POLICY "Organization members can upload evidence"
  ON public.supplier_product_evidence
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Can upload for their organization's supplier products
    (organization_id IN (
      SELECT organization_id
      FROM public.organization_members
      WHERE user_id = auth.uid()
    ))
    OR
    -- Platform admins can upload for platform supplier products
    (platform_supplier_product_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    ))
  );

-- Organization admins can update their evidence
CREATE POLICY "Organization admins can update evidence"
  ON public.supplier_product_evidence
  FOR UPDATE
  TO authenticated
  USING (
    (organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('admin', 'owner')
    ))
    OR
    (platform_supplier_product_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    ))
  )
  WITH CHECK (
    (organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('admin', 'owner')
    ))
    OR
    (platform_supplier_product_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    ))
  );

-- Organization admins can delete their evidence (unverified only)
CREATE POLICY "Organization admins can delete unverified evidence"
  ON public.supplier_product_evidence
  FOR DELETE
  TO authenticated
  USING (
    -- Can only delete unverified evidence
    verification_status IN ('pending', 'rejected')
    AND
    (
      (organization_id IN (
        SELECT om.organization_id
        FROM public.organization_members om
        JOIN public.roles r ON r.id = om.role_id
        WHERE om.user_id = auth.uid()
        AND r.name IN ('admin', 'owner')
      ))
      OR
      (platform_supplier_product_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.organization_members om
        JOIN public.organizations o ON o.id = om.organization_id
        WHERE om.user_id = auth.uid()
        AND o.is_platform_admin = true
      ))
    )
  );

-- ============================================================================
-- PART 6: Create helper functions
-- ============================================================================

-- Function to check if a supplier product has verified evidence for a specific category
CREATE OR REPLACE FUNCTION public.has_verified_evidence(
  p_supplier_product_id UUID,
  p_category TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF p_category IS NULL THEN
    -- Check for any verified evidence
    RETURN EXISTS (
      SELECT 1 FROM public.supplier_product_evidence
      WHERE supplier_product_id = p_supplier_product_id
        AND verification_status = 'verified'
    );
  ELSIF p_category = 'climate' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.supplier_product_evidence
      WHERE supplier_product_id = p_supplier_product_id
        AND verification_status = 'verified'
        AND covers_climate = true
    );
  ELSIF p_category = 'water' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.supplier_product_evidence
      WHERE supplier_product_id = p_supplier_product_id
        AND verification_status = 'verified'
        AND covers_water = true
    );
  ELSIF p_category = 'waste' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.supplier_product_evidence
      WHERE supplier_product_id = p_supplier_product_id
        AND verification_status = 'verified'
        AND covers_waste = true
    );
  ELSIF p_category = 'land' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.supplier_product_evidence
      WHERE supplier_product_id = p_supplier_product_id
        AND verification_status = 'verified'
        AND covers_land = true
    );
  ELSE
    RETURN false;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.has_verified_evidence IS
  'Check if a supplier product has verified evidence, optionally for a specific impact category (climate, water, waste, land).';

-- Function to get evidence coverage summary for a supplier product
CREATE OR REPLACE FUNCTION public.get_evidence_coverage(
  p_supplier_product_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'has_any_evidence', COUNT(*) > 0,
    'has_verified_evidence', COUNT(*) FILTER (WHERE verification_status = 'verified') > 0,
    'total_documents', COUNT(*),
    'verified_documents', COUNT(*) FILTER (WHERE verification_status = 'verified'),
    'pending_documents', COUNT(*) FILTER (WHERE verification_status = 'pending'),
    'climate_covered', bool_or(covers_climate AND verification_status = 'verified'),
    'water_covered', bool_or(covers_water AND verification_status = 'verified'),
    'waste_covered', bool_or(covers_waste AND verification_status = 'verified'),
    'land_covered', bool_or(covers_land AND verification_status = 'verified'),
    'evidence_types', array_agg(DISTINCT evidence_type) FILTER (WHERE verification_status = 'verified'),
    'earliest_expiry', MIN(document_expiry) FILTER (WHERE verification_status = 'verified')
  )
  INTO v_result
  FROM public.supplier_product_evidence
  WHERE supplier_product_id = p_supplier_product_id;

  RETURN COALESCE(v_result, jsonb_build_object(
    'has_any_evidence', false,
    'has_verified_evidence', false,
    'total_documents', 0,
    'verified_documents', 0,
    'pending_documents', 0,
    'climate_covered', false,
    'water_covered', false,
    'waste_covered', false,
    'land_covered', false,
    'evidence_types', ARRAY[]::text[],
    'earliest_expiry', null
  ));
END;
$$;

COMMENT ON FUNCTION public.get_evidence_coverage IS
  'Get a summary of evidence coverage for a supplier product including verified status by impact category.';

-- ============================================================================
-- PART 7: Create updated_at trigger
-- ============================================================================

DROP TRIGGER IF EXISTS update_supplier_product_evidence_updated_at ON public.supplier_product_evidence;

CREATE TRIGGER update_supplier_product_evidence_updated_at
  BEFORE UPDATE ON public.supplier_product_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_verification_bodies_updated_at ON public.verification_bodies;

CREATE TRIGGER update_verification_bodies_updated_at
  BEFORE UPDATE ON public.verification_bodies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- PART 8: Create storage bucket for supplier product evidence
-- ============================================================================

-- Note: Storage bucket creation is handled by Supabase CLI or Dashboard
-- This is documentation of the expected bucket configuration:
--
-- Bucket: supplier-product-evidence
-- - Max file size: 20MB (larger for LCA reports)
-- - Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
--   application/vnd.ms-excel, text/csv, image/jpeg, image/png
-- - Path structure: {organization_id}/products/{supplier_product_id}/{filename}
-- - RLS: Organization-scoped access

-- ============================================================================
-- PART 9: Create view for evidence summary per product
-- ============================================================================

CREATE OR REPLACE VIEW public.supplier_product_evidence_summary AS
SELECT
  sp.id AS supplier_product_id,
  sp.organization_id,
  sp.name AS product_name,
  sp.supplier_id,
  COUNT(spe.id) AS total_evidence_count,
  COUNT(spe.id) FILTER (WHERE spe.verification_status = 'verified') AS verified_evidence_count,
  COUNT(spe.id) FILTER (WHERE spe.verification_status = 'pending') AS pending_evidence_count,
  bool_or(spe.covers_climate AND spe.verification_status = 'verified') AS climate_verified,
  bool_or(spe.covers_water AND spe.verification_status = 'verified') AS water_verified,
  bool_or(spe.covers_waste AND spe.verification_status = 'verified') AS waste_verified,
  bool_or(spe.covers_land AND spe.verification_status = 'verified') AS land_verified,
  MIN(spe.document_expiry) FILTER (WHERE spe.verification_status = 'verified') AS earliest_expiry,
  array_agg(DISTINCT spe.evidence_type) FILTER (WHERE spe.verification_status = 'verified') AS verified_evidence_types
FROM public.supplier_products sp
LEFT JOIN public.supplier_product_evidence spe ON spe.supplier_product_id = sp.id
GROUP BY sp.id, sp.organization_id, sp.name, sp.supplier_id;

COMMENT ON VIEW public.supplier_product_evidence_summary IS
  'Aggregated evidence summary per supplier product showing coverage by impact category.';

-- ============================================================================
-- PART 10: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_product_evidence TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_verified_evidence TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_evidence_coverage TO authenticated;
