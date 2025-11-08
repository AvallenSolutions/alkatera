/*
  # Create KPI Management System with Summary View

  ## Overview
  This migration creates the complete KPI (Key Performance Indicator) management system
  for tracking organizational metrics and performance goals. It establishes the data model
  for KPIs, their historical data points, and provides a performant view for dashboard display.

  ## Problem Being Solved
  Organizations need to:
  - Track multiple performance indicators (emissions, costs, targets, etc.)
  - Record historical data points for each KPI
  - View the most recent value for each KPI alongside its target
  - Ensure data is isolated per organization (multi-tenant security)
  - Query KPI summaries efficiently for dashboard display

  ## Solution Architecture

  ### Part 1: KPI Tables
  Creates two core tables:
  1. `kpis` - Defines KPI metadata (name, target, unit, etc.)
  2. `kpi_data_points` - Stores time-series data for each KPI

  ### Part 2: KPI Summary View
  Creates `kpi_summary_view` that:
  - Joins kpis with their most recent data point
  - Provides ready-to-display summary for dashboards
  - Inherits RLS from base tables
  - Optimized for SELECT queries

  ### Part 3: Security (RLS)
  - All tables use organization_id for tenant isolation
  - Policies use get_current_organization_id() as single source of truth
  - View inherits security automatically via security_invoker
  - Users only see their organization's KPIs

  ## Tables Created

  ### 1. kpis
  Stores KPI definitions for each organization
  
  Columns:
  - id (uuid, PK): Unique identifier
  - organization_id (uuid, FK): Which organization owns this KPI
  - name (text): KPI display name (e.g., "Total Emissions")
  - description (text): Detailed explanation
  - target_value (numeric): Goal/target for this KPI
  - unit (text): Unit of measurement (e.g., "tCO₂e", "£", "%")
  - category (text): Grouping (e.g., "emissions", "financial", "operational")
  - created_at (timestamptz): When KPI was created
  - updated_at (timestamptz): When KPI was last modified

  ### 2. kpi_data_points
  Stores historical values for each KPI
  
  Columns:
  - id (uuid, PK): Unique identifier
  - kpi_id (uuid, FK): Which KPI this data point belongs to
  - value (numeric): The measured value
  - recorded_date (date): When this value was recorded
  - notes (text): Optional context or explanation
  - created_at (timestamptz): When data point was created
  - created_by (uuid, FK): Who created this data point

  ### 3. kpi_summary_view (VIEW)
  Pre-joined view showing latest KPI values
  
  Columns:
  - kpi_id (uuid): KPI identifier
  - organization_id (uuid): Organization owner
  - name (text): KPI name
  - description (text): KPI description
  - current_value (numeric): Most recent recorded value
  - target_value (numeric): Target goal
  - unit (text): Unit of measurement
  - category (text): KPI category
  - last_recorded_date (date): When current_value was recorded
  - last_updated (timestamptz): When KPI definition was updated

  ## Security Model

  ### RLS Policies Created

  **kpis table:**
  1. SELECT: Users can view KPIs from their organization
  2. INSERT: Authenticated users can create KPIs in their organization
  3. UPDATE: Users can update KPIs from their organization
  4. DELETE: Users can delete KPIs from their organization

  **kpi_data_points table:**
  1. SELECT: Users can view data points for their organization's KPIs
  2. INSERT: Authenticated users can add data points to their organization's KPIs
  3. UPDATE: Users can update data points for their organization's KPIs
  4. DELETE: Users can delete data points for their organization's KPIs

  **kpi_summary_view:**
  - Uses security_invoker = true
  - Inherits RLS from kpis table automatically
  - No additional policies needed

  ## Usage Examples

  ### Query the summary view:
  ```sql
  SELECT * FROM kpi_summary_view;
  ```

  ### Insert a new KPI:
  ```sql
  INSERT INTO kpis (organization_id, name, target_value, unit, category)
  VALUES (
    get_current_organization_id(),
    'Total Emissions',
    1000,
    'tCO₂e',
    'emissions'
  );
  ```

  ### Record a data point:
  ```sql
  INSERT INTO kpi_data_points (kpi_id, value, recorded_date)
  VALUES (
    '<kpi-id>',
    850.5,
    CURRENT_DATE
  );
  ```

  ## Performance Considerations
  - Index on organization_id for fast tenant filtering
  - Index on kpi_id for efficient joins
  - Index on recorded_date for latest value queries
  - View uses DISTINCT ON for optimal latest-value selection
*/

-- =====================================================
-- PART 1: CREATE KPI TABLES
-- =====================================================

-- Table: kpis
-- Stores KPI definitions for each organization
CREATE TABLE IF NOT EXISTS public.kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_value numeric,
  unit text NOT NULL,
  category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add helpful comments
COMMENT ON TABLE public.kpis IS 
  'Stores Key Performance Indicator definitions for organizations. Each KPI tracks a specific metric with a target value.';

COMMENT ON COLUMN public.kpis.organization_id IS 
  'Foreign key to organizations table. Enables multi-tenant data isolation.';

COMMENT ON COLUMN public.kpis.target_value IS 
  'The goal or target value for this KPI. NULL if no target is set.';

COMMENT ON COLUMN public.kpis.unit IS 
  'Unit of measurement (e.g., "tCO₂e", "£", "%", "kWh")';

COMMENT ON COLUMN public.kpis.category IS 
  'Grouping category (e.g., "emissions", "financial", "operational", "energy")';

-- Table: kpi_data_points
-- Stores time-series data for each KPI
CREATE TABLE IF NOT EXISTS public.kpi_data_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  value numeric NOT NULL,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Add helpful comments
COMMENT ON TABLE public.kpi_data_points IS 
  'Stores historical data points for KPIs. Each row represents a measurement at a specific point in time.';

COMMENT ON COLUMN public.kpi_data_points.recorded_date IS 
  'The date this value was recorded or is effective for. Used to track historical trends.';

COMMENT ON COLUMN public.kpi_data_points.created_by IS 
  'User who created this data point. Optional tracking for audit purposes.';

-- =====================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for fast organization filtering on kpis
CREATE INDEX IF NOT EXISTS idx_kpis_organization_id 
  ON public.kpis(organization_id);

-- Index for fast KPI lookups on data points
CREATE INDEX IF NOT EXISTS idx_kpi_data_points_kpi_id 
  ON public.kpi_data_points(kpi_id);

-- Index for fast date-based queries (finding latest values)
CREATE INDEX IF NOT EXISTS idx_kpi_data_points_recorded_date 
  ON public.kpi_data_points(recorded_date DESC);

-- Composite index for optimal latest-value queries
CREATE INDEX IF NOT EXISTS idx_kpi_data_points_kpi_date 
  ON public.kpi_data_points(kpi_id, recorded_date DESC);

-- =====================================================
-- PART 3: ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on both tables
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_data_points ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 4: CREATE RLS POLICIES FOR KPIS TABLE
-- =====================================================

-- SELECT policy: Users can view KPIs from their organization
CREATE POLICY "Users can view KPIs from their organization"
  ON public.kpis
  FOR SELECT
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- INSERT policy: Users can create KPIs in their organization
CREATE POLICY "Users can create KPIs in their organization"
  ON public.kpis
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_current_organization_id());

-- UPDATE policy: Users can update KPIs from their organization
CREATE POLICY "Users can update KPIs from their organization"
  ON public.kpis
  FOR UPDATE
  TO authenticated
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- DELETE policy: Users can delete KPIs from their organization
CREATE POLICY "Users can delete KPIs from their organization"
  ON public.kpis
  FOR DELETE
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- =====================================================
-- PART 5: CREATE RLS POLICIES FOR KPI_DATA_POINTS TABLE
-- =====================================================

-- SELECT policy: Users can view data points for their organization's KPIs
CREATE POLICY "Users can view data points from their organization"
  ON public.kpi_data_points
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kpis
      WHERE kpis.id = kpi_data_points.kpi_id
      AND kpis.organization_id = get_current_organization_id()
    )
  );

-- INSERT policy: Users can create data points for their organization's KPIs
CREATE POLICY "Users can create data points for their organization"
  ON public.kpi_data_points
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kpis
      WHERE kpis.id = kpi_data_points.kpi_id
      AND kpis.organization_id = get_current_organization_id()
    )
  );

-- UPDATE policy: Users can update data points for their organization's KPIs
CREATE POLICY "Users can update data points from their organization"
  ON public.kpi_data_points
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kpis
      WHERE kpis.id = kpi_data_points.kpi_id
      AND kpis.organization_id = get_current_organization_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kpis
      WHERE kpis.id = kpi_data_points.kpi_id
      AND kpis.organization_id = get_current_organization_id()
    )
  );

-- DELETE policy: Users can delete data points for their organization's KPIs
CREATE POLICY "Users can delete data points from their organization"
  ON public.kpi_data_points
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kpis
      WHERE kpis.id = kpi_data_points.kpi_id
      AND kpis.organization_id = get_current_organization_id()
    )
  );

-- =====================================================
-- PART 6: CREATE KPI SUMMARY VIEW
-- =====================================================

-- Drop the view if it exists (for idempotency)
DROP VIEW IF EXISTS public.kpi_summary_view CASCADE;

-- Create the optimized summary view
-- This view shows each KPI with its most recent data point
CREATE VIEW public.kpi_summary_view
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (k.id)
  k.id as kpi_id,
  k.organization_id,
  k.name,
  k.description,
  kdp.value as current_value,
  k.target_value,
  k.unit,
  k.category,
  kdp.recorded_date as last_recorded_date,
  k.updated_at as last_updated
FROM public.kpis k
LEFT JOIN public.kpi_data_points kdp ON k.id = kdp.kpi_id
ORDER BY k.id, kdp.recorded_date DESC NULLS LAST;

-- Add comprehensive documentation
COMMENT ON VIEW public.kpi_summary_view IS 
  'Optimized view showing each KPI with its most recent data point. Uses security_invoker=true to inherit RLS from kpis table. Provides ready-to-display summary for dashboards showing current value, target, and metadata.';

-- =====================================================
-- PART 7: GRANT PERMISSIONS
-- =====================================================

-- Grant SELECT permission on tables to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_data_points TO authenticated;

-- Grant SELECT permission on view to authenticated users
GRANT SELECT ON public.kpi_summary_view TO authenticated;

-- =====================================================
-- PART 8: CREATE SAMPLE DATA (OPTIONAL - FOR TESTING)
-- =====================================================

-- Note: Sample data would be inserted via application code
-- This ensures proper organization_id association through RLS
-- Example structure (commented out):

-- INSERT INTO public.kpis (organization_id, name, target_value, unit, category)
-- VALUES 
--   (get_current_organization_id(), 'Total Emissions', 1000, 'tCO₂e', 'emissions'),
--   (get_current_organization_id(), 'Carbon Cost', 50000, '£', 'financial'),
--   (get_current_organization_id(), 'Reduction Target', 20, '%', 'target'),
--   (get_current_organization_id(), 'Progress', 100, '%', 'progress');
