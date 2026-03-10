-- Add annual production volume to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS annual_production_volume numeric,
  ADD COLUMN IF NOT EXISTS annual_production_unit text DEFAULT 'units';

COMMENT ON COLUMN public.products.annual_production_volume IS
  'Annual production volume of this product across all facilities';
COMMENT ON COLUMN public.products.annual_production_unit IS
  'Unit for annual production: units, litres, kg, tonnes, bottles, cases';

-- Add allocation percentage to facility product assignments
ALTER TABLE public.facility_product_assignments
  ADD COLUMN IF NOT EXISTS allocation_percentage numeric DEFAULT 100;

-- Ensure percentage is in valid range
ALTER TABLE public.facility_product_assignments
  ADD CONSTRAINT fpa_allocation_pct_range CHECK (
    allocation_percentage IS NULL OR (allocation_percentage >= 0 AND allocation_percentage <= 100)
  );

COMMENT ON COLUMN public.facility_product_assignments.allocation_percentage IS
  'Percentage of annual product production allocated to this facility (0-100)';
