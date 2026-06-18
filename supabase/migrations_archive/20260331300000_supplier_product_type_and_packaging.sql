-- =============================================================================
-- Add product_type awareness to supplier_products (ingredient vs packaging)
-- =============================================================================
-- Packaging suppliers (e.g. Frugalpac) provide single units (bottles, cans,
-- labels) where the key data is weight per unit, material composition, and
-- EPR classification — not bulk weight/volume like ingredient suppliers.
-- =============================================================================

-- 1. Product type column
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'ingredient';

ALTER TABLE supplier_products
  ADD CONSTRAINT check_sp_product_type
    CHECK (product_type IN ('ingredient', 'packaging'));

-- 2. Packaging-specific columns on supplier_products
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS weight_g numeric(10,2),
  ADD COLUMN IF NOT EXISTS packaging_category text,
  ADD COLUMN IF NOT EXISTS primary_material text,
  ADD COLUMN IF NOT EXISTS epr_material_code text,
  ADD COLUMN IF NOT EXISTS epr_is_drinks_container boolean;

ALTER TABLE supplier_products
  ADD CONSTRAINT check_sp_packaging_category
    CHECK (packaging_category IS NULL OR packaging_category IN (
      'container', 'label', 'closure', 'secondary', 'shipment', 'tertiary'
    ));

ALTER TABLE supplier_products
  ADD CONSTRAINT check_sp_epr_material_code
    CHECK (epr_material_code IS NULL OR epr_material_code IN (
      'AL', 'FC', 'GL', 'PC', 'PL', 'ST', 'WD', 'OT'
    ));

ALTER TABLE supplier_products
  ADD CONSTRAINT check_sp_weight_g_positive
    CHECK (weight_g IS NULL OR weight_g >= 0);

-- 3. Material composition breakdown table (mirrors packaging_material_components)
CREATE TABLE IF NOT EXISTS supplier_product_components (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_product_id uuid NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
  component_name text NOT NULL,
  epr_material_type text NOT NULL,
  weight_grams numeric NOT NULL DEFAULT 0,
  percentage numeric(5,2),
  recycled_content_pct numeric(5,2),
  is_recyclable boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Validate material type against known EPR categories (same as packaging_material_components)
ALTER TABLE supplier_product_components
  ADD CONSTRAINT check_spc_epr_material_type
    CHECK (epr_material_type IN (
      'aluminium', 'fibre_composite', 'glass', 'paper_cardboard',
      'plastic_rigid', 'plastic_flexible', 'steel', 'wood', 'other',
      'adhesive', 'ink', 'coating', 'lacquer'
    ));

ALTER TABLE supplier_product_components
  ADD CONSTRAINT check_spc_weight_positive
    CHECK (weight_grams >= 0);

ALTER TABLE supplier_product_components
  ADD CONSTRAINT check_spc_percentage_range
    CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100));

ALTER TABLE supplier_product_components
  ADD CONSTRAINT check_spc_recycled_content_range
    CHECK (recycled_content_pct IS NULL OR (recycled_content_pct >= 0 AND recycled_content_pct <= 100));

-- Index for fast lookup by parent product
CREATE INDEX IF NOT EXISTS idx_spc_supplier_product_id
  ON supplier_product_components(supplier_product_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_spc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_spc_updated_at
  BEFORE UPDATE ON supplier_product_components
  FOR EACH ROW EXECUTE FUNCTION update_spc_updated_at();

-- =============================================================================
-- RLS for supplier_product_components
-- =============================================================================
ALTER TABLE supplier_product_components ENABLE ROW LEVEL SECURITY;

-- Suppliers can manage components for their own products
CREATE POLICY "Suppliers can manage their product components"
  ON supplier_product_components
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM supplier_products sp
      JOIN suppliers s ON s.id = sp.supplier_id
      WHERE sp.id = supplier_product_components.supplier_product_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM supplier_products sp
      JOIN suppliers s ON s.id = sp.supplier_id
      WHERE sp.id = supplier_product_components.supplier_product_id
        AND s.user_id = auth.uid()
    )
  );

-- Org members can view components for supplier products in their org
CREATE POLICY "Org members can view supplier product components"
  ON supplier_product_components
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM supplier_products sp
      JOIN organization_members om ON om.organization_id = sp.organization_id
      WHERE sp.id = supplier_product_components.supplier_product_id
        AND om.user_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role full access to supplier product components"
  ON supplier_product_components
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT ALL ON supplier_product_components TO authenticated;
GRANT ALL ON supplier_product_components TO service_role;

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON COLUMN supplier_products.product_type IS
  'Whether this is an ingredient or packaging product';
COMMENT ON COLUMN supplier_products.weight_g IS
  'Weight of a single packaging unit in grams (packaging products only)';
COMMENT ON COLUMN supplier_products.packaging_category IS
  'Packaging type: container, label, closure, secondary, shipment, tertiary';
COMMENT ON COLUMN supplier_products.primary_material IS
  'Dominant material of the packaging (e.g. recycled_paperboard, glass, aluminium)';
COMMENT ON COLUMN supplier_products.epr_material_code IS
  'UK EPR (RPD) material code: AL, FC, GL, PC, PL, ST, WD, OT';
COMMENT ON COLUMN supplier_products.epr_is_drinks_container IS
  'Whether this packaging qualifies as a drinks container for EPR purposes';

COMMENT ON TABLE supplier_product_components IS
  'Material composition breakdown for packaging supplier products (mirrors packaging_material_components)';
COMMENT ON COLUMN supplier_product_components.epr_material_type IS
  'EPR material category: aluminium, glass, paper_cardboard, plastic_rigid, plastic_flexible, steel, wood, fibre_composite, other, adhesive, ink, coating, lacquer';

-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
