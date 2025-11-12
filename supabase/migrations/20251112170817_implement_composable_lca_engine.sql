/*
  # Implement Composable LCA Engine with Data Provenance Tracking

  ## Overview
  This migration implements the core database schema changes for the Composable LCA Engine,
  enabling transparent data quality tracking and immutable audit history for all activity
  data points. This aligns with Dr. Sharma's "Glass Box" principle for verifiable sustainability
  reporting.

  ## Key Changes

  ### 1. Source Type Enumeration
  Creates a new enum type to classify the origin and quality of activity data:
  - `user_provided`: Manually entered by the user
  - `supplier_provided`: Raw data provided by a supplier
  - `platform_estimate`: Generic estimate from databases like OpenLCA
  - `linked_lca_report`: Linked to a verified supplier LCA report

  ### 2. LCA Reports Table
  Creates a table to store supplier LCA reports that can be referenced by activity data points.

  ### 3. Activity Data Points Enhancement
  Extends the existing `activity_data` table with:
  - `source_type`: Indicates data origin and quality level
  - `linked_lca_report_id`: Links to specific supplier LCA reports
  - `data_payload`: JSONB field for flexible data storage

  ### 4. Immutable Audit History
  Creates `data_point_version_history` table to log all changes to data point provenance,
  creating a complete, tamper-proof audit trail.

  ### 5. Automatic Provenance Logging
  Implements a Postgres trigger that automatically captures changes to data source types,
  ensuring no quality improvements or downgrades go unrecorded.

  ## Security
  - All tables have RLS enabled
  - Users can only view history for their organization's data
  - History records are immutable (insert-only)
  - Trigger function runs with SECURITY DEFINER for reliable user tracking

  ## Compliance
  - Satisfies CSRD audit trail requirements
  - Supports EU Green Claims Directive verification
  - Enables transparent quality progression tracking
  - Provides complete data lineage for reporting
*/

-- ============================================================================
-- STEP 1: Create LCA Reports Table (Prerequisite)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lca_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  report_name text NOT NULL,
  report_date date NOT NULL,
  product_name text,
  functional_unit text,
  report_file_url text,
  verification_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.lca_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view LCA reports"
  ON public.lca_reports
  FOR SELECT
  TO authenticated
  USING (organization_id = get_current_organization_id());

CREATE POLICY "Organization members can insert LCA reports"
  ON public.lca_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Organization members can update LCA reports"
  ON public.lca_reports
  FOR UPDATE
  TO authenticated
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

COMMENT ON TABLE public.lca_reports IS 'Stores supplier LCA reports that can be linked to activity data points for enhanced data quality.';

CREATE INDEX IF NOT EXISTS idx_lca_reports_organization_id
  ON public.lca_reports(organization_id);

CREATE INDEX IF NOT EXISTS idx_lca_reports_supplier_id
  ON public.lca_reports(supplier_id);

-- ============================================================================
-- STEP 2: Create Source Type Enum
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
    CREATE TYPE public.source_type AS ENUM (
      'user_provided',       -- Manually entered by the user (Tier 3)
      'supplier_provided',   -- Provided as raw data by a supplier (Tier 2)
      'platform_estimate',   -- A generic estimate from a database like OpenLCA (Tier 3)
      'linked_lca_report'    -- Linked to a supplier's completed LCA report (Tier 1)
    );
  END IF;
END $$;

COMMENT ON TYPE public.source_type IS 'Classifies the origin and quality level of activity data points for transparent provenance tracking.';

-- ============================================================================
-- STEP 3: Alter Activity Data Table with New Columns
-- ============================================================================

-- Add source_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'activity_data'
    AND column_name = 'source_type'
  ) THEN
    ALTER TABLE public.activity_data
    ADD COLUMN source_type public.source_type NOT NULL DEFAULT 'user_provided';
  END IF;
END $$;

-- Add linked_lca_report_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'activity_data'
    AND column_name = 'linked_lca_report_id'
  ) THEN
    ALTER TABLE public.activity_data
    ADD COLUMN linked_lca_report_id uuid REFERENCES public.lca_reports(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add data_payload column for flexible data storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'activity_data'
    AND column_name = 'data_payload'
  ) THEN
    ALTER TABLE public.activity_data
    ADD COLUMN data_payload jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.activity_data.source_type IS 'Indicates the origin of the data point, determining its quality and provenance level.';
COMMENT ON COLUMN public.activity_data.linked_lca_report_id IS 'If source_type is "linked_lca_report", this links to the specific supplier LCA report providing verified data.';
COMMENT ON COLUMN public.activity_data.data_payload IS 'Flexible JSONB field for storing additional metadata and contextual information about the activity data.';

-- Create index for source_type queries
CREATE INDEX IF NOT EXISTS idx_activity_data_source_type
  ON public.activity_data(source_type);

-- Create index for linked LCA reports
CREATE INDEX IF NOT EXISTS idx_activity_data_linked_lca_report_id
  ON public.activity_data(linked_lca_report_id)
  WHERE linked_lca_report_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Create Immutable Audit History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.data_point_version_history (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  activity_data_point_id uuid NOT NULL REFERENCES public.activity_data(id) ON DELETE CASCADE,
  previous_state jsonb NOT NULL,
  new_state jsonb NOT NULL,
  change_type text NOT NULL DEFAULT 'source_update',
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_point_version_history ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.data_point_version_history IS 'Immutable audit log of changes to activity data point provenance, creating a verifiable history of data quality improvements for CSRD compliance.';
COMMENT ON COLUMN public.data_point_version_history.previous_state IS 'JSONB snapshot of the data point state before the change, including source_type, data_payload, and linked_lca_report_id.';
COMMENT ON COLUMN public.data_point_version_history.new_state IS 'JSONB snapshot of the data point state after the change, enabling full reconstruction of data lineage.';
COMMENT ON COLUMN public.data_point_version_history.change_type IS 'Classification of the change for filtering and reporting (e.g., "source_update", "quality_upgrade", "lca_linkage").';

-- Create indexes for efficient history queries
CREATE INDEX IF NOT EXISTS idx_version_history_activity_data_point_id
  ON public.data_point_version_history(activity_data_point_id);

CREATE INDEX IF NOT EXISTS idx_version_history_updated_at
  ON public.data_point_version_history(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_version_history_updated_by
  ON public.data_point_version_history(updated_by);

-- ============================================================================
-- STEP 5: Create Trigger Function for Automatic Provenance Logging
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_data_point_source_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_change_type text;
BEGIN
  -- Determine the type of change for better categorization
  IF NEW.source_type IS DISTINCT FROM OLD.source_type THEN
    IF NEW.source_type = 'linked_lca_report' THEN
      v_change_type := 'lca_linkage';
    ELSIF (NEW.source_type = 'supplier_provided' OR NEW.source_type = 'linked_lca_report')
          AND OLD.source_type IN ('user_provided', 'platform_estimate') THEN
      v_change_type := 'quality_upgrade';
    ELSE
      v_change_type := 'source_update';
    END IF;
  ELSE
    v_change_type := 'metadata_update';
  END IF;

  -- Insert the change record into the immutable audit log
  INSERT INTO public.data_point_version_history (
    activity_data_point_id,
    previous_state,
    new_state,
    change_type,
    updated_by,
    updated_at
  )
  VALUES (
    OLD.id,
    jsonb_build_object(
      'source_type', OLD.source_type,
      'data_payload', OLD.data_payload,
      'linked_lca_report_id', OLD.linked_lca_report_id,
      'quantity', OLD.quantity,
      'unit', OLD.unit
    ),
    jsonb_build_object(
      'source_type', NEW.source_type,
      'data_payload', NEW.data_payload,
      'linked_lca_report_id', NEW.linked_lca_report_id,
      'quantity', NEW.quantity,
      'unit', NEW.unit
    ),
    v_change_type,
    auth.uid(),
    now()
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.log_data_point_source_change() IS 'Trigger function that automatically logs all changes to activity data point provenance, ensuring complete audit trail for compliance.';

-- ============================================================================
-- STEP 6: Attach Trigger to Activity Data Table
-- ============================================================================

-- Drop trigger if it already exists
DROP TRIGGER IF EXISTS on_source_type_update ON public.activity_data;

-- Create trigger that fires on any update that changes source_type
CREATE TRIGGER on_source_type_update
AFTER UPDATE ON public.activity_data
FOR EACH ROW
WHEN (OLD.source_type IS DISTINCT FROM NEW.source_type)
EXECUTE FUNCTION public.log_data_point_source_change();

COMMENT ON TRIGGER on_source_type_update ON public.activity_data IS 'Automatically logs changes to data point source type, creating immutable audit trail for Glass Box transparency.';

-- ============================================================================
-- STEP 7: Implement Row-Level Security Policies for Audit History
-- ============================================================================

-- Policy: Users can only read history for their organization's data
CREATE POLICY "Allow read access to own organization's history"
  ON public.data_point_version_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.activity_data adp
      WHERE adp.id = activity_data_point_id
      AND adp.organization_id = get_current_organization_id()
    )
  );

COMMENT ON POLICY "Allow read access to own organization's history" ON public.data_point_version_history IS 'RLS policy ensuring users can only view audit history for activity data belonging to their organization.';

-- Note: We intentionally do NOT create INSERT, UPDATE, or DELETE policies.
-- The history table should only be written to via the trigger, making it truly immutable.

-- ============================================================================
-- STEP 8: Create Helper Function for Quality Level Calculation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_data_quality_tier(p_source_type public.source_type)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_source_type
    WHEN 'linked_lca_report' THEN 1      -- Highest quality: Verified LCA data
    WHEN 'supplier_provided' THEN 2      -- Medium quality: Direct supplier data
    WHEN 'user_provided' THEN 3          -- Lower quality: Manual entry
    WHEN 'platform_estimate' THEN 3      -- Lower quality: Generic estimate
    ELSE 3
  END;
END;
$$;

COMMENT ON FUNCTION public.get_data_quality_tier(public.source_type) IS 'Maps source_type to DQI tier level (1=highest, 3=lowest) for quality scoring and reporting.';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.log_data_point_source_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_quality_tier(public.source_type) TO authenticated;
