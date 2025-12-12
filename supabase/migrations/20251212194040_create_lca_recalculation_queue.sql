/*
  # Create LCA Recalculation Queue and Status Tracking

  ## Overview
  This migration creates the infrastructure for recalculating existing LCAs with 
  EF 3.1 methodology. It includes a job queue system, status tracking, and batch
  processing support for handling large numbers of LCAs efficiently.

  ## New Tables

  ### 1. `lca_recalculation_queue`
  Queue table for pending EF 3.1 recalculations:
  - Job status tracking (pending, processing, completed, failed)
  - Priority levels for urgent recalculations
  - Retry logic with attempt counting
  - Batch grouping for efficient processing

  ### 2. `lca_recalculation_batches`
  Groups recalculation jobs into batches for monitoring:
  - Batch progress tracking
  - Estimated completion time
  - Admin notifications

  ## Changes to `product_lcas` Table
  - `ef31_recalculation_status` - Status of EF 3.1 recalculation
  - `ef31_recalculation_requested_at` - When recalculation was requested
  - `ef31_recalculation_error` - Error message if failed

  ## Processing Flow
  1. Admin triggers recalculation (manual or automated)
  2. Jobs added to queue with batch grouping
  3. Edge function processes queue in order
  4. Status updated on completion/failure
  5. Notifications sent to organization admins

  ## Security
  - Only admins can trigger recalculations
  - Status visible to organization members
  - Audit trail maintained
*/

-- =====================================================
-- STEP 1: ADD RECALCULATION STATUS TO PRODUCT_LCAS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'ef31_recalculation_status'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN ef31_recalculation_status TEXT DEFAULT NULL;

    COMMENT ON COLUMN public.product_lcas.ef31_recalculation_status IS
      'EF 3.1 recalculation status: NULL (not requested), "pending", "processing", "completed", "failed".';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'ef31_recalculation_requested_at'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN ef31_recalculation_requested_at TIMESTAMPTZ DEFAULT NULL;

    COMMENT ON COLUMN public.product_lcas.ef31_recalculation_requested_at IS
      'When EF 3.1 recalculation was requested.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'ef31_recalculation_error'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN ef31_recalculation_error TEXT DEFAULT NULL;

    COMMENT ON COLUMN public.product_lcas.ef31_recalculation_error IS
      'Error message if EF 3.1 recalculation failed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'ef31_recalculation_attempts'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN ef31_recalculation_attempts INTEGER DEFAULT 0;

    COMMENT ON COLUMN public.product_lcas.ef31_recalculation_attempts IS
      'Number of EF 3.1 recalculation attempts.';
  END IF;
END $$;

-- Add index for recalculation status queries
CREATE INDEX IF NOT EXISTS idx_product_lcas_ef31_recalc_status
  ON public.product_lcas(ef31_recalculation_status)
  WHERE ef31_recalculation_status IS NOT NULL;

-- =====================================================
-- STEP 2: CREATE RECALCULATION BATCHES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lca_recalculation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5,
  total_jobs INTEGER NOT NULL DEFAULT 0,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  failed_jobs INTEGER NOT NULL DEFAULT 0,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES public.profiles(id),
  trigger_reason TEXT,
  error_summary JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_batch_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

COMMENT ON TABLE public.lca_recalculation_batches IS
  'Groups EF 3.1 recalculation jobs into batches for monitoring and progress tracking.';

CREATE INDEX IF NOT EXISTS idx_recalc_batches_status
  ON public.lca_recalculation_batches(status, priority DESC);

ALTER TABLE public.lca_recalculation_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view and manage recalculation batches"
  ON public.lca_recalculation_batches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- =====================================================
-- STEP 3: CREATE RECALCULATION QUEUE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lca_recalculation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.lca_recalculation_batches(id) ON DELETE CASCADE,
  product_lca_id UUID NOT NULL REFERENCES public.product_lcas(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  error_details JSONB,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_queue_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority BETWEEN 1 AND 10),
  UNIQUE(product_lca_id, batch_id)
);

COMMENT ON TABLE public.lca_recalculation_queue IS
  'Queue for pending EF 3.1 recalculation jobs with retry logic and batch grouping.';

CREATE INDEX IF NOT EXISTS idx_recalc_queue_pending
  ON public.lca_recalculation_queue(status, priority DESC, created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_recalc_queue_batch
  ON public.lca_recalculation_queue(batch_id)
  WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recalc_queue_org
  ON public.lca_recalculation_queue(organization_id);

ALTER TABLE public.lca_recalculation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization recalculation queue"
  ON public.lca_recalculation_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = lca_recalculation_queue.organization_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage recalculation queue"
  ON public.lca_recalculation_queue
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON om.role_id = r.id
      WHERE om.organization_id = lca_recalculation_queue.organization_id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON om.role_id = r.id
      WHERE om.organization_id = lca_recalculation_queue.organization_id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- =====================================================
-- STEP 4: CREATE FUNCTION TO QUEUE LCAs FOR RECALCULATION
-- =====================================================

CREATE OR REPLACE FUNCTION public.queue_lca_for_ef31_recalculation(
  p_product_lca_id UUID,
  p_priority INTEGER DEFAULT 5,
  p_batch_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_queue_id UUID;
  v_has_access BOOLEAN;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM public.product_lcas
  WHERE id = p_product_lca_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Product LCA not found';
  END IF;

  SELECT public.check_methodology_access(v_org_id, 'ef_31') INTO v_has_access;
  
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Organization does not have access to EF 3.1 methodology. Please upgrade to Premium or Enterprise tier.';
  END IF;

  INSERT INTO public.lca_recalculation_queue (
    batch_id,
    product_lca_id,
    organization_id,
    priority,
    status
  ) VALUES (
    p_batch_id,
    p_product_lca_id,
    v_org_id,
    p_priority,
    'pending'
  )
  ON CONFLICT (product_lca_id, batch_id) DO UPDATE SET
    status = 'pending',
    attempt_count = 0,
    last_error = NULL,
    updated_at = now()
  RETURNING id INTO v_queue_id;

  UPDATE public.product_lcas
  SET 
    ef31_recalculation_status = 'pending',
    ef31_recalculation_requested_at = now(),
    ef31_recalculation_error = NULL
  WHERE id = p_product_lca_id;

  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.queue_lca_for_ef31_recalculation IS
  'Queues a product LCA for EF 3.1 recalculation. Checks tier access first.';

-- =====================================================
-- STEP 5: CREATE FUNCTION TO BATCH QUEUE ALL ELIGIBLE LCAs
-- =====================================================

CREATE OR REPLACE FUNCTION public.queue_all_lcas_for_ef31_recalculation(
  p_organization_id UUID DEFAULT NULL,
  p_batch_name TEXT DEFAULT NULL,
  p_triggered_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_batch_id UUID;
  v_count INTEGER := 0;
  v_lca RECORD;
BEGIN
  INSERT INTO public.lca_recalculation_batches (
    batch_name,
    description,
    triggered_by,
    trigger_reason
  ) VALUES (
    COALESCE(p_batch_name, 'EF 3.1 Recalculation - ' || to_char(now(), 'YYYY-MM-DD HH24:MI')),
    CASE 
      WHEN p_organization_id IS NOT NULL THEN 'Organization-specific recalculation'
      ELSE 'Platform-wide EF 3.1 recalculation'
    END,
    p_triggered_by,
    'Manual trigger or subscription upgrade'
  )
  RETURNING id INTO v_batch_id;

  FOR v_lca IN
    SELECT pl.id, pl.organization_id
    FROM public.product_lcas pl
    JOIN public.organizations o ON o.id = pl.organization_id
    WHERE pl.status = 'completed'
    AND (pl.ef31_impacts IS NULL OR pl.ef31_calculated_at IS NULL)
    AND o.subscription_tier IN ('premium', 'enterprise')
    AND o.subscription_status IN ('active', 'trial')
    AND (p_organization_id IS NULL OR pl.organization_id = p_organization_id)
  LOOP
    INSERT INTO public.lca_recalculation_queue (
      batch_id,
      product_lca_id,
      organization_id,
      status
    ) VALUES (
      v_batch_id,
      v_lca.id,
      v_lca.organization_id,
      'pending'
    )
    ON CONFLICT (product_lca_id, batch_id) DO NOTHING;

    UPDATE public.product_lcas
    SET 
      ef31_recalculation_status = 'pending',
      ef31_recalculation_requested_at = now()
    WHERE id = v_lca.id;

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.lca_recalculation_batches
  SET total_jobs = v_count
  WHERE id = v_batch_id;

  RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.queue_all_lcas_for_ef31_recalculation IS
  'Queues all eligible completed LCAs for EF 3.1 recalculation. Only includes Premium/Enterprise orgs.';

-- =====================================================
-- STEP 6: CREATE FUNCTION TO GET NEXT QUEUE ITEM
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_next_recalculation_job()
RETURNS TABLE (
  queue_id UUID,
  product_lca_id UUID,
  organization_id UUID,
  batch_id UUID,
  attempt_count INTEGER
) AS $$
DECLARE
  v_job RECORD;
BEGIN
  SELECT 
    q.id,
    q.product_lca_id,
    q.organization_id,
    q.batch_id,
    q.attempt_count
  INTO v_job
  FROM public.lca_recalculation_queue q
  WHERE q.status = 'pending'
  AND (q.next_retry_at IS NULL OR q.next_retry_at <= now())
  ORDER BY q.priority DESC, q.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.lca_recalculation_queue
  SET 
    status = 'processing',
    processing_started_at = now(),
    attempt_count = attempt_count + 1,
    updated_at = now()
  WHERE id = v_job.id;

  UPDATE public.product_lcas
  SET ef31_recalculation_status = 'processing'
  WHERE id = v_job.product_lca_id;

  RETURN QUERY SELECT 
    v_job.id,
    v_job.product_lca_id,
    v_job.organization_id,
    v_job.batch_id,
    v_job.attempt_count + 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_next_recalculation_job IS
  'Atomically claims and returns the next pending recalculation job from the queue.';

-- =====================================================
-- STEP 7: CREATE FUNCTION TO COMPLETE QUEUE ITEM
-- =====================================================

CREATE OR REPLACE FUNCTION public.complete_recalculation_job(
  p_queue_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL,
  p_error_details JSONB DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_job RECORD;
  v_new_status TEXT;
BEGIN
  SELECT * INTO v_job
  FROM public.lca_recalculation_queue
  WHERE id = p_queue_id;

  IF v_job IS NULL THEN
    RETURN;
  END IF;

  IF p_success THEN
    v_new_status := 'completed';
  ELSIF v_job.attempt_count >= v_job.max_attempts THEN
    v_new_status := 'failed';
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE public.lca_recalculation_queue
  SET 
    status = v_new_status,
    processing_completed_at = CASE WHEN p_success OR v_new_status = 'failed' THEN now() ELSE NULL END,
    last_error = p_error,
    error_details = p_error_details,
    next_retry_at = CASE 
      WHEN v_new_status = 'pending' THEN now() + (v_job.attempt_count * INTERVAL '5 minutes')
      ELSE NULL 
    END,
    updated_at = now()
  WHERE id = p_queue_id;

  UPDATE public.product_lcas
  SET 
    ef31_recalculation_status = v_new_status,
    ef31_recalculation_error = p_error,
    ef31_recalculation_attempts = v_job.attempt_count
  WHERE id = v_job.product_lca_id;

  IF v_job.batch_id IS NOT NULL THEN
    UPDATE public.lca_recalculation_batches
    SET 
      completed_jobs = completed_jobs + CASE WHEN p_success THEN 1 ELSE 0 END,
      failed_jobs = failed_jobs + CASE WHEN NOT p_success AND v_new_status = 'failed' THEN 1 ELSE 0 END,
      error_summary = CASE 
        WHEN NOT p_success THEN error_summary || jsonb_build_object('lca_id', v_job.product_lca_id, 'error', p_error)
        ELSE error_summary 
      END,
      updated_at = now()
    WHERE id = v_job.batch_id;

    UPDATE public.lca_recalculation_batches
    SET 
      status = CASE 
        WHEN completed_jobs + failed_jobs >= total_jobs THEN 
          CASE WHEN failed_jobs > 0 THEN 'completed' ELSE 'completed' END
        ELSE status 
      END,
      processing_completed_at = CASE 
        WHEN completed_jobs + failed_jobs >= total_jobs THEN now()
        ELSE NULL 
      END
    WHERE id = v_job.batch_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.complete_recalculation_job IS
  'Marks a recalculation job as completed or failed, with retry logic and batch updates.';

-- =====================================================
-- STEP 8: CREATE VIEW FOR RECALCULATION PROGRESS
-- =====================================================

CREATE OR REPLACE VIEW public.ef31_recalculation_progress AS
SELECT 
  b.id AS batch_id,
  b.batch_name,
  b.status AS batch_status,
  b.total_jobs,
  b.completed_jobs,
  b.failed_jobs,
  b.total_jobs - b.completed_jobs - b.failed_jobs AS pending_jobs,
  CASE 
    WHEN b.total_jobs > 0 THEN ROUND((b.completed_jobs::NUMERIC / b.total_jobs) * 100, 1)
    ELSE 0 
  END AS completion_percentage,
  b.processing_started_at,
  b.processing_completed_at,
  b.triggered_by,
  p.full_name AS triggered_by_name,
  b.created_at
FROM public.lca_recalculation_batches b
LEFT JOIN public.profiles p ON p.id = b.triggered_by
ORDER BY b.created_at DESC;

COMMENT ON VIEW public.ef31_recalculation_progress IS
  'Shows progress of EF 3.1 recalculation batches with completion percentage.';

-- =====================================================
-- STEP 9: CREATE TRIGGER FOR BATCH UPDATES
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_recalculation_batch_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_recalc_batches_updated_at ON public.lca_recalculation_batches;
CREATE TRIGGER update_recalc_batches_updated_at
  BEFORE UPDATE ON public.lca_recalculation_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_recalculation_batch_timestamp();

DROP TRIGGER IF EXISTS update_recalc_queue_updated_at ON public.lca_recalculation_queue;
CREATE TRIGGER update_recalc_queue_updated_at
  BEFORE UPDATE ON public.lca_recalculation_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_recalculation_batch_timestamp();

-- =====================================================
-- STEP 10: VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_queue_exists BOOLEAN;
  v_batch_exists BOOLEAN;
  v_functions_count INTEGER;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lca_recalculation_queue') INTO v_queue_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lca_recalculation_batches') INTO v_batch_exists;
  SELECT COUNT(*) INTO v_functions_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN ('queue_lca_for_ef31_recalculation', 'queue_all_lcas_for_ef31_recalculation', 'get_next_recalculation_job', 'complete_recalculation_job');

  RAISE NOTICE 'LCA Recalculation Queue Migration Summary:';
  RAISE NOTICE '  Queue table created: %', v_queue_exists;
  RAISE NOTICE '  Batches table created: %', v_batch_exists;
  RAISE NOTICE '  Queue functions created: % (expected 4)', v_functions_count;
  RAISE NOTICE '  Progress view created: ef31_recalculation_progress';
  RAISE NOTICE '  Migration completed successfully';
END $$;
