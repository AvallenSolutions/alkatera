-- Migration: Nature Impact Assessments & Performance Benchmarks
-- Creates tables for TNFD LEAP Framework dependency/impact data capture
-- and nature performance benchmarks used by nature-biodiversity.ts.

-- ============================================================================
-- nature_impact_assessments — annual TNFD LEAP questionnaire data
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nature_impact_assessments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  assessment_year int NOT NULL,
  assessment_status text NOT NULL DEFAULT 'draft'
    CHECK (assessment_status IN ('draft', 'complete', 'reviewed')),

  -- TNFD LEAP: Evaluate — Dependencies
  water_dependency_level text CHECK (water_dependency_level IN ('low', 'medium', 'high', 'critical')),
  water_dependency_notes text,
  pollination_dependency_level text CHECK (pollination_dependency_level IN ('low', 'medium', 'high', 'critical')),
  pollination_dependency_notes text,
  soil_health_dependency_level text CHECK (soil_health_dependency_level IN ('low', 'medium', 'high', 'critical')),
  soil_health_dependency_notes text,

  -- TNFD LEAP: Evaluate — Impacts
  land_use_ha numeric(10,2),
  land_converted_ha numeric(10,2),
  pollution_outputs_kg_n numeric(12,4),
  pollution_outputs_kg_p numeric(12,4),
  pesticide_kg_active numeric(10,4),
  invasive_species_risk text CHECK (invasive_species_risk IN ('none', 'low', 'medium', 'high')),
  invasive_species_details text,

  -- TNFD LEAP: Assess — Materiality
  nature_risk_materiality text CHECK (nature_risk_materiality IN ('not_material', 'potentially_material', 'material', 'highly_material')),
  materiality_rationale text,
  physical_risk_notes text,
  transition_risk_notes text,

  -- TNFD LEAP: Prepare — Targets
  has_nature_positive_target boolean NOT NULL DEFAULT false,
  nature_positive_target_year int,
  nature_positive_target_description text,
  nature_positive_baseline_year int,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),

  UNIQUE (organization_id, assessment_year)
);

COMMENT ON TABLE public.nature_impact_assessments IS
  'Annual nature dependency and impact assessment per TNFD LEAP Framework and CSRD ESRS E4.';
COMMENT ON COLUMN public.nature_impact_assessments.land_use_ha IS
  'Total agricultural land area under the organisation''s operational control or in its supply chain (ha). Used for TNFD core metric: area of land use.';
COMMENT ON COLUMN public.nature_impact_assessments.nature_risk_materiality IS
  'Organisation''s own materiality determination for nature-related risks per TNFD recommendations Section 4.';

-- RLS
ALTER TABLE public.nature_impact_assessments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nature_impact_assessments' AND policyname = 'Users can view own org nature assessments'
  ) THEN
    CREATE POLICY "Users can view own org nature assessments" ON public.nature_impact_assessments
      FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nature_impact_assessments' AND policyname = 'Users can manage own org nature assessments'
  ) THEN
    CREATE POLICY "Users can manage own org nature assessments" ON public.nature_impact_assessments
      FOR ALL USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- ============================================================================
-- nature_performance_benchmarks — queried by getNatureBenchmarksFromDB()
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nature_performance_benchmarks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active boolean NOT NULL DEFAULT true,
  land_use_excellent numeric NOT NULL DEFAULT 500,
  land_use_good numeric NOT NULL DEFAULT 2000,
  land_use_source text NOT NULL DEFAULT 'Internal benchmark (beverage sector LCA studies)',
  ecotoxicity_excellent numeric NOT NULL DEFAULT 5,
  ecotoxicity_good numeric NOT NULL DEFAULT 15,
  ecotoxicity_source text NOT NULL DEFAULT 'Internal benchmark (ReCiPe 2016 sector data)',
  eutrophication_excellent numeric NOT NULL DEFAULT 0.3,
  eutrophication_good numeric NOT NULL DEFAULT 0.7,
  eutrophication_source text NOT NULL DEFAULT 'Internal benchmark (EU WFD alignment)',
  acidification_excellent numeric NOT NULL DEFAULT 1.5,
  acidification_good numeric NOT NULL DEFAULT 3.0,
  acidification_source text NOT NULL DEFAULT 'Internal benchmark (DEFRA/industrial LCA)',
  last_review_date date NOT NULL DEFAULT '2026-01-12',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the single active row with default values matching NATURE_PERFORMANCE_THRESHOLDS
INSERT INTO public.nature_performance_benchmarks (is_active)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.nature_performance_benchmarks WHERE is_active = true);

-- Reload PostgREST schema cache so new tables/columns are immediately available
NOTIFY pgrst, 'reload schema';
