-- ============================================================================
-- ADD MISSING GREENWASH BULK JOBS TABLES
-- ============================================================================
-- The original migration 20260113140000 was never applied to the database.
-- This migration creates the bulk jobs tables with IF NOT EXISTS for safety.
-- ============================================================================

-- ============================================================================
-- Bulk Jobs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.greenwash_bulk_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_urls INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- ============================================================================
-- Bulk Job URLs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.greenwash_bulk_job_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_job_id UUID NOT NULL REFERENCES public.greenwash_bulk_jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  assessment_id UUID REFERENCES public.greenwash_assessments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_greenwash_bulk_jobs_org
  ON public.greenwash_bulk_jobs(organization_id);

CREATE INDEX IF NOT EXISTS idx_greenwash_bulk_jobs_status
  ON public.greenwash_bulk_jobs(status);

CREATE INDEX IF NOT EXISTS idx_greenwash_bulk_jobs_created_by
  ON public.greenwash_bulk_jobs(created_by);

CREATE INDEX IF NOT EXISTS idx_greenwash_bulk_job_urls_job
  ON public.greenwash_bulk_job_urls(bulk_job_id);

CREATE INDEX IF NOT EXISTS idx_greenwash_bulk_job_urls_status
  ON public.greenwash_bulk_job_urls(status);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.greenwash_bulk_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.greenwash_bulk_job_urls ENABLE ROW LEVEL SECURITY;

-- Bulk jobs policies (idempotent)
DO $$ BEGIN
  CREATE POLICY "Users can view their organization's bulk jobs"
    ON public.greenwash_bulk_jobs FOR SELECT
    USING (
      organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create bulk jobs for their organization"
    ON public.greenwash_bulk_jobs FOR INSERT
    WITH CHECK (
      organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their organization's bulk jobs"
    ON public.greenwash_bulk_jobs FOR UPDATE
    USING (
      organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their organization's bulk jobs"
    ON public.greenwash_bulk_jobs FOR DELETE
    USING (
      organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bulk job URLs policies (idempotent)
DO $$ BEGIN
  CREATE POLICY "Users can view bulk job URLs for their organization"
    ON public.greenwash_bulk_job_urls FOR SELECT
    USING (
      bulk_job_id IN (
        SELECT id FROM public.greenwash_bulk_jobs
        WHERE organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create bulk job URLs for their organization"
    ON public.greenwash_bulk_job_urls FOR INSERT
    WITH CHECK (
      bulk_job_id IN (
        SELECT id FROM public.greenwash_bulk_jobs
        WHERE organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update bulk job URLs for their organization"
    ON public.greenwash_bulk_job_urls FOR UPDATE
    USING (
      bulk_job_id IN (
        SELECT id FROM public.greenwash_bulk_jobs
        WHERE organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- Function to update bulk job counts
-- ============================================================================

CREATE OR REPLACE FUNCTION update_bulk_job_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.greenwash_bulk_jobs
  SET
    completed_count = (
      SELECT COUNT(*) FROM public.greenwash_bulk_job_urls
      WHERE bulk_job_id = COALESCE(NEW.bulk_job_id, OLD.bulk_job_id)
      AND status = 'completed'
    ),
    failed_count = (
      SELECT COUNT(*) FROM public.greenwash_bulk_job_urls
      WHERE bulk_job_id = COALESCE(NEW.bulk_job_id, OLD.bulk_job_id)
      AND status = 'failed'
    )
  WHERE id = COALESCE(NEW.bulk_job_id, OLD.bulk_job_id);

  -- Auto-complete job if all URLs are processed
  UPDATE public.greenwash_bulk_jobs
  SET
    status = 'completed',
    completed_at = now()
  WHERE id = COALESCE(NEW.bulk_job_id, OLD.bulk_job_id)
    AND status = 'processing'
    AND (completed_count + failed_count) >= total_urls;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger for idempotency
DROP TRIGGER IF EXISTS on_bulk_job_url_status_change ON public.greenwash_bulk_job_urls;

CREATE TRIGGER on_bulk_job_url_status_change
  AFTER UPDATE OF status ON public.greenwash_bulk_job_urls
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_job_counts();

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.greenwash_bulk_jobs TO authenticated;
GRANT ALL ON public.greenwash_bulk_jobs TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.greenwash_bulk_job_urls TO authenticated;
GRANT ALL ON public.greenwash_bulk_job_urls TO service_role;

-- ============================================================================
-- NOTIFY PostgREST to reload its schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';
