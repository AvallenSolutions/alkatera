/*
  # Create Scope 1 & 2 Emissions Data Capture Tables

  1. New Tables
    - `scope_1_2_emission_sources`
      - `id` (uuid, primary key)
      - `source_name` (text, emission source name)
      - `scope` (text, 'Scope 1' or 'Scope 2')
      - `category` (text, emission category)
      - `default_unit` (text, default measurement unit)
      - `emission_factor_id` (uuid, nullable reference to emissions_factors)
    
    - `facility_activity_data`
      - `id` (uuid, primary key)
      - `facility_id` (uuid, references facilities table)
      - `emission_source_id` (uuid, references scope_1_2_emission_sources)
      - `quantity` (numeric, consumption amount)
      - `unit` (text, measurement unit)
      - `reporting_period_start` (date)
      - `reporting_period_end` (date)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  2. Security
    - Enable RLS on both tables
    - scope_1_2_emission_sources: Authenticated users can read
    - facility_activity_data: Users can only CRUD data for facilities in their organization

  3. Performance
    - Index on facility_id for fast lookups
    - Index on emission_source_id for joins
*/

-- Create scope_1_2_emission_sources table
CREATE TABLE IF NOT EXISTS public.scope_1_2_emission_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('Scope 1', 'Scope 2')),
    category TEXT NOT NULL CHECK (category IN ('Stationary Combustion', 'Mobile Combustion', 'Fugitive Emissions', 'Purchased Energy')),
    default_unit TEXT NOT NULL,
    emission_factor_id UUID REFERENCES public.emissions_factors(factor_id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create facility_activity_data table
CREATE TABLE IF NOT EXISTS public.facility_activity_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    emission_source_id UUID NOT NULL REFERENCES public.scope_1_2_emission_sources(id),
    quantity NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    reporting_period_start DATE NOT NULL,
    reporting_period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_facility_activity_data_facility_id 
ON public.facility_activity_data(facility_id);

CREATE INDEX IF NOT EXISTS idx_facility_activity_data_emission_source_id 
ON public.facility_activity_data(emission_source_id);

CREATE INDEX IF NOT EXISTS idx_facility_activity_data_reporting_period 
ON public.facility_activity_data(reporting_period_start, reporting_period_end);

-- Enable RLS
ALTER TABLE public.scope_1_2_emission_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_activity_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scope_1_2_emission_sources
-- All authenticated users can read emission sources (reference data)
CREATE POLICY "Authenticated users can view emission sources"
ON public.scope_1_2_emission_sources
FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for facility_activity_data
-- Users can view activity data for facilities in their organization
CREATE POLICY "Users can view facility activity data in their organization"
ON public.facility_activity_data
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.facilities f
    INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
    WHERE f.id = facility_activity_data.facility_id
    AND om.user_id = auth.uid()
  )
);

-- Users can insert activity data for facilities in their organization
CREATE POLICY "Users can insert facility activity data in their organization"
ON public.facility_activity_data
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.facilities f
    INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
    WHERE f.id = facility_activity_data.facility_id
    AND om.user_id = auth.uid()
  )
);

-- Users can update activity data for facilities in their organization
CREATE POLICY "Users can update facility activity data in their organization"
ON public.facility_activity_data
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.facilities f
    INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
    WHERE f.id = facility_activity_data.facility_id
    AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.facilities f
    INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
    WHERE f.id = facility_activity_data.facility_id
    AND om.user_id = auth.uid()
  )
);

-- Users can delete activity data for facilities in their organization
CREATE POLICY "Users can delete facility activity data in their organization"
ON public.facility_activity_data
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.facilities f
    INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
    WHERE f.id = facility_activity_data.facility_id
    AND om.user_id = auth.uid()
  )
);

-- Populate scope_1_2_emission_sources with verified data
-- Note: emission_factor_id is set to NULL for now as we need to map to actual UUIDs
-- These can be updated later with proper emission factor mappings

-- Scope 1 Data
INSERT INTO public.scope_1_2_emission_sources (source_name, scope, category, default_unit, emission_factor_id) VALUES
('Natural Gas', 'Scope 1', 'Stationary Combustion', 'kWh', NULL),
('Gas Oil (Red Diesel)', 'Scope 1', 'Stationary Combustion', 'litres', NULL),
('Liquefied Petroleum Gas (LPG)', 'Scope 1', 'Stationary Combustion', 'litres', NULL),
('Burning Oil (Kerosene)', 'Scope 1', 'Stationary Combustion', 'litres', NULL),
('Heavy Fuel Oil (HFO)', 'Scope 1', 'Stationary Combustion', 'litres', NULL),
('Coal (Industrial)', 'Scope 1', 'Stationary Combustion', 'tonnes', NULL),
('Diesel (Owned Fleet)', 'Scope 1', 'Mobile Combustion', 'litres', NULL),
('Petrol (Owned Fleet)', 'Scope 1', 'Mobile Combustion', 'litres', NULL),
('Refrigerant Leakage (R404A)', 'Scope 1', 'Fugitive Emissions', 'kg', NULL),
('Refrigerant Leakage (R134a)', 'Scope 1', 'Fugitive Emissions', 'kg', NULL),
('Refrigerant Leakage (R410A)', 'Scope 1', 'Fugitive Emissions', 'kg', NULL),
('Carbon Dioxide (CO2) from fermentation/carbonation process', 'Scope 1', 'Fugitive Emissions', 'kg', NULL)
ON CONFLICT DO NOTHING;

-- Scope 2 Data
INSERT INTO public.scope_1_2_emission_sources (source_name, scope, category, default_unit, emission_factor_id) VALUES
('Purchased Grid Electricity', 'Scope 2', 'Purchased Energy', 'kWh', NULL),
('Purchased Heat or Steam', 'Scope 2', 'Purchased Energy', 'kWh', NULL),
('Purchased Cooling', 'Scope 2', 'Purchased Energy', 'kWh', NULL)
ON CONFLICT DO NOTHING;