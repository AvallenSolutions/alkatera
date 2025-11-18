/*
  # Make system_boundary Nullable in product_lcas

  1. Changes to `product_lcas` table
    - Alter `system_boundary` column to be nullable
    - This allows draft LCAs to be created without a system boundary initially
    - System boundary can be defined later in the LCA creation workflow

  2. Rationale
    - LCAs created from products need minimal initial data
    - System boundary is specific to the LCA assessment, not the product
    - This change supports a progressive disclosure workflow
    - Users can complete system boundary when they have sufficient context

  3. Notes
    - This is a non-breaking change
    - Existing records with system_boundary values remain unchanged
    - NULL values are now permitted for draft LCAs
*/

-- Make system_boundary nullable
ALTER TABLE public.product_lcas
  ALTER COLUMN system_boundary DROP NOT NULL;

-- Add comment explaining the nullable field
COMMENT ON COLUMN public.product_lcas.system_boundary IS 'System boundary description (cradle-to-gate, cradle-to-grave, etc.). Nullable to support draft creation.';
