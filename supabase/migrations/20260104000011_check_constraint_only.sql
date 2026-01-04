/*
  # Check What the Current Constraint Allows
*/

SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'organizations'::regclass
  AND conname = 'valid_subscription_tier';
