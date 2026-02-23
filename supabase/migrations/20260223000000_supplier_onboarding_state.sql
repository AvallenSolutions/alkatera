-- Add onboarding_state JSONB column to suppliers table
-- Stores the full supplier onboarding wizard state inline,
-- avoiding a separate table and leveraging existing RLS policies
-- (suppliers already have SELECT/UPDATE on their own record via user_id = auth.uid()).

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS onboarding_state JSONB;

COMMENT ON COLUMN public.suppliers.onboarding_state IS
  'JSONB state for the supplier onboarding wizard. Stores current step, completed steps, dismissed/completed flags.';

-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
