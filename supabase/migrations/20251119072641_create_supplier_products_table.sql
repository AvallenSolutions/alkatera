/*
  # Create Supplier Products Table

  ## Overview
  This migration creates the supplier_products table to store product catalog data
  from suppliers in the organization's supply chain. This enables users to select
  materials from their supplier network with primary data provenance.

  ## New Table: `supplier_products`
  
  ### Columns:
  - `id` (uuid, primary key) - Unique identifier
  - `supplier_id` (uuid, foreign key) - Links to suppliers table
  - `organization_id` (uuid, foreign key) - Organization that owns this data
  - `name` (text, required) - Product/material name
  - `description` (text, nullable) - Detailed product description
  - `category` (text, nullable) - Product category for organization
  - `unit` (text, required) - Base unit (kg, L, m, etc.)
  - `carbon_intensity` (numeric, nullable) - Carbon footprint per unit (kg CO2e)
  - `product_code` (text, nullable) - Supplier's product/SKU code
  - `is_active` (boolean, default true) - Whether product is currently available
  - `metadata` (jsonb, nullable) - Additional flexible product data
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security (RLS)
  - Organization-scoped access via organization_id
  - Users can only see products from suppliers in their organization
  - Policies use helper function for clean multi-tenant isolation

  ## Performance
  - Index on organization_id for tenant filtering
  - Index on supplier_id for efficient supplier-product joins
  - Index on name for search functionality
  - Composite index on organization + active status
  - GIN index on metadata for flexible JSON queries

  ## Data Integrity
  - Foreign key to suppliers table with CASCADE delete
  - Foreign key to organizations table with CASCADE delete
  - Check constraint for positive carbon_intensity values
  - Unique constraint on supplier_id + product_code combination
*/

-- ============================================================================
-- STEP 1: Create supplier_products table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT NOT NULL,
  carbon_intensity NUMERIC(10, 4),
  product_code TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT positive_carbon_intensity CHECK (carbon_intensity IS NULL OR carbon_intensity >= 0),
  CONSTRAINT non_empty_name CHECK (length(trim(name)) > 0),
  CONSTRAINT non_empty_unit CHECK (length(trim(unit)) > 0)
);

COMMENT ON TABLE public.supplier_products IS 
  'Stores product catalog data from suppliers. Enables material selection with primary data provenance from supply chain.';

COMMENT ON COLUMN public.supplier_products.supplier_id IS 
  'Foreign key to suppliers table - which supplier provides this product';

COMMENT ON COLUMN public.supplier_products.organization_id IS 
  'Organization that owns this supplier relationship - enables multi-tenant isolation';

COMMENT ON COLUMN public.supplier_products.carbon_intensity IS 
  'Carbon footprint per unit (kg CO2e per unit). Primary data from supplier when available.';

COMMENT ON COLUMN public.supplier_products.product_code IS 
  'Supplier product code or SKU for reference and ordering';

COMMENT ON COLUMN public.supplier_products.metadata IS 
  'Flexible JSON storage for additional product attributes (certifications, specifications, etc.)';

-- ============================================================================
-- STEP 2: Create unique constraint on supplier + product code
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_products_unique_code
  ON public.supplier_products(supplier_id, product_code)
  WHERE product_code IS NOT NULL;

COMMENT ON INDEX idx_supplier_products_unique_code IS 
  'Ensures product codes are unique per supplier - prevents duplicate entries';

-- ============================================================================
-- STEP 3: Create performance indexes
-- ============================================================================

-- Index for organization filtering (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_supplier_products_organization_id
  ON public.supplier_products(organization_id);

-- Index for supplier-based lookups
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id
  ON public.supplier_products(supplier_id);

-- Index for product name search (using standard text pattern matching)
CREATE INDEX IF NOT EXISTS idx_supplier_products_name_lower
  ON public.supplier_products(LOWER(name));

-- Composite index for active products by organization
CREATE INDEX IF NOT EXISTS idx_supplier_products_org_active
  ON public.supplier_products(organization_id, is_active)
  WHERE is_active = true;

-- GIN index for metadata queries
CREATE INDEX IF NOT EXISTS idx_supplier_products_metadata
  ON public.supplier_products USING gin(metadata);

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies
-- ============================================================================

-- SELECT: Users can view products from suppliers in their organization
CREATE POLICY "Users can view supplier products from their organization"
  ON public.supplier_products
  FOR SELECT
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- INSERT: Users can create supplier products in their organization
CREATE POLICY "Users can create supplier products in their organization"
  ON public.supplier_products
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_current_organization_id());

-- UPDATE: Users can update supplier products from their organization
CREATE POLICY "Users can update supplier products from their organization"
  ON public.supplier_products
  FOR UPDATE
  TO authenticated
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- DELETE: Users can delete supplier products from their organization
CREATE POLICY "Users can delete supplier products from their organization"
  ON public.supplier_products
  FOR DELETE
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- ============================================================================
-- STEP 6: Create updated_at trigger
-- ============================================================================

DROP TRIGGER IF EXISTS update_supplier_products_updated_at ON public.supplier_products;

CREATE TRIGGER update_supplier_products_updated_at
  BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 7: Add foreign key constraint from product_lca_materials
-- ============================================================================

-- Add foreign key if table exists and column exists but constraint doesn't
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials'
    AND column_name = 'supplier_product_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_product_lca_materials_supplier_product'
  ) THEN
    ALTER TABLE public.product_lca_materials
      ADD CONSTRAINT fk_product_lca_materials_supplier_product
      FOREIGN KEY (supplier_product_id)
      REFERENCES public.supplier_products(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON CONSTRAINT fk_product_lca_materials_supplier_product 
  ON public.product_lca_materials IS 
  'Links materials to supplier products when data_source is "supplier". SET NULL on delete to preserve material records.';

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_products TO authenticated;