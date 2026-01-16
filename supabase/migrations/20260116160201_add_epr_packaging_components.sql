/*
  # Add EPR Packaging Components System

  This migration adds support for UK Extended Producer Responsibility (EPR)
  packaging data collection requirements.

  1. New Table: `packaging_material_components`
    - Stores material breakdown for packaging items (paper, glue, ink, etc.)
    - Links to parent product_materials record
    - Enables EPR-compliant material weight tracking

  2. New Columns on `product_materials`
    - EPR compliance fields (packaging activity, household/non-household, etc.)
    - Component breakdown flag

  3. Security
    - RLS policies for organization-scoped access
    - Follows existing patterns from multipack_components
*/

-- ============================================================================
-- STEP 1: Add EPR columns to product_materials table
-- ============================================================================

DO $$
BEGIN
  -- Flag to indicate if this packaging item has component breakdown
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'has_component_breakdown'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN has_component_breakdown BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- EPR Packaging Level (primary, secondary, tertiary, shipment)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_packaging_level'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_packaging_level TEXT CHECK (
      epr_packaging_level IS NULL OR
      epr_packaging_level IN ('primary', 'secondary', 'tertiary', 'shipment')
    );
  END IF;

  -- EPR Packaging Activity (how packaging was supplied)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_packaging_activity'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_packaging_activity TEXT CHECK (
      epr_packaging_activity IS NULL OR
      epr_packaging_activity IN ('brand', 'packed_filled', 'imported', 'empty', 'hired', 'marketplace')
    );
  END IF;

  -- Household vs Non-household packaging
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_is_household'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_is_household BOOLEAN DEFAULT true;
  END IF;

  -- RAM Recyclability Rating (Red/Amber/Green)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_ram_rating'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_ram_rating TEXT CHECK (
      epr_ram_rating IS NULL OR
      epr_ram_rating IN ('red', 'amber', 'green')
    );
  END IF;

  -- UK Nation where packaging is supplied/discarded
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_uk_nation'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_uk_nation TEXT CHECK (
      epr_uk_nation IS NULL OR
      epr_uk_nation IN ('england', 'scotland', 'wales', 'northern_ireland')
    );
  END IF;

  -- Drinks container flag (for 150ml-3l containers)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_materials'
    AND column_name = 'epr_is_drinks_container'
  ) THEN
    ALTER TABLE public.product_materials
    ADD COLUMN epr_is_drinks_container BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.product_materials.has_component_breakdown IS 'Indicates if this packaging has detailed material component breakdown';
COMMENT ON COLUMN public.product_materials.epr_packaging_level IS 'UK EPR packaging class: primary, secondary, tertiary, or shipment';
COMMENT ON COLUMN public.product_materials.epr_packaging_activity IS 'How packaging was supplied: brand, packed_filled, imported, empty, hired, marketplace';
COMMENT ON COLUMN public.product_materials.epr_is_household IS 'Whether packaging is household (true) or non-household (false) for EPR';
COMMENT ON COLUMN public.product_materials.epr_ram_rating IS 'Recyclability Assessment Methodology rating: red, amber, or green';
COMMENT ON COLUMN public.product_materials.epr_uk_nation IS 'UK nation where packaging supplied/discarded: england, scotland, wales, northern_ireland';
COMMENT ON COLUMN public.product_materials.epr_is_drinks_container IS 'Flag for drinks containers 150ml-3l that need separate tracking';

-- ============================================================================
-- STEP 2: Create packaging_material_components table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.packaging_material_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent reference to product_materials
  product_material_id INTEGER NOT NULL REFERENCES public.product_materials(id) ON DELETE CASCADE,

  -- EPR Material Classification
  epr_material_type TEXT NOT NULL CHECK (epr_material_type IN (
    -- Main EPR material categories (aligned with gov.uk)
    'aluminium', 'fibre_composite', 'glass', 'paper_cardboard',
    'plastic_rigid', 'plastic_flexible', 'steel', 'wood', 'other',
    -- Sub-component materials for detailed breakdown
    'adhesive', 'ink', 'coating', 'lacquer'
  )),

  -- Component details
  component_name TEXT NOT NULL,
  weight_grams NUMERIC(10, 4) NOT NULL CHECK (weight_grams > 0),
  recycled_content_percentage NUMERIC(5, 2) DEFAULT 0 CHECK (
    recycled_content_percentage >= 0 AND recycled_content_percentage <= 100
  ),
  is_recyclable BOOLEAN DEFAULT true,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_packaging_components_material_id
ON public.packaging_material_components(product_material_id);

CREATE INDEX IF NOT EXISTS idx_packaging_components_epr_type
ON public.packaging_material_components(epr_material_type);

-- Create trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_packaging_material_components_updated_at'
  ) THEN
    CREATE TRIGGER update_packaging_material_components_updated_at
    BEFORE UPDATE ON public.packaging_material_components
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE public.packaging_material_components IS 'Material breakdown for packaging items to support UK EPR compliance';
COMMENT ON COLUMN public.packaging_material_components.product_material_id IS 'Parent packaging item in product_materials';
COMMENT ON COLUMN public.packaging_material_components.epr_material_type IS 'EPR material category aligned with UK gov.uk requirements';
COMMENT ON COLUMN public.packaging_material_components.component_name IS 'Descriptive name for the component (e.g., Paper substrate, Wet glue)';
COMMENT ON COLUMN public.packaging_material_components.weight_grams IS 'Weight of this component in grams';
COMMENT ON COLUMN public.packaging_material_components.recycled_content_percentage IS 'Percentage of recycled content (0-100)';
COMMENT ON COLUMN public.packaging_material_components.is_recyclable IS 'Whether this component is recyclable';

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.packaging_material_components ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: RLS Policies for packaging_material_components
-- ============================================================================

-- SELECT policy
CREATE POLICY "Users can view packaging components in their organization"
ON public.packaging_material_components
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_materials pm
    JOIN public.products p ON pm.product_id = p.id
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE pm.id = packaging_material_components.product_material_id
    AND om.user_id = auth.uid()
  )
);

-- INSERT policy
CREATE POLICY "Users can insert packaging components in their organization"
ON public.packaging_material_components
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.product_materials pm
    JOIN public.products p ON pm.product_id = p.id
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE pm.id = packaging_material_components.product_material_id
    AND om.user_id = auth.uid()
  )
);

-- UPDATE policy
CREATE POLICY "Users can update packaging components in their organization"
ON public.packaging_material_components
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_materials pm
    JOIN public.products p ON pm.product_id = p.id
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE pm.id = packaging_material_components.product_material_id
    AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.product_materials pm
    JOIN public.products p ON pm.product_id = p.id
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE pm.id = packaging_material_components.product_material_id
    AND om.user_id = auth.uid()
  )
);

-- DELETE policy
CREATE POLICY "Users can delete packaging components in their organization"
ON public.packaging_material_components
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_materials pm
    JOIN public.products p ON pm.product_id = p.id
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE pm.id = packaging_material_components.product_material_id
    AND om.user_id = auth.uid()
  )
);
