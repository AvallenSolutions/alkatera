-- Fix FK constraint on certification_gap_analyses.requirement_id (v2)
-- The constraint must point to framework_requirements, not certification_framework_requirements.
-- This migration drops ALL FK constraints on requirement_id and recreates the correct one.

-- Step 1: Find and drop any FK constraint on certification_gap_analyses.requirement_id
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'certification_gap_analyses'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.column_name = 'id'
    -- Also check key_column_usage for the source column
    INTERSECT
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'certification_gap_analyses'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'requirement_id'
  LOOP
    EXECUTE format('ALTER TABLE public.certification_gap_analyses DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped FK constraint: %', constraint_name;
  END LOOP;
END $$;

-- Step 2: Also try dropping by known names (belt and suspenders)
ALTER TABLE public.certification_gap_analyses
  DROP CONSTRAINT IF EXISTS certification_gap_analyses_requirement_id_fkey;
ALTER TABLE public.certification_gap_analyses
  DROP CONSTRAINT IF EXISTS gap_analyses_requirement_id_fkey;
ALTER TABLE public.certification_gap_analyses
  DROP CONSTRAINT IF EXISTS fk_requirement_id;

-- Step 3: Clean up any orphaned records before re-adding constraint
DELETE FROM public.certification_gap_analyses
WHERE requirement_id NOT IN (SELECT id FROM public.framework_requirements);

-- Step 4: Create the correct FK constraint
ALTER TABLE public.certification_gap_analyses
  ADD CONSTRAINT certification_gap_analyses_requirement_id_fkey
  FOREIGN KEY (requirement_id) REFERENCES public.framework_requirements(id) ON DELETE CASCADE;

-- Step 5: Verify by logging what the constraint now points to
DO $$
DECLARE
  ref_table TEXT;
BEGIN
  SELECT ccu.table_name INTO ref_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'certification_gap_analyses'
    AND tc.constraint_name = 'certification_gap_analyses_requirement_id_fkey';

  RAISE NOTICE 'FK now references table: %', ref_table;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
