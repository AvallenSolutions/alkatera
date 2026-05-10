-- Rosa progress-tracker cache.
--
-- The /rosa/ hub's progress tracker (replacing the old Activity Pulse) is
-- per-user: each user picks what they want to track and Rosa writes a
-- short consultant read on the trend. Both the timeseries and the read
-- are cached together to keep latency low and avoid re-running Claude
-- when the underlying data hasn't moved.

CREATE TABLE IF NOT EXISTS public.rosa_progress_tracker_cache (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tracker_id text NOT NULL,
  payload jsonb NOT NULL,
  signals_hash text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

COMMENT ON TABLE public.rosa_progress_tracker_cache IS
  'Cached payload (chart series + Rosa-voiced read) for the user''s chosen progress tracker. One row per (org, user). Busts when signals_hash changes or TTL elapses.';

ALTER TABLE public.rosa_progress_tracker_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rosa_progress_tracker_cache'
      AND policyname = 'rosa_progress_tracker_cache_select_own'
  ) THEN
    CREATE POLICY rosa_progress_tracker_cache_select_own
      ON public.rosa_progress_tracker_cache
      FOR SELECT
      USING (
        user_id = auth.uid()
        AND organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Writes via service role only (the API route).
