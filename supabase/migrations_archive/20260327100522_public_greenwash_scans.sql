-- Public Greenwash Guardian scans (no auth required, no org/user FKs)
-- Used by the marketing site's free scan tool

CREATE TABLE public_greenwash_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  input_content text,
  overall_risk_level text
    CHECK (overall_risk_level IN ('low', 'medium', 'high')),
  overall_risk_score integer
    CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
  summary text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  legislation_applied jsonb NOT NULL DEFAULT '[]'::jsonb,
  claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for polling by ID (PK covers this) and cleanup by age
CREATE INDEX idx_public_greenwash_scans_created_at
  ON public_greenwash_scans (created_at);

-- RLS: anyone can SELECT (for polling), only service role can INSERT/UPDATE
ALTER TABLE public_greenwash_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public scans"
  ON public_greenwash_scans FOR SELECT
  USING (true);

-- Auto-cleanup: delete scans older than 24 hours
-- Run via pg_cron if available, otherwise handled at application level
