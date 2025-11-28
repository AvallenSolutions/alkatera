/*
  # Add Multi-Capital Impact Vectors to Product LCA Materials

  ## Overview
  This migration implements the Hybrid Overlay Impact Vector system, enabling
  the storage of complete multi-capital environmental impacts at the material
  entry level. This supports CSRD/TNFD compliance and transparent data provenance.

  ## New Columns Added to `product_lca_materials`

  ### Impact Values (Per Reference Unit)
  - `impact_climate` (numeric) - kg CO2e per reference unit
  - `impact_water` (numeric) - m³ or L per reference unit
  - `impact_land` (numeric) - m² per reference unit
  - `impact_waste` (numeric) - kg per reference unit

  ### Provenance Tracking
  - `impact_source` (text) - Data source type: 'primary_verified', 'secondary_modelled', 'hybrid_proxy'
  - `impact_reference_id` (text) - OpenLCA/Ecoinvent process ID or staging factor ID
  - `impact_metadata` (jsonb) - Additional context: {method, confidence_score, supplier_name, etc}

  ## Data Quality Hierarchy

  ### primary_verified
  User or supplier-provided verified measurements. Highest data quality.
  Example: Supplier EPD with verified CO2 value of 0.5 kg CO2e/kg

  ### secondary_modelled
  Background database data from Ecoinvent/OpenLCA. Standard LCA practice.
  Example: "Sugar (Cane - Global)" from staging_emission_factors

  ### hybrid_proxy
  Mix of primary (e.g., supplier CO2) and modelled (e.g., Ecoinvent water/land).
  Example: Supplier provides CO2, system overlays water/land from proxy

  ## Calculation Benefits
  - No runtime lookups needed during LCA calculation
  - Complete impact vector stored at material entry time
  - Transparent audit trail of data sources
  - Supports CSRD E1-E5 reporting requirements

  ## Migration Safety
  - All new columns nullable for backward compatibility
  - Existing materials remain functional
  - No data loss or breaking changes
*/

-- =====================================================
-- STEP 1: ADD IMPACT VALUE COLUMNS
-- =====================================================

DO $$
BEGIN
  -- Climate Change Impact (kg CO2e per reference unit)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'impact_climate'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN impact_climate NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.impact_climate IS
      'Climate change impact in kg CO2e per reference unit. Used for GHG Protocol and CSRD E1 reporting.';
  END IF;

  -- Water Depletion Impact (m³ or L per reference unit)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'impact_water'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN impact_water NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.impact_water IS
      'Water depletion impact per reference unit (m³ or L). Used for CSRD E3 water consumption reporting.';
  END IF;

  -- Land Use Impact (m² per reference unit)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'impact_land'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN impact_land NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.impact_land IS
      'Land use impact in m² per reference unit. Used for CSRD E4 and TNFD biodiversity reporting.';
  END IF;

  -- Waste Generation Impact (kg per reference unit)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'impact_waste'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN impact_waste NUMERIC DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.impact_waste IS
      'Waste generation in kg per reference unit. Used for circularity and CSRD E5 waste reporting.';
  END IF;
END $$;

-- =====================================================
-- STEP 2: ADD PROVENANCE TRACKING COLUMNS
-- =====================================================

DO $$
BEGIN
  -- Impact Source Type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'impact_source'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN impact_source TEXT DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.impact_source IS
      'Data provenance: "primary_verified" (user/supplier), "secondary_modelled" (Ecoinvent/OpenLCA), "hybrid_proxy" (mix of both)';
  END IF;

  -- Impact Reference ID (OpenLCA/Ecoinvent process ID)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'impact_reference_id'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN impact_reference_id TEXT DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.impact_reference_id IS
      'External reference: OpenLCA process UUID, Ecoinvent dataset ID, or staging_emission_factors.id';
  END IF;

  -- Impact Metadata (JSONB for flexibility)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'impact_metadata'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN impact_metadata JSONB DEFAULT NULL;

    COMMENT ON COLUMN public.product_lca_materials.impact_metadata IS
      'Additional provenance data: {lcia_method, ecoinvent_version, confidence_score, supplier_epd_url, verification_date}';
  END IF;
END $$;

-- =====================================================
-- STEP 3: ADD CHECK CONSTRAINTS
-- =====================================================

-- Ensure impact values are non-negative when provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_impact_climate_non_negative'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT check_impact_climate_non_negative
      CHECK (impact_climate IS NULL OR impact_climate >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_impact_water_non_negative'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT check_impact_water_non_negative
      CHECK (impact_water IS NULL OR impact_water >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_impact_land_non_negative'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT check_impact_land_non_negative
      CHECK (impact_land IS NULL OR impact_land >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_impact_waste_non_negative'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT check_impact_waste_non_negative
      CHECK (impact_waste IS NULL OR impact_waste >= 0);
  END IF;
END $$;

-- Ensure impact_source is valid when provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_valid_impact_source'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT check_valid_impact_source
      CHECK (
        impact_source IS NULL OR
        impact_source IN ('primary_verified', 'secondary_modelled', 'hybrid_proxy')
      );
  END IF;
END $$;

-- =====================================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index on impact_source for filtering by data quality
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_impact_source
  ON public.product_lca_materials(impact_source)
  WHERE impact_source IS NOT NULL;

-- Index on impact_reference_id for lookups
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_impact_reference_id
  ON public.product_lca_materials(impact_reference_id)
  WHERE impact_reference_id IS NOT NULL;

-- GIN index on impact_metadata for JSONB queries
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_impact_metadata
  ON public.product_lca_materials USING GIN (impact_metadata)
  WHERE impact_metadata IS NOT NULL;

-- =====================================================
-- STEP 5: VERIFICATION QUERY
-- =====================================================

DO $$
DECLARE
  total_materials integer;
  materials_with_impacts integer;
BEGIN
  SELECT COUNT(*) INTO total_materials FROM public.product_lca_materials;

  SELECT COUNT(*) INTO materials_with_impacts
  FROM public.product_lca_materials
  WHERE impact_climate IS NOT NULL;

  RAISE NOTICE 'Multi-Capital Impact Vector Migration Summary:';
  RAISE NOTICE '  Total materials in database: %', total_materials;
  RAISE NOTICE '  Materials with impact vectors: %', materials_with_impacts;
  RAISE NOTICE '  ✓ Migration completed successfully';

  IF materials_with_impacts = 0 AND total_materials > 0 THEN
    RAISE NOTICE '  ℹ Note: Existing materials will need impact data populated via re-entry or backfill';
  END IF;
END $$;
