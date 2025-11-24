/*
  # Add System Boundary to Products

  1. Changes
    - Add `system_boundary` column to products table
    - Supports LCA scope definition: cradle-to-gate or cradle-to-grave

  2. Details
    - `system_boundary` defaults to 'cradle_to_gate' per V4 LCA Methodology
    - Helps control downstream data requirements and compliance scope
*/

-- Create ENUM type for system boundary if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'system_boundary_enum') THEN
    CREATE TYPE public.system_boundary_enum AS ENUM ('cradle_to_gate', 'cradle_to_grave');
  END IF;
END $$;

-- Add system_boundary column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'system_boundary'
  ) THEN
    ALTER TABLE public.products 
    ADD COLUMN system_boundary public.system_boundary_enum NOT NULL DEFAULT 'cradle_to_gate';
  END IF;
END $$;

-- Create index for filtering by system boundary
CREATE INDEX IF NOT EXISTS idx_products_system_boundary ON public.products(system_boundary);

-- Add comment
COMMENT ON COLUMN public.products.system_boundary IS 
'Defines the scope of the LCA calculation: cradle_to_gate (raw materials to factory gate) or cradle_to_grave (complete lifecycle). Controls downstream data requirements and compliance scope.';