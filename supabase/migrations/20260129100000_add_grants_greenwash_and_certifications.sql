-- ============================================================================
-- CREATE GREENWASH & CERTIFICATIONS TABLES WITH GRANT PERMISSIONS
-- ============================================================================
-- The original migrations (20260113110000 and 20260119100000) were never
-- applied to the database. This migration creates all missing tables,
-- adds RLS policies, GRANT permissions, indexes, and seed data.
-- All statements use IF NOT EXISTS / ON CONFLICT for idempotency.
-- ============================================================================


-- ============================================================================
-- GREENWASH GUARDIAN: greenwash_assessments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.greenwash_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  input_type TEXT NOT NULL CHECK (input_type IN ('url', 'document', 'text', 'social_media')),
  input_source TEXT,
  input_content TEXT,
  overall_risk_level TEXT CHECK (overall_risk_level IN ('low', 'medium', 'high')),
  overall_risk_score INTEGER CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
  summary TEXT,
  recommendations JSONB DEFAULT '[]'::jsonb,
  legislation_applied JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_greenwash_assessments_org_id ON public.greenwash_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_greenwash_assessments_created_by ON public.greenwash_assessments(created_by);
CREATE INDEX IF NOT EXISTS idx_greenwash_assessments_status ON public.greenwash_assessments(status);
CREATE INDEX IF NOT EXISTS idx_greenwash_assessments_created_at ON public.greenwash_assessments(created_at DESC);

DO $$ BEGIN
  CREATE TRIGGER update_greenwash_assessments_updated_at
  BEFORE UPDATE ON public.greenwash_assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.greenwash_assessments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GREENWASH GUARDIAN: greenwash_assessment_claims
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.greenwash_assessment_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.greenwash_assessments(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  claim_context TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  issue_type TEXT,
  issue_description TEXT NOT NULL,
  legislation_name TEXT NOT NULL,
  legislation_article TEXT,
  legislation_jurisdiction TEXT CHECK (legislation_jurisdiction IN ('uk', 'eu', 'both')),
  suggestion TEXT NOT NULL,
  suggested_revision TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_greenwash_claims_assessment_id ON public.greenwash_assessment_claims(assessment_id);
CREATE INDEX IF NOT EXISTS idx_greenwash_claims_risk_level ON public.greenwash_assessment_claims(risk_level);

ALTER TABLE public.greenwash_assessment_claims ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GREENWASH: Storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'greenwash-documents',
  'greenwash-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CERTIFICATIONS HUB: certification_frameworks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.certification_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_code VARCHAR(50) NOT NULL UNIQUE,
  framework_name VARCHAR(255) NOT NULL,
  framework_version VARCHAR(50),
  description TEXT,
  governing_body VARCHAR(255),
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  effective_date DATE,
  has_scoring BOOLEAN DEFAULT true,
  passing_score DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- CERTIFICATIONS HUB: framework_requirements
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.framework_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES public.certification_frameworks(id) ON DELETE CASCADE,
  requirement_code VARCHAR(100) NOT NULL,
  requirement_name VARCHAR(255) NOT NULL,
  requirement_category VARCHAR(100),
  parent_requirement_id UUID REFERENCES public.framework_requirements(id),
  section VARCHAR(100),
  subsection VARCHAR(100),
  order_index INTEGER,
  description TEXT,
  guidance TEXT,
  examples TEXT,
  max_points DECIMAL(5,2),
  is_mandatory BOOLEAN DEFAULT false,
  is_conditional BOOLEAN DEFAULT false,
  conditional_logic TEXT,
  required_data_sources TEXT[],
  evidence_requirements TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(framework_id, requirement_code)
);

CREATE INDEX IF NOT EXISTS idx_framework_requirements_framework ON public.framework_requirements(framework_id);
CREATE INDEX IF NOT EXISTS idx_framework_requirements_parent ON public.framework_requirements(parent_requirement_id);
CREATE INDEX IF NOT EXISTS idx_framework_requirements_category ON public.framework_requirements(requirement_category);

-- ============================================================================
-- CERTIFICATIONS HUB: organization_certifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organization_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES public.certification_frameworks(id),
  status VARCHAR(50) DEFAULT 'not_started',
  target_date DATE,
  certification_number VARCHAR(255),
  certified_date DATE,
  expiry_date DATE,
  score_achieved DECIMAL(5,2),
  readiness_score DECIMAL(5,2),
  data_completeness DECIMAL(5,2),
  last_assessment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, framework_id)
);

CREATE INDEX IF NOT EXISTS idx_org_certifications_org ON public.organization_certifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_certifications_framework ON public.organization_certifications(framework_id);
CREATE INDEX IF NOT EXISTS idx_org_certifications_status ON public.organization_certifications(status);

-- ============================================================================
-- CERTIFICATIONS HUB: certification_gap_analyses
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.certification_gap_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES public.certification_frameworks(id),
  requirement_id UUID NOT NULL REFERENCES public.framework_requirements(id),
  analysis_date DATE NOT NULL,
  analyzed_by VARCHAR(255),
  compliance_status VARCHAR(50) NOT NULL,
  confidence_level VARCHAR(50),
  current_score DECIMAL(5,2),
  target_score DECIMAL(5,2),
  gap_points DECIMAL(5,2),
  current_state TEXT,
  required_state TEXT,
  gap_description TEXT,
  remediation_actions TEXT,
  estimated_effort VARCHAR(50),
  priority VARCHAR(50),
  target_completion_date DATE,
  owner VARCHAR(255),
  data_sources_checked TEXT[],
  data_quality VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gap_analyses_org ON public.certification_gap_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_gap_analyses_framework ON public.certification_gap_analyses(framework_id);
CREATE INDEX IF NOT EXISTS idx_gap_analyses_requirement ON public.certification_gap_analyses(requirement_id);
CREATE INDEX IF NOT EXISTS idx_gap_analyses_status ON public.certification_gap_analyses(compliance_status);

-- ============================================================================
-- CERTIFICATIONS HUB: certification_evidence_links
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.certification_evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES public.framework_requirements(id),
  source_module VARCHAR(100) NOT NULL,
  source_table VARCHAR(100) NOT NULL,
  source_record_id UUID NOT NULL,
  evidence_type VARCHAR(100),
  evidence_description TEXT,
  evidence_date DATE,
  relevance_notes TEXT,
  covers_requirement BOOLEAN DEFAULT false,
  verified_by VARCHAR(255),
  verified_date DATE,
  verification_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, requirement_id, source_module, source_table, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_links_org ON public.certification_evidence_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_requirement ON public.certification_evidence_links(requirement_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_source ON public.certification_evidence_links(source_module, source_table);

-- ============================================================================
-- CERTIFICATIONS HUB: certification_audit_packages
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.certification_audit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES public.certification_frameworks(id),
  package_name VARCHAR(255) NOT NULL,
  package_type VARCHAR(100),
  description TEXT,
  created_date DATE NOT NULL,
  submission_deadline DATE,
  submitted_date DATE,
  status VARCHAR(50) DEFAULT 'draft',
  review_notes TEXT,
  included_requirements UUID[],
  included_evidence UUID[],
  executive_summary TEXT,
  methodology TEXT,
  generated_documents JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_packages_org ON public.certification_audit_packages(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_packages_framework ON public.certification_audit_packages(framework_id);
CREATE INDEX IF NOT EXISTS idx_audit_packages_status ON public.certification_audit_packages(status);

-- ============================================================================
-- CERTIFICATIONS HUB: certification_score_history
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.certification_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL REFERENCES public.certification_frameworks(id),
  score_date DATE NOT NULL,
  overall_score DECIMAL(5,2),
  category_scores JSONB,
  requirements_met INTEGER,
  requirements_partial INTEGER,
  requirements_not_met INTEGER,
  total_requirements INTEGER,
  data_completeness DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cert_score_history_org ON public.certification_score_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_cert_score_history_framework ON public.certification_score_history(framework_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.certification_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.framework_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_gap_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_audit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_score_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES (using DO blocks for idempotency)
-- ============================================================================

-- Greenwash assessments policies
DO $$ BEGIN
  CREATE POLICY "Users can view assessments in their organization" ON public.greenwash_assessments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = greenwash_assessments.organization_id AND om.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create assessments in their organization" ON public.greenwash_assessments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = greenwash_assessments.organization_id AND om.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update assessments in their organization" ON public.greenwash_assessments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = greenwash_assessments.organization_id AND om.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = greenwash_assessments.organization_id AND om.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete assessments in their organization" ON public.greenwash_assessments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = greenwash_assessments.organization_id AND om.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Greenwash claims policies
DO $$ BEGIN
  CREATE POLICY "Users can view claims for assessments in their organization" ON public.greenwash_assessment_claims FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.greenwash_assessments ga JOIN public.organization_members om ON ga.organization_id = om.organization_id WHERE ga.id = greenwash_assessment_claims.assessment_id AND om.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create claims for assessments in their organization" ON public.greenwash_assessment_claims FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.greenwash_assessments ga JOIN public.organization_members om ON ga.organization_id = om.organization_id WHERE ga.id = greenwash_assessment_claims.assessment_id AND om.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete claims for assessments in their organization" ON public.greenwash_assessment_claims FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.greenwash_assessments ga JOIN public.organization_members om ON ga.organization_id = om.organization_id WHERE ga.id = greenwash_assessment_claims.assessment_id AND om.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage policies
DO $$ BEGIN
  CREATE POLICY "Users can upload greenwash documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'greenwash-documents' AND (storage.foldername(name))[1] IN (SELECT om.organization_id::text FROM public.organization_members om WHERE om.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view greenwash documents in their org" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'greenwash-documents' AND (storage.foldername(name))[1] IN (SELECT om.organization_id::text FROM public.organization_members om WHERE om.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete greenwash documents in their org" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'greenwash-documents' AND (storage.foldername(name))[1] IN (SELECT om.organization_id::text FROM public.organization_members om WHERE om.user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Certification frameworks (public read)
DO $$ BEGIN
  CREATE POLICY "frameworks_public_read" ON public.certification_frameworks FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "requirements_public_read" ON public.framework_requirements FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Organization certifications
DO $$ BEGIN
  CREATE POLICY "org_certifications_select" ON public.organization_certifications FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "org_certifications_insert" ON public.organization_certifications FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "org_certifications_update" ON public.organization_certifications FOR UPDATE USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Gap analyses
DO $$ BEGIN
  CREATE POLICY "gap_analyses_select" ON public.certification_gap_analyses FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gap_analyses_insert" ON public.certification_gap_analyses FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gap_analyses_update" ON public.certification_gap_analyses FOR UPDATE USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "gap_analyses_delete" ON public.certification_gap_analyses FOR DELETE USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Evidence links
DO $$ BEGIN
  CREATE POLICY "evidence_links_select" ON public.certification_evidence_links FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "evidence_links_insert" ON public.certification_evidence_links FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "evidence_links_update" ON public.certification_evidence_links FOR UPDATE USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "evidence_links_delete" ON public.certification_evidence_links FOR DELETE USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Audit packages
DO $$ BEGIN
  CREATE POLICY "audit_packages_select" ON public.certification_audit_packages FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "audit_packages_insert" ON public.certification_audit_packages FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "audit_packages_update" ON public.certification_audit_packages FOR UPDATE USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "audit_packages_delete" ON public.certification_audit_packages FOR DELETE USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Score history
DO $$ BEGIN
  CREATE POLICY "cert_score_history_select" ON public.certification_score_history FOR SELECT USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "cert_score_history_insert" ON public.certification_score_history FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Greenwash tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.greenwash_assessments TO authenticated;
GRANT ALL ON public.greenwash_assessments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.greenwash_assessment_claims TO authenticated;
GRANT ALL ON public.greenwash_assessment_claims TO service_role;

-- Certifications tables
GRANT SELECT ON public.certification_frameworks TO authenticated;
GRANT ALL ON public.certification_frameworks TO service_role;

GRANT SELECT ON public.framework_requirements TO authenticated;
GRANT ALL ON public.framework_requirements TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_certifications TO authenticated;
GRANT ALL ON public.organization_certifications TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certification_gap_analyses TO authenticated;
GRANT ALL ON public.certification_gap_analyses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certification_evidence_links TO authenticated;
GRANT ALL ON public.certification_evidence_links TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certification_audit_packages TO authenticated;
GRANT ALL ON public.certification_audit_packages TO service_role;

GRANT SELECT, INSERT ON public.certification_score_history TO authenticated;
GRANT ALL ON public.certification_score_history TO service_role;

-- ============================================================================
-- SEED DATA: CERTIFICATION FRAMEWORKS
-- ============================================================================

INSERT INTO public.certification_frameworks (framework_code, framework_name, framework_version, description, governing_body, website_url, passing_score)
VALUES
  ('bcorp_21', 'B Corp Certification', '2.1', 'B Corp certification for businesses meeting the highest standards of verified social and environmental performance, public transparency, and legal accountability.', 'B Lab', 'https://www.bcorporation.net/', 80),
  ('csrd', 'Corporate Sustainability Reporting Directive', '2024', 'EU directive requiring large companies to disclose information on sustainability matters including environmental, social, and governance topics.', 'European Commission', 'https://finance.ec.europa.eu/capital-markets-union-and-financial-markets/company-reporting-and-auditing/company-reporting/corporate-sustainability-reporting_en', NULL),
  ('sbti', 'Science Based Targets initiative', '2.0', 'Framework for setting corporate emission reduction targets in line with climate science.', 'SBTi', 'https://sciencebasedtargets.org/', NULL),
  ('gri', 'Global Reporting Initiative Standards', '2021', 'Global standards for sustainability reporting covering economic, environmental, and social impacts.', 'GRI', 'https://www.globalreporting.org/', NULL)
ON CONFLICT (framework_code) DO NOTHING;

-- ============================================================================
-- SEED DATA: B CORP REQUIREMENTS
-- ============================================================================

DO $$
DECLARE
  bcorp_id UUID;
BEGIN
  SELECT id INTO bcorp_id FROM public.certification_frameworks WHERE framework_code = 'bcorp_21';

  IF bcorp_id IS NOT NULL THEN
    INSERT INTO public.framework_requirements (framework_id, requirement_code, requirement_name, requirement_category, description, max_points, is_mandatory, required_data_sources)
    VALUES
      (bcorp_id, 'GOV-MISSION', 'Mission & Engagement', 'governance', 'Mission statement, stakeholder consideration in governance', 8, false, ARRAY['governance']),
      (bcorp_id, 'GOV-ETHICS', 'Ethics & Transparency', 'governance', 'Code of ethics, anti-corruption policies, financial transparency', 6, false, ARRAY['governance']),
      (bcorp_id, 'GOV-STRUCTURE', 'Corporate Structure', 'governance', 'Benefit corporation status, stakeholder governance', 4, false, ARRAY['governance']),
      (bcorp_id, 'WRK-COMP', 'Compensation & Benefits', 'workers', 'Living wage, benefits, pay equity', 12, false, ARRAY['people_culture']),
      (bcorp_id, 'WRK-DEV', 'Training & Development', 'workers', 'Professional development, skills training', 8, false, ARRAY['people_culture']),
      (bcorp_id, 'WRK-ENGAGE', 'Worker Engagement', 'workers', 'Satisfaction surveys, engagement programs', 6, false, ARRAY['people_culture']),
      (bcorp_id, 'WRK-HEALTH', 'Health & Safety', 'workers', 'Workplace safety, wellness programs', 6, false, ARRAY['people_culture']),
      (bcorp_id, 'COM-GIVING', 'Civic Engagement & Giving', 'community', 'Charitable donations, volunteering', 10, false, ARRAY['community_impact']),
      (bcorp_id, 'COM-LOCAL', 'Local Involvement', 'community', 'Local sourcing, employment, economic impact', 8, false, ARRAY['community_impact']),
      (bcorp_id, 'COM-DIVERSITY', 'Diversity, Equity & Inclusion', 'community', 'DEI policies, diverse representation', 10, false, ARRAY['people_culture']),
      (bcorp_id, 'ENV-CLIMATE', 'Climate Action', 'environment', 'GHG emissions measurement and reduction', 15, false, ARRAY['environmental']),
      (bcorp_id, 'ENV-WASTE', 'Waste Management', 'environment', 'Waste reduction and circularity', 8, false, ARRAY['environmental']),
      (bcorp_id, 'ENV-WATER', 'Water Stewardship', 'environment', 'Water usage and conservation', 6, false, ARRAY['environmental']),
      (bcorp_id, 'ENV-NATURE', 'Land & Nature', 'environment', 'Biodiversity, land use impact', 6, false, ARRAY['environmental']),
      (bcorp_id, 'CUS-IMPACT', 'Customer Impact', 'customers', 'Products/services that create positive impact', 10, false, ARRAY['products']),
      (bcorp_id, 'CUS-PRIVACY', 'Data Privacy & Security', 'customers', 'Customer data protection', 4, false, ARRAY['governance'])
    ON CONFLICT (framework_id, requirement_code) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- NOTIFY PostgREST to reload its schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';
