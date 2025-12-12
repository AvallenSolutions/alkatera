/*
  # Create EF 3.1 Reference Tables

  ## Overview
  This migration creates the reference tables needed to support Environmental Footprint 3.1
  calculations, including official impact category definitions, EU27 2010 normalisation
  factors, and weighting factors for single score calculation.

  ## Tables Created

  ### 1. `ef31_impact_categories`
  Reference table containing all 16 EF 3.1 mandatory impact categories with:
  - Official category names and codes
  - Unit of measurement
  - Characterisation model reference
  - Default weighting factor

  ### 2. `ef31_normalisation_factors`
  EU27 2010 person-year equivalent normalisation reference values:
  - One record per impact category
  - Values based on EU27 2010 reference (official PEF values)
  - Source documentation references

  ### 3. `ef31_weighting_factors`
  Weighting factors for converting normalised impacts to single score:
  - Default EF weighting set
  - Supports custom weighting sets per organisation

  ### 4. `ef31_process_mappings`
  Maps EcoInvent 3.12 process UUIDs to EF 3.1 impact factors:
  - Links staging emission factors to EF 3.1 values
  - Supports hybrid data resolution

  ## Security
  - All tables have RLS enabled
  - Reference data readable by all authenticated users
  - Only system can modify reference data

  ## Data Sources
  - EU JRC EPLCA platform (official EF 3.1 values)
  - EcoInvent 3.12 database
  - ILCD format characterisation factors
*/

-- =====================================================
-- STEP 1: CREATE EF 3.1 IMPACT CATEGORIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ef31_impact_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_description TEXT NOT NULL,
  characterisation_model TEXT NOT NULL,
  model_version TEXT,
  default_weight NUMERIC(6, 4) NOT NULL DEFAULT 0.0625,
  display_order INTEGER NOT NULL,
  description TEXT,
  regulatory_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.ef31_impact_categories IS
  'Official EF 3.1 impact category definitions with characterisation model references and default weights.';

ALTER TABLE public.ef31_impact_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view EF 3.1 impact categories"
  ON public.ef31_impact_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- STEP 2: POPULATE EF 3.1 IMPACT CATEGORIES
-- =====================================================

INSERT INTO public.ef31_impact_categories (code, name, short_name, unit, unit_description, characterisation_model, model_version, default_weight, display_order, description) VALUES
  ('CC', 'Climate change', 'Climate', 'kg CO2 eq', 'kilogram CO2 equivalent', 'IPCC AR5', 'GWP100', 0.2106, 1, 'Global warming potential over 100 years including fossil, biogenic, and land use change'),
  ('OD', 'Ozone depletion', 'Ozone', 'kg CFC-11 eq', 'kilogram CFC-11 equivalent', 'WMO', '2014', 0.0631, 2, 'Stratospheric ozone layer destruction potential'),
  ('IR', 'Ionising radiation', 'Radiation', 'kBq U235 eq', 'kilobecquerel U235 equivalent', 'Frischknecht et al.', '2000', 0.0501, 3, 'Human health effects from radioactive substance emissions'),
  ('POF', 'Photochemical ozone formation', 'Smog', 'kg NMVOC eq', 'kilogram NMVOC equivalent', 'Van Zelm et al.', '2008 (ReCiPe)', 0.0478, 4, 'Ground-level ozone formation affecting human health'),
  ('PM', 'Particulate matter', 'PM', 'disease incidence', 'disease incidence', 'UNEP', '2016', 0.0896, 5, 'Respiratory effects from fine particulate emissions'),
  ('HTC', 'Human toxicity, cancer', 'Tox Cancer', 'CTUh', 'Comparative Toxic Unit human', 'USEtox', '2.12', 0.0213, 6, 'Carcinogenic effects on human health'),
  ('HTNC', 'Human toxicity, non-cancer', 'Tox Non-C', 'CTUh', 'Comparative Toxic Unit human', 'USEtox', '2.12', 0.0184, 7, 'Non-carcinogenic effects on human health'),
  ('AC', 'Acidification', 'Acid', 'mol H+ eq', 'mole H+ equivalent', 'Accumulated Exceedance', 'Seppala et al. 2006', 0.0620, 8, 'Terrestrial and aquatic acidification potential'),
  ('EUF', 'Eutrophication, freshwater', 'Eutro FW', 'kg P eq', 'kilogram P equivalent', 'ReCiPe', '2008', 0.0280, 9, 'Freshwater nutrient enrichment from phosphorus'),
  ('EUM', 'Eutrophication, marine', 'Eutro Marine', 'kg N eq', 'kilogram N equivalent', 'ReCiPe', '2008', 0.0296, 10, 'Marine nutrient enrichment from nitrogen'),
  ('EUT', 'Eutrophication, terrestrial', 'Eutro Terr', 'mol N eq', 'mole N equivalent', 'Accumulated Exceedance', 'Seppala et al. 2006', 0.0371, 11, 'Terrestrial nutrient enrichment'),
  ('ETF', 'Ecotoxicity, freshwater', 'Ecotox', 'CTUe', 'Comparative Toxic Unit ecosystem', 'USEtox', '2.12', 0.0192, 12, 'Toxic effects on freshwater ecosystems'),
  ('LU', 'Land use', 'Land', 'pt', 'dimensionless point', 'LANCA', 'v2.5', 0.0794, 13, 'Soil quality degradation from land occupation and transformation'),
  ('WU', 'Water use', 'Water', 'm3 world eq', 'cubic metre world equivalent', 'AWARE', '1.2', 0.0851, 14, 'Water scarcity weighted consumption'),
  ('RUF', 'Resource use, fossils', 'Res Fossil', 'MJ', 'megajoule', 'CML', '2002 (ADP fossil)', 0.0832, 15, 'Abiotic depletion of fossil energy carriers'),
  ('RUM', 'Resource use, minerals and metals', 'Res Mineral', 'kg Sb eq', 'kilogram Sb equivalent', 'CML', '2002 (ADP ultimate reserves)', 0.0755, 16, 'Abiotic depletion of mineral and metal resources')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- STEP 3: CREATE EF 3.1 NORMALISATION FACTORS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ef31_normalisation_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  impact_category_code TEXT NOT NULL REFERENCES public.ef31_impact_categories(code),
  reference_region TEXT NOT NULL DEFAULT 'EU27+1',
  reference_year INTEGER NOT NULL DEFAULT 2010,
  normalisation_value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  source_document TEXT,
  source_version TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(impact_category_code, reference_region, reference_year)
);

COMMENT ON TABLE public.ef31_normalisation_factors IS
  'EU27 2010 normalisation reference values for EF 3.1. Values represent per-capita annual impacts.';

ALTER TABLE public.ef31_normalisation_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view normalisation factors"
  ON public.ef31_normalisation_factors
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- STEP 4: POPULATE EF 3.1 NORMALISATION FACTORS (EU27 2010)
-- =====================================================

INSERT INTO public.ef31_normalisation_factors (impact_category_code, reference_region, reference_year, normalisation_value, unit, source_document) VALUES
  ('CC', 'EU27+1', 2010, 8090, 'kg CO2 eq/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('OD', 'EU27+1', 2010, 0.0536, 'kg CFC-11 eq/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('IR', 'EU27+1', 2010, 4220, 'kBq U235 eq/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('POF', 'EU27+1', 2010, 40.6, 'kg NMVOC eq/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('PM', 'EU27+1', 2010, 0.000594, 'disease incidence/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('HTC', 'EU27+1', 2010, 0.0000169, 'CTUh/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('HTNC', 'EU27+1', 2010, 0.000233, 'CTUh/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('AC', 'EU27+1', 2010, 55.5, 'mol H+ eq/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('EUF', 'EU27+1', 2010, 1.61, 'kg P eq/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('EUM', 'EU27+1', 2010, 19.5, 'kg N eq/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('EUT', 'EU27+1', 2010, 177, 'mol N eq/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('ETF', 'EU27+1', 2010, 17500, 'CTUe/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('LU', 'EU27+1', 2010, 819000, 'pt/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('WU', 'EU27+1', 2010, 11500, 'm3 world eq/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('RUF', 'EU27+1', 2010, 65000, 'MJ/person/year', 'JRC EF 3.1 Normalisation Factors'),
  ('RUM', 'EU27+1', 2010, 0.0636, 'kg Sb eq/person/year', 'JRC EF 3.1 Normalisation Factors')
ON CONFLICT (impact_category_code, reference_region, reference_year) DO NOTHING;

-- =====================================================
-- STEP 5: CREATE EF 3.1 WEIGHTING FACTORS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ef31_weighting_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, organization_id)
);

COMMENT ON TABLE public.ef31_weighting_sets IS
  'Weighting sets for EF 3.1 single score calculation. Default set uses official EF weights.';

ALTER TABLE public.ef31_weighting_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization weighting sets and default"
  ON public.ef31_weighting_sets
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ef31_weighting_sets.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage organization weighting sets"
  ON public.ef31_weighting_sets
  FOR ALL
  TO authenticated
  USING (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON om.role_id = r.id
      WHERE om.organization_id = ef31_weighting_sets.organization_id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON om.role_id = r.id
      WHERE om.organization_id = ef31_weighting_sets.organization_id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- Insert default weighting set
INSERT INTO public.ef31_weighting_sets (name, description, is_default, organization_id) VALUES
  ('EF 3.1 Default', 'Official Environmental Footprint 3.1 weighting factors from JRC', true, NULL)
ON CONFLICT (name, organization_id) DO NOTHING;

-- =====================================================
-- STEP 6: CREATE WEIGHTING FACTORS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ef31_weighting_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weighting_set_id UUID NOT NULL REFERENCES public.ef31_weighting_sets(id) ON DELETE CASCADE,
  impact_category_code TEXT NOT NULL REFERENCES public.ef31_impact_categories(code),
  weighting_factor NUMERIC(6, 4) NOT NULL,
  robustness_level TEXT DEFAULT 'recommended',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(weighting_set_id, impact_category_code)
);

COMMENT ON TABLE public.ef31_weighting_factors IS
  'Individual weighting factors linking impact categories to weighting sets.';

ALTER TABLE public.ef31_weighting_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view weighting factors"
  ON public.ef31_weighting_factors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ef31_weighting_sets ws
      WHERE ws.id = ef31_weighting_factors.weighting_set_id
      AND (
        ws.organization_id IS NULL OR
        EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE organization_members.organization_id = ws.organization_id
          AND organization_members.user_id = auth.uid()
        )
      )
    )
  );

-- =====================================================
-- STEP 7: POPULATE DEFAULT WEIGHTING FACTORS
-- =====================================================

INSERT INTO public.ef31_weighting_factors (weighting_set_id, impact_category_code, weighting_factor, robustness_level)
SELECT 
  ws.id,
  ic.code,
  ic.default_weight,
  'recommended'
FROM public.ef31_weighting_sets ws
CROSS JOIN public.ef31_impact_categories ic
WHERE ws.is_default = true
ON CONFLICT (weighting_set_id, impact_category_code) DO NOTHING;

-- =====================================================
-- STEP 8: CREATE EF 3.1 PROCESS MAPPINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ef31_process_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecoinvent_process_uuid TEXT NOT NULL,
  ecoinvent_process_name TEXT NOT NULL,
  ecoinvent_version TEXT DEFAULT '3.12',
  staging_factor_id UUID REFERENCES public.staging_emission_factors(id),
  ef_climate_change NUMERIC,
  ef_ozone_depletion NUMERIC,
  ef_ionising_radiation NUMERIC,
  ef_photochemical_ozone_formation NUMERIC,
  ef_particulate_matter NUMERIC,
  ef_human_toxicity_cancer NUMERIC,
  ef_human_toxicity_non_cancer NUMERIC,
  ef_acidification NUMERIC,
  ef_eutrophication_freshwater NUMERIC,
  ef_eutrophication_marine NUMERIC,
  ef_eutrophication_terrestrial NUMERIC,
  ef_ecotoxicity_freshwater NUMERIC,
  ef_land_use NUMERIC,
  ef_water_use NUMERIC,
  ef_resource_use_fossils NUMERIC,
  ef_resource_use_minerals_metals NUMERIC,
  data_quality_rating TEXT DEFAULT 'medium',
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ecoinvent_process_uuid, ecoinvent_version)
);

COMMENT ON TABLE public.ef31_process_mappings IS
  'Maps EcoInvent process UUIDs to EF 3.1 impact values. Used for hybrid data resolution.';

CREATE INDEX IF NOT EXISTS idx_ef31_process_mappings_uuid
  ON public.ef31_process_mappings(ecoinvent_process_uuid);

CREATE INDEX IF NOT EXISTS idx_ef31_process_mappings_staging_factor
  ON public.ef31_process_mappings(staging_factor_id)
  WHERE staging_factor_id IS NOT NULL;

ALTER TABLE public.ef31_process_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view EF 3.1 process mappings"
  ON public.ef31_process_mappings
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- STEP 9: ADD EF 3.1 FIELDS TO PRODUCT_LCAS TABLE
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'lca_methodology'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN lca_methodology TEXT DEFAULT 'recipe_2016';

    COMMENT ON COLUMN public.product_lcas.lca_methodology IS
      'Primary LCA methodology: "recipe_2016" (ReCiPe 2016 Midpoint) or "ef_31" (Environmental Footprint 3.1).';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'ef31_impacts'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN ef31_impacts JSONB DEFAULT NULL;

    COMMENT ON COLUMN public.product_lcas.ef31_impacts IS
      'EF 3.1 aggregated impacts with all 16 categories, normalised values, weighted values, and single score.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'ef31_single_score'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN ef31_single_score NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lcas.ef31_single_score IS
      'EF 3.1 aggregated single score (dimensionless) for easy comparison.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'ef31_calculated_at'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN ef31_calculated_at TIMESTAMPTZ DEFAULT NULL;

    COMMENT ON COLUMN public.product_lcas.ef31_calculated_at IS
      'Timestamp when EF 3.1 calculation was last performed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'weighting_set_id'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN weighting_set_id UUID REFERENCES public.ef31_weighting_sets(id);

    COMMENT ON COLUMN public.product_lcas.weighting_set_id IS
      'Custom weighting set used for EF 3.1 single score calculation. NULL uses default EF weights.';
  END IF;
END $$;

-- =====================================================
-- STEP 10: CREATE HELPER FUNCTION FOR NORMALISATION
-- =====================================================

CREATE OR REPLACE FUNCTION public.ef31_normalise_impact(
  p_impact_category_code TEXT,
  p_impact_value NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_normalisation_value NUMERIC;
BEGIN
  SELECT normalisation_value INTO v_normalisation_value
  FROM public.ef31_normalisation_factors
  WHERE impact_category_code = p_impact_category_code
  AND reference_region = 'EU27+1'
  AND reference_year = 2010;

  IF v_normalisation_value IS NULL OR v_normalisation_value = 0 THEN
    RETURN NULL;
  END IF;

  RETURN p_impact_value / v_normalisation_value;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.ef31_normalise_impact IS
  'Normalises an EF 3.1 impact value to person-year equivalent using EU27 2010 reference.';

-- =====================================================
-- STEP 11: CREATE HELPER FUNCTION FOR SINGLE SCORE
-- =====================================================

CREATE OR REPLACE FUNCTION public.ef31_calculate_single_score(
  p_impacts JSONB,
  p_weighting_set_id UUID DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_total_score NUMERIC := 0;
  v_category RECORD;
  v_impact_value NUMERIC;
  v_normalised_value NUMERIC;
  v_weighted_value NUMERIC;
  v_weighting_set UUID;
BEGIN
  IF p_weighting_set_id IS NOT NULL THEN
    v_weighting_set := p_weighting_set_id;
  ELSE
    SELECT id INTO v_weighting_set
    FROM public.ef31_weighting_sets
    WHERE is_default = true
    LIMIT 1;
  END IF;

  FOR v_category IN
    SELECT 
      ic.code,
      wf.weighting_factor,
      nf.normalisation_value
    FROM public.ef31_impact_categories ic
    JOIN public.ef31_weighting_factors wf ON wf.impact_category_code = ic.code AND wf.weighting_set_id = v_weighting_set
    JOIN public.ef31_normalisation_factors nf ON nf.impact_category_code = ic.code
  LOOP
    v_impact_value := (p_impacts->>v_category.code)::NUMERIC;
    
    IF v_impact_value IS NOT NULL AND v_category.normalisation_value > 0 THEN
      v_normalised_value := v_impact_value / v_category.normalisation_value;
      v_weighted_value := v_normalised_value * v_category.weighting_factor;
      v_total_score := v_total_score + v_weighted_value;
    END IF;
  END LOOP;

  RETURN v_total_score;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.ef31_calculate_single_score IS
  'Calculates EF 3.1 single score from JSONB impacts using normalisation and weighting factors.';

-- =====================================================
-- STEP 12: VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_categories_count INTEGER;
  v_norm_factors_count INTEGER;
  v_weight_factors_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_categories_count FROM public.ef31_impact_categories;
  SELECT COUNT(*) INTO v_norm_factors_count FROM public.ef31_normalisation_factors;
  SELECT COUNT(*) INTO v_weight_factors_count FROM public.ef31_weighting_factors;

  RAISE NOTICE 'EF 3.1 Reference Tables Migration Summary:';
  RAISE NOTICE '  Impact categories: % (expected 16)', v_categories_count;
  RAISE NOTICE '  Normalisation factors: % (expected 16)', v_norm_factors_count;
  RAISE NOTICE '  Weighting factors: % (expected 16)', v_weight_factors_count;
  RAISE NOTICE '  Helper functions: ef31_normalise_impact, ef31_calculate_single_score';
  RAISE NOTICE '  Migration completed successfully';
END $$;
