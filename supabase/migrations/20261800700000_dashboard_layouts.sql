-- Pulse Phase 8 — per-user dashboard layouts
--
-- Stores the customised widget grid for each (user, organisation) pair.
-- The layout JSON shape is the react-grid-layout breakpoint map:
--   { "lg": [{ i, x, y, w, h, minW?, minH? }, ...] }
--
-- A user that hasn't customised falls back to the role-default layout
-- baked into lib/pulse/layout.ts. We do NOT store defaults here so we can
-- evolve them without a migration.

CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  hidden_widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, organization_id)
);

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

-- A user can only ever read or write their own layout row.
CREATE POLICY "dashboard_layouts_owner_read"
  ON public.dashboard_layouts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "dashboard_layouts_owner_write"
  ON public.dashboard_layouts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.dashboard_layouts IS
  'Pulse: per-user customised widget layouts. JSON shape mirrors react-grid-layout breakpoint maps.';
