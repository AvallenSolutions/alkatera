/*
  # Create Facility Types Lookup Table

  1. New Tables
    - `facility_types`
      - `id` (uuid, primary key) - Unique identifier for each facility type
      - `name` (text, not null) - Name of the facility type (e.g., 'Production', 'Warehouse')
      - `created_at` (timestamptz) - Timestamp when the type was created

  2. Changes
    - Add `facility_type_id` column to `facilities` table
    - Add foreign key constraint from `facilities.facility_type_id` to `facility_types.id`
    - Remove old `facility_type` text column from `facilities` table

  3. Security
    - Enable RLS on `facility_types` table
    - Add policy for authenticated users to read facility types

  4. Data Seeding
    - Insert predefined facility types: Production, Bottling, Canning, Warehouse & Distribution, Packaging
*/

-- Create facility_types table
CREATE TABLE IF NOT EXISTS public.facility_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on facility_types
ALTER TABLE public.facility_types ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read facility types
CREATE POLICY "Authenticated users can read facility types"
  ON public.facility_types
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed facility types with predefined values
INSERT INTO public.facility_types (name) VALUES
  ('Production'),
  ('Bottling'),
  ('Canning'),
  ('Warehouse & Distribution'),
  ('Packaging')
ON CONFLICT (name) DO NOTHING;

-- Add facility_type_id column to facilities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'facilities'
    AND column_name = 'facility_type_id'
  ) THEN
    ALTER TABLE public.facilities
    ADD COLUMN facility_type_id uuid REFERENCES public.facility_types(id);
  END IF;
END $$;

-- Remove old facility_type text column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'facilities'
    AND column_name = 'facility_type'
  ) THEN
    ALTER TABLE public.facilities DROP COLUMN facility_type;
  END IF;
END $$;
