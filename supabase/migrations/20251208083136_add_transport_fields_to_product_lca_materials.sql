/*
  # Add Transport Fields to Product LCA Materials

  1. Changes to Tables
    - Add transport fields to `product_lca_materials` table
      - `transport_mode` (text) - Snapshot of transport mode at LCA calculation time
      - `distance_km` (numeric) - Snapshot of distance at LCA calculation time
      - `impact_transport` (numeric) - Calculated transport emissions for this material

  2. Performance
    - Index on transport_mode for analytics and reporting
    - Enable efficient transport impact analysis across LCAs

  3. Notes
    - All fields nullable for backward compatibility with existing LCAs
    - Captures transport configuration at time of LCA calculation
    - impact_transport stored separately from material production impacts
    - Enables breakdown of transport vs production emissions in reports
*/

-- ============================================================================
-- STEP 1: Add transport mode field to product_lca_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'transport_mode'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN transport_mode TEXT CHECK (transport_mode IN ('truck', 'train', 'ship', 'air'));

    COMMENT ON COLUMN public.product_lca_materials.transport_mode IS
      'Historical snapshot of transport mode used at LCA calculation time. Matches DEFRA freight categories.';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add transport distance field to product_lca_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'distance_km'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN distance_km NUMERIC CHECK (distance_km IS NULL OR distance_km >= 0);

    COMMENT ON COLUMN public.product_lca_materials.distance_km IS
      'Historical snapshot of distance in kilometres at LCA calculation time. Used for transport emissions calculation.';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add transport impact field to product_lca_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'impact_transport'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN impact_transport NUMERIC DEFAULT 0;

    COMMENT ON COLUMN public.product_lca_materials.impact_transport IS
      'Transport emissions for this material in kg CO2e. Calculated as: (quantity_kg / 1000) × distance_km × DEFRA_emission_factor.';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Create indexes for transport analytics
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_transport_mode
  ON public.product_lca_materials(transport_mode)
  WHERE transport_mode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_with_transport
  ON public.product_lca_materials(product_lca_id, transport_mode)
  WHERE transport_mode IS NOT NULL AND distance_km IS NOT NULL;

-- ============================================================================
-- STEP 5: Create index for impact analysis
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_impact_transport
  ON public.product_lca_materials(impact_transport)
  WHERE impact_transport IS NOT NULL AND impact_transport > 0;