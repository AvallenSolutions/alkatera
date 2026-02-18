-- Re-add production volume columns to facility_product_assignments
--
-- Migration 20260204150000 was recorded as applied but the columns were never
-- actually created (likely a partial transaction failure). This caused the
-- FacilitiesTab and recipe page queries to fail silently because they SELECT
-- production_volume, production_volume_unit, and reporting_session_id — columns
-- that don't exist.
--
-- Symptoms:
--   - FacilitiesTab shows "No Facilities Assigned" despite active assignments
--   - Recipe page shows "No facilities configured" for distance calculations
--   - Users get "duplicate key" errors when trying to re-add facilities

ALTER TABLE facility_product_assignments
  ADD COLUMN IF NOT EXISTS production_volume numeric,
  ADD COLUMN IF NOT EXISTS production_volume_unit text DEFAULT 'units',
  ADD COLUMN IF NOT EXISTS reporting_session_id uuid;

-- Add foreign key (idempotent)
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

-- Add index (idempotent)
CREATE INDEX IF NOT EXISTS idx_fpa_reporting_session
ON facility_product_assignments(reporting_session_id)
WHERE reporting_session_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
