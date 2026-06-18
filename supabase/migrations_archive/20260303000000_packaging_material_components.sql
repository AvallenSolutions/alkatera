-- =============================================================================
-- Create packaging_material_components table
-- =============================================================================
-- Stores the individual material components of a packaging item for EPR
-- material breakdown reporting. Each packaging item (product_materials row)
-- can have multiple components (e.g. a label has paper, ink, adhesive).
-- The UI (PackagingComponentEditor) and save logic (useRecipeEditor,
-- recipe/page.tsx) already write to this table — this migration adds it.
-- =============================================================================

CREATE TABLE IF NOT EXISTS packaging_material_components (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_material_id uuid NOT NULL REFERENCES product_materials(id) ON DELETE CASCADE,
  epr_material_type text NOT NULL,
  component_name text NOT NULL,
  weight_grams numeric NOT NULL DEFAULT 0,
  recycled_content_percentage numeric DEFAULT 0,
  is_recyclable boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Validate material type against known EPR categories
ALTER TABLE packaging_material_components
  ADD CONSTRAINT check_epr_material_type
    CHECK (epr_material_type IN (
      'aluminium', 'fibre_composite', 'glass', 'paper_cardboard',
      'plastic_rigid', 'plastic_flexible', 'steel', 'wood', 'other',
      'adhesive', 'ink', 'coating', 'lacquer'
    ));

-- Index for fast lookup by parent packaging item
CREATE INDEX idx_pmc_product_material_id
  ON packaging_material_components(product_material_id);

-- RLS
ALTER TABLE packaging_material_components ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage components for their own packaging items
CREATE POLICY "Users can manage their packaging components"
  ON packaging_material_components
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM product_materials pm
      JOIN products p ON p.id = pm.product_id
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE pm.id = packaging_material_components.product_material_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_materials pm
      JOIN products p ON p.id = pm.product_id
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE pm.id = packaging_material_components.product_material_id
        AND om.user_id = auth.uid()
    )
  );

-- Service role bypass for API routes
CREATE POLICY "Service role full access to packaging components"
  ON packaging_material_components
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT ALL ON packaging_material_components TO authenticated;
GRANT ALL ON packaging_material_components TO service_role;

-- Comments
COMMENT ON TABLE packaging_material_components IS
  'Individual material components of packaging items for UK EPR material breakdown reporting';
COMMENT ON COLUMN packaging_material_components.epr_material_type IS
  'EPR material category: aluminium, glass, paper_cardboard, plastic_rigid, plastic_flexible, steel, wood, fibre_composite, other, adhesive, ink, coating, lacquer';
COMMENT ON COLUMN packaging_material_components.weight_grams IS
  'Weight of this component in grams';
