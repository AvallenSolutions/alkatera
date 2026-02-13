-- =============================================================================
-- EPR: Fix missing columns on product_materials
-- =============================================================================
-- The UI (PackagingFormCard / useRecipeEditor) already writes these fields
-- but they were never added to the schema — writes are silently dropped.
-- This migration adds the columns so EPR data actually persists.
-- =============================================================================

ALTER TABLE product_materials
  ADD COLUMN IF NOT EXISTS epr_packaging_activity text,
  ADD COLUMN IF NOT EXISTS epr_packaging_level text,
  ADD COLUMN IF NOT EXISTS epr_ram_rating text,
  ADD COLUMN IF NOT EXISTS epr_uk_nation text;

-- Also add to the carbon footprint materials snapshot table
ALTER TABLE product_carbon_footprint_materials
  ADD COLUMN IF NOT EXISTS epr_packaging_activity text,
  ADD COLUMN IF NOT EXISTS epr_packaging_level text,
  ADD COLUMN IF NOT EXISTS epr_ram_rating text,
  ADD COLUMN IF NOT EXISTS epr_uk_nation text;

-- Add CHECK constraints for data integrity
ALTER TABLE product_materials
  ADD CONSTRAINT check_epr_packaging_activity
    CHECK (epr_packaging_activity IS NULL OR epr_packaging_activity IN
      ('brand', 'packed_filled', 'imported', 'empty', 'hired', 'marketplace')),
  ADD CONSTRAINT check_epr_packaging_level
    CHECK (epr_packaging_level IS NULL OR epr_packaging_level IN
      ('primary', 'secondary', 'tertiary', 'shipment')),
  ADD CONSTRAINT check_epr_ram_rating
    CHECK (epr_ram_rating IS NULL OR epr_ram_rating IN
      ('red', 'amber', 'green')),
  ADD CONSTRAINT check_epr_uk_nation
    CHECK (epr_uk_nation IS NULL OR epr_uk_nation IN
      ('england', 'scotland', 'wales', 'northern_ireland'));

-- Comments for documentation
COMMENT ON COLUMN product_materials.epr_packaging_activity IS
  'EPR packaging activity: how the packaging was supplied to the UK market (brand/packed_filled/imported/empty/hired/marketplace)';
COMMENT ON COLUMN product_materials.epr_packaging_level IS
  'EPR packaging level: primary/secondary/tertiary/shipment';
COMMENT ON COLUMN product_materials.epr_ram_rating IS
  'Recyclability Assessment Methodology (RAM) rating: red/amber/green — determines fee modulation from Year 2';
COMMENT ON COLUMN product_materials.epr_uk_nation IS
  'UK nation where packaging is supplied/discarded: england/scotland/wales/northern_ireland';
