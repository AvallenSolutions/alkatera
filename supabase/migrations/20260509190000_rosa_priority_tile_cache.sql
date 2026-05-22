-- Rosa-curated priority tiles: cache + telemetry
--
-- The /rosa/ hub's three priority tiles are now picked by Claude given a
-- per-org signal pack. To keep latency/cost reasonable we cache the
-- structured tile JSON per (org, user) and only re-curate when the
-- underlying signals change (signal_hash) or after the TTL elapses.
--
-- Telemetry captures every curate / show / click / snooze so we can
-- iterate on which signals Rosa weights well over time.

-- ==========================================================================
-- Cache table
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.rosa_priority_tile_cache (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tiles_json jsonb NOT NULL,
  signals_hash text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

COMMENT ON TABLE public.rosa_priority_tile_cache IS
  'Cached Claude-curated priority tiles for /rosa/ hub. One row per (org, user). Busts when signals_hash changes or TTL elapses.';
COMMENT ON COLUMN public.rosa_priority_tile_cache.signals_hash IS
  'sha256 of the stable-stringified signal pack. Lets the route detect material changes without comparing the whole pack.';

ALTER TABLE public.rosa_priority_tile_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rosa_priority_tile_cache'
      AND policyname = 'rosa_tile_cache_select_own'
  ) THEN
    CREATE POLICY rosa_tile_cache_select_own
      ON public.rosa_priority_tile_cache
      FOR SELECT
      USING (
        user_id = auth.uid()
        AND organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Writes only via service role (the API route). No direct authenticated INSERT/UPDATE.

-- ==========================================================================
-- Telemetry table
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.rosa_telemetry (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event text NOT NULL,                  -- e.g. 'tile.curated' | 'tile.shown' | 'tile.clicked' | 'tile.snoozed' | 'tile.fallback'
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rosa_telemetry IS
  'Append-only event log for Rosa-surface interactions. Used to evaluate which signals Rosa weights well and to enforce per-day curation budgets.';

CREATE INDEX IF NOT EXISTS rosa_telemetry_org_event_created_idx
  ON public.rosa_telemetry (organization_id, event, created_at DESC);

CREATE INDEX IF NOT EXISTS rosa_telemetry_user_event_created_idx
  ON public.rosa_telemetry (user_id, event, created_at DESC);

ALTER TABLE public.rosa_telemetry ENABLE ROW LEVEL SECURITY;

-- Members can read their own org's telemetry (useful for admin dashboards later).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rosa_telemetry'
      AND policyname = 'rosa_telemetry_select_own_org'
  ) THEN
    CREATE POLICY rosa_telemetry_select_own_org
      ON public.rosa_telemetry
      FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Writes via service role only.
