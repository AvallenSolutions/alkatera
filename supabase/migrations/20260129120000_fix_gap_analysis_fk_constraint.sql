-- Fix FK constraint on certification_gap_analyses.requirement_id
-- The original migration created the table with FK to certification_framework_requirements,
-- but the code uses framework_requirements. This migration:
-- 1. Copies data from certification_framework_requirements to framework_requirements (if both exist)
-- 2. Drops the old FK constraint
-- 3. Creates new FK constraint pointing to framework_requirements

-- Step 1: If certification_framework_requirements exists, copy its data to framework_requirements
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'certification_framework_requirements'
  ) THEN
    -- Copy data using only columns that exist in both tables
    INSERT INTO public.framework_requirements (
      id, framework_id, requirement_code, requirement_name,
      requirement_category, description, max_points, is_mandatory,
      section, subsection, order_index, guidance, examples,
      evidence_requirements, created_at, updated_at
    )
    SELECT
      id, framework_id, requirement_code, requirement_name,
      requirement_category,
      description,
      max_points,
      is_mandatory,
      section,
      subsection,
      order_index,
      guidance, examples,
      evidence_requirements,
      created_at, updated_at
    FROM public.certification_framework_requirements
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Copied data from certification_framework_requirements to framework_requirements';
  END IF;
END $$;

-- Step 2: Drop old FK constraint and create new one pointing to framework_requirements
DO $$
BEGIN
  -- Drop the existing FK constraint (try multiple possible names)
  BEGIN
    ALTER TABLE public.certification_gap_analyses
      DROP CONSTRAINT IF EXISTS certification_gap_analyses_requirement_id_fkey;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop constraint certification_gap_analyses_requirement_id_fkey: %', SQLERRM;
  END;

  -- Also try the alternate name pattern
  BEGIN
    ALTER TABLE public.certification_gap_analyses
      DROP CONSTRAINT IF EXISTS gap_analyses_requirement_id_fkey;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop constraint gap_analyses_requirement_id_fkey: %', SQLERRM;
  END;

  -- Create new FK constraint pointing to framework_requirements
  BEGIN
    ALTER TABLE public.certification_gap_analyses
      ADD CONSTRAINT certification_gap_analyses_requirement_id_fkey
      FOREIGN KEY (requirement_id) REFERENCES public.framework_requirements(id);
    RAISE NOTICE 'Created FK constraint pointing to framework_requirements';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'FK constraint already exists';
  END;
END $$;

-- Step 3: Also fix FK on certification_evidence_links if it has the same issue
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.certification_evidence_links
      DROP CONSTRAINT IF EXISTS certification_evidence_links_requirement_id_fkey;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.certification_evidence_links
      ADD CONSTRAINT certification_evidence_links_requirement_id_fkey
      FOREIGN KEY (requirement_id) REFERENCES public.framework_requirements(id);
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not fix evidence_links FK: %', SQLERRM;
  END;
END $$;

-- Step 4: Clean up any orphaned gap analysis records
DELETE FROM public.certification_gap_analyses
WHERE requirement_id NOT IN (SELECT id FROM public.framework_requirements);

-- Step 5: Ensure GRANT permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.framework_requirements TO authenticated;
GRANT ALL ON public.framework_requirements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certification_gap_analyses TO authenticated;
GRANT ALL ON public.certification_gap_analyses TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
