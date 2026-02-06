-- ============================================================================
-- ISO 14044 COMPLIANCE: PEDIGREE MATRIX & DATA QUALITY ENHANCEMENTS
-- ============================================================================
-- Adds 5-dimensional Pedigree Matrix scoring per ISO 14044 Section 4.2.3.6
-- Enables proper Data Quality Indicator (DQI) calculation
-- Supports uncertainty propagation through LCA calculations
-- ============================================================================

-- Add Pedigree Matrix columns to staging_emission_factors
-- Each dimension is scored 1-5 per Weidema & Wesnaes (1996) methodology
ALTER TABLE public.staging_emission_factors
ADD COLUMN IF NOT EXISTS pedigree_reliability smallint DEFAULT 3
  CHECK (pedigree_reliability >= 1 AND pedigree_reliability <= 5),
ADD COLUMN IF NOT EXISTS pedigree_completeness smallint DEFAULT 3
  CHECK (pedigree_completeness >= 1 AND pedigree_completeness <= 5),
ADD COLUMN IF NOT EXISTS pedigree_temporal smallint DEFAULT 3
  CHECK (pedigree_temporal >= 1 AND pedigree_temporal <= 5),
ADD COLUMN IF NOT EXISTS pedigree_geographical smallint DEFAULT 3
  CHECK (pedigree_geographical >= 1 AND pedigree_geographical <= 5),
ADD COLUMN IF NOT EXISTS pedigree_technological smallint DEFAULT 3
  CHECK (pedigree_technological >= 1 AND pedigree_technological <= 5);

-- Add cut-off criteria documentation (ISO 14044 Section 4.2.3.3.2)
ALTER TABLE public.staging_emission_factors
ADD COLUMN IF NOT EXISTS cutoff_rules text DEFAULT NULL;

-- Add data vintage tracking for temporal representativeness
ALTER TABLE public.staging_emission_factors
ADD COLUMN IF NOT EXISTS data_collection_year smallint DEFAULT NULL,
ADD COLUMN IF NOT EXISTS data_publication_year smallint DEFAULT NULL;

-- Add computed DQI score based on Pedigree Matrix (0-100 scale)
-- Formula: 100 - ((sum of (score-1) / 20) * 100) where perfect = all 1s = 100%
ALTER TABLE public.staging_emission_factors
ADD COLUMN IF NOT EXISTS pedigree_dqi_score numeric(5,2)
  GENERATED ALWAYS AS (
    100.0 - (
      (COALESCE(pedigree_reliability, 3) - 1 +
       COALESCE(pedigree_completeness, 3) - 1 +
       COALESCE(pedigree_temporal, 3) - 1 +
       COALESCE(pedigree_geographical, 3) - 1 +
       COALESCE(pedigree_technological, 3) - 1
      ) / 20.0 * 100.0
    )
  ) STORED;

-- ============================================================================
-- BACKFILL PEDIGREE SCORES FROM EXISTING DATA QUALITY GRADES
-- ============================================================================
-- Map existing data_quality_grade to Pedigree Matrix scores:
-- HIGH   -> reliability=2, completeness=2, temporal=2, geo=2, tech=2 (DQI=90%)
-- MEDIUM -> reliability=3, completeness=3, temporal=3, geo=3, tech=3 (DQI=70%)
-- LOW    -> reliability=4, completeness=4, temporal=4, geo=4, tech=4 (DQI=50%)

-- Update factors based on their metadata quality grade
UPDATE public.staging_emission_factors
SET
  pedigree_reliability = CASE
    WHEN metadata->>'data_quality_grade' = 'HIGH' THEN 2
    WHEN metadata->>'data_quality_grade' = 'MEDIUM' THEN 3
    ELSE 4
  END,
  pedigree_completeness = CASE
    WHEN metadata->>'data_quality_grade' = 'HIGH' THEN 2
    WHEN metadata->>'data_quality_grade' = 'MEDIUM' THEN 3
    ELSE 4
  END,
  pedigree_temporal = CASE
    WHEN metadata->>'data_quality_grade' = 'HIGH' THEN 2
    WHEN metadata->>'data_quality_grade' = 'MEDIUM' THEN 3
    ELSE 4
  END,
  pedigree_geographical = CASE
    WHEN geographic_scope IN ('GB', 'UK', 'EU', 'US') THEN 2
    WHEN geographic_scope = 'GLO' THEN 3
    ELSE 4
  END,
  pedigree_technological = CASE
    WHEN metadata->>'data_quality_grade' = 'HIGH' THEN 2
    WHEN metadata->>'data_quality_grade' = 'MEDIUM' THEN 3
    ELSE 4
  END
WHERE organization_id IS NULL;

-- Extract data years from temporal_coverage where possible
-- Format is typically "2020-2024" or "2023"
UPDATE public.staging_emission_factors
SET
  data_collection_year = CASE
    WHEN temporal_coverage ~ '^\d{4}$' THEN temporal_coverage::smallint
    WHEN temporal_coverage ~ '^\d{4}-\d{4}$' THEN SPLIT_PART(temporal_coverage, '-', 2)::smallint
    ELSE NULL
  END,
  data_publication_year = CASE
    WHEN metadata->'literature_source'->>'year' IS NOT NULL
    THEN (metadata->'literature_source'->>'year')::smallint
    ELSE NULL
  END
WHERE organization_id IS NULL
  AND temporal_coverage IS NOT NULL;

-- ============================================================================
-- PEDIGREE MATRIX REFERENCE DOCUMENTATION
-- ============================================================================
-- Create a reference table documenting the Pedigree Matrix scoring criteria
-- per Weidema & Wesnaes (1996) and ecoinvent guidelines

CREATE TABLE IF NOT EXISTS public.pedigree_matrix_reference (
  dimension text PRIMARY KEY,
  score_1 text NOT NULL,
  score_2 text NOT NULL,
  score_3 text NOT NULL,
  score_4 text NOT NULL,
  score_5 text NOT NULL
);

INSERT INTO public.pedigree_matrix_reference (dimension, score_1, score_2, score_3, score_4, score_5)
VALUES
  ('reliability',
   'Verified data based on measurements',
   'Verified data partly based on assumptions or non-verified data based on measurements',
   'Non-verified data partly based on qualified estimates',
   'Qualified estimate (e.g., by industrial expert)',
   'Non-qualified estimate'),
  ('completeness',
   'Representative data from all sites relevant for the market considered, over an adequate period',
   'Representative data from >50% of sites relevant for the market, over an adequate period',
   'Representative data from only some sites (<50%) OR >50% of sites but from shorter periods',
   'Representative data from only one site OR some sites but from shorter periods',
   'Unknown representativeness or data from a small number of sites and shorter periods'),
  ('temporal',
   'Less than 3 years difference to reference year',
   '3-6 years difference to reference year',
   '6-10 years difference to reference year',
   '10-15 years difference to reference year',
   'Age of data unknown or more than 15 years'),
  ('geographical',
   'Data from area under study',
   'Average data from larger area in which the area under study is included',
   'Data from area with similar production conditions',
   'Data from area with slightly similar production conditions',
   'Data from unknown or distinctly different area'),
  ('technological',
   'Data from enterprises, processes, and materials under study',
   'Data from processes and materials under study but from different enterprises',
   'Data from processes and materials under study but from different technology',
   'Data on related processes or materials',
   'Data on related processes on laboratory scale or from different technology')
ON CONFLICT (dimension) DO NOTHING;

-- ============================================================================
-- ADD INDICES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_staging_factors_pedigree_dqi
  ON public.staging_emission_factors(pedigree_dqi_score);

CREATE INDEX IF NOT EXISTS idx_staging_factors_data_year
  ON public.staging_emission_factors(data_collection_year);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON COLUMN public.staging_emission_factors.pedigree_reliability IS
  'ISO 14044 Pedigree Matrix: Reliability (1=verified measurements, 5=non-qualified estimate)';
COMMENT ON COLUMN public.staging_emission_factors.pedigree_completeness IS
  'ISO 14044 Pedigree Matrix: Completeness (1=all relevant sites, 5=unknown representativeness)';
COMMENT ON COLUMN public.staging_emission_factors.pedigree_temporal IS
  'ISO 14044 Pedigree Matrix: Temporal correlation (1=<3yr difference, 5=>15yr or unknown)';
COMMENT ON COLUMN public.staging_emission_factors.pedigree_geographical IS
  'ISO 14044 Pedigree Matrix: Geographical correlation (1=exact area, 5=unknown/different area)';
COMMENT ON COLUMN public.staging_emission_factors.pedigree_technological IS
  'ISO 14044 Pedigree Matrix: Technological correlation (1=exact technology, 5=different technology)';
COMMENT ON COLUMN public.staging_emission_factors.pedigree_dqi_score IS
  'Computed Data Quality Indicator (0-100%) from Pedigree Matrix scores';
COMMENT ON COLUMN public.staging_emission_factors.cutoff_rules IS
  'ISO 14044 Section 4.2.3.3.2: Documentation of cut-off criteria applied';
COMMENT ON COLUMN public.staging_emission_factors.data_collection_year IS
  'Year the underlying data was collected (for temporal representativeness)';
COMMENT ON COLUMN public.staging_emission_factors.data_publication_year IS
  'Year the source was published';
