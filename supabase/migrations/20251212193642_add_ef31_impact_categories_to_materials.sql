/*
  # Add EF 3.1 Impact Categories to Product LCA Materials

  ## Overview
  This migration adds the 16 mandatory Environmental Footprint 3.1 (EF 3.1) impact 
  category columns to the product_lca_materials table. These columns support 
  PEF (Product Environmental Footprint) and OEF (Organisation Environmental Footprint)
  compliance for EU legislation including CSRD, Green Claims Directive, and Ecodesign.

  ## New Columns Added to `product_lca_materials`

  ### Climate Change (3 sub-categories per EF 3.1)
  - `ef_climate_change_total` (numeric) - Total GWP in kg CO2 eq
  - `ef_climate_change_fossil` (numeric) - Fossil-based GWP in kg CO2 eq
  - `ef_climate_change_biogenic` (numeric) - Biogenic carbon GWP in kg CO2 eq
  - `ef_climate_change_luluc` (numeric) - Land use/land use change GWP in kg CO2 eq

  ### Ozone and Radiation
  - `ef_ozone_depletion` (numeric) - kg CFC-11 eq (stratospheric ozone depletion)
  - `ef_ionising_radiation` (numeric) - kBq U235 eq (human health effects)

  ### Particulate Matter and Photochemical Ozone
  - `ef_particulate_matter` (numeric) - Disease incidence (respiratory effects)
  - `ef_photochemical_ozone_formation` (numeric) - kg NMVOC eq (human health)

  ### Human Toxicity (Cancer and Non-Cancer)
  - `ef_human_toxicity_cancer` (numeric) - CTUh (Comparative Toxic Units - cancer)
  - `ef_human_toxicity_non_cancer` (numeric) - CTUh (non-cancer effects)

  ### Acidification
  - `ef_acidification` (numeric) - mol H+ eq (accumulated exceedance)

  ### Eutrophication (3 sub-categories)
  - `ef_eutrophication_freshwater` (numeric) - kg P eq (freshwater)
  - `ef_eutrophication_marine` (numeric) - kg N eq (marine)
  - `ef_eutrophication_terrestrial` (numeric) - mol N eq (terrestrial)

  ### Ecotoxicity
  - `ef_ecotoxicity_freshwater` (numeric) - CTUe (Comparative Toxic Units - ecosystem)

  ### Resource Use
  - `ef_resource_use_fossils` (numeric) - MJ (fossil energy carriers)
  - `ef_resource_use_minerals_metals` (numeric) - kg Sb eq (abiotic depletion)

  ### Water and Land
  - `ef_water_use` (numeric) - m3 world eq (AWARE method)
  - `ef_land_use` (numeric) - Dimensionless pt (soil quality index)

  ### Single Score
  - `ef_single_score` (numeric) - Normalised and weighted single score (dimensionless)

  ### Tracking Fields
  - `ef_calculated_at` (timestamptz) - When EF 3.1 calculation was performed
  - `ef_methodology_version` (text) - EF methodology version used (e.g., '3.1')

  ## Data Safety
  - All new columns are nullable for backward compatibility
  - Existing ReCiPe 2016 data remains unchanged
  - No data loss or breaking changes

  ## Regulatory Context
  - EF 3.1 is the official EU methodology for Product Environmental Footprints
  - Required for Green Claims Directive compliance (2024+)
  - Supports CSRD environmental disclosures
  - Enables Ecodesign for Sustainable Products Regulation (ESPR) compliance
*/

-- =====================================================
-- STEP 1: ADD EF 3.1 CLIMATE CHANGE COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_climate_change_total'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_climate_change_total NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_climate_change_total IS
      'EF 3.1 Climate Change - Total GWP in kg CO2 eq. Includes fossil, biogenic, and LULUC.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_climate_change_fossil'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_climate_change_fossil NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_climate_change_fossil IS
      'EF 3.1 Climate Change - Fossil-based emissions in kg CO2 eq.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_climate_change_biogenic'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_climate_change_biogenic NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_climate_change_biogenic IS
      'EF 3.1 Climate Change - Biogenic carbon emissions in kg CO2 eq per PEF methodology.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_climate_change_luluc'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_climate_change_luluc NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_climate_change_luluc IS
      'EF 3.1 Climate Change - Land Use and Land Use Change emissions in kg CO2 eq.';
  END IF;
END $$;

-- =====================================================
-- STEP 2: ADD EF 3.1 OZONE AND RADIATION COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_ozone_depletion'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_ozone_depletion NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_ozone_depletion IS
      'EF 3.1 Ozone Depletion in kg CFC-11 eq. Measures stratospheric ozone layer destruction.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_ionising_radiation'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_ionising_radiation NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_ionising_radiation IS
      'EF 3.1 Ionising Radiation in kBq U235 eq. Human health effects from radioactive emissions.';
  END IF;
END $$;

-- =====================================================
-- STEP 3: ADD EF 3.1 PARTICULATE AND PHOTOCHEMICAL COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_particulate_matter'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_particulate_matter NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_particulate_matter IS
      'EF 3.1 Particulate Matter in disease incidence. Respiratory effects from fine particles.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_photochemical_ozone_formation'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_photochemical_ozone_formation NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_photochemical_ozone_formation IS
      'EF 3.1 Photochemical Ozone Formation in kg NMVOC eq. Ground-level smog effects on human health.';
  END IF;
END $$;

-- =====================================================
-- STEP 4: ADD EF 3.1 HUMAN TOXICITY COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_human_toxicity_cancer'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_human_toxicity_cancer NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_human_toxicity_cancer IS
      'EF 3.1 Human Toxicity (Cancer) in CTUh. Based on USEtox 2.12 consensus model.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_human_toxicity_non_cancer'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_human_toxicity_non_cancer NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_human_toxicity_non_cancer IS
      'EF 3.1 Human Toxicity (Non-Cancer) in CTUh. Based on USEtox 2.12 consensus model.';
  END IF;
END $$;

-- =====================================================
-- STEP 5: ADD EF 3.1 ACIDIFICATION COLUMN
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_acidification'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_acidification NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_acidification IS
      'EF 3.1 Acidification in mol H+ eq. Accumulated Exceedance method for terrestrial and aquatic acidification.';
  END IF;
END $$;

-- =====================================================
-- STEP 6: ADD EF 3.1 EUTROPHICATION COLUMNS (3 TYPES)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_eutrophication_freshwater'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_eutrophication_freshwater NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_eutrophication_freshwater IS
      'EF 3.1 Eutrophication (Freshwater) in kg P eq. Phosphorus enrichment of freshwater bodies.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_eutrophication_marine'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_eutrophication_marine NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_eutrophication_marine IS
      'EF 3.1 Eutrophication (Marine) in kg N eq. Nitrogen enrichment of marine ecosystems.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_eutrophication_terrestrial'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_eutrophication_terrestrial NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_eutrophication_terrestrial IS
      'EF 3.1 Eutrophication (Terrestrial) in mol N eq. Nitrogen deposition effects on land ecosystems.';
  END IF;
END $$;

-- =====================================================
-- STEP 7: ADD EF 3.1 ECOTOXICITY COLUMN
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_ecotoxicity_freshwater'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_ecotoxicity_freshwater NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_ecotoxicity_freshwater IS
      'EF 3.1 Ecotoxicity (Freshwater) in CTUe. Based on USEtox 2.12 ecosystem impact model.';
  END IF;
END $$;

-- =====================================================
-- STEP 8: ADD EF 3.1 RESOURCE USE COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_resource_use_fossils'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_resource_use_fossils NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_resource_use_fossils IS
      'EF 3.1 Resource Use (Fossils) in MJ. Abiotic depletion of fossil energy carriers.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_resource_use_minerals_metals'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_resource_use_minerals_metals NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_resource_use_minerals_metals IS
      'EF 3.1 Resource Use (Minerals and Metals) in kg Sb eq. Abiotic depletion using ultimate reserves.';
  END IF;
END $$;

-- =====================================================
-- STEP 9: ADD EF 3.1 WATER AND LAND USE COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_water_use'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_water_use NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_water_use IS
      'EF 3.1 Water Use in m3 world eq. AWARE method with user deprivation weighting.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_land_use'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_land_use NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_land_use IS
      'EF 3.1 Land Use in dimensionless pt. Soil Quality Index aggregating biotic production, erosion, filtration, groundwater.';
  END IF;
END $$;

-- =====================================================
-- STEP 10: ADD EF 3.1 SINGLE SCORE AND TRACKING COLUMNS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_single_score'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_single_score NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_single_score IS
      'EF 3.1 Single Score (dimensionless). Normalised and weighted aggregation of all 16 impact categories.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_normalised_impacts'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_normalised_impacts JSONB DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_normalised_impacts IS
      'EF 3.1 Normalised impacts for all 16 categories (person-year equivalents based on EU27 2010 reference).';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_weighted_impacts'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_weighted_impacts JSONB DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_weighted_impacts IS
      'EF 3.1 Weighted impacts for all 16 categories (after applying EF weighting factors).';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_calculated_at'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_calculated_at TIMESTAMPTZ DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_calculated_at IS
      'Timestamp when EF 3.1 impacts were calculated for this material.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ef_methodology_version'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN ef_methodology_version TEXT DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.ef_methodology_version IS
      'EF methodology version used for calculation (e.g., "3.1", "3.0").';
  END IF;
END $$;

-- =====================================================
-- STEP 11: ADD INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_ef_calculated_at
  ON public.product_lca_materials(ef_calculated_at)
  WHERE ef_calculated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_ef_methodology
  ON public.product_lca_materials(ef_methodology_version)
  WHERE ef_methodology_version IS NOT NULL;

-- =====================================================
-- STEP 12: VERIFICATION
-- =====================================================

DO $$
DECLARE
  ef_column_count integer;
BEGIN
  SELECT COUNT(*) INTO ef_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'product_lca_materials'
  AND column_name LIKE 'ef_%';

  RAISE NOTICE 'EF 3.1 Impact Categories Migration Summary:';
  RAISE NOTICE '  EF 3.1 columns added: %', ef_column_count;
  RAISE NOTICE '  Expected columns: 22 (16 impacts + 3 climate sub + single score + normalised + weighted + 2 tracking)';
  RAISE NOTICE '  Migration completed successfully';
END $$;
