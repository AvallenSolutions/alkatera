-- Add activity_date column to utility_data_entries for per-entry date tracking
-- Previously, only the reporting period (start/end) from the session was stored.
-- This allows users to record the specific date of each utility reading.

ALTER TABLE public.utility_data_entries
ADD COLUMN IF NOT EXISTS activity_date date;

-- Add index for date-based queries
CREATE INDEX IF NOT EXISTS idx_utility_data_entries_activity_date
ON public.utility_data_entries(activity_date);
