-- ESG Vitality Score: snapshots + per-org weighting
--
-- The Rosa hub's top card and the /performance/ page top card both compose
-- environmental + social + governance scores into a single ESG composite.
-- We snapshot the result on every page view (idempotent per org per day) so
-- a 12-week trend fills out lazily, no cron needed.

CREATE TABLE IF NOT EXISTS public.esg_score_snapshots (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  composite numeric(5,2),
  environmental numeric(5,2),
  social numeric(5,2),
  governance numeric(5,2),
  breakdown jsonb,
  weights jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, snapshot_date)
);

COMMENT ON TABLE public.esg_score_snapshots IS
  'Daily ESG vitality snapshots per org. Lazy-filled on page view; PK enforces one row per (org, date).';
COMMENT ON COLUMN public.esg_score_snapshots.breakdown IS
  'Sub-pillar values, e.g. {"e":{"climate":80,"water":60,"circularity":null,"nature":55},"s":{"community":70,"people":65,"supplier":40},"g":{"governance":75,"certifications":20}}';
COMMENT ON COLUMN public.esg_score_snapshots.weights IS
  'ESG weights at the time of snapshot, so historical trend reflects historical weighting. {"v":1,"e":0.5,"s":0.25,"g":0.25}';

CREATE INDEX IF NOT EXISTS esg_snapshots_org_date_idx
  ON public.esg_score_snapshots (organization_id, snapshot_date DESC);

ALTER TABLE public.esg_score_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'esg_score_snapshots'
      AND policyname = 'esg_snapshots_select_own_org'
  ) THEN
    CREATE POLICY esg_snapshots_select_own_org
      ON public.esg_score_snapshots FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Writes via service role only.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS vitality_weights jsonb;

COMMENT ON COLUMN public.organizations.vitality_weights IS
  'ESG pillar weights for the composite vitality score. Shape: {"v":1,"e":0.5,"s":0.25,"g":0.25}. Default {0.5, 0.25, 0.25} when null.';
