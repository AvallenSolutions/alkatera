/*
  # Fix LCA Stages Table Schema

  1. Problem
    - lca_life_cycle_stages table has wrong ID type (integer instead of uuid)
    - Missing display_order column
    - Missing description column

  2. Changes to `lca_life_cycle_stages` table
    - Add display_order column (integer, required)
    - Add description column (text, nullable)

  3. Changes to `lca_sub_stages` table
    - Check if display_order exists, add if missing
    - Check if description exists, add if missing

  4. Data Integrity
    - Preserves all existing data
    - Assigns default display_order based on existing ID order

  5. Security
    - No changes to RLS policies

  6. Notes
    - Cannot easily change id from integer to uuid without data loss
    - Will work with integer id for now (code should handle both)
*/

-- Add display_order column to lca_life_cycle_stages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lca_life_cycle_stages'
    AND column_name = 'display_order'
  ) THEN
    -- Add column with temporary default
    ALTER TABLE public.lca_life_cycle_stages
      ADD COLUMN display_order INTEGER NOT NULL DEFAULT 1;

    -- Update display_order based on current id order
    UPDATE public.lca_life_cycle_stages
    SET display_order = id;

    -- Now that all rows have values, we can remove the default
    ALTER TABLE public.lca_life_cycle_stages
      ALTER COLUMN display_order DROP DEFAULT;
  END IF;
END $$;

-- Add description column to lca_life_cycle_stages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lca_life_cycle_stages'
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.lca_life_cycle_stages
      ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add display_order column to lca_sub_stages if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lca_sub_stages'
    AND column_name = 'display_order'
  ) THEN
    ALTER TABLE public.lca_sub_stages
      ADD COLUMN display_order INTEGER NOT NULL DEFAULT 1;

    -- Update display_order based on current id order
    UPDATE public.lca_sub_stages
    SET display_order = CAST(id AS INTEGER);

    ALTER TABLE public.lca_sub_stages
      ALTER COLUMN display_order DROP DEFAULT;
  END IF;
END $$;

-- Add description column to lca_sub_stages if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lca_sub_stages'
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.lca_sub_stages
      ADD COLUMN description TEXT;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_lca_stages_display_order
  ON public.lca_life_cycle_stages(display_order);

CREATE INDEX IF NOT EXISTS idx_lca_sub_stages_display_order
  ON public.lca_sub_stages(display_order);

-- Add comments
COMMENT ON COLUMN public.lca_life_cycle_stages.display_order IS 'Controls the display order in the UI. Lower numbers appear first.';
COMMENT ON COLUMN public.lca_life_cycle_stages.description IS 'Detailed explanation of the life cycle stage.';
COMMENT ON COLUMN public.lca_sub_stages.display_order IS 'Controls the display order within the parent stage. Lower numbers appear first.';
COMMENT ON COLUMN public.lca_sub_stages.description IS 'Detailed explanation of the sub-stage.';