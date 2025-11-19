/*
  # Add Dual-Path Data Entry Support to Product LCA Materials

  ## Overview
  This migration evolves the product_lca_materials table to support advanced dual-path
  data entry, allowing users to add ingredients from either the OpenLCA database or
  their internal Supplier Network with full data provenance tracking.

  ## Changes to `product_lca_materials` table
  
  ### New Columns Added:
  - `data_source` (text, nullable) - Provenance flag: 'openlca' or 'supplier'
  - `data_source_id` (text, nullable) - External system UUID (OpenLCA process ID)
  - `supplier_product_id` (uuid, nullable) - Foreign key to supplier_products table
  - `origin_country` (text, nullable) - User-entered origin location
  - `is_organic_certified` (boolean, default false) - Organic certification flag

  ## Data Integrity
  - Check constraint ensures data_source is either 'openlca' or 'supplier' when provided
  - Check constraint ensures proper foreign references based on data_source type
  - Existing data is preserved and remains valid
  - Backwards compatible with existing simple material entries

  ## Performance
  - Index on data_source for filtering by provenance type
  - Index on supplier_product_id for efficient joins
  - Index on data_source_id for OpenLCA lookups

  ## Security
  - RLS policies continue to work as expected
  - No changes needed to existing policies
  - Supplier product access controlled via supplier_products RLS
*/

-- ============================================================================
-- STEP 1: Add data_source column
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'data_source'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN data_source TEXT;
    
    COMMENT ON COLUMN public.product_lca_materials.data_source IS 
      'Data provenance flag indicating source: "openlca" for OpenLCA database, "supplier" for internal supplier network';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add data_source_id column
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'data_source_id'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN data_source_id TEXT;
    
    COMMENT ON COLUMN public.product_lca_materials.data_source_id IS 
      'External system identifier - stores OpenLCA process UUID or other external reference ID';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add supplier_product_id column
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'supplier_product_id'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN supplier_product_id UUID;
    
    COMMENT ON COLUMN public.product_lca_materials.supplier_product_id IS 
      'Foreign key to supplier_products table when data_source is "supplier"';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add origin_country column
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'origin_country'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN origin_country TEXT;
    
    COMMENT ON COLUMN public.product_lca_materials.origin_country IS 
      'Country or region of origin for the material, used for geographical correlation in LCA calculations';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Add is_organic_certified column
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'is_organic_certified'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD COLUMN is_organic_certified BOOLEAN DEFAULT false;
    
    COMMENT ON COLUMN public.product_lca_materials.is_organic_certified IS 
      'Indicates whether the material has organic certification, affecting carbon intensity calculations';
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Add check constraint for valid data_source values
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_data_source'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT valid_data_source
      CHECK (data_source IS NULL OR data_source IN ('openlca', 'supplier'));
  END IF;
END $$;

COMMENT ON CONSTRAINT valid_data_source ON public.product_lca_materials IS 
  'Ensures data_source is either "openlca", "supplier", or NULL for backwards compatibility';

-- ============================================================================
-- STEP 7: Add check constraint for data source integrity
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'data_source_integrity'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT data_source_integrity
      CHECK (
        (data_source = 'openlca' AND data_source_id IS NOT NULL) OR
        (data_source = 'supplier' AND supplier_product_id IS NOT NULL) OR
        (data_source IS NULL)
      );
  END IF;
END $$;

COMMENT ON CONSTRAINT data_source_integrity ON public.product_lca_materials IS 
  'Ensures proper foreign references: openlca requires data_source_id, supplier requires supplier_product_id';

-- ============================================================================
-- STEP 8: Create indexes for performance
-- ============================================================================

-- Index on data_source for filtering by provenance type
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_data_source
  ON public.product_lca_materials(data_source)
  WHERE data_source IS NOT NULL;

-- Index on supplier_product_id for efficient joins
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_supplier_product_id
  ON public.product_lca_materials(supplier_product_id)
  WHERE supplier_product_id IS NOT NULL;

-- Index on data_source_id for OpenLCA lookups
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_data_source_id
  ON public.product_lca_materials(data_source_id)
  WHERE data_source_id IS NOT NULL;

-- Index on origin_country for geographical analysis
CREATE INDEX IF NOT EXISTS idx_product_lca_materials_origin_country
  ON public.product_lca_materials(origin_country)
  WHERE origin_country IS NOT NULL;