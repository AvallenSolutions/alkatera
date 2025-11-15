/*
  # Create Product LCA Materials Table

  1. New Table: `product_lca_materials`
    - `id` (uuid, primary key)
    - `product_lca_id` (uuid, foreign key to product_lcas, required)
    - `material_id` (uuid, required) - UUID of ingredient or packaging item
    - `material_type` (text, required) - 'ingredient' or 'packaging'
    - `quantity` (numeric, required) - Amount of material used
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Organization-scoped access via product_lcas relationship
    - Users can manage materials for their organization's LCAs

  3. Indexes
    - Index on product_lca_id for joins
    - Index on material_type for filtering

  4. Notes
    - Links to either ingredients or packaging_types via material_id
    - material_type discriminates which table material_id references
    - No foreign key constraint on material_id (polymorphic relationship)
    - Quantity stored as numeric for precision in calculations
*/

-- ============================================================================
-- STEP 1: Create Product LCA Materials Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_lca_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_lca_id UUID NOT NULL REFERENCES public.product_lcas(id) ON DELETE CASCADE,
  material_id UUID NOT NULL,
  material_type TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_material_type CHECK (material_type IN ('ingredient', 'packaging')),
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);

COMMENT ON TABLE public.product_lca_materials IS 'Materials (ingredients and packaging) associated with a product LCA. Uses polymorphic pattern where material_id references either ingredients or packaging_types based on material_type.';
COMMENT ON COLUMN public.product_lca_materials.product_lca_id IS 'Foreign key linking to the parent product LCA.';
COMMENT ON COLUMN public.product_lca_materials.material_id IS 'UUID referencing either ingredients or packaging_types table (determined by material_type).';
COMMENT ON COLUMN public.product_lca_materials.material_type IS 'Discriminator field: "ingredient" or "packaging" indicating which table material_id references.';
COMMENT ON COLUMN public.product_lca_materials.quantity IS 'Amount of material used in the product. Units are context-dependent (kg, L, units, etc).';

-- ============================================================================
-- STEP 2: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_product_lca_id
  ON public.product_lca_materials(product_lca_id);

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_material_type
  ON public.product_lca_materials(material_type);

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_material_id
  ON public.product_lca_materials(material_id);

-- ============================================================================
-- STEP 3: Create Trigger for Updated_At
-- ============================================================================

CREATE TRIGGER update_product_lca_materials_updated_at
  BEFORE UPDATE ON public.product_lca_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.product_lca_materials ENABLE ROW LEVEL SECURITY;

-- Users can view materials for their organization's LCAs
CREATE POLICY "Users can view materials for their organization's LCAs"
  ON public.product_lca_materials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_lcas
      JOIN public.organization_members ON product_lcas.organization_id = organization_members.organization_id
      WHERE product_lcas.id = product_lca_materials.product_lca_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Users can insert materials for their organization's LCAs
CREATE POLICY "Users can insert materials for their organization's LCAs"
  ON public.product_lca_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.product_lcas
      JOIN public.organization_members ON product_lcas.organization_id = organization_members.organization_id
      WHERE product_lcas.id = product_lca_materials.product_lca_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Users can update materials for their organization's LCAs
CREATE POLICY "Users can update materials for their organization's LCAs"
  ON public.product_lca_materials
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_lcas
      JOIN public.organization_members ON product_lcas.organization_id = organization_members.organization_id
      WHERE product_lcas.id = product_lca_materials.product_lca_id
        AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.product_lcas
      JOIN public.organization_members ON product_lcas.organization_id = organization_members.organization_id
      WHERE product_lcas.id = product_lca_materials.product_lca_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Users can delete materials for their organization's LCAs
CREATE POLICY "Users can delete materials for their organization's LCAs"
  ON public.product_lca_materials
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_lcas
      JOIN public.organization_members ON product_lcas.organization_id = organization_members.organization_id
      WHERE product_lcas.id = product_lca_materials.product_lca_id
        AND organization_members.user_id = auth.uid()
    )
  );
