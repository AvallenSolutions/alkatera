/*
  # Check Current Constraint Definition

  This shows what the current constraint looks like
*/

-- Get the current constraint definition
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'organizations'::regclass
  AND conname = 'valid_subscription_tier';

-- Also check if the is_platform_admin column exists
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'organizations'
  AND column_name = 'is_platform_admin';
