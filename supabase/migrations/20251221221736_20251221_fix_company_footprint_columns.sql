/*
  # Fix Company Footprint Missing Columns

  ## Summary
  This migration addresses critical defects preventing the Company Footprint feature from working.

  ## Changes

  ### 1. product_lcas - Add GHG Calculation Columns
  - `total_ghg_emissions` - Total GHG emissions in kg CO2e
  - `total_ghg_emissions_fossil` - Fossil-based GHG emissions
  - `total_ghg_emissions_biogenic` - Biogenic GHG emissions
  - `total_ghg_emissions_dluc` - Direct Land Use Change emissions
  - Lifecycle stage breakdowns for raw materials, processing, packaging, transport, use, end-of-life

  ### 2. emissions_factors - Add category_type Column
  - Adds `category_type` column to categorize factors as scope1/scope2/scope3

  ### 3. facility_activity_data - Fix Data Entry Issues
  - Adds `organization_id` column for proper RLS scoping
  - Makes reporting period fields nullable with defaults
*/

-- ============================================
-- PART 1: Add GHG columns to product_lcas
-- ============================================

ALTER TABLE product_lcas
ADD COLUMN IF NOT EXISTS total_ghg_emissions numeric DEFAULT 0;

ALTER TABLE product_lcas
ADD COLUMN IF NOT EXISTS total_ghg_emissions_fossil numeric DEFAULT 0;

ALTER TABLE product_lcas
ADD COLUMN IF NOT EXISTS total_ghg_emissions_biogenic numeric DEFAULT 0;

ALTER TABLE product_lcas
ADD COLUMN IF NOT EXISTS total_ghg_emissions_dluc numeric DEFAULT 0;

ALTER TABLE product_lcas
ADD COLUMN IF NOT EXISTS total_ghg_raw_materials numeric DEFAULT 0;

ALTER TABLE product_lcas
ADD COLUMN IF NOT EXISTS total_ghg_processing numeric DEFAULT 0;

ALTER TABLE product_lcas
ADD COLUMN IF NOT EXISTS total_ghg_packaging numeric DEFAULT 0;

ALTER TABLE product_lcas
ADD COLUMN IF NOT EXISTS total_ghg_transport numeric DEFAULT 0;

ALTER TABLE product_lcas
ADD COLUMN IF NOT EXISTS total_ghg_use numeric DEFAULT 0;

ALTER TABLE product_lcas
ADD COLUMN IF NOT EXISTS total_ghg_end_of_life numeric DEFAULT 0;

COMMENT ON COLUMN product_lcas.total_ghg_emissions IS 'Total GHG emissions in kg CO2e (sum of all lifecycle stages)';
COMMENT ON COLUMN product_lcas.total_ghg_emissions_fossil IS 'Fossil-based GHG emissions in kg CO2e';
COMMENT ON COLUMN product_lcas.total_ghg_emissions_biogenic IS 'Biogenic GHG emissions in kg CO2e';
COMMENT ON COLUMN product_lcas.total_ghg_emissions_dluc IS 'Direct Land Use Change emissions in kg CO2e';

-- ============================================
-- PART 2: Add category_type to emissions_factors
-- ============================================

ALTER TABLE emissions_factors
ADD COLUMN IF NOT EXISTS category_type text;

UPDATE emissions_factors
SET category_type = CASE
  WHEN category ILIKE '%scope 1%' OR category ILIKE '%stationary%' OR category ILIKE '%mobile%' OR category ILIKE '%fugitive%' OR category ILIKE '%process%' THEN 'scope1'
  WHEN category ILIKE '%scope 2%' OR category ILIKE '%electricity%' OR category ILIKE '%heat%' OR category ILIKE '%steam%' OR category ILIKE '%cooling%' THEN 'scope2'
  WHEN category ILIKE '%scope 3%' OR category ILIKE '%travel%' OR category ILIKE '%waste%' OR category ILIKE '%commut%' OR category ILIKE '%upstream%' OR category ILIKE '%downstream%' THEN 'scope3'
  WHEN type = 'scope1' THEN 'scope1'
  WHEN type = 'scope2' THEN 'scope2'
  WHEN type = 'scope3' THEN 'scope3'
  ELSE 'scope3'
END
WHERE category_type IS NULL;

COMMENT ON COLUMN emissions_factors.category_type IS 'Scope categorization: scope1, scope2, or scope3';

-- ============================================
-- PART 3: Fix facility_activity_data
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facility_activity_data' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE facility_activity_data ADD COLUMN organization_id uuid;
  END IF;
END $$;

ALTER TABLE facility_activity_data
ALTER COLUMN reporting_period_start DROP NOT NULL;

ALTER TABLE facility_activity_data
ALTER COLUMN reporting_period_end DROP NOT NULL;

ALTER TABLE facility_activity_data
ALTER COLUMN reporting_period_start SET DEFAULT CURRENT_DATE;

ALTER TABLE facility_activity_data
ALTER COLUMN reporting_period_end SET DEFAULT (CURRENT_DATE + INTERVAL '1 year')::date;

UPDATE facility_activity_data fad
SET organization_id = f.organization_id
FROM facilities f
WHERE fad.facility_id = f.id
  AND fad.organization_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'facility_activity_data_organization_id_fkey'
      AND table_name = 'facility_activity_data'
  ) THEN
    ALTER TABLE facility_activity_data
    ADD CONSTRAINT facility_activity_data_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_facility_activity_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM facilities
    WHERE id = NEW.facility_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_facility_activity_org_id ON facility_activity_data;
CREATE TRIGGER set_facility_activity_org_id
  BEFORE INSERT ON facility_activity_data
  FOR EACH ROW
  EXECUTE FUNCTION set_facility_activity_organization_id();

-- ============================================
-- PART 4: Recalculate Product LCAs (simplified)
-- ============================================

UPDATE product_lcas plca
SET
  total_ghg_emissions = COALESCE((
    SELECT SUM(COALESCE(impact_climate, 0) * COALESCE(quantity, 1))
    FROM product_lca_materials
    WHERE product_lca_id = plca.id
  ), 0),
  total_ghg_emissions_fossil = COALESCE((
    SELECT SUM(COALESCE(impact_climate_fossil, 0) * COALESCE(quantity, 1))
    FROM product_lca_materials
    WHERE product_lca_id = plca.id
  ), 0),
  total_ghg_emissions_biogenic = COALESCE((
    SELECT SUM(COALESCE(impact_climate_biogenic, 0) * COALESCE(quantity, 1))
    FROM product_lca_materials
    WHERE product_lca_id = plca.id
  ), 0),
  total_ghg_emissions_dluc = COALESCE((
    SELECT SUM(COALESCE(impact_climate_dluc, 0) * COALESCE(quantity, 1))
    FROM product_lca_materials
    WHERE product_lca_id = plca.id
  ), 0),
  total_ghg_packaging = COALESCE((
    SELECT SUM(COALESCE(impact_climate, 0) * COALESCE(quantity, 1))
    FROM product_lca_materials
    WHERE product_lca_id = plca.id
      AND (material_type ILIKE '%packag%' OR packaging_category IS NOT NULL)
  ), 0),
  total_ghg_transport = COALESCE((
    SELECT SUM(COALESCE(impact_transport, 0) * COALESCE(quantity, 1))
    FROM product_lca_materials
    WHERE product_lca_id = plca.id
  ), 0),
  updated_at = NOW();

-- ============================================
-- PART 5: Add indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_facility_activity_data_org_id 
ON facility_activity_data(organization_id);

CREATE INDEX IF NOT EXISTS idx_product_lcas_org_ghg 
ON product_lcas(organization_id, total_ghg_emissions);
