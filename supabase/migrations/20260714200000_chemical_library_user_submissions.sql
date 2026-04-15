-- Migration: Allow user submissions to the consolidated chemical library
-- Adds submitted_by column and INSERT RLS policy

-- Track who submitted the chemical (NULL = seed/admin data)
ALTER TABLE public.chemical_library
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id);

-- Allow authenticated users to insert new chemicals
DROP POLICY IF EXISTS "Authenticated users can insert chemicals" ON public.chemical_library;
CREATE POLICY "Authenticated users can insert chemicals"
  ON public.chemical_library FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
