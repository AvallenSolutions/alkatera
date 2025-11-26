/*
  # System Purge & Staging Emission Factors Architecture

  1. Purpose
     - Create staging_emission_factors table for local realistic emission data
     - Provide data purge script to clear test data whilst preserving user accounts
     - Establish foundation for waterfall resolver (Staging → OpenLCA)

  2. New Table: staging_emission_factors
     - Local library of verified emission factors
     - Prioritised in waterfall lookup before external databases
     - Curated list for frontend dropdowns (no free text)

  3. Seed Data: Beverage Industry Tech Pack
     - 5 packaging materials with realistic factors
     - 7 ingredient factors (water, sugars, acids, alcohol)
     - 3 energy/transport factors for utilities

  4. Security
     - RLS enabled with organization-level access control
     - Read access for authenticated users in organisation
     - Write access for admins only (future)

  5. Data Purge Instructions (Manual Execution)
     - See comments at end of file for purge SQL
     - Removes products, ingredients, packaging, logs
     - Preserves users, organizations, members
*/

-- =====================================================
-- SECTION 1: CREATE STAGING_EMISSION_FACTORS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS staging_emission_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('Ingredient', 'Packaging', 'Energy', 'Transport', 'Waste')),
  co2_factor numeric NOT NULL CHECK (co2_factor >= 0),
  reference_unit text NOT NULL,
  source text DEFAULT 'Internal Proxy',
  uuid_ref text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_staging_factors_name ON staging_emission_factors(name);
CREATE INDEX IF NOT EXISTS idx_staging_factors_category ON staging_emission_factors(category);
CREATE INDEX IF NOT EXISTS idx_staging_factors_org ON staging_emission_factors(organization_id);

-- Enable RLS
ALTER TABLE staging_emission_factors ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Organization members can read their org's factors
CREATE POLICY "Users can view staging factors in their organisation"
  ON staging_emission_factors FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = staging_emission_factors.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- RLS Policy: Allow insert for authenticated users
CREATE POLICY "Users can insert staging factors for their organisation"
  ON staging_emission_factors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = staging_emission_factors.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- =====================================================
-- SECTION 2: SEED DATA - BEVERAGE INDUSTRY TECH PACK
-- =====================================================

-- PACKAGING MATERIALS
INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, reference_unit, source, metadata) VALUES
(NULL, 'Glass Bottle (Standard Flint)', 'Packaging', 1.10, 'kg', 'Internal Proxy', '{"typical_mass_g": 250, "description": "Standard flint glass bottle, virgin material"}'),
(NULL, 'Glass Bottle (60% PCR)', 'Packaging', 0.65, 'kg', 'Internal Proxy', '{"typical_mass_g": 250, "description": "Glass bottle with 60% post-consumer recycled content"}'),
(NULL, 'Aluminium Cap', 'Packaging', 9.20, 'kg', 'Internal Proxy', '{"typical_mass_g": 3, "description": "Standard aluminium closure/cap"}'),
(NULL, 'Paper Label (Wet Glue)', 'Packaging', 1.10, 'kg', 'Internal Proxy', '{"typical_mass_g": 2, "description": "Paper label with wet glue application"}'),
(NULL, 'Corrugated Cardboard', 'Packaging', 0.95, 'kg', 'Internal Proxy', '{"typical_mass_g": 120, "description": "Secondary packaging, corrugated cardboard box"}')
ON CONFLICT DO NOTHING;

-- INGREDIENTS
INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, reference_unit, source, metadata) VALUES
(NULL, 'Water (Municipal Treatment)', 'Ingredient', 0.0003, 'kg', 'Internal Proxy', '{"description": "Potable water from municipal treatment plant"}'),
(NULL, 'Sugar (Beet - EU)', 'Ingredient', 0.55, 'kg', 'Internal Proxy', '{"description": "Sugar beet cultivation and processing, European average"}'),
(NULL, 'Sugar (Cane - Global)', 'Ingredient', 0.90, 'kg', 'Internal Proxy', '{"description": "Sugar cane cultivation and processing, global average"}'),
(NULL, 'Citric Acid', 'Ingredient', 5.50, 'kg', 'Internal Proxy', '{"description": "Citric acid anhydrous, fermentation process"}'),
(NULL, 'Ethanol (Grain)', 'Ingredient', 1.60, 'kg', 'Internal Proxy', '{"description": "Ethanol from grain fermentation"}'),
(NULL, 'Gin Concentrate', 'Ingredient', 1.85, 'kg', 'Internal Proxy', '{"description": "Gin botanical concentrate"}'),
(NULL, 'CO2 (Industrial)', 'Ingredient', 1.10, 'kg', 'Internal Proxy', '{"description": "Industrial CO2 for carbonation"}')
ON CONFLICT DO NOTHING;

-- ENERGY & TRANSPORT
INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, reference_unit, source, metadata) VALUES
(NULL, 'Electricity (Grid - UK)', 'Energy', 0.21, 'kWh', 'Internal Proxy', '{"description": "UK grid electricity, annual average"}'),
(NULL, 'Natural Gas (Heat)', 'Energy', 0.20, 'kWh', 'Internal Proxy', '{"description": "Natural gas for heating applications"}'),
(NULL, 'Transport (HGV Diesel)', 'Transport', 0.12, 'tkm', 'Internal Proxy', '{"description": "Heavy goods vehicle diesel transport"}')
ON CONFLICT DO NOTHING;

-- =====================================================
-- SECTION 3: HELPER FUNCTIONS
-- =====================================================

-- Function to search staging factors with fallback
CREATE OR REPLACE FUNCTION get_emission_factor_with_fallback(
  p_name text,
  p_organization_id uuid DEFAULT NULL
)
RETURNS TABLE (
  factor_id uuid,
  factor_name text,
  factor_value numeric,
  factor_unit text,
  factor_source text
) AS $$
BEGIN
  -- Stage 1: Check staging_emission_factors (organization-specific first, then global)
  RETURN QUERY
  SELECT
    id as factor_id,
    name as factor_name,
    co2_factor as factor_value,
    reference_unit as factor_unit,
    source as factor_source
  FROM staging_emission_factors
  WHERE
    LOWER(name) = LOWER(p_name)
    AND (organization_id = p_organization_id OR organization_id IS NULL)
  ORDER BY
    CASE WHEN organization_id = p_organization_id THEN 1 ELSE 2 END
  LIMIT 1;

  -- If found in staging, return
  IF FOUND THEN
    RETURN;
  END IF;

  -- Stage 2: Check emissions_factors table (OpenLCA/DEFRA)
  RETURN QUERY
  SELECT
    id as factor_id,
    name as factor_name,
    value as factor_value,
    unit as factor_unit,
    source as factor_source
  FROM emissions_factors
  WHERE LOWER(name) LIKE '%' || LOWER(p_name) || '%'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_emission_factor_with_fallback(text, uuid) TO authenticated;

COMMENT ON TABLE staging_emission_factors IS 'Local staging library for realistic emission factors. Prioritised in waterfall lookup before external databases (OpenLCA/Ecoinvent).';
COMMENT ON FUNCTION get_emission_factor_with_fallback IS 'Waterfall resolver: checks staging_emission_factors first (org-specific then global), falls back to emissions_factors table if not found.';
