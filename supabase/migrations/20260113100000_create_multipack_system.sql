/*
  # Create Multipack System

  1. Changes to Products Table
    - Add `is_multipack` boolean column to distinguish multipacks from single products

  2. New Table: `multipack_components`
    - Links multipack products to their component products
    - Stores quantity of each component in the multipack
    - Supports nested multipacks (multipack containing another multipack)

  3. New Table: `multipack_secondary_packaging`
    - Simple secondary packaging for multipacks (outer box, shrink wrap, etc.)
    - Lightweight compared to full packaging system

  4. Security
    - RLS policies for organization-scoped access
    - All tables inherit organization access from products table
*/

-- ============================================================================
-- STEP 1: Add is_multipack column to products table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'is_multipack'
  ) THEN
    ALTER TABLE public.products ADD COLUMN is_multipack BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create index for filtering multipacks
CREATE INDEX IF NOT EXISTS idx_products_is_multipack ON public.products(is_multipack);

-- Add comment
COMMENT ON COLUMN public.products.is_multipack IS 'Indicates if the product is a multipack containing other products';

-- ============================================================================
-- STEP 2: Create multipack_components table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.multipack_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  multipack_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure quantity is positive
  CONSTRAINT positive_component_quantity CHECK (quantity > 0),

  -- Prevent duplicate entries for same component in a multipack
  CONSTRAINT unique_multipack_component UNIQUE (multipack_product_id, component_product_id),

  -- Prevent self-reference (product cannot contain itself)
  CONSTRAINT no_self_reference CHECK (multipack_product_id != component_product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_multipack_components_multipack_id
ON public.multipack_components(multipack_product_id);

CREATE INDEX IF NOT EXISTS idx_multipack_components_component_id
ON public.multipack_components(component_product_id);

-- Create trigger for updated_at
CREATE TRIGGER update_multipack_components_updated_at
BEFORE UPDATE ON public.multipack_components
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.multipack_components IS 'Junction table linking multipack products to their component products with quantities';
COMMENT ON COLUMN public.multipack_components.multipack_product_id IS 'The multipack product that contains other products';
COMMENT ON COLUMN public.multipack_components.component_product_id IS 'A product contained within the multipack';
COMMENT ON COLUMN public.multipack_components.quantity IS 'Number of units of this component in the multipack';

-- ============================================================================
-- STEP 3: Create multipack_secondary_packaging table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.multipack_secondary_packaging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  multipack_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  material_type TEXT NOT NULL DEFAULT 'cardboard',
  weight_grams NUMERIC(10, 2) NOT NULL,
  is_recyclable BOOLEAN DEFAULT true,
  recycled_content_percentage NUMERIC(5, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure weight is positive
  CONSTRAINT positive_packaging_weight CHECK (weight_grams > 0),

  -- Ensure recycled content is between 0 and 100
  CONSTRAINT valid_recycled_content CHECK (recycled_content_percentage >= 0 AND recycled_content_percentage <= 100)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_multipack_secondary_packaging_multipack_id
ON public.multipack_secondary_packaging(multipack_product_id);

-- Create trigger for updated_at
CREATE TRIGGER update_multipack_secondary_packaging_updated_at
BEFORE UPDATE ON public.multipack_secondary_packaging
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.multipack_secondary_packaging IS 'Simple secondary packaging for multipacks (outer box, shrink wrap, etc.)';
COMMENT ON COLUMN public.multipack_secondary_packaging.material_name IS 'Name of the packaging material (e.g., Cardboard Box, Shrink Wrap)';
COMMENT ON COLUMN public.multipack_secondary_packaging.material_type IS 'Type of material (cardboard, plastic, paper, etc.)';
COMMENT ON COLUMN public.multipack_secondary_packaging.weight_grams IS 'Weight of the packaging in grams';
COMMENT ON COLUMN public.multipack_secondary_packaging.is_recyclable IS 'Whether the packaging is recyclable';
COMMENT ON COLUMN public.multipack_secondary_packaging.recycled_content_percentage IS 'Percentage of recycled content in the packaging';

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.multipack_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multipack_secondary_packaging ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: RLS Policies for multipack_components
-- ============================================================================

-- SELECT policy
CREATE POLICY "Users can view multipack components in their organization"
ON public.multipack_components
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = multipack_components.multipack_product_id
    AND om.user_id = auth.uid()
  )
);

-- INSERT policy
CREATE POLICY "Users can insert multipack components in their organization"
ON public.multipack_components
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = multipack_components.multipack_product_id
    AND om.user_id = auth.uid()
  )
);

-- UPDATE policy
CREATE POLICY "Users can update multipack components in their organization"
ON public.multipack_components
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = multipack_components.multipack_product_id
    AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = multipack_components.multipack_product_id
    AND om.user_id = auth.uid()
  )
);

-- DELETE policy
CREATE POLICY "Users can delete multipack components in their organization"
ON public.multipack_components
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = multipack_components.multipack_product_id
    AND om.user_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 6: RLS Policies for multipack_secondary_packaging
-- ============================================================================

-- SELECT policy
CREATE POLICY "Users can view multipack packaging in their organization"
ON public.multipack_secondary_packaging
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = multipack_secondary_packaging.multipack_product_id
    AND om.user_id = auth.uid()
  )
);

-- INSERT policy
CREATE POLICY "Users can insert multipack packaging in their organization"
ON public.multipack_secondary_packaging
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = multipack_secondary_packaging.multipack_product_id
    AND om.user_id = auth.uid()
  )
);

-- UPDATE policy
CREATE POLICY "Users can update multipack packaging in their organization"
ON public.multipack_secondary_packaging
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = multipack_secondary_packaging.multipack_product_id
    AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = multipack_secondary_packaging.multipack_product_id
    AND om.user_id = auth.uid()
  )
);

-- DELETE policy
CREATE POLICY "Users can delete multipack packaging in their organization"
ON public.multipack_secondary_packaging
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = multipack_secondary_packaging.multipack_product_id
    AND om.user_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 7: Create helper function to get aggregated multipack data
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_multipack_aggregated_data(p_multipack_id UUID)
RETURNS TABLE (
  total_components INTEGER,
  total_units INTEGER,
  aggregated_unit_size_value NUMERIC,
  component_products JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT mc.component_product_id)::INTEGER as total_components,
    SUM(mc.quantity)::INTEGER as total_units,
    SUM(p.unit_size_value * mc.quantity) as aggregated_unit_size_value,
    jsonb_agg(
      jsonb_build_object(
        'product_id', p.id,
        'product_name', p.name,
        'product_sku', p.sku,
        'quantity', mc.quantity,
        'unit_size_value', p.unit_size_value,
        'unit_size_unit', p.unit_size_unit,
        'is_multipack', p.is_multipack
      )
    ) as component_products
  FROM public.multipack_components mc
  JOIN public.products p ON p.id = mc.component_product_id
  WHERE mc.multipack_product_id = p_multipack_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_multipack_aggregated_data(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_multipack_aggregated_data IS 'Returns aggregated data for a multipack including component products and their quantities';
