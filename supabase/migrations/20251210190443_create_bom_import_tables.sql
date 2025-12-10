/*
  # Create Bill of Materials Import Tables

  1. New Tables
    - `bom_imports` - Tracks uploaded BOM files with metadata
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `product_id` (bigint, foreign key to products, nullable)
      - `file_name` (text) - Original filename
      - `file_type` (text) - 'pdf' or 'csv'
      - `file_url` (text, nullable) - Storage URL for archived file
      - `status` (text) - 'pending', 'processing', 'completed', 'failed'
      - `error_message` (text, nullable) - Error details if failed
      - `item_count` (integer) - Number of items extracted
      - `created_by` (uuid) - User who uploaded
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `bom_extracted_items` - Stores parsed ingredient/packaging data
      - `id` (uuid, primary key)
      - `bom_import_id` (uuid, foreign key to bom_imports)
      - `raw_name` (text) - Original name from BOM
      - `clean_name` (text) - Cleaned/normalized name
      - `quantity` (numeric) - Amount extracted
      - `unit` (text) - Unit extracted (kg, L, ml, g, etc.)
      - `item_type` (text) - 'ingredient' or 'packaging'
      - `unit_cost` (numeric, nullable) - Cost per unit if available
      - `total_cost` (numeric, nullable) - Total cost if available
      - `matched_material_id` (uuid, nullable) - Link to staging_emission_factors
      - `match_confidence` (numeric, nullable) - Confidence score 0-1
      - `is_reviewed` (boolean) - Manual review completed
      - `is_imported` (boolean) - Item imported to product
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Organization-scoped access policies

  3. Indexes
    - Index on bom_import_id for joins
    - Index on organization_id for filtering
    - Index on status for querying pending imports
*/

-- ============================================================================
-- STEP 1: Create BOM Imports Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bom_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  item_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_file_type CHECK (file_type IN ('pdf', 'csv')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

COMMENT ON TABLE public.bom_imports IS 'Tracks uploaded Bill of Materials files for parsing and import into product specifications.';
COMMENT ON COLUMN public.bom_imports.status IS 'Import status: pending (uploaded), processing (being parsed), completed (ready for review), failed (error occurred).';

-- ============================================================================
-- STEP 2: Create BOM Extracted Items Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bom_extracted_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_import_id UUID NOT NULL REFERENCES public.bom_imports(id) ON DELETE CASCADE,
  raw_name TEXT NOT NULL,
  clean_name TEXT,
  quantity NUMERIC(12, 6),
  unit TEXT,
  item_type TEXT DEFAULT 'ingredient',
  unit_cost NUMERIC(12, 4),
  total_cost NUMERIC(12, 4),
  matched_material_id UUID,
  match_confidence NUMERIC(3, 2),
  is_reviewed BOOLEAN DEFAULT false,
  is_imported BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_item_type CHECK (item_type IN ('ingredient', 'packaging'))
);

COMMENT ON TABLE public.bom_extracted_items IS 'Individual items extracted from BOM files, pending review and import into product specifications.';
COMMENT ON COLUMN public.bom_extracted_items.raw_name IS 'Original component name as extracted from the BOM file.';
COMMENT ON COLUMN public.bom_extracted_items.clean_name IS 'Cleaned/normalized name after removing codes and formatting.';
COMMENT ON COLUMN public.bom_extracted_items.match_confidence IS 'Confidence score (0.00-1.00) for auto-matched material.';

-- ============================================================================
-- STEP 3: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bom_imports_organization_id
  ON public.bom_imports(organization_id);

CREATE INDEX IF NOT EXISTS idx_bom_imports_product_id
  ON public.bom_imports(product_id);

CREATE INDEX IF NOT EXISTS idx_bom_imports_status
  ON public.bom_imports(status);

CREATE INDEX IF NOT EXISTS idx_bom_extracted_items_bom_import_id
  ON public.bom_extracted_items(bom_import_id);

CREATE INDEX IF NOT EXISTS idx_bom_extracted_items_item_type
  ON public.bom_extracted_items(item_type);

CREATE INDEX IF NOT EXISTS idx_bom_extracted_items_is_imported
  ON public.bom_extracted_items(is_imported);

-- ============================================================================
-- STEP 4: Create Triggers for Updated_At
-- ============================================================================

CREATE TRIGGER update_bom_imports_updated_at
  BEFORE UPDATE ON public.bom_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bom_extracted_items_updated_at
  BEFORE UPDATE ON public.bom_extracted_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.bom_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_extracted_items ENABLE ROW LEVEL SECURITY;

-- BOM Imports Policies
CREATE POLICY "Users can view BOM imports for their organization"
  ON public.bom_imports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = bom_imports.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert BOM imports for their organization"
  ON public.bom_imports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = bom_imports.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update BOM imports for their organization"
  ON public.bom_imports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = bom_imports.organization_id
        AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = bom_imports.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete BOM imports for their organization"
  ON public.bom_imports
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = bom_imports.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- BOM Extracted Items Policies (access via parent bom_imports)
CREATE POLICY "Users can view extracted items for their organization"
  ON public.bom_extracted_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bom_imports
      JOIN public.organization_members ON bom_imports.organization_id = organization_members.organization_id
      WHERE bom_imports.id = bom_extracted_items.bom_import_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert extracted items for their organization"
  ON public.bom_extracted_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bom_imports
      JOIN public.organization_members ON bom_imports.organization_id = organization_members.organization_id
      WHERE bom_imports.id = bom_extracted_items.bom_import_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update extracted items for their organization"
  ON public.bom_extracted_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bom_imports
      JOIN public.organization_members ON bom_imports.organization_id = organization_members.organization_id
      WHERE bom_imports.id = bom_extracted_items.bom_import_id
        AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bom_imports
      JOIN public.organization_members ON bom_imports.organization_id = organization_members.organization_id
      WHERE bom_imports.id = bom_extracted_items.bom_import_id
        AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete extracted items for their organization"
  ON public.bom_extracted_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bom_imports
      JOIN public.organization_members ON bom_imports.organization_id = organization_members.organization_id
      WHERE bom_imports.id = bom_extracted_items.bom_import_id
        AND organization_members.user_id = auth.uid()
    )
  );
