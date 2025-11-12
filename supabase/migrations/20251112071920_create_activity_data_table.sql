/*
  # Create Activity Data Table for Emissions Data Ingestion

  ## Overview
  This migration creates the core activity_data table to store user-submitted emissions activity data
  across all scopes (Scope 1, 2, and 3). This table serves as the primary data collection point for
  the emissions calculation engine.

  ## New Tables
  
  ### `activity_data`
  Stores activity data submissions from authenticated organization members.
  
  **Columns:**
  - `id` (uuid, primary key) - Unique identifier for each activity record
  - `organization_id` (uuid, not null, FK) - Links to the organization that owns this data
  - `user_id` (uuid, not null, FK) - The user who submitted this activity data
  - `name` (text, not null) - Descriptive name of the activity (e.g., "Monthly Electricity Consumption")
  - `category` (text, not null) - Emissions category (e.g., "Scope 1", "Scope 2", "Scope 3")
  - `quantity` (numeric, not null) - The measured quantity of the activity
  - `unit` (text, not null) - Unit of measurement (e.g., "kWh", "litres", "kg")
  - `activity_date` (date, not null) - The date when the activity occurred
  - `created_at` (timestamptz) - Timestamp when the record was created
  
  ## Security
  
  ### Row Level Security (RLS)
  - **Enabled:** Yes
  - **Policy 1:** Organization members can INSERT activity data for their own organization
  - **Policy 2:** Organization members can SELECT activity data from their own organization
  - **Policy 3:** Organization members can UPDATE activity data in their own organization
  - **Policy 4:** Organization members can DELETE activity data from their own organization
  
  All policies use the existing `get_current_organization_id()` helper function to verify
  that the data belongs to the user's organization.

  ## Notes
  - Uses numeric type for quantity to support precise decimal values
  - Category is stored as text to allow flexibility for various scope subcategories
  - Foreign key constraints ensure data integrity with organizations and users tables
  - Timestamps default to current time for audit trail
  - Indexes created for common query patterns to optimize performance
*/

-- Create the activity_data table
CREATE TABLE IF NOT EXISTS public.activity_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  activity_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.activity_data ENABLE ROW LEVEL SECURITY;

-- Policy: Allow organization members to insert activity data
CREATE POLICY "Organization members can insert activity data"
  ON public.activity_data
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_current_organization_id());

-- Policy: Allow organization members to select activity data
CREATE POLICY "Organization members can select activity data"
  ON public.activity_data
  FOR SELECT
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- Policy: Allow organization members to update activity data
CREATE POLICY "Organization members can update activity data"
  ON public.activity_data
  FOR UPDATE
  TO authenticated
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- Policy: Allow organization members to delete activity data
CREATE POLICY "Organization members can delete activity data"
  ON public.activity_data
  FOR DELETE
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_activity_data_organization_id 
  ON public.activity_data(organization_id);

CREATE INDEX IF NOT EXISTS idx_activity_data_user_id 
  ON public.activity_data(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_data_activity_date 
  ON public.activity_data(activity_date);

CREATE INDEX IF NOT EXISTS idx_activity_data_category 
  ON public.activity_data(category);
