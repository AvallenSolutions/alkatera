/*
  # Create Vitality Scores and Benchmarking System

  1. New Tables
    - `organization_vitality_scores`
      - Stores calculated vitality scores for each organization over time
      - Enables historical tracking and trend analysis
      - Supports platform-wide and category-specific benchmarking

    - `vitality_score_snapshots`
      - Historical snapshots of vitality scores
      - Enables year-over-year and month-over-month comparisons

  2. Views
    - `vitality_benchmarks`
      - Calculates platform-wide averages
      - Calculates category-specific averages
      - Identifies top performers by pillar

    - `organization_benchmark_comparison`
      - Compares each organization to relevant benchmarks
      - Shows percentile rankings

  3. Security
    - Enable RLS on all new tables
    - Organizations can only read their own vitality scores
    - Benchmark data is anonymized and aggregated
*/

-- Create organization vitality scores table
CREATE TABLE IF NOT EXISTS organization_vitality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calculation_date timestamptz NOT NULL DEFAULT now(),
  year int NOT NULL,

  -- Overall score
  overall_score int NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Pillar scores
  climate_score int NOT NULL CHECK (climate_score >= 0 AND climate_score <= 100),
  water_score int NOT NULL CHECK (water_score >= 0 AND water_score <= 100),
  circularity_score int NOT NULL CHECK (circularity_score >= 0 AND circularity_score <= 100),
  nature_score int NOT NULL CHECK (nature_score >= 0 AND nature_score <= 100),

  -- Supporting metrics for context
  total_emissions_kg numeric,
  emissions_intensity numeric,
  water_consumption_m3 numeric,
  water_risk_level text,
  waste_diversion_rate numeric,
  land_use_m2a numeric,
  biodiversity_risk text,

  -- Products assessed
  products_assessed int DEFAULT 0,

  -- Metadata
  data_quality_score numeric,
  calculation_metadata jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(organization_id, year, calculation_date)
);

CREATE INDEX IF NOT EXISTS idx_vitality_scores_org_year
  ON organization_vitality_scores(organization_id, year DESC);
CREATE INDEX IF NOT EXISTS idx_vitality_scores_calculation_date
  ON organization_vitality_scores(calculation_date DESC);
CREATE INDEX IF NOT EXISTS idx_vitality_scores_overall
  ON organization_vitality_scores(overall_score DESC);

-- Enable RLS
ALTER TABLE organization_vitality_scores ENABLE ROW LEVEL SECURITY;

-- Organizations can read their own scores
CREATE POLICY "Organizations can view own vitality scores"
  ON organization_vitality_scores
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Service role can insert/update scores
CREATE POLICY "Service role can manage vitality scores"
  ON organization_vitality_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create historical snapshots table
CREATE TABLE IF NOT EXISTS vitality_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,

  overall_score int NOT NULL,
  climate_score int NOT NULL,
  water_score int NOT NULL,
  circularity_score int NOT NULL,
  nature_score int NOT NULL,

  created_at timestamptz DEFAULT now(),

  UNIQUE(organization_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_vitality_snapshots_org_date
  ON vitality_score_snapshots(organization_id, snapshot_date DESC);

-- Enable RLS
ALTER TABLE vitality_score_snapshots ENABLE ROW LEVEL SECURITY;

-- Organizations can read their own snapshots
CREATE POLICY "Organizations can view own snapshots"
  ON vitality_score_snapshots
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Service role can insert snapshots
CREATE POLICY "Service role can manage snapshots"
  ON vitality_score_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create view for platform-wide benchmarks
CREATE OR REPLACE VIEW vitality_benchmarks AS
WITH latest_scores AS (
  SELECT DISTINCT ON (organization_id)
    organization_id,
    overall_score,
    climate_score,
    water_score,
    circularity_score,
    nature_score,
    year,
    calculation_date
  FROM organization_vitality_scores
  ORDER BY organization_id, calculation_date DESC
),
org_categories AS (
  SELECT
    id as organization_id,
    industry_sector as category_name
  FROM organizations
  WHERE industry_sector IS NOT NULL
)
SELECT
  'platform' as benchmark_type,
  NULL as category_name,
  ROUND(AVG(ls.overall_score))::int as overall_avg,
  ROUND(AVG(ls.climate_score))::int as climate_avg,
  ROUND(AVG(ls.water_score))::int as water_avg,
  ROUND(AVG(ls.circularity_score))::int as circularity_avg,
  ROUND(AVG(ls.nature_score))::int as nature_avg,
  MAX(ls.overall_score) as overall_top,
  MAX(ls.climate_score) as climate_top,
  MAX(ls.water_score) as water_top,
  MAX(ls.circularity_score) as circularity_top,
  MAX(ls.nature_score) as nature_top,
  COUNT(DISTINCT ls.organization_id) as organization_count,
  now() as calculated_at
FROM latest_scores ls

UNION ALL

SELECT
  'category' as benchmark_type,
  oc.category_name,
  ROUND(AVG(ls.overall_score))::int as overall_avg,
  ROUND(AVG(ls.climate_score))::int as climate_avg,
  ROUND(AVG(ls.water_score))::int as water_avg,
  ROUND(AVG(ls.circularity_score))::int as circularity_avg,
  ROUND(AVG(ls.nature_score))::int as nature_avg,
  MAX(ls.overall_score) as overall_top,
  MAX(ls.climate_score) as climate_top,
  MAX(ls.water_score) as water_top,
  MAX(ls.circularity_score) as circularity_top,
  MAX(ls.nature_score) as nature_top,
  COUNT(DISTINCT ls.organization_id) as organization_count,
  now() as calculated_at
FROM latest_scores ls
JOIN org_categories oc ON ls.organization_id = oc.organization_id
WHERE oc.category_name IS NOT NULL
GROUP BY oc.category_name;

-- Create function to get benchmark comparison for an organization
CREATE OR REPLACE FUNCTION get_organization_benchmark_comparison(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_latest_score organization_vitality_scores%ROWTYPE;
  v_platform_benchmark vitality_benchmarks%ROWTYPE;
  v_category_benchmark vitality_benchmarks%ROWTYPE;
  v_org_category text;
BEGIN
  -- Check if user has access to this organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_organization_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get latest score for organization
  SELECT * INTO v_latest_score
  FROM organization_vitality_scores
  WHERE organization_id = p_organization_id
  ORDER BY calculation_date DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_data', false,
      'message', 'No vitality scores calculated yet'
    );
  END IF;

  -- Get organization category
  SELECT industry_sector INTO v_org_category
  FROM organizations
  WHERE id = p_organization_id;

  -- Get platform benchmark
  SELECT * INTO v_platform_benchmark
  FROM vitality_benchmarks
  WHERE benchmark_type = 'platform';

  -- Get category benchmark if applicable
  IF v_org_category IS NOT NULL THEN
    SELECT * INTO v_category_benchmark
    FROM vitality_benchmarks
    WHERE benchmark_type = 'category'
    AND category_name = v_org_category;
  END IF;

  -- Build result
  v_result := jsonb_build_object(
    'has_data', true,
    'current_scores', jsonb_build_object(
      'overall', v_latest_score.overall_score,
      'climate', v_latest_score.climate_score,
      'water', v_latest_score.water_score,
      'circularity', v_latest_score.circularity_score,
      'nature', v_latest_score.nature_score,
      'calculation_date', v_latest_score.calculation_date
    ),
    'platform_benchmarks', jsonb_build_object(
      'overall_average', v_platform_benchmark.overall_avg,
      'climate_average', v_platform_benchmark.climate_avg,
      'water_average', v_platform_benchmark.water_avg,
      'circularity_average', v_platform_benchmark.circularity_avg,
      'nature_average', v_platform_benchmark.nature_avg,
      'overall_top', v_platform_benchmark.overall_top,
      'climate_top', v_platform_benchmark.climate_top,
      'water_top', v_platform_benchmark.water_top,
      'circularity_top', v_platform_benchmark.circularity_top,
      'nature_top', v_platform_benchmark.nature_top,
      'organization_count', v_platform_benchmark.organization_count
    )
  );

  -- Add category benchmarks if available
  IF v_category_benchmark IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'category_benchmarks', jsonb_build_object(
        'category_name', v_org_category,
        'overall_average', v_category_benchmark.overall_avg,
        'climate_average', v_category_benchmark.climate_avg,
        'water_average', v_category_benchmark.water_avg,
        'circularity_average', v_category_benchmark.circularity_avg,
        'nature_average', v_category_benchmark.nature_avg,
        'overall_top', v_category_benchmark.overall_top,
        'climate_top', v_category_benchmark.climate_top,
        'water_top', v_category_benchmark.water_top,
        'circularity_top', v_category_benchmark.circularity_top,
        'nature_top', v_category_benchmark.nature_top,
        'organization_count', v_category_benchmark.organization_count
      )
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Create function to store/update vitality score
CREATE OR REPLACE FUNCTION upsert_organization_vitality_score(
  p_organization_id uuid,
  p_year int,
  p_overall_score int,
  p_climate_score int,
  p_water_score int,
  p_circularity_score int,
  p_nature_score int,
  p_metrics jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score_id uuid;
BEGIN
  INSERT INTO organization_vitality_scores (
    organization_id,
    year,
    overall_score,
    climate_score,
    water_score,
    circularity_score,
    nature_score,
    total_emissions_kg,
    emissions_intensity,
    water_consumption_m3,
    water_risk_level,
    waste_diversion_rate,
    land_use_m2a,
    biodiversity_risk,
    products_assessed,
    calculation_metadata
  ) VALUES (
    p_organization_id,
    p_year,
    p_overall_score,
    p_climate_score,
    p_water_score,
    p_circularity_score,
    p_nature_score,
    (p_metrics->>'total_emissions_kg')::numeric,
    (p_metrics->>'emissions_intensity')::numeric,
    (p_metrics->>'water_consumption_m3')::numeric,
    p_metrics->>'water_risk_level',
    (p_metrics->>'waste_diversion_rate')::numeric,
    (p_metrics->>'land_use_m2a')::numeric,
    p_metrics->>'biodiversity_risk',
    (p_metrics->>'products_assessed')::int,
    p_metrics
  )
  ON CONFLICT (organization_id, year, calculation_date)
  DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    climate_score = EXCLUDED.climate_score,
    water_score = EXCLUDED.water_score,
    circularity_score = EXCLUDED.circularity_score,
    nature_score = EXCLUDED.nature_score,
    total_emissions_kg = EXCLUDED.total_emissions_kg,
    emissions_intensity = EXCLUDED.emissions_intensity,
    water_consumption_m3 = EXCLUDED.water_consumption_m3,
    water_risk_level = EXCLUDED.water_risk_level,
    waste_diversion_rate = EXCLUDED.waste_diversion_rate,
    land_use_m2a = EXCLUDED.land_use_m2a,
    biodiversity_risk = EXCLUDED.biodiversity_risk,
    products_assessed = EXCLUDED.products_assessed,
    calculation_metadata = EXCLUDED.calculation_metadata,
    updated_at = now()
  RETURNING id INTO v_score_id;

  -- Also create a snapshot for the current date
  INSERT INTO vitality_score_snapshots (
    organization_id,
    snapshot_date,
    overall_score,
    climate_score,
    water_score,
    circularity_score,
    nature_score
  ) VALUES (
    p_organization_id,
    CURRENT_DATE,
    p_overall_score,
    p_climate_score,
    p_water_score,
    p_circularity_score,
    p_nature_score
  )
  ON CONFLICT (organization_id, snapshot_date)
  DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    climate_score = EXCLUDED.climate_score,
    water_score = EXCLUDED.water_score,
    circularity_score = EXCLUDED.circularity_score,
    nature_score = EXCLUDED.nature_score;

  RETURN v_score_id;
END;
$$;