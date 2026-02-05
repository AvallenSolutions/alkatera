-- Add production volume tracking to facility-product assignments
-- This enables users to enter how much of a product is made at each facility
-- Required for FacilitiesTab.tsx to work correctly

-- Add columns for production volume tracking
ALTER TABLE facility_product_assignments
ADD COLUMN IF NOT EXISTS production_volume numeric,
ADD COLUMN IF NOT EXISTS production_volume_unit text DEFAULT 'units',
ADD COLUMN IF NOT EXISTS reporting_session_id uuid;

-- Add foreign key for reporting_session_id (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fpa_reporting_session_fkey'
  ) THEN
    ALTER TABLE facility_product_assignments
    ADD CONSTRAINT fpa_reporting_session_fkey
    FOREIGN KEY (reporting_session_id)
    REFERENCES facility_reporting_sessions(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for faster lookups by reporting session
CREATE INDEX IF NOT EXISTS idx_fpa_reporting_session
ON facility_product_assignments(reporting_session_id)
WHERE reporting_session_id IS NOT NULL;

-- Comment on new columns
COMMENT ON COLUMN facility_product_assignments.production_volume IS
  'Volume of this product produced at this facility for the reporting period';
COMMENT ON COLUMN facility_product_assignments.production_volume_unit IS
  'Unit of measurement: units, litres, kg, tonnes, bottles, cases';
COMMENT ON COLUMN facility_product_assignments.reporting_session_id IS
  'Links to facility reporting session for emission intensity calculations';
