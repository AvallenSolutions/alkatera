/*
  # Add Missing Columns to product_lcas Table

  1. Problem
    - The product_lcas table is missing several critical columns that were defined in earlier migrations
    - Missing columns: functional_unit, system_boundary, status, product_id
    - This causes "column not found" errors when trying to create LCAs

  2. Changes to `product_lcas` table
    - Add `functional_unit` (TEXT, NOT NULL) - The functional unit for the LCA (e.g., "250 ml", "1 kg")
    - Add `system_boundary` (TEXT, nullable) - System boundary description, nullable for drafts
    - Add `status` (TEXT, NOT NULL, default 'draft') - LCA status tracking
    - Add `product_id` (BIGINT, nullable, FK to products) - Links LCA to source product

  3. Data Integrity
    - functional_unit defaults to '1 unit' for existing rows
    - system_boundary can be NULL (supports draft state)
    - status defaults to 'draft'
    - product_id can be NULL (supports standalone LCAs)
    - product_id is BIGINT to match products.id type

  4. Security
    - No changes to RLS policies
    - Foreign key constraint ensures referential integrity

  5. Notes
    - This migration adds columns that should have been present from earlier migrations
    - Safe to run even if some columns already exist (uses IF NOT EXISTS pattern)
*/

-- Add functional_unit column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'functional_unit'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN functional_unit TEXT NOT NULL DEFAULT '1 unit';

    -- Remove default after adding (we want it required for new inserts)
    ALTER TABLE public.product_lcas
      ALTER COLUMN functional_unit DROP DEFAULT;
  END IF;
END $$;

-- Add system_boundary column (nullable for drafts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'system_boundary'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN system_boundary TEXT;
  END IF;
END $$;

-- Add status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';

    -- Add constraint to ensure valid status values
    ALTER TABLE public.product_lcas
      ADD CONSTRAINT valid_status CHECK (status IN ('draft', 'pending', 'completed', 'failed'));
  END IF;
END $$;

-- Add product_id column (FK to products table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lcas'
    AND column_name = 'product_id'
  ) THEN
    ALTER TABLE public.product_lcas
      ADD COLUMN product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.product_lcas.functional_unit IS 'The functional unit for the LCA assessment (e.g., "250 ml", "1 kg"). Derived from product unit size.';
COMMENT ON COLUMN public.product_lcas.system_boundary IS 'System boundary description (cradle-to-gate, cradle-to-grave, etc.). Nullable to support draft creation.';
COMMENT ON COLUMN public.product_lcas.status IS 'Current status of the LCA: draft (being edited), pending (calculating), completed (finished), or failed (error occurred).';
COMMENT ON COLUMN public.product_lcas.product_id IS 'Foreign key linking this LCA to the source product. NULL for standalone LCAs.';

-- Create index on product_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_lcas_product_id ON public.product_lcas(product_id);

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_product_lcas_status_v2 ON public.product_lcas(status);