-- Pulse U4 -- Adaptive widget ranking.
--
-- Tracks per-user, per-widget engagement so the grid can surface the widgets
-- each user opens most often at the top. Engagement signal is a single drill
-- open; scores are time-decayed with a 30-day half-life on read (cheap).
--
-- One row per (user_id, organization_id, widget_id). `open_timestamps` keeps
-- the last 90 raw opens as a JSONB array so we can recompute scores after a
-- half-life tweak without losing history.

CREATE TABLE IF NOT EXISTS public.pulse_widget_engagement (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  widget_id text NOT NULL,
  open_count integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  open_timestamps jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id, widget_id)
);

CREATE INDEX IF NOT EXISTS pulse_widget_engagement_user_idx
  ON public.pulse_widget_engagement (user_id, organization_id, last_opened_at DESC);

-- Keep updated_at in sync.
CREATE OR REPLACE FUNCTION public.pulse_widget_engagement_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pulse_widget_engagement_touch_trigger ON public.pulse_widget_engagement;
CREATE TRIGGER pulse_widget_engagement_touch_trigger
BEFORE UPDATE ON public.pulse_widget_engagement
FOR EACH ROW
EXECUTE FUNCTION public.pulse_widget_engagement_touch_updated_at();

-- Row-level security. Users only see and mutate their own engagement rows.
ALTER TABLE public.pulse_widget_engagement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pulse_engagement_owner ON public.pulse_widget_engagement;
CREATE POLICY pulse_engagement_owner ON public.pulse_widget_engagement
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
