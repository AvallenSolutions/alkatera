-- Check if calculation_logs table exists and what columns it has
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'calculation_logs'
ORDER BY ordinal_position;
