-- Add not_applicable_categories to corporate_reports
-- Stores category keys that the organisation has explicitly marked as not applicable.
-- These are excluded from the completeness denominator entirely.
ALTER TABLE corporate_reports
  ADD COLUMN IF NOT EXISTS not_applicable_categories text[] DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
