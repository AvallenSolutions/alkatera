-- ============================================================================
-- ADD MISSING GRANT PERMISSIONS
-- ============================================================================
-- The greenwash and certifications tables were created with RLS policies
-- but without explicit GRANT permissions. Without GRANTs, PostgREST
-- cannot see the tables in its schema cache, causing
-- "Could not find the table in the schema cache" errors.
-- ============================================================================

-- ============================================================================
-- GREENWASH GUARDIAN TABLES
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.greenwash_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.greenwash_assessments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.greenwash_assessment_claims TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.greenwash_assessment_claims TO service_role;

-- ============================================================================
-- CERTIFICATIONS HUB TABLES
-- ============================================================================

GRANT SELECT ON public.certification_frameworks TO authenticated;
GRANT SELECT ON public.certification_frameworks TO service_role;
GRANT ALL ON public.certification_frameworks TO service_role;

GRANT SELECT ON public.framework_requirements TO authenticated;
GRANT SELECT ON public.framework_requirements TO service_role;
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
-- NOTIFY PostgREST to reload its schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';
