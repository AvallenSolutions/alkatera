/*
  # Add trigger to prevent third-party facilities in production sites

  1. Changes
    - Create trigger function to validate facility type
    - Add trigger to product_lca_production_sites table
    - Ensures only owned facilities can be added to production sites
    - Third-party facilities must use contract_manufacturer_allocations table

  2. Purpose
    - Prevents duplicate allocations appearing in both tables
    - Enforces correct data model separation
    - Ensures data integrity
*/

-- Create function to validate facility operational control
CREATE OR REPLACE FUNCTION validate_production_site_facility_type()
RETURNS TRIGGER AS $$
DECLARE
  v_operational_control TEXT;
BEGIN
  -- Get the operational_control of the facility
  SELECT operational_control INTO v_operational_control
  FROM facilities
  WHERE id = NEW.facility_id;

  -- Only allow owned facilities in production sites
  IF v_operational_control != 'owned' THEN
    RAISE EXCEPTION 'Only owned facilities can be added to production sites. Third-party/contract manufacturer facilities must use contract_manufacturer_allocations table instead. Facility operational_control: %', v_operational_control;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to product_lca_production_sites
DROP TRIGGER IF EXISTS check_production_site_facility_type ON product_lca_production_sites;

CREATE TRIGGER check_production_site_facility_type
  BEFORE INSERT OR UPDATE ON product_lca_production_sites
  FOR EACH ROW
  EXECUTE FUNCTION validate_production_site_facility_type();

-- Add helpful comment
COMMENT ON FUNCTION validate_production_site_facility_type() IS 
'Validates that only owned facilities can be tracked in product_lca_production_sites. Third-party/contract manufacturer facilities must use contract_manufacturer_allocations table.';
