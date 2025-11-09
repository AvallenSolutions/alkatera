/*
  # Create GHG Emissions Tracking System with Hotspots View

  ## Overview
  This migration creates the complete GHG (Greenhouse Gas) emissions tracking system
  following the GHG Protocol Corporate Standard. It establishes the data model for
  tracking emissions across three scopes and provides an aggregated hotspots view
  for dashboard display.

  ## Problem Being Solved
  Organizations need to:
  - Track GHG emissions across Scope 1, 2, and 3 categories
  - Aggregate emissions by category to identify hotspots
  - View latest reporting period data
  - Ensure multi-tenant data isolation
  - Query emissions summaries efficiently for dashboards

  ## Solution Architecture

  ### Part 1: GHG Emissions Tables
  Creates two core tables:
  1. `ghg_categories` - Defines emission categories and scope mappings
  2. `ghg_emissions` - Stores emissions data by category and period

  ### Part 2: GHG Hotspots View
  Creates `ghg_hotspots_view` that:
  - Aggregates emissions by category for latest reporting period
  - Shows scope, category name, and total emissions
  - Calculates percentage of total emissions
  - Inherits RLS from base tables
  - Optimized for dashboard display

  ### Part 3: Security (RLS)
  - All tables use organization_id for tenant isolation
  - Policies use get_current_organization_id() as single source of truth
  - View inherits security automatically via security_invoker
  - Users only see their organization's emissions

  ## GHG Protocol Scopes

  ### Scope 1: Direct Emissions
  - Stationary combustion (boilers, furnaces)
  - Mobile combustion (company vehicles)
  - Process emissions (manufacturing)
  - Fugitive emissions (refrigerants, leaks)

  ### Scope 2: Indirect Emissions (Energy)
  - Purchased electricity
  - Purchased heat
  - Purchased steam
  - Purchased cooling

  ### Scope 3: Other Indirect Emissions
  - Purchased goods and services
  - Business travel
  - Employee commuting
  - Waste disposal
  - Use of sold products
  - Transportation and distribution

  ## Tables Created

  ### 1. ghg_categories
  Reference table for emission categories
  
  Columns:
  - id (uuid, PK): Unique identifier
  - scope (int): GHG Protocol scope (1, 2, or 3)
  - name (text): Category name
  - description (text): Detailed explanation
  - emission_factor_unit (text): Unit for emission factors
  - is_active (boolean): Whether category is in use

  ### 2. ghg_emissions
  Stores emissions data by category and reporting period
  
  Columns:
  - id (uuid, PK): Unique identifier
  - organization_id (uuid, FK): Which organization owns this emission
  - category_id (uuid, FK): Which emission category
  - reporting_period (text): Period identifier (e.g., "2024-Q1", "2024")
  - activity_amount (numeric): Amount of activity (e.g., kWh, km)
  - activity_unit (text): Unit of activity
  - emission_factor (numeric): CO₂e per unit of activity
  - total_emissions (numeric): Total tCO₂e for this entry
  - recorded_date (date): When emission was recorded
  - notes (text): Additional context
  - created_at (timestamptz): When record was created
  - created_by (uuid, FK): Who created this record

  ### 3. ghg_hotspots_view (VIEW)
  Aggregated emissions by category for latest period
  
  Columns:
  - organization_id (uuid): Organization identifier
  - reporting_period (text): Latest reporting period
  - scope (int): GHG scope (1, 2, or 3)
  - category_name (text): Emission category name
  - total_emissions (numeric): Sum of emissions in tCO₂e
  - percentage_of_total (numeric): Percentage of organization's total
  - emission_count (bigint): Number of emission records

  ## Security Model

  ### RLS Policies Created

  **ghg_categories table:**
  - Public reference data (no RLS needed)
  - All authenticated users can read

  **ghg_emissions table:**
  1. SELECT: Users can view emissions from their organization
  2. INSERT: Authenticated users can create emissions in their organization
  3. UPDATE: Users can update emissions from their organization
  4. DELETE: Users can delete emissions from their organization

  **ghg_hotspots_view:**
  - Uses security_invoker = true
  - Inherits RLS from ghg_emissions table automatically
  - No additional policies needed

  ## Performance Considerations
  - Index on organization_id for fast tenant filtering
  - Index on category_id for efficient joins
  - Index on reporting_period for latest period queries
  - Composite indexes for aggregation optimization
*/

-- =====================================================
-- PART 1: CREATE GHG CATEGORIES TABLE (REFERENCE DATA)
-- =====================================================

-- Table: ghg_categories
-- Reference table for emission categories following GHG Protocol
CREATE TABLE IF NOT EXISTS public.ghg_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope int NOT NULL CHECK (scope IN (1, 2, 3)),
  name text NOT NULL UNIQUE,
  description text,
  emission_factor_unit text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ghg_categories IS 
  'Reference table for GHG emission categories following the GHG Protocol Corporate Standard. Maps categories to Scope 1, 2, or 3.';

COMMENT ON COLUMN public.ghg_categories.scope IS 
  'GHG Protocol scope: 1 (Direct), 2 (Indirect Energy), 3 (Other Indirect)';

COMMENT ON COLUMN public.ghg_categories.emission_factor_unit IS 
  'Standard unit for emission factors (e.g., "kgCO2e/kWh", "kgCO2e/km")';

-- =====================================================
-- PART 2: CREATE GHG EMISSIONS TABLE
-- =====================================================

-- Table: ghg_emissions
-- Stores emissions data by category and reporting period
CREATE TABLE IF NOT EXISTS public.ghg_emissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.ghg_categories(id) ON DELETE RESTRICT,
  reporting_period text NOT NULL,
  activity_amount numeric NOT NULL,
  activity_unit text NOT NULL,
  emission_factor numeric NOT NULL,
  total_emissions numeric NOT NULL,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  
  CONSTRAINT positive_activity CHECK (activity_amount >= 0),
  CONSTRAINT positive_emission_factor CHECK (emission_factor >= 0),
  CONSTRAINT positive_total_emissions CHECK (total_emissions >= 0)
);

COMMENT ON TABLE public.ghg_emissions IS 
  'Stores greenhouse gas emissions data by category and reporting period. Follows GHG Protocol calculation methodology.';

COMMENT ON COLUMN public.ghg_emissions.reporting_period IS 
  'Period identifier (e.g., "2024-Q1", "2024-Q2", "2024"). Used to group emissions for reporting.';

COMMENT ON COLUMN public.ghg_emissions.activity_amount IS 
  'Quantity of activity that generated emissions (e.g., 1000 kWh, 500 km)';

COMMENT ON COLUMN public.ghg_emissions.emission_factor IS 
  'Conversion factor in kgCO₂e per activity unit. Used to calculate total emissions.';

COMMENT ON COLUMN public.ghg_emissions.total_emissions IS 
  'Calculated total emissions in tCO₂e (tonnes of CO₂ equivalent). Typically activity_amount * emission_factor / 1000.';

-- =====================================================
-- PART 3: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for fast organization filtering
CREATE INDEX IF NOT EXISTS idx_ghg_emissions_organization_id 
  ON public.ghg_emissions(organization_id);

-- Index for category lookups
CREATE INDEX IF NOT EXISTS idx_ghg_emissions_category_id 
  ON public.ghg_emissions(category_id);

-- Index for reporting period queries
CREATE INDEX IF NOT EXISTS idx_ghg_emissions_reporting_period 
  ON public.ghg_emissions(reporting_period);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_ghg_emissions_recorded_date 
  ON public.ghg_emissions(recorded_date DESC);

-- Composite index for optimal aggregation queries
CREATE INDEX IF NOT EXISTS idx_ghg_emissions_org_period 
  ON public.ghg_emissions(organization_id, reporting_period);

-- Index on scope for category filtering
CREATE INDEX IF NOT EXISTS idx_ghg_categories_scope 
  ON public.ghg_categories(scope);

-- =====================================================
-- PART 4: ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on ghg_emissions (categories are reference data, no RLS needed)
ALTER TABLE public.ghg_emissions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 5: CREATE RLS POLICIES FOR GHG_EMISSIONS TABLE
-- =====================================================

-- SELECT policy: Users can view emissions from their organization
CREATE POLICY "Users can view emissions from their organization"
  ON public.ghg_emissions
  FOR SELECT
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- INSERT policy: Users can create emissions in their organization
CREATE POLICY "Users can create emissions in their organization"
  ON public.ghg_emissions
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_current_organization_id());

-- UPDATE policy: Users can update emissions from their organization
CREATE POLICY "Users can update emissions from their organization"
  ON public.ghg_emissions
  FOR UPDATE
  TO authenticated
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- DELETE policy: Users can delete emissions from their organization
CREATE POLICY "Users can delete emissions from their organization"
  ON public.ghg_emissions
  FOR DELETE
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- =====================================================
-- PART 6: CREATE GHG HOTSPOTS VIEW
-- =====================================================

-- Drop the view if it exists (for idempotency)
DROP VIEW IF EXISTS public.ghg_hotspots_view CASCADE;

-- Create the optimized hotspots view
-- Shows aggregated emissions by category for the latest reporting period
CREATE VIEW public.ghg_hotspots_view
WITH (security_invoker = true)
AS
WITH latest_period AS (
  SELECT 
    organization_id,
    MAX(reporting_period) as latest_period
  FROM public.ghg_emissions
  GROUP BY organization_id
),
org_totals AS (
  SELECT 
    e.organization_id,
    e.reporting_period,
    SUM(e.total_emissions) as org_total_emissions
  FROM public.ghg_emissions e
  INNER JOIN latest_period lp 
    ON e.organization_id = lp.organization_id 
    AND e.reporting_period = lp.latest_period
  GROUP BY e.organization_id, e.reporting_period
)
SELECT 
  e.organization_id,
  e.reporting_period,
  c.scope,
  c.name as category_name,
  SUM(e.total_emissions) as total_emissions,
  ROUND(
    (SUM(e.total_emissions) / NULLIF(ot.org_total_emissions, 0) * 100)::numeric, 
    2
  ) as percentage_of_total,
  COUNT(e.id) as emission_count
FROM public.ghg_emissions e
INNER JOIN latest_period lp 
  ON e.organization_id = lp.organization_id 
  AND e.reporting_period = lp.latest_period
INNER JOIN public.ghg_categories c ON e.category_id = c.id
INNER JOIN org_totals ot 
  ON e.organization_id = ot.organization_id 
  AND e.reporting_period = ot.reporting_period
WHERE c.is_active = true
GROUP BY 
  e.organization_id, 
  e.reporting_period, 
  c.scope, 
  c.name,
  ot.org_total_emissions
ORDER BY total_emissions DESC;

COMMENT ON VIEW public.ghg_hotspots_view IS 
  'Aggregated view of GHG emissions by category for the latest reporting period. Shows emission hotspots with percentages. Uses security_invoker=true to inherit RLS from ghg_emissions table.';

-- =====================================================
-- PART 7: GRANT PERMISSIONS
-- =====================================================

-- Grant permissions on tables
GRANT SELECT ON public.ghg_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghg_emissions TO authenticated;

-- Grant SELECT permission on view
GRANT SELECT ON public.ghg_hotspots_view TO authenticated;

-- =====================================================
-- PART 8: SEED REFERENCE DATA (GHG CATEGORIES)
-- =====================================================

-- Insert standard GHG Protocol categories
-- These are reference data available to all organizations

-- Scope 1: Direct Emissions
INSERT INTO public.ghg_categories (scope, name, description, emission_factor_unit) VALUES
  (1, 'Stationary Combustion', 'Emissions from fuel burned in stationary equipment (boilers, furnaces, etc.)', 'kgCO2e/kWh'),
  (1, 'Mobile Combustion', 'Emissions from fuel burned in company-owned or controlled vehicles', 'kgCO2e/km'),
  (1, 'Fugitive Emissions', 'Intentional or unintentional releases (refrigerants, natural gas leaks)', 'kgCO2e/kg'),
  (1, 'Process Emissions', 'Emissions from physical or chemical processes (manufacturing, etc.)', 'kgCO2e/unit')
ON CONFLICT (name) DO NOTHING;

-- Scope 2: Indirect Emissions from Energy
INSERT INTO public.ghg_categories (scope, name, description, emission_factor_unit) VALUES
  (2, 'Purchased Electricity', 'Emissions from purchased electricity consumption', 'kgCO2e/kWh'),
  (2, 'Purchased Heat', 'Emissions from purchased heat or steam', 'kgCO2e/kWh'),
  (2, 'Purchased Cooling', 'Emissions from purchased cooling', 'kgCO2e/kWh')
ON CONFLICT (name) DO NOTHING;

-- Scope 3: Other Indirect Emissions
INSERT INTO public.ghg_categories (scope, name, description, emission_factor_unit) VALUES
  (3, 'Purchased Goods and Services', 'Emissions from production of purchased goods and services', 'kgCO2e/£'),
  (3, 'Business Travel', 'Emissions from employee business travel in vehicles not owned by the organization', 'kgCO2e/km'),
  (3, 'Employee Commuting', 'Emissions from employee commuting to and from work', 'kgCO2e/km'),
  (3, 'Waste Disposal', 'Emissions from disposal and treatment of waste', 'kgCO2e/kg'),
  (3, 'Upstream Transportation', 'Emissions from transportation and distribution of purchased products', 'kgCO2e/tonne-km'),
  (3, 'Downstream Transportation', 'Emissions from transportation and distribution of sold products', 'kgCO2e/tonne-km'),
  (3, 'Use of Sold Products', 'Emissions from use of sold products by end users', 'kgCO2e/unit'),
  (3, 'End-of-Life Treatment', 'Emissions from disposal and treatment of sold products at end of life', 'kgCO2e/unit')
ON CONFLICT (name) DO NOTHING;
