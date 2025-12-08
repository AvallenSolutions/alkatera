/*
  # Add Transport Fields to Product Materials

  1. Changes to Tables
    - Add transport fields to `product_materials` table
      - `transport_mode` (text) - Mode of transport (truck, train, ship, air)
      - `distance_km` (numeric) - Distance from origin to facility in kilometres
      - `transport_emissions` (numeric) - Calculated transport emissions in kg CO2e

  2. Performance
    - Index on transport_mode for filtering and analytics
    - Enable efficient queries for transport impact analysis

  3. Notes
    - All new fields are nullable for backward compatibility
    - transport_mode restricted to valid DEFRA transport categories
    - distance_km must be non-negative when specified
    - transport_emissions calculated during LCA computation
*/

-- ============================================================================
-- STEP 1: Add transport mode field to product_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'transport_mode'
  ) THEN
    ALTER TABLE public.product_materials
      ADD COLUMN transport_mode TEXT CHECK (transport_mode IN ('truck', 'train', 'ship', 'air'));

    COMMENT ON COLUMN public.product_materials.transport_mode IS
      'Mode of transport from origin to facility. Must match DEFRA freight categories: truck, train, ship, or air.';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add transport distance field to product_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'distance_km'
  ) THEN
    ALTER TABLE public.product_materials
      ADD COLUMN distance_km NUMERIC CHECK (distance_km IS NULL OR distance_km >= 0);

    COMMENT ON COLUMN public.product_materials.distance_km IS
      'Distance in kilometres from material origin to production facility. Used to calculate transport emissions.';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add calculated transport emissions field to product_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'transport_emissions'
  ) THEN
    ALTER TABLE public.product_materials
      ADD COLUMN transport_emissions NUMERIC;

    COMMENT ON COLUMN public.product_materials.transport_emissions IS
      'Calculated transport emissions in kg CO2e. Computed using: (weight_kg / 1000) × distance_km × emission_factor';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Create indexes for transport analytics
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_materials_transport_mode
  ON public.product_materials(transport_mode)
  WHERE transport_mode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_materials_with_transport
  ON public.product_materials(product_id, transport_mode)
  WHERE transport_mode IS NOT NULL AND distance_km IS NOT NULL;

-- ============================================================================
-- STEP 5: Add validation constraint for transport data completeness
-- ============================================================================

-- Ensure if transport_mode is specified, distance_km must also be specified
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transport_data_completeness'
  ) THEN
    ALTER TABLE public.product_materials
      ADD CONSTRAINT transport_data_completeness
      CHECK (
        (transport_mode IS NULL AND distance_km IS NULL) OR
        (transport_mode IS NOT NULL AND distance_km IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT transport_data_completeness ON public.product_materials IS
  'Ensures transport_mode and distance_km are either both NULL or both specified for data consistency.';