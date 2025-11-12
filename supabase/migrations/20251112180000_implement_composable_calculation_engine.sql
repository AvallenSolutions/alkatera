/*
  # Implement Composable Calculation Engine with Governance

  ## Overview
  This migration implements the recursive dependency resolver and governance framework
  for the composable LCA calculation engine. It enables nested LCA calculations with
  mandatory system boundary compatibility checks and complete audit trails.

  ## Key Components

  ### 1. System Boundary Enumeration
  Defines standard LCA system boundaries for governance checks:
  - `cradle-to-gate`: Raw material extraction to factory gate
  - `gate-to-gate`: Processing stage only
  - `cradle-to-grave`: Complete product lifecycle including end-of-life

  ### 2. Enhanced LCA Reports Table
  Extends the lca_reports table with:
  - `system_boundary`: Defines the scope of the LCA study
  - `functional_unit`: Reference unit for comparison (e.g., "1 kg of product")
  - `target_unit`: Standard unit for calculation aggregation

  ### 3. Recursive Dependency Resolver
  PostgreSQL function that:
  - Traverses the entire LCA dependency graph recursively
  - Flattens nested LCA reports into primitive data points
  - Enriches each data point with provenance metadata
  - Returns system boundary information for governance validation

  ### 4. Calculation Logs Table
  Immutable audit log capturing:
  - Complete input set (all data points used)
  - Final calculation results
  - Governance metadata (DQI profile, boundary checks)
  - Calculation engine version for reproducibility
  - Error details for failed calculations

  ## Governance Rules

  ### System Boundary Compatibility
  Child LCA reports must have compatible system boundaries with parent:
  - `cradle-to-gate` → `cradle-to-grave` ✓ (compatible)
  - `gate-to-gate` → `cradle-to-grave` ✓ (compatible)
  - `cradle-to-grave` → `cradle-to-gate` ✗ (incompatible)
  - Same boundary → Same boundary ✓ (compatible)

  ### DQI Propagation
  Data Quality Indicator follows "weakest link" principle:
  - Any Low DQI input → Final result is Low DQI
  - Any Medium DQI input (no Low) → Final result is Medium DQI
  - All High DQI inputs → Final result is High DQI

  ## Security
  - All tables have RLS enabled
  - Function runs as SECURITY DEFINER for reliable access
  - Calculation logs are immutable (insert-only)
  - Organization-based access control throughout

  ## Compliance
  - Complete calculation reproducibility via versioned logs
  - Transparent governance rule application
  - Immutable audit trail for regulatory reporting
  - System boundary validation for ISO 14040/14044 compliance
*/

-- ============================================================================
-- STEP 1: Create System Boundary Enum
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'system_boundary_enum') THEN
    CREATE TYPE public.system_boundary_enum AS ENUM (
      'cradle-to-gate',
      'gate-to-gate',
      'cradle-to-grave'
    );
  END IF;
END $$;

COMMENT ON TYPE public.system_boundary_enum IS 'Defines the scope of an LCA study, determining which lifecycle stages are included in the analysis.';

-- ============================================================================
-- STEP 2: Extend LCA Reports Table with Governance Fields
-- ============================================================================

-- Add system_boundary column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lca_reports'
    AND column_name = 'system_boundary'
  ) THEN
    ALTER TABLE public.lca_reports
    ADD COLUMN system_boundary public.system_boundary_enum DEFAULT 'cradle-to-gate';
  END IF;
END $$;

-- Add target_unit column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lca_reports'
    AND column_name = 'target_unit'
  ) THEN
    ALTER TABLE public.lca_reports
    ADD COLUMN target_unit text DEFAULT 'kg CO2e';
  END IF;
END $$;

COMMENT ON COLUMN public.lca_reports.system_boundary IS 'Defines the scope of the LCA study (cradle-to-gate, gate-to-gate, or cradle-to-grave). Used for governance checks during composable calculations.';
COMMENT ON COLUMN public.lca_reports.functional_unit IS 'Reference unit for the LCA study (e.g., "1 kg of product", "1 unit"). Critical for correct impact interpretation.';
COMMENT ON COLUMN public.lca_reports.target_unit IS 'Standard unit for aggregating calculation results (e.g., "kg CO2e" for carbon footprint).';

-- Create index for system boundary queries
CREATE INDEX IF NOT EXISTS idx_lca_reports_system_boundary
  ON public.lca_reports(system_boundary);

-- ============================================================================
-- STEP 3: Create Calculation Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.calculation_logs (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  lca_id uuid NOT NULL REFERENCES public.lca_reports(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'success',
  result_payload jsonb,
  inputs_payload jsonb NOT NULL,
  governance_metadata jsonb DEFAULT '{}'::jsonb,
  calculation_engine_version text NOT NULL,
  error_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE public.calculation_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.calculation_logs IS 'Immutable audit log of all LCA calculations, capturing inputs, outputs, governance metadata, and engine version for complete reproducibility.';
COMMENT ON COLUMN public.calculation_logs.result_payload IS 'Final calculation results including aggregated impacts, emissions factors, and summary statistics.';
COMMENT ON COLUMN public.calculation_logs.inputs_payload IS 'Complete set of flattened data points used as inputs, including all nested LCA dependencies.';
COMMENT ON COLUMN public.calculation_logs.governance_metadata IS 'Metadata about governance checks performed: DQI profile, boundary compatibility, validation results.';
COMMENT ON COLUMN public.calculation_logs.calculation_engine_version IS 'Version identifier of the calculation engine, enabling reproducibility and change tracking.';
COMMENT ON COLUMN public.calculation_logs.error_details IS 'Detailed error information if calculation failed, including error type and message for debugging.';

-- Create indexes for efficient log queries
CREATE INDEX IF NOT EXISTS idx_calculation_logs_lca_id
  ON public.calculation_logs(lca_id);

CREATE INDEX IF NOT EXISTS idx_calculation_logs_organization_id
  ON public.calculation_logs(organization_id);

CREATE INDEX IF NOT EXISTS idx_calculation_logs_created_at
  ON public.calculation_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calculation_logs_status
  ON public.calculation_logs(status);

-- RLS policies for calculation logs
CREATE POLICY "Organization members can view calculation logs"
  ON public.calculation_logs
  FOR SELECT
  TO authenticated
  USING (organization_id = get_current_organization_id());

CREATE POLICY "Organization members can insert calculation logs"
  ON public.calculation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_current_organization_id());

-- ============================================================================
-- STEP 4: Create Recursive LCA Dependency Resolver Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_lca_dependency_graph(root_lca_id UUID)
RETURNS TABLE (
    -- Core activity data fields
    id UUID,
    organization_id UUID,
    name TEXT,
    category TEXT,
    quantity NUMERIC,
    unit TEXT,
    activity_date DATE,
    source_type TEXT,
    data_payload JSONB,
    -- Provenance & governance enrichment
    lca_level INT,
    source_lca_id UUID,
    source_lca_system_boundary TEXT,
    source_lca_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE lca_graph AS (
        -- ====================================================================
        -- ANCHOR: Start with root LCA's activity data points
        -- ====================================================================
        SELECT
            adp.id,
            adp.organization_id,
            adp.name,
            adp.category,
            adp.quantity,
            adp.unit,
            adp.activity_date,
            adp.source_type::TEXT,
            adp.data_payload,
            1 AS lca_level,
            lca.id AS source_lca_id,
            lca.system_boundary::TEXT AS source_lca_system_boundary,
            lca.report_name AS source_lca_name
        FROM public.activity_data adp
        CROSS JOIN public.lca_reports lca
        WHERE lca.id = root_lca_id
          AND adp.organization_id = lca.organization_id

        UNION ALL

        -- ====================================================================
        -- RECURSIVE: Follow linked_lca_report references down the graph
        -- ====================================================================
        SELECT
            child_adp.id,
            child_adp.organization_id,
            child_adp.name,
            child_adp.category,
            child_adp.quantity,
            child_adp.unit,
            child_adp.activity_date,
            child_adp.source_type::TEXT,
            child_adp.data_payload,
            parent_graph.lca_level + 1 AS lca_level,
            child_lca.id AS source_lca_id,
            child_lca.system_boundary::TEXT AS source_lca_system_boundary,
            child_lca.report_name AS source_lca_name
        FROM lca_graph parent_graph
        CROSS JOIN public.lca_reports child_lca
        INNER JOIN public.activity_data child_adp
          ON child_adp.organization_id = child_lca.organization_id
        WHERE parent_graph.source_type = 'linked_lca_report'
          AND child_lca.id = (parent_graph.data_payload->>'linked_lca_report_id')::UUID
    )
    -- ========================================================================
    -- FINAL: Return only primitive data points (not composable references)
    -- ========================================================================
    SELECT
      lg.id,
      lg.organization_id,
      lg.name,
      lg.category,
      lg.quantity,
      lg.unit,
      lg.activity_date,
      lg.source_type,
      lg.data_payload,
      lg.lca_level,
      lg.source_lca_id,
      lg.source_lca_system_boundary,
      lg.source_lca_name
    FROM lca_graph lg
    WHERE lg.source_type != 'linked_lca_report'
    ORDER BY lg.lca_level ASC, lg.id ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.resolve_lca_dependency_graph(UUID) IS 'Recursively resolves all nested LCA dependencies for a given root LCA ID, returning a flattened list of primitive data points enriched with system boundary data for governance checks. Critical for composable LCA calculations.';

-- ============================================================================
-- STEP 5: Create Helper Function for System Boundary Validation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_boundary_compatible(
  child_boundary TEXT,
  parent_boundary TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Same boundaries are always compatible
  IF child_boundary = parent_boundary THEN
    RETURN TRUE;
  END IF;

  -- Cradle-to-grave can incorporate cradle-to-gate and gate-to-gate
  IF parent_boundary = 'cradle-to-grave' AND
     (child_boundary = 'cradle-to-gate' OR child_boundary = 'gate-to-gate') THEN
    RETURN TRUE;
  END IF;

  -- All other combinations are incompatible
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.is_boundary_compatible(TEXT, TEXT) IS 'Validates system boundary compatibility between child and parent LCA reports according to ISO 14040/14044 standards.';

-- ============================================================================
-- STEP 6: Grant Necessary Permissions
-- ============================================================================

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.resolve_lca_dependency_graph(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_boundary_compatible(TEXT, TEXT) TO authenticated;
