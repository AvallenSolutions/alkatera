-- Add a user-supplied `name` column to facility data entry tables so users
-- can label individual bill uploads. This is especially useful when a single
-- facility has multiple bills for the same utility/water/waste category
-- within one reporting period (e.g. three electricity bills from different
-- meters), allowing each entry to be identified unambiguously.

ALTER TABLE public.utility_data_entries
  ADD COLUMN IF NOT EXISTS name text;

COMMENT ON COLUMN public.utility_data_entries.name IS
  'Optional user-supplied label for this entry (e.g. "Solar meter Q1 2026", "Main grid supply"). Helps distinguish multiple bills for the same facility and period.';

ALTER TABLE public.facility_activity_entries
  ADD COLUMN IF NOT EXISTS name text;

COMMENT ON COLUMN public.facility_activity_entries.name IS
  'Optional user-supplied label for this entry (e.g. "Thames Water Q1 2026", "Landfill invoice #12345"). Helps distinguish multiple bills/entries for the same facility and category.';
