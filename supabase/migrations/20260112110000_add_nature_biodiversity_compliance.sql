/*
  # Nature & Biodiversity Compliance Tables

  ## Purpose
  Create database structures for nature impact benchmarks and methodology documentation
  to support CSRD ESRS E4, TNFD LEAP, and ReCiPe 2016 compliance.

  ## Compliance Standards
  - CSRD ESRS E4 - Biodiversity and Ecosystems
  - TNFD - Taskforce on Nature-related Financial Disclosures
  - ReCiPe 2016 Midpoint (Hierarchist)
  - GRI 304 - Biodiversity

  ## Tables Created
  1. nature_performance_benchmarks - Configurable performance thresholds
  2. nature_calculation_methodology (view) - Audit documentation

  ## Important Notes
  - Benchmarks are INTERNAL, not regulatory requirements
  - TNFD/SBTN do not prescribe specific thresholds
  - Review benchmarks annually
*/

-- =====================================================
-- SECTION 1: NATURE PERFORMANCE BENCHMARKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS nature_performance_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Land Use thresholds (m²a/unit)
  land_use_excellent numeric NOT NULL DEFAULT 500,
  land_use_good numeric NOT NULL DEFAULT 2000,
  land_use_source text NOT NULL DEFAULT 'Internal benchmark (beverage sector LCA studies)',

  -- Terrestrial Ecotoxicity thresholds (kg 1,4-DCB eq/unit)
  ecotoxicity_excellent numeric NOT NULL DEFAULT 5,
  ecotoxicity_good numeric NOT NULL DEFAULT 15,
  ecotoxicity_source text NOT NULL DEFAULT 'Internal benchmark (ReCiPe 2016 sector data)',

  -- Freshwater Eutrophication thresholds (kg P eq/unit)
  eutrophication_excellent numeric NOT NULL DEFAULT 0.3,
  eutrophication_good numeric NOT NULL DEFAULT 0.7,
  eutrophication_source text NOT NULL DEFAULT 'Internal benchmark (EU WFD alignment)',

  -- Terrestrial Acidification thresholds (kg SO₂ eq/unit)
  acidification_excellent numeric NOT NULL DEFAULT 1.5,
  acidification_good numeric NOT NULL DEFAULT 3.0,
  acidification_source text NOT NULL DEFAULT 'Internal benchmark (DEFRA/industrial LCA)',

  -- Land Intensity thresholds for materials (m²a/kg)
  land_intensity_low numeric NOT NULL DEFAULT 5,
  land_intensity_medium numeric NOT NULL DEFAULT 15,

  -- Metadata
  is_active boolean NOT NULL DEFAULT true,
  sector text DEFAULT 'beverage', -- Can be customized per sector
  notes text,
  last_review_date date NOT NULL DEFAULT CURRENT_DATE,
  next_review_date date DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
  reviewed_by uuid REFERENCES auth.users(id),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure only one active benchmark set
CREATE UNIQUE INDEX IF NOT EXISTS idx_nature_benchmarks_active
  ON nature_performance_benchmarks (is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE nature_performance_benchmarks ENABLE ROW LEVEL SECURITY;

-- Read-only for all authenticated users (reference data)
CREATE POLICY "nature_benchmarks_read" ON nature_performance_benchmarks
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE nature_performance_benchmarks IS
  'Configurable performance thresholds for nature impact metrics. These are INTERNAL BENCHMARKS, not regulatory requirements. TNFD/SBTN do not prescribe specific thresholds.';

-- Insert default benchmarks
INSERT INTO nature_performance_benchmarks (
  land_use_excellent, land_use_good, land_use_source,
  ecotoxicity_excellent, ecotoxicity_good, ecotoxicity_source,
  eutrophication_excellent, eutrophication_good, eutrophication_source,
  acidification_excellent, acidification_good, acidification_source,
  sector, notes, is_active
) VALUES (
  500, 2000, 'Internal benchmark - beverage sector LCA studies (JRC PEF)',
  5, 15, 'Internal benchmark - ReCiPe 2016 sector data',
  0.3, 0.7, 'Internal benchmark - EU Water Framework Directive alignment',
  1.5, 3.0, 'Internal benchmark - DEFRA/industrial LCA studies',
  'beverage',
  'Initial benchmarks based on beverage industry LCA studies and PEF benchmarks. Review annually.',
  true
) ON CONFLICT DO NOTHING;

-- =====================================================
-- SECTION 2: MATERIAL FOSSIL/BIOGENIC SPLITS
-- =====================================================

-- Add columns to staging_emission_factors for fossil/biogenic breakdown
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staging_emission_factors' AND column_name = 'fossil_carbon_fraction'
  ) THEN
    ALTER TABLE staging_emission_factors ADD COLUMN fossil_carbon_fraction numeric DEFAULT 0.85
      CHECK (fossil_carbon_fraction >= 0 AND fossil_carbon_fraction <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staging_emission_factors' AND column_name = 'biogenic_carbon_fraction'
  ) THEN
    ALTER TABLE staging_emission_factors ADD COLUMN biogenic_carbon_fraction numeric DEFAULT 0.15
      CHECK (biogenic_carbon_fraction >= 0 AND biogenic_carbon_fraction <= 1);
  END IF;
END $$;

COMMENT ON COLUMN staging_emission_factors.fossil_carbon_fraction IS
  'Fraction of GWP from fossil carbon sources (0-1). Default 0.85 for industrial materials.';
COMMENT ON COLUMN staging_emission_factors.biogenic_carbon_fraction IS
  'Fraction of GWP from biogenic carbon sources (0-1). Default 0.15. Higher for agricultural products.';

-- Update fossil/biogenic splits for known material types
-- Agricultural products: higher biogenic fraction
UPDATE staging_emission_factors
SET fossil_carbon_fraction = 0.30, biogenic_carbon_fraction = 0.70
WHERE category = 'Ingredient'
  AND (name ILIKE '%apple%' OR name ILIKE '%grape%' OR name ILIKE '%barley%'
       OR name ILIKE '%hop%' OR name ILIKE '%sugar%' OR name ILIKE '%wheat%'
       OR name ILIKE '%corn%' OR name ILIKE '%fruit%');

-- Packaging materials: mostly fossil
UPDATE staging_emission_factors
SET fossil_carbon_fraction = 0.95, biogenic_carbon_fraction = 0.05
WHERE category = 'Packaging'
  AND (name ILIKE '%plastic%' OR name ILIKE '%PET%' OR name ILIKE '%aluminium%'
       OR name ILIKE '%aluminum%' OR name ILIKE '%glass%');

-- Paper/cardboard: mostly biogenic
UPDATE staging_emission_factors
SET fossil_carbon_fraction = 0.25, biogenic_carbon_fraction = 0.75
WHERE category = 'Packaging'
  AND (name ILIKE '%paper%' OR name ILIKE '%cardboard%' OR name ILIKE '%cork%');

-- Energy: depends on source
UPDATE staging_emission_factors
SET fossil_carbon_fraction = 1.0, biogenic_carbon_fraction = 0.0
WHERE category = 'Energy'
  AND (name ILIKE '%natural gas%' OR name ILIKE '%diesel%' OR name ILIKE '%coal%');

-- =====================================================
-- SECTION 3: NATURE METHODOLOGY DOCUMENTATION VIEW
-- =====================================================

CREATE OR REPLACE VIEW nature_calculation_methodology AS
SELECT
  'CSRD ESRS E4 - Biodiversity and Ecosystems' as disclosure_standard,
  jsonb_build_object(
    'impact_assessment', jsonb_build_object(
      'methodology', 'ReCiPe 2016 Midpoint (Hierarchist)',
      'source', 'https://www.rivm.nl/bibliotheek/rapporten/2016-0104.pdf',
      'categories', jsonb_build_array(
        jsonb_build_object('name', 'Land Use', 'unit', 'm²a crop eq', 'code', 'LU'),
        jsonb_build_object('name', 'Terrestrial Ecotoxicity', 'unit', 'kg 1,4-DCB eq', 'code', 'TETPinf'),
        jsonb_build_object('name', 'Freshwater Eutrophication', 'unit', 'kg P eq', 'code', 'FEP'),
        jsonb_build_object('name', 'Terrestrial Acidification', 'unit', 'kg SO₂ eq', 'code', 'TAP100')
      ),
      'characterisation_factors', 'ReCiPe 2016 v1.1'
    ),
    'ef31_normalisation', jsonb_build_object(
      'baseline', 'EU-27+UK 2010',
      'land_use_factor', 819000,
      'ecotoxicity_factor', 28700,
      'eutrophication_factor', 1.61,
      'acidification_factor', 55.6,
      'source', 'JRC EF 3.1 Report'
    ),
    'data_sources', jsonb_build_object(
      'priority_1', 'Supplier EPDs and verified LCA data',
      'priority_2', 'Ecoinvent 3.12 (license pending)',
      'priority_3', 'Internal staging_emission_factors proxies'
    ),
    'tnfd_alignment', jsonb_build_object(
      'framework', 'TNFD LEAP Approach v1.0',
      'locate', 'Partial - supply chain origin tracking',
      'evaluate', 'Implemented - ReCiPe 2016 impact metrics',
      'assess', 'Not implemented - risk assessment pending',
      'prepare', 'Partial - metrics reporting'
    ),
    'disclaimers', jsonb_build_array(
      'Performance thresholds are internal benchmarks, not regulatory requirements',
      'TNFD and SBTN do not prescribe specific impact thresholds',
      'Ecoinvent data pending license - current factors are proxy values',
      'Impact factors vary by geography, farming practice, and supply chain',
      'Users should set their own targets per ESRS E4-4 requirements'
    )
  ) as methodology_documentation,
  (SELECT jsonb_build_object(
    'land_use', jsonb_build_object('excellent', land_use_excellent, 'good', land_use_good, 'source', land_use_source),
    'ecotoxicity', jsonb_build_object('excellent', ecotoxicity_excellent, 'good', ecotoxicity_good, 'source', ecotoxicity_source),
    'eutrophication', jsonb_build_object('excellent', eutrophication_excellent, 'good', eutrophication_good, 'source', eutrophication_source),
    'acidification', jsonb_build_object('excellent', acidification_excellent, 'good', acidification_good, 'source', acidification_source),
    'last_review', last_review_date,
    'next_review', next_review_date
  ) FROM nature_performance_benchmarks WHERE is_active = true LIMIT 1) as active_benchmarks,
  now() as generated_at;

COMMENT ON VIEW nature_calculation_methodology IS
  'ESRS E4 disclosure documentation: methodology, benchmarks, and data sources for nature impact calculations.';

-- =====================================================
-- SECTION 4: FUNCTION TO GET MATERIAL-SPECIFIC SPLITS
-- =====================================================

CREATE OR REPLACE FUNCTION get_fossil_biogenic_split(p_material_name text)
RETURNS TABLE (
  fossil_fraction numeric,
  biogenic_fraction numeric,
  source text
) AS $$
BEGIN
  -- Try to find material-specific split
  RETURN QUERY
  SELECT
    COALESCE(sef.fossil_carbon_fraction, 0.85) as fossil_fraction,
    COALESCE(sef.biogenic_carbon_fraction, 0.15) as biogenic_fraction,
    COALESCE(sef.name, 'Default (85/15)') as source
  FROM staging_emission_factors sef
  WHERE sef.name ILIKE '%' || p_material_name || '%'
  LIMIT 1;

  -- If no match, return defaults
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      0.85::numeric as fossil_fraction,
      0.15::numeric as biogenic_fraction,
      'Default assumption'::text as source;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_fossil_biogenic_split(text) TO authenticated;

COMMENT ON FUNCTION get_fossil_biogenic_split IS
  'Returns material-specific fossil/biogenic carbon split. Defaults to 85/15 if material not found.';
