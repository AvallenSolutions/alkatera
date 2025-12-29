/*
  # Fix Fleet Activities Scope Constraint

  1. Changes
    - Update scope check constraint to include Scope 3 Cat 6 for grey fleet
    - This allows tracking of employee-owned vehicles used for business purposes
  
  2. Reason
    - Employee-owned vehicles (grey fleet) should be categorised as Scope 3 Cat 6
    - Current constraint was blocking valid Scope 3 insertions
*/

-- Drop the old constraint that only allows Scope 1 and Scope 2
ALTER TABLE fleet_activities
DROP CONSTRAINT IF EXISTS fleet_activities_scope_check;

-- Add updated constraint to allow Scope 1, Scope 2, and Scope 3 Cat 6
ALTER TABLE fleet_activities
ADD CONSTRAINT fleet_activities_scope_check
CHECK (scope = ANY (ARRAY['Scope 1'::text, 'Scope 2'::text, 'Scope 3 Cat 6'::text]));
