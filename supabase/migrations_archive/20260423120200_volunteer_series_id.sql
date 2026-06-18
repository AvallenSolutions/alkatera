-- Support recurring volunteer activities by grouping expanded occurrences
-- under a shared series_id. Users log a single recurring activity and the
-- API materialises one row per occurrence, all sharing the same series_id
-- so they can be listed, edited or deleted as a group.

ALTER TABLE public.community_volunteer_activities
  ADD COLUMN IF NOT EXISTS series_id uuid;

CREATE INDEX IF NOT EXISTS idx_community_volunteer_series
  ON public.community_volunteer_activities(series_id)
  WHERE series_id IS NOT NULL;
