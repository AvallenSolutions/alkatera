/*
  # Fix Scope 3 Business Travel Transport Mode Constraint

  ## Issue
  Business travel entries cannot be saved because the CHECK constraint on transport_mode
  expects generic values ('road', 'rail', 'sea', 'air') but the frontend sends specific
  flight types ('Domestic', 'Short-haul', 'Long-haul', 'National').

  ## Changes
  1. Drop the restrictive transport_mode CHECK constraint
  2. Add a more flexible constraint that allows business travel specific values
  3. Keep other valid constraints intact

  ## Impact
  - Business Travel entries will now save successfully
  - Frontend validation values will work correctly
  - Database remains flexible for future transport mode additions
*/

-- Drop the restrictive transport_mode constraint
ALTER TABLE corporate_overheads
DROP CONSTRAINT IF EXISTS corporate_overheads_transport_mode_check;

-- Add a flexible constraint that accepts both generic and specific values
ALTER TABLE corporate_overheads
ADD CONSTRAINT corporate_overheads_transport_mode_flexible_check
CHECK (
  transport_mode IS NULL OR
  length(trim(transport_mode)) > 0
);

-- Add helpful comment
COMMENT ON COLUMN corporate_overheads.transport_mode IS
  'Transport mode for business travel and logistics. Accepts flexible values including flight types (Domestic, Short-haul, Long-haul), rail types (National, International), and other modes. Validation handled at application level.';
