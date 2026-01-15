/*
  # Add Unit Measurement to Supplier Products

  1. Changes
    - Add `unit_measurement` column to store the measurement of a single unit (e.g., 570 for a 570g bottle)
    - Add `unit_measurement_type` column to specify what is being measured (weight, volume, length, etc.)

  2. Purpose
    - Allow tracking of specific unit measurements for supplier products
    - Enable better inventory management and calculations
*/

-- Add unit measurement columns to platform_supplier_products
ALTER TABLE public.platform_supplier_products
ADD COLUMN IF NOT EXISTS unit_measurement NUMERIC(12, 4),
ADD COLUMN IF NOT EXISTS unit_measurement_type TEXT CHECK (
  unit_measurement_type IS NULL OR
  unit_measurement_type IN ('weight', 'volume', 'length', 'area', 'count')
);

COMMENT ON COLUMN public.platform_supplier_products.unit_measurement IS
  'The measurement value of a single unit (e.g., 570 for a 570g bottle)';
COMMENT ON COLUMN public.platform_supplier_products.unit_measurement_type IS
  'The type of measurement: weight (g/kg), volume (ml/L), length (cm/m), area (m²), count (units)';

-- Add unit measurement columns to supplier_products
ALTER TABLE public.supplier_products
ADD COLUMN IF NOT EXISTS unit_measurement NUMERIC(12, 4),
ADD COLUMN IF NOT EXISTS unit_measurement_type TEXT CHECK (
  unit_measurement_type IS NULL OR
  unit_measurement_type IN ('weight', 'volume', 'length', 'area', 'count')
);

COMMENT ON COLUMN public.supplier_products.unit_measurement IS
  'The measurement value of a single unit (e.g., 570 for a 570g bottle)';
COMMENT ON COLUMN public.supplier_products.unit_measurement_type IS
  'The type of measurement: weight (g/kg), volume (ml/L), length (cm/m), area (m²), count (units)';
