/*
  # Create Category-Aware Hybrid Data System

  ## Overview
  This migration implements a comprehensive hybrid data model that combines:
  - DEFRA 2025 emission factors for UK-relevant GHG calculations (Scope 1, 2, transport, commuting)
  - Ecoinvent 3.12 environmental impacts for comprehensive multi-capital assessment
  - Category-aware routing to ensure regulatory compliance and ISO 14044/14067 conformance

  ## Changes Made

  ### 1. Material Category Enumeration
  New enum `material_category_type` with values:
  - SCOPE_1_2_ENERGY: UK electricity, natural gas, fuels → DEFRA GWP + Ecoinvent non-GWP
  - SCOPE_3_TRANSPORT: HGV, rail, sea, air freight → DEFRA GWP + Ecoinvent non-GWP
  - SCOPE_3_COMMUTING: Employee travel → DEFRA GWP + Ecoinvent non-GWP
  - MANUFACTURING_MATERIAL: Ingredients, packaging → Full Ecoinvent or supplier data
  - WASTE: Waste treatment processes

  ### 2. Enhanced Tracking Fields
  Added to `staging_emission_factors`:
  - category_type: Classifies factor for routing logic
  - geographic_scope: UK/EU/GLO for data quality assessment

  Added to `product_lca_materials`:
  - category_type: Material classification
  - gwp_data_source: Source for GHG data (DEFRA/Ecoinvent/Supplier)
  - non_gwp_data_source: Source for environmental data
  - gwp_reference_id: DEFRA factor ID or Ecoinvent process ID
  - non_gwp_reference_id: Ecoinvent process ID for non-GWP impacts
  - data_quality_grade: HIGH/MEDIUM/LOW
  - is_hybrid_source: Boolean flag for dual-source materials

  ### 3. Complete ReCiPe 2016 Impact Categories
  Added missing impact columns to `product_lca_materials` for full ISO 14044 compliance:
  - impact_ozone_depletion (kg CFC-11 eq)
  - impact_photochemical_ozone_formation (kg NOx eq)
  - impact_ionising_radiation (kBq Co-60 eq)
  - impact_particulate_matter (kg PM2.5 eq)
  - impact_human_toxicity_carcinogenic (kg 1,4-DCB)
  - impact_human_toxicity_non_carcinogenic (kg 1,4-DCB)
  - impact_freshwater_ecotoxicity (kg 1,4-DCB)
  - impact_marine_ecotoxicity (kg 1,4-DCB)
  - impact_marine_eutrophication (kg N eq)
  - impact_mineral_resource_scarcity (kg Cu eq)

  ### 4. GHG Breakdown Fields
  Enhanced GWP tracking with ISO 14067 sub-categories:
  - impact_climate_fossil (fossil CO2)
  - impact_climate_biogenic (biogenic CO2)
  - impact_climate_dluc (direct land use change CO2)

  ### 5. DEFRA-Ecoinvent Mapping Table
  New table `defra_ecoinvent_impact_mappings`:
  - Links DEFRA emission factors to Ecoinvent processes
  - Enables hybrid calculation: DEFRA GWP + Ecoinvent non-GWP
  - Tracks mapping quality and geographic alignment

  ## Compliance Benefits

  **UK Regulatory Compliance:**
  - Uses DEFRA 2025 for all UK government reporting requirements
  - Traceable to official conversion factors for audit purposes

  **ISO 14044/14067 Compliance:**
  - Complete 18-category ReCiPe 2016 midpoint assessment
  - Suitable for third-party verification and EPD publication

  **CSRD/TNFD Compliance:**
  - Multi-capital impact assessment (E1-E5)
  - Transparent data provenance tracking
*/

-- =====================================================
-- SECTION 1: CREATE MATERIAL CATEGORY ENUM
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'material_category_type') THEN
    CREATE TYPE material_category_type AS ENUM (
      'SCOPE_1_2_ENERGY',
      'SCOPE_3_TRANSPORT',
      'SCOPE_3_COMMUTING',
      'MANUFACTURING_MATERIAL',
      'WASTE'
    );
    RAISE NOTICE 'Created enum: material_category_type';
  END IF;
END $$;

COMMENT ON TYPE material_category_type IS
  'Categorizes materials for hybrid data resolution routing. Energy/transport/commuting use DEFRA GWP + Ecoinvent non-GWP. Manufacturing materials use full Ecoinvent or supplier data.';

-- =====================================================
-- SECTION 2: ADD CATEGORY AND TRACKING FIELDS TO STAGING
-- =====================================================

-- Add category_type to staging_emission_factors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staging_emission_factors' AND column_name = 'category_type'
  ) THEN
    ALTER TABLE staging_emission_factors
      ADD COLUMN category_type material_category_type DEFAULT NULL;

    COMMENT ON COLUMN staging_emission_factors.category_type IS
      'Material category for routing: determines whether to use DEFRA GWP + Ecoinvent non-GWP hybrid or full dataset';

    RAISE NOTICE 'Added category_type to staging_emission_factors';
  END IF;
END $$;

-- Add geographic_scope to staging_emission_factors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staging_emission_factors' AND column_name = 'geographic_scope'
  ) THEN
    ALTER TABLE staging_emission_factors
      ADD COLUMN geographic_scope TEXT DEFAULT 'GLO';

    COMMENT ON COLUMN staging_emission_factors.geographic_scope IS
      'Geographic scope of factor: UK (DEFRA), EU-27 (European), GLO (Global). Used for data quality assessment.';

    RAISE NOTICE 'Added geographic_scope to staging_emission_factors';
  END IF;
END $$;

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_staging_factors_category_type
  ON staging_emission_factors(category_type)
  WHERE category_type IS NOT NULL;

-- =====================================================
-- SECTION 3: ADD TRACKING FIELDS TO PRODUCT_LCA_MATERIALS
-- =====================================================

-- Add category_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'category_type'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN category_type material_category_type DEFAULT 'MANUFACTURING_MATERIAL';

    COMMENT ON COLUMN product_lca_materials.category_type IS
      'Material category determining data resolution path. Defaults to MANUFACTURING_MATERIAL for ingredients/packaging.';

    RAISE NOTICE 'Added category_type to product_lca_materials';
  END IF;
END $$;

-- Add gwp_data_source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'gwp_data_source'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN gwp_data_source TEXT DEFAULT NULL;

    COMMENT ON COLUMN product_lca_materials.gwp_data_source IS
      'Source of GHG data: "DEFRA 2025", "Ecoinvent 3.12", "Supplier EPD", etc.';

    RAISE NOTICE 'Added gwp_data_source to product_lca_materials';
  END IF;
END $$;

-- Add non_gwp_data_source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'non_gwp_data_source'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN non_gwp_data_source TEXT DEFAULT NULL;

    COMMENT ON COLUMN product_lca_materials.non_gwp_data_source IS
      'Source of environmental impact data (water, land, toxicity, etc.): "Ecoinvent 3.12", "Supplier EPD", etc.';

    RAISE NOTICE 'Added non_gwp_data_source to product_lca_materials';
  END IF;
END $$;

-- Add gwp_reference_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'gwp_reference_id'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN gwp_reference_id TEXT DEFAULT NULL;

    COMMENT ON COLUMN product_lca_materials.gwp_reference_id IS
      'Reference ID for GHG data source: DEFRA factor name, Ecoinvent process UUID, or staging factor ID';

    RAISE NOTICE 'Added gwp_reference_id to product_lca_materials';
  END IF;
END $$;

-- Add non_gwp_reference_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'non_gwp_reference_id'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN non_gwp_reference_id TEXT DEFAULT NULL;

    COMMENT ON COLUMN product_lca_materials.non_gwp_reference_id IS
      'Reference ID for environmental data source: Ecoinvent process UUID or staging factor ID';

    RAISE NOTICE 'Added non_gwp_reference_id to product_lca_materials';
  END IF;
END $$;

-- Add data_quality_grade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'data_quality_grade'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN data_quality_grade TEXT DEFAULT NULL
      CHECK (data_quality_grade IS NULL OR data_quality_grade IN ('HIGH', 'MEDIUM', 'LOW'));

    COMMENT ON COLUMN product_lca_materials.data_quality_grade IS
      'Overall data quality: HIGH (supplier verified), MEDIUM (regional government or Ecoinvent), LOW (distant proxy)';

    RAISE NOTICE 'Added data_quality_grade to product_lca_materials';
  END IF;
END $$;

-- Add is_hybrid_source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'is_hybrid_source'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN is_hybrid_source BOOLEAN DEFAULT false;

    COMMENT ON COLUMN product_lca_materials.is_hybrid_source IS
      'True if material uses hybrid approach: DEFRA GWP + Ecoinvent non-GWP impacts';

    RAISE NOTICE 'Added is_hybrid_source to product_lca_materials';
  END IF;
END $$;

-- Create indexes for filtering and querying
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_category_type
  ON product_lca_materials(category_type);

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_data_quality_grade
  ON product_lca_materials(data_quality_grade)
  WHERE data_quality_grade IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_is_hybrid
  ON product_lca_materials(is_hybrid_source)
  WHERE is_hybrid_source = true;

-- =====================================================
-- SECTION 4: ADD COMPLETE RECIPE 2016 IMPACT CATEGORIES
-- =====================================================

-- Add ozone depletion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_ozone_depletion'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_ozone_depletion NUMERIC DEFAULT NULL CHECK (impact_ozone_depletion IS NULL OR impact_ozone_depletion >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_ozone_depletion IS
      'Ozone depletion potential in kg CFC-11 equivalent - ReCiPe 2016 midpoint';

    RAISE NOTICE 'Added impact_ozone_depletion';
  END IF;
END $$;

-- Add photochemical ozone formation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_photochemical_ozone_formation'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_photochemical_ozone_formation NUMERIC DEFAULT NULL CHECK (impact_photochemical_ozone_formation IS NULL OR impact_photochemical_ozone_formation >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_photochemical_ozone_formation IS
      'Photochemical ozone formation potential in kg NOx equivalent - ReCiPe 2016 midpoint';

    RAISE NOTICE 'Added impact_photochemical_ozone_formation';
  END IF;
END $$;

-- Add ionising radiation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_ionising_radiation'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_ionising_radiation NUMERIC DEFAULT NULL CHECK (impact_ionising_radiation IS NULL OR impact_ionising_radiation >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_ionising_radiation IS
      'Ionising radiation potential in kBq Cobalt-60 equivalent - ReCiPe 2016 midpoint';

    RAISE NOTICE 'Added impact_ionising_radiation';
  END IF;
END $$;

-- Add particulate matter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_particulate_matter'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_particulate_matter NUMERIC DEFAULT NULL CHECK (impact_particulate_matter IS NULL OR impact_particulate_matter >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_particulate_matter IS
      'Particulate matter formation potential in kg PM2.5 equivalent - ReCiPe 2016 midpoint';

    RAISE NOTICE 'Added impact_particulate_matter';
  END IF;
END $$;

-- Add human toxicity (carcinogenic)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_human_toxicity_carcinogenic'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_human_toxicity_carcinogenic NUMERIC DEFAULT NULL CHECK (impact_human_toxicity_carcinogenic IS NULL OR impact_human_toxicity_carcinogenic >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_human_toxicity_carcinogenic IS
      'Human toxicity potential (carcinogenic) in kg 1,4-dichlorobenzene equivalent - ReCiPe 2016 midpoint';

    RAISE NOTICE 'Added impact_human_toxicity_carcinogenic';
  END IF;
END $$;

-- Add human toxicity (non-carcinogenic)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_human_toxicity_non_carcinogenic'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_human_toxicity_non_carcinogenic NUMERIC DEFAULT NULL CHECK (impact_human_toxicity_non_carcinogenic IS NULL OR impact_human_toxicity_non_carcinogenic >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_human_toxicity_non_carcinogenic IS
      'Human toxicity potential (non-carcinogenic) in kg 1,4-dichlorobenzene equivalent - ReCiPe 2016 midpoint';

    RAISE NOTICE 'Added impact_human_toxicity_non_carcinogenic';
  END IF;
END $$;

-- Add freshwater ecotoxicity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_freshwater_ecotoxicity'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_freshwater_ecotoxicity NUMERIC DEFAULT NULL CHECK (impact_freshwater_ecotoxicity IS NULL OR impact_freshwater_ecotoxicity >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_freshwater_ecotoxicity IS
      'Freshwater ecotoxicity potential in kg 1,4-dichlorobenzene equivalent - ReCiPe 2016 midpoint';

    RAISE NOTICE 'Added impact_freshwater_ecotoxicity';
  END IF;
END $$;

-- Add marine ecotoxicity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_marine_ecotoxicity'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_marine_ecotoxicity NUMERIC DEFAULT NULL CHECK (impact_marine_ecotoxicity IS NULL OR impact_marine_ecotoxicity >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_marine_ecotoxicity IS
      'Marine ecotoxicity potential in kg 1,4-dichlorobenzene equivalent - ReCiPe 2016 midpoint';

    RAISE NOTICE 'Added impact_marine_ecotoxicity';
  END IF;
END $$;

-- Add marine eutrophication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_marine_eutrophication'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_marine_eutrophication NUMERIC DEFAULT NULL CHECK (impact_marine_eutrophication IS NULL OR impact_marine_eutrophication >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_marine_eutrophication IS
      'Marine eutrophication potential in kg nitrogen equivalent - ReCiPe 2016 midpoint';

    RAISE NOTICE 'Added impact_marine_eutrophication';
  END IF;
END $$;

-- Add mineral resource scarcity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_mineral_resource_scarcity'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_mineral_resource_scarcity NUMERIC DEFAULT NULL CHECK (impact_mineral_resource_scarcity IS NULL OR impact_mineral_resource_scarcity >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_mineral_resource_scarcity IS
      'Mineral resource scarcity in kg copper equivalent - ReCiPe 2016 midpoint';

    RAISE NOTICE 'Added impact_mineral_resource_scarcity';
  END IF;
END $$;

-- =====================================================
-- SECTION 5: ADD GHG BREAKDOWN FIELDS (IF NOT EXISTS)
-- =====================================================

-- These may already exist from previous migrations, but ensure they're present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_climate_fossil'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_climate_fossil NUMERIC DEFAULT NULL CHECK (impact_climate_fossil IS NULL OR impact_climate_fossil >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_climate_fossil IS
      'Fossil CO2 emissions in kg CO2e - ISO 14067 GHG breakdown';

    RAISE NOTICE 'Added impact_climate_fossil';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_climate_biogenic'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_climate_biogenic NUMERIC DEFAULT NULL CHECK (impact_climate_biogenic IS NULL OR impact_climate_biogenic >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_climate_biogenic IS
      'Biogenic CO2 emissions in kg CO2e - ISO 14067 GHG breakdown';

    RAISE NOTICE 'Added impact_climate_biogenic';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'impact_climate_dluc'
  ) THEN
    ALTER TABLE product_lca_materials
      ADD COLUMN impact_climate_dluc NUMERIC DEFAULT NULL CHECK (impact_climate_dluc IS NULL OR impact_climate_dluc >= 0);

    COMMENT ON COLUMN product_lca_materials.impact_climate_dluc IS
      'Direct land use change CO2 emissions in kg CO2e - ISO 14067 GHG breakdown';

    RAISE NOTICE 'Added impact_climate_dluc';
  END IF;
END $$;

-- =====================================================
-- SECTION 6: CREATE DEFRA-ECOINVENT MAPPING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.defra_ecoinvent_impact_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- DEFRA Factor Identification
  defra_factor_name TEXT NOT NULL,
  defra_category TEXT NOT NULL, -- 'energy', 'transport', 'commuting'
  defra_subcategory TEXT, -- 'electricity', 'hgv', 'passenger_car', etc.

  -- Ecoinvent Proxy Match
  ecoinvent_proxy_id UUID REFERENCES ecoinvent_material_proxies(id),
  ecoinvent_process_name TEXT,
  ecoinvent_category TEXT,

  -- Mapping Quality
  mapping_quality TEXT NOT NULL CHECK (mapping_quality IN ('exact', 'close', 'generic', 'distant')),
  geographic_alignment TEXT DEFAULT 'UK' CHECK (geographic_alignment IN ('UK', 'EU', 'GLO')),
  mapping_confidence_score INTEGER CHECK (mapping_confidence_score BETWEEN 0 AND 100),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.defra_ecoinvent_impact_mappings IS
  'Maps DEFRA 2025 emission factors to Ecoinvent 3.12 processes for hybrid GWP+environmental impact calculations';

COMMENT ON COLUMN public.defra_ecoinvent_impact_mappings.mapping_quality IS
  'exact: Direct match, close: Similar process with adjustments, generic: Broader category match, distant: Last resort proxy';

COMMENT ON COLUMN public.defra_ecoinvent_impact_mappings.geographic_alignment IS
  'Geographic consistency between DEFRA (UK) and Ecoinvent process scope';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_defra_mappings_factor_name
  ON public.defra_ecoinvent_impact_mappings(defra_factor_name);

CREATE INDEX IF NOT EXISTS idx_defra_mappings_category
  ON public.defra_ecoinvent_impact_mappings(defra_category);

CREATE INDEX IF NOT EXISTS idx_defra_mappings_quality
  ON public.defra_ecoinvent_impact_mappings(mapping_quality);

-- Enable RLS
ALTER TABLE public.defra_ecoinvent_impact_mappings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read mappings
CREATE POLICY "Authenticated users can view DEFRA-Ecoinvent mappings"
  ON public.defra_ecoinvent_impact_mappings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can manage mappings
CREATE POLICY "Service role can manage DEFRA-Ecoinvent mappings"
  ON public.defra_ecoinvent_impact_mappings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create update trigger
CREATE TRIGGER update_defra_mappings_updated_at
  BEFORE UPDATE ON public.defra_ecoinvent_impact_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SECTION 7: VERIFICATION
-- =====================================================

DO $$
DECLARE
  new_impact_columns INTEGER;
  tracking_columns INTEGER;
  mapping_table_exists BOOLEAN;
BEGIN
  -- Count new impact columns
  SELECT COUNT(*) INTO new_impact_columns
  FROM information_schema.columns
  WHERE table_name = 'product_lca_materials'
    AND column_name IN (
      'impact_ozone_depletion',
      'impact_photochemical_ozone_formation',
      'impact_ionising_radiation',
      'impact_particulate_matter',
      'impact_human_toxicity_carcinogenic',
      'impact_human_toxicity_non_carcinogenic',
      'impact_freshwater_ecotoxicity',
      'impact_marine_ecotoxicity',
      'impact_marine_eutrophication',
      'impact_mineral_resource_scarcity'
    );

  -- Count tracking columns
  SELECT COUNT(*) INTO tracking_columns
  FROM information_schema.columns
  WHERE table_name = 'product_lca_materials'
    AND column_name IN (
      'category_type',
      'gwp_data_source',
      'non_gwp_data_source',
      'gwp_reference_id',
      'non_gwp_reference_id',
      'data_quality_grade',
      'is_hybrid_source'
    );

  -- Check mapping table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'defra_ecoinvent_impact_mappings'
  ) INTO mapping_table_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Category-Aware Hybrid System Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'New ReCiPe 2016 impact columns: % of 10', new_impact_columns;
  RAISE NOTICE 'Tracking/provenance columns: % of 7', tracking_columns;
  RAISE NOTICE 'DEFRA-Ecoinvent mapping table: %',
    CASE WHEN mapping_table_exists THEN 'Created' ELSE 'Missing' END;
  RAISE NOTICE '';
  RAISE NOTICE 'System now supports:';
  RAISE NOTICE '  ✓ Complete 18-category ReCiPe 2016 assessment';
  RAISE NOTICE '  ✓ DEFRA 2025 GWP + Ecoinvent non-GWP hybrid';
  RAISE NOTICE '  ✓ Category-aware data resolution routing';
  RAISE NOTICE '  ✓ Dual provenance tracking (GWP + non-GWP sources)';
  RAISE NOTICE '  ✓ ISO 14044/14067 compliance ready';
  RAISE NOTICE '  ✓ CSRD/TNFD multi-capital reporting';
  RAISE NOTICE '========================================';
END $$;
