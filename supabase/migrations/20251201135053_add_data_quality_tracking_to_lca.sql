/*
  # Add Data Quality Tracking & ISO Compliance Fields to Product LCA System

  ## Overview
  This migration implements the 3-tier waterfall data hierarchy for ISO-compliant
  LCA calculations with full provenance tracking and transparency.

  ## Changes

  ### 1. product_lca_materials - Add Data Quality Fields
  - `data_priority` (1=Primary/Verified, 2=Regional/DEFRA, 3=Secondary/Ecoinvent)
  - `data_quality_tag` (Human-readable source label)
  - `supplier_lca_id` (References supplier's product_lca if Priority 1)
  - `confidence_score` (0-100 score for data reliability)
  - `methodology` (ISO 14067, ReCiPe 2016, etc.)
  - `source_reference` (Exact source citation)

  ### 2. product_lca_materials - Add GHG Breakdown (ISO 14067)
  - `impact_climate_fossil` (Fossil CO2e)
  - `impact_climate_biogenic` (Biogenic CO2e - reported separately)
  - `impact_climate_dluc` (Direct Land Use Change CO2e)

  ### 3. product_lcas - Add Data Quality Summary
  - `data_quality_summary` (JSONB with score, rating, breakdown by source)

  ## Compliance
  - ISO 14040/14044: LCA Principles and Framework
  - ISO 14067: Carbon Footprint of Products (GHG breakdown)
  - ISO 14046: Water Footprint
  - GHG Protocol Product Standard
*/

-- =====================================================
-- STEP 1: ADD DATA QUALITY COLUMNS TO PRODUCT_LCA_MATERIALS
-- =====================================================

-- Check and add data_priority column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials'
    AND column_name = 'data_priority'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN data_priority INTEGER DEFAULT 3 CHECK (data_priority BETWEEN 1 AND 3);
  END IF;
END $$;

-- Check and add data_quality_tag column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials'
    AND column_name = 'data_quality_tag'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN data_quality_tag TEXT;
  END IF;
END $$;

-- Check and add supplier_lca_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials'
    AND column_name = 'supplier_lca_id'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN supplier_lca_id UUID REFERENCES public.product_lcas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Check and add confidence_score column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials'
    AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100);
  END IF;
END $$;

-- Check and add methodology column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials'
    AND column_name = 'methodology'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN methodology TEXT;
  END IF;
END $$;

-- Check and add source_reference column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials'
    AND column_name = 'source_reference'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN source_reference TEXT;
  END IF;
END $$;

-- =====================================================
-- STEP 2: ADD GHG BREAKDOWN COLUMNS (ISO 14067)
-- =====================================================

-- Check and add impact_climate_fossil column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials'
    AND column_name = 'impact_climate_fossil'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN impact_climate_fossil NUMERIC DEFAULT 0 CHECK (impact_climate_fossil >= 0);
  END IF;
END $$;

-- Check and add impact_climate_biogenic column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials'
    AND column_name = 'impact_climate_biogenic'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN impact_climate_biogenic NUMERIC DEFAULT 0 CHECK (impact_climate_biogenic >= 0);
  END IF;
END $$;

-- Check and add impact_climate_dluc column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials'
    AND column_name = 'impact_climate_dluc'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN impact_climate_dluc NUMERIC DEFAULT 0 CHECK (impact_climate_dluc >= 0);
  END IF;
END $$;

-- =====================================================
-- STEP 3: ADD DATA QUALITY SUMMARY TO PRODUCT_LCAS
-- =====================================================

-- Check and add data_quality_summary column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas'
    AND column_name = 'data_quality_summary'
  ) THEN
    ALTER TABLE public.product_lcas
    ADD COLUMN data_quality_summary JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- =====================================================
-- STEP 4: ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN public.product_lca_materials.data_priority IS
  'Data source priority: 1=Primary/Verified (Supplier EPD), 2=Regional/DEFRA (Government), 3=Secondary/Ecoinvent (Modelled)';

COMMENT ON COLUMN public.product_lca_materials.data_quality_tag IS
  'Human-readable tag: Primary_Verified | Regional_Standard | Secondary_Modelled';

COMMENT ON COLUMN public.product_lca_materials.supplier_lca_id IS
  'If data_priority=1, references the supplier product LCA that provided verified impact data';

COMMENT ON COLUMN public.product_lca_materials.confidence_score IS
  'Data reliability score 0-100. Primary=95, Regional=85, Secondary=70, Proxy=50';

COMMENT ON COLUMN public.product_lca_materials.methodology IS
  'Impact assessment method used: ISO 14067, ReCiPe 2016 Midpoint (H), GHG Protocol, etc.';

COMMENT ON COLUMN public.product_lca_materials.source_reference IS
  'Exact source citation for audit trail: "Supplier LCA abc-123", "DEFRA 2024 Natural Gas", "Ecoinvent 3.12 Sugar beet GLO"';

COMMENT ON COLUMN public.product_lca_materials.impact_climate_fossil IS
  'Fossil CO2e emissions (kg CO2e) - from fossil fuels, minerals. Per ISO 14067, reported in total but tracked separately.';

COMMENT ON COLUMN public.product_lca_materials.impact_climate_biogenic IS
  'Biogenic CO2e emissions (kg CO2e) - from biomass, crops, forestry. Per ISO 14067, must be reported separately from fossil.';

COMMENT ON COLUMN public.product_lca_materials.impact_climate_dluc IS
  'Direct Land Use Change CO2e (kg CO2e) - emissions from deforestation/land conversion. Per ISO 14067, reported separately.';

COMMENT ON COLUMN public.product_lcas.data_quality_summary IS
  'JSON summary: {score: 85, rating: "High", breakdown: {primary_share: "60%", regional_share: "10%", secondary_share: "30%"}}';

-- =====================================================
-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_data_priority
  ON public.product_lca_materials(data_priority);

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_supplier_lca
  ON public.product_lca_materials(supplier_lca_id)
  WHERE supplier_lca_id IS NOT NULL;

-- =====================================================
-- STEP 6: VALIDATION
-- =====================================================

-- Log completion
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'product_lca_materials'
  AND column_name IN (
    'data_priority',
    'data_quality_tag',
    'supplier_lca_id',
    'confidence_score',
    'methodology',
    'source_reference',
    'impact_climate_fossil',
    'impact_climate_biogenic',
    'impact_climate_dluc'
  );

  RAISE NOTICE 'Data quality migration complete. Added % columns to product_lca_materials', col_count;
END $$;