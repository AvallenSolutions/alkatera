-- ============================================================================
-- FIX CERTIFICATION FRAMEWORKS SCHEMA
-- ============================================================================
-- This migration fixes the schema to match what the API and UI expect:
-- 1. Adds missing columns to certification_frameworks
-- 2. Renames framework_requirements to certification_framework_requirements
-- 3. Updates column names for consistency
-- ============================================================================

-- ============================================================================
-- ADD MISSING COLUMNS TO certification_frameworks
-- ============================================================================

ALTER TABLE certification_frameworks
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points DECIMAL(7,2) DEFAULT 0;

-- Copy data from framework_* columns to new columns
UPDATE certification_frameworks
SET
  name = framework_name,
  code = framework_code,
  version = framework_version
WHERE name IS NULL;

-- Update display order based on priority (B Corp > CSRD > SBTi > GRI)
UPDATE certification_frameworks SET display_order = 1, category = 'Impact Certification' WHERE framework_code = 'bcorp_21';
UPDATE certification_frameworks SET display_order = 2, category = 'Regulatory Compliance' WHERE framework_code = 'csrd';
UPDATE certification_frameworks SET display_order = 3, category = 'Climate Targets' WHERE framework_code = 'sbti';
UPDATE certification_frameworks SET display_order = 4, category = 'Reporting Standards' WHERE framework_code = 'gri';

-- Calculate total_points from requirements
UPDATE certification_frameworks cf
SET total_points = (
  SELECT COALESCE(SUM(max_points), 0)
  FROM framework_requirements fr
  WHERE fr.framework_id = cf.id
);

-- ============================================================================
-- RENAME framework_requirements TO certification_framework_requirements
-- ============================================================================

-- First check if the target table exists (from a previous migration)
DO $$
BEGIN
  -- Drop the old RLS policies
  DROP POLICY IF EXISTS "requirements_public_read" ON framework_requirements;

  -- Rename the table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'framework_requirements' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'certification_framework_requirements' AND table_schema = 'public') THEN
      ALTER TABLE framework_requirements RENAME TO certification_framework_requirements;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- UPDATE COLUMN NAMES IN certification_framework_requirements FOR CONSISTENCY
-- ============================================================================

-- Add API-expected columns
ALTER TABLE certification_framework_requirements
  ADD COLUMN IF NOT EXISTS requirement_code_alias VARCHAR(100),
  ADD COLUMN IF NOT EXISTS requirement_name_alias VARCHAR(255),
  ADD COLUMN IF NOT EXISTS points_available DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS guidance TEXT,
  ADD COLUMN IF NOT EXISTS data_sources TEXT[];

-- Copy data to new columns
UPDATE certification_framework_requirements
SET
  requirement_code_alias = requirement_code,
  requirement_name_alias = requirement_name,
  points_available = max_points,
  is_required = is_mandatory,
  data_sources = required_data_sources
WHERE requirement_code_alias IS NULL;

-- ============================================================================
-- RE-CREATE RLS POLICIES
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE certification_framework_requirements ENABLE ROW LEVEL SECURITY;

-- Recreate the public read policy
CREATE POLICY IF NOT EXISTS "cert_requirements_public_read" ON certification_framework_requirements
  FOR SELECT USING (true);

-- ============================================================================
-- UPDATE INDEXES
-- ============================================================================

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_framework_requirements_framework;
DROP INDEX IF EXISTS idx_framework_requirements_parent;
DROP INDEX IF EXISTS idx_framework_requirements_category;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_cert_framework_req_framework ON certification_framework_requirements(framework_id);
CREATE INDEX IF NOT EXISTS idx_cert_framework_req_parent ON certification_framework_requirements(parent_requirement_id);
CREATE INDEX IF NOT EXISTS idx_cert_framework_req_category ON certification_framework_requirements(requirement_category);

-- ============================================================================
-- ADD MORE COMPREHENSIVE FRAMEWORK DATA
-- ============================================================================

-- Update B Corp with more details
UPDATE certification_frameworks
SET
  description = 'B Corp certification verifies that a business meets high standards of social and environmental performance, accountability, and transparency. The B Impact Assessment evaluates a company''s impact on its workers, community, environment, and customers.',
  total_points = 200
WHERE framework_code = 'bcorp_21';

-- Update CSRD with more details
UPDATE certification_frameworks
SET
  description = 'The EU Corporate Sustainability Reporting Directive (CSRD) requires companies to report on their sustainability performance using European Sustainability Reporting Standards (ESRS). It covers environmental, social, and governance topics.',
  total_points = 0  -- CSRD is compliance-based, not points-based
WHERE framework_code = 'csrd';

-- Update SBTi with more details
UPDATE certification_frameworks
SET
  description = 'Science Based Targets initiative (SBTi) enables companies to set greenhouse gas emissions reduction targets that are consistent with what climate science says is needed to meet the goals of the Paris Agreement.',
  total_points = 0  -- SBTi is target-based, not points-based
WHERE framework_code = 'sbti';

-- Update GRI with more details
UPDATE certification_frameworks
SET
  description = 'The Global Reporting Initiative (GRI) Standards help organizations understand and communicate their impacts on the economy, environment, and people. GRI reporting is the world''s most widely used sustainability reporting framework.',
  total_points = 0  -- GRI is disclosure-based, not points-based
WHERE framework_code = 'gri';

-- ============================================================================
-- ADD ADDITIONAL FRAMEWORKS
-- ============================================================================

INSERT INTO certification_frameworks (framework_code, framework_name, name, code, framework_version, version, description, governing_body, website_url, passing_score, category, display_order, total_points, is_active)
VALUES
  ('iso14001', 'ISO 14001', 'ISO 14001 Environmental Management', 'iso14001', '2015', '2015',
   'ISO 14001 is an internationally agreed standard that sets out the requirements for an environmental management system. It helps organizations improve their environmental performance through more efficient use of resources and reduction of waste.',
   'International Organization for Standardization', 'https://www.iso.org/iso-14001-environmental-management.html',
   NULL, 'Environmental Management', 5, 0, true),

  ('iso50001', 'ISO 50001', 'ISO 50001 Energy Management', 'iso50001', '2018', '2018',
   'ISO 50001 provides a framework for establishing, implementing, maintaining and improving an energy management system. It enables organizations to follow a systematic approach in achieving continual improvement of energy performance.',
   'International Organization for Standardization', 'https://www.iso.org/iso-50001-energy-management.html',
   NULL, 'Energy Management', 6, 0, true),

  ('cdp_climate', 'CDP Climate Change', 'CDP Climate Change Disclosure', 'cdp_climate', '2024', '2024',
   'CDP Climate Change questionnaire enables companies to measure and manage their environmental impacts by disclosing information about climate change risks, opportunities, and emissions.',
   'CDP', 'https://www.cdp.net/',
   NULL, 'Climate Disclosure', 7, 0, true),

  ('ecovadis', 'EcoVadis', 'EcoVadis Sustainability Rating', 'ecovadis', '2024', '2024',
   'EcoVadis provides business sustainability ratings, assessing companies on their environmental, social, and ethical performance based on international CSR standards.',
   'EcoVadis', 'https://ecovadis.com/',
   45, 'Supply Chain Rating', 8, 100, true)

ON CONFLICT (framework_code) DO UPDATE SET
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  version = EXCLUDED.version,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  total_points = EXCLUDED.total_points;

-- ============================================================================
-- ADD B CORP ADDITIONAL REQUIREMENTS
-- ============================================================================

DO $$
DECLARE
  bcorp_id UUID;
BEGIN
  SELECT id INTO bcorp_id FROM certification_frameworks WHERE framework_code = 'bcorp_21';

  IF bcorp_id IS NOT NULL THEN
    -- Supply Chain requirements (missing from original seed)
    INSERT INTO certification_framework_requirements (framework_id, requirement_code, requirement_name, requirement_category, description, max_points, is_mandatory, required_data_sources, points_available, is_required, data_sources)
    VALUES
      (bcorp_id, 'SUP-SCREEN', 'Supplier Screening', 'supply_chain', 'Screening suppliers for environmental and social practices', 8, false, ARRAY['supply_chain'], 8, false, ARRAY['supply_chain']),
      (bcorp_id, 'SUP-CODE', 'Supplier Code of Conduct', 'supply_chain', 'Formal code of conduct for suppliers', 6, false, ARRAY['supply_chain'], 6, false, ARRAY['supply_chain']),
      (bcorp_id, 'SUP-AUDIT', 'Supplier Audits', 'supply_chain', 'Regular audits of supplier practices', 6, false, ARRAY['supply_chain'], 6, false, ARRAY['supply_chain'])
    ON CONFLICT (framework_id, requirement_code) DO UPDATE SET
      points_available = EXCLUDED.points_available,
      is_required = EXCLUDED.is_required,
      data_sources = EXCLUDED.data_sources;

    -- Update existing requirements to have the new columns populated
    UPDATE certification_framework_requirements
    SET
      points_available = max_points,
      is_required = is_mandatory,
      data_sources = required_data_sources
    WHERE framework_id = bcorp_id AND points_available IS NULL;
  END IF;
END $$;

-- ============================================================================
-- ADD CSRD/ESRS REQUIREMENTS
-- ============================================================================

DO $$
DECLARE
  csrd_id UUID;
BEGIN
  SELECT id INTO csrd_id FROM certification_frameworks WHERE framework_code = 'csrd';

  IF csrd_id IS NOT NULL THEN
    INSERT INTO certification_framework_requirements (framework_id, requirement_code, requirement_name, requirement_category, description, max_points, is_mandatory, required_data_sources, points_available, is_required, data_sources)
    VALUES
      -- General disclosures
      (csrd_id, 'ESRS-2', 'General Disclosures', 'general', 'Governance, strategy, and materiality assessment', 0, true, ARRAY['governance'], 0, true, ARRAY['governance']),

      -- Environmental standards
      (csrd_id, 'ESRS-E1', 'Climate Change', 'environment', 'Climate change mitigation and adaptation', 0, true, ARRAY['environmental'], 0, true, ARRAY['environmental']),
      (csrd_id, 'ESRS-E2', 'Pollution', 'environment', 'Pollution of air, water, and soil', 0, false, ARRAY['environmental'], 0, false, ARRAY['environmental']),
      (csrd_id, 'ESRS-E3', 'Water & Marine Resources', 'environment', 'Water and marine resources', 0, false, ARRAY['environmental'], 0, false, ARRAY['environmental']),
      (csrd_id, 'ESRS-E4', 'Biodiversity & Ecosystems', 'environment', 'Biodiversity and ecosystems', 0, false, ARRAY['environmental'], 0, false, ARRAY['environmental']),
      (csrd_id, 'ESRS-E5', 'Circular Economy', 'environment', 'Resource use and circular economy', 0, false, ARRAY['environmental'], 0, false, ARRAY['environmental']),

      -- Social standards
      (csrd_id, 'ESRS-S1', 'Own Workforce', 'social', 'Own workforce conditions and rights', 0, true, ARRAY['people_culture'], 0, true, ARRAY['people_culture']),
      (csrd_id, 'ESRS-S2', 'Workers in Value Chain', 'social', 'Workers in the value chain', 0, false, ARRAY['supply_chain'], 0, false, ARRAY['supply_chain']),
      (csrd_id, 'ESRS-S3', 'Affected Communities', 'social', 'Affected communities', 0, false, ARRAY['community_impact'], 0, false, ARRAY['community_impact']),
      (csrd_id, 'ESRS-S4', 'Consumers & End-users', 'social', 'Consumers and end-users', 0, false, ARRAY['products'], 0, false, ARRAY['products']),

      -- Governance standards
      (csrd_id, 'ESRS-G1', 'Business Conduct', 'governance', 'Business conduct including anti-corruption', 0, true, ARRAY['governance'], 0, true, ARRAY['governance'])
    ON CONFLICT (framework_id, requirement_code) DO UPDATE SET
      points_available = EXCLUDED.points_available,
      is_required = EXCLUDED.is_required,
      data_sources = EXCLUDED.data_sources;
  END IF;
END $$;

-- ============================================================================
-- ADD SBTi REQUIREMENTS
-- ============================================================================

DO $$
DECLARE
  sbti_id UUID;
BEGIN
  SELECT id INTO sbti_id FROM certification_frameworks WHERE framework_code = 'sbti';

  IF sbti_id IS NOT NULL THEN
    INSERT INTO certification_framework_requirements (framework_id, requirement_code, requirement_name, requirement_category, description, max_points, is_mandatory, required_data_sources, points_available, is_required, data_sources)
    VALUES
      (sbti_id, 'SBT-COMMIT', 'Commitment Letter', 'commitment', 'Submit a commitment letter to set targets', 0, true, ARRAY['governance'], 0, true, ARRAY['governance']),
      (sbti_id, 'SBT-SCOPE12', 'Scope 1 & 2 Targets', 'targets', 'Set near-term Scope 1 and 2 emission reduction targets', 0, true, ARRAY['environmental'], 0, true, ARRAY['environmental']),
      (sbti_id, 'SBT-SCOPE3', 'Scope 3 Target', 'targets', 'Set Scope 3 target if Scope 3 emissions are 40%+ of total', 0, false, ARRAY['environmental', 'supply_chain'], 0, false, ARRAY['environmental', 'supply_chain']),
      (sbti_id, 'SBT-NETZERO', 'Net-Zero Target', 'targets', 'Long-term net-zero target aligned with 1.5°C pathway', 0, false, ARRAY['environmental'], 0, false, ARRAY['environmental']),
      (sbti_id, 'SBT-REPORT', 'Annual Disclosure', 'reporting', 'Disclose emissions annually and progress toward targets', 0, true, ARRAY['environmental'], 0, true, ARRAY['environmental'])
    ON CONFLICT (framework_id, requirement_code) DO UPDATE SET
      points_available = EXCLUDED.points_available,
      is_required = EXCLUDED.is_required,
      data_sources = EXCLUDED.data_sources;
  END IF;
END $$;

-- ============================================================================
-- RECALCULATE TOTAL POINTS
-- ============================================================================

UPDATE certification_frameworks cf
SET total_points = (
  SELECT COALESCE(SUM(max_points), 0)
  FROM certification_framework_requirements cfr
  WHERE cfr.framework_id = cf.id
);
