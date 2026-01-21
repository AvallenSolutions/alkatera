/*
  # Create Production Allocation Hub Support Objects

  This migration creates the database objects needed for the Production Allocation Hub page:

  1. New Tables
    - `facility_product_assignments` - Links facilities to products they can produce

  2. New Views
    - `facility_product_allocation_matrix` - Matrix view for allocation status display

  3. New Functions
    - `get_facility_unallocated_capacity` - Returns unallocated emissions per facility

  ## Notes
  - Supports the Production Allocation Hub page at /company/production-allocation
  - Combines data from owned facilities and contract manufacturers
  - Provides allocation health metrics and status tracking
*/

-- ============================================================================
-- Create facility_product_assignments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.facility_product_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  assignment_status TEXT NOT NULL DEFAULT 'active' CHECK (assignment_status IN ('active', 'paused', 'archived')),
  is_primary_facility BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_facility_product_assignment UNIQUE (facility_id, product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fpa_organization_id ON facility_product_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_fpa_facility_id ON facility_product_assignments(facility_id);
CREATE INDEX IF NOT EXISTS idx_fpa_product_id ON facility_product_assignments(product_id);

-- Add comments
COMMENT ON TABLE public.facility_product_assignments IS 'Links facilities to products they are assigned to produce';
COMMENT ON COLUMN public.facility_product_assignments.assignment_status IS 'Current status of the assignment: active, paused, or archived';
COMMENT ON COLUMN public.facility_product_assignments.is_primary_facility IS 'Whether this is the primary production facility for the product';

-- Enable RLS
ALTER TABLE public.facility_product_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view assignments for their organization"
  ON facility_product_assignments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    OR
    organization_id IN (
      SELECT organization_id FROM advisor_organization_access
      WHERE advisor_user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can create assignments for their organization"
  ON facility_product_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update assignments for their organization"
  ON facility_product_assignments FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete assignments for their organization"
  ON facility_product_assignments FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Create facility_product_allocation_matrix view
-- ============================================================================

CREATE OR REPLACE VIEW public.facility_product_allocation_matrix AS
WITH
-- Get all facility-product combinations from assignments
assignments AS (
  SELECT
    fpa.id AS assignment_id,
    fpa.organization_id,
    fpa.facility_id,
    fpa.product_id,
    fpa.assignment_status,
    fpa.is_primary_facility
  FROM facility_product_assignments fpa
  WHERE fpa.assignment_status = 'active'
),

-- Get the latest allocation from contract_manufacturer_allocations
cm_allocations AS (
  SELECT DISTINCT ON (facility_id, product_id)
    cma.organization_id,
    cma.facility_id,
    cma.product_id,
    cma.id AS allocation_id,
    cma.allocated_emissions_kg_co2e,
    cma.reporting_period_start,
    cma.reporting_period_end,
    cma.status,
    cma.attribution_ratio,
    'contract_manufacturer' AS allocation_type
  FROM contract_manufacturer_allocations cma
  ORDER BY facility_id, product_id, reporting_period_end DESC
),

-- Get the latest allocation from product_lca_production_sites (owned facilities)
owned_allocations AS (
  SELECT DISTINCT ON (ps.facility_id, pl.product_id)
    ps.organization_id,
    ps.facility_id,
    pl.product_id,
    ps.id AS allocation_id,
    ps.allocated_emissions_kg_co2e,
    ps.reporting_period_start,
    ps.reporting_period_end,
    ps.status,
    ps.attribution_ratio,
    'owned' AS allocation_type
  FROM product_lca_production_sites ps
  JOIN product_lcas pl ON pl.id = ps.product_lca_id
  ORDER BY ps.facility_id, pl.product_id, ps.reporting_period_end DESC NULLS LAST
),

-- Combine all allocations
all_allocations AS (
  SELECT * FROM cm_allocations
  UNION ALL
  SELECT * FROM owned_allocations
),

-- Get the latest allocation per facility-product pair
latest_allocations AS (
  SELECT DISTINCT ON (facility_id, product_id)
    organization_id,
    facility_id,
    product_id,
    allocation_id,
    allocated_emissions_kg_co2e,
    reporting_period_start,
    reporting_period_end,
    status,
    attribution_ratio,
    allocation_type
  FROM all_allocations
  ORDER BY facility_id, product_id, reporting_period_end DESC NULLS LAST
)

-- Final matrix combining assignments with allocations
SELECT
  a.assignment_id,
  COALESCE(a.organization_id, la.organization_id) AS organization_id,
  COALESCE(a.facility_id, la.facility_id) AS facility_id,
  COALESCE(a.product_id, la.product_id) AS product_id,
  f.name AS facility_name,
  f.address_city,
  f.address_country,
  f.operational_control,
  p.name AS product_name,
  a.assignment_status,
  a.is_primary_facility AS primary_facility,
  la.allocation_id IS NOT NULL AS has_allocations,
  la.allocation_type,
  CASE
    WHEN la.allocation_id IS NOT NULL THEN
      jsonb_build_object(
        'allocated_emissions', COALESCE(la.allocated_emissions_kg_co2e, 0),
        'reporting_period_start', la.reporting_period_start,
        'reporting_period_end', la.reporting_period_end,
        'status', la.status,
        'attribution_ratio', COALESCE(la.attribution_ratio, 0)
      )
    ELSE NULL
  END AS latest_allocation
FROM assignments a
FULL OUTER JOIN latest_allocations la
  ON a.facility_id = la.facility_id
  AND a.product_id = la.product_id
LEFT JOIN facilities f ON f.id = COALESCE(a.facility_id, la.facility_id)
LEFT JOIN products p ON p.id = COALESCE(a.product_id, la.product_id)
WHERE COALESCE(a.organization_id, la.organization_id) IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON public.facility_product_allocation_matrix TO authenticated;

COMMENT ON VIEW public.facility_product_allocation_matrix IS 'Matrix view showing facility-product assignments and their allocation status for the Production Allocation Hub';

-- ============================================================================
-- Create get_facility_unallocated_capacity function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_facility_unallocated_capacity(p_organization_id UUID)
RETURNS TABLE (
  facility_id UUID,
  facility_name TEXT,
  total_emissions_kg_co2e NUMERIC,
  allocated_emissions_kg_co2e NUMERIC,
  unallocated_emissions_kg_co2e NUMERIC,
  allocation_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH facility_totals AS (
    -- Get total emissions per facility from the most recent aggregated data
    SELECT DISTINCT ON (fea.facility_id)
      fea.facility_id,
      f.name AS facility_name,
      COALESCE(fea.total_co2e, 0) AS total_emissions
    FROM facility_emissions_aggregated fea
    JOIN facilities f ON f.id = fea.facility_id
    WHERE fea.organization_id = p_organization_id
    ORDER BY fea.facility_id, fea.reporting_period_end DESC
  ),

  facility_allocated AS (
    -- Get total allocated emissions per facility from contract manufacturer allocations
    SELECT
      cma.facility_id,
      COALESCE(SUM(cma.allocated_emissions_kg_co2e), 0) AS cm_allocated
    FROM contract_manufacturer_allocations cma
    WHERE cma.organization_id = p_organization_id
      AND cma.status != 'draft'
    GROUP BY cma.facility_id
  ),

  facility_allocated_owned AS (
    -- Get total allocated emissions per facility from owned production sites
    SELECT
      ps.facility_id,
      COALESCE(SUM(ps.allocated_emissions_kg_co2e), 0) AS owned_allocated
    FROM product_lca_production_sites ps
    WHERE ps.organization_id = p_organization_id
      AND ps.status != 'draft'
    GROUP BY ps.facility_id
  )

  SELECT
    ft.facility_id,
    ft.facility_name,
    ft.total_emissions AS total_emissions_kg_co2e,
    COALESCE(fa.cm_allocated, 0) + COALESCE(fao.owned_allocated, 0) AS allocated_emissions_kg_co2e,
    GREATEST(0, ft.total_emissions - COALESCE(fa.cm_allocated, 0) - COALESCE(fao.owned_allocated, 0)) AS unallocated_emissions_kg_co2e,
    CASE
      WHEN ft.total_emissions > 0 THEN
        LEAST(100, ((COALESCE(fa.cm_allocated, 0) + COALESCE(fao.owned_allocated, 0)) / ft.total_emissions) * 100)
      ELSE 0
    END AS allocation_percentage
  FROM facility_totals ft
  LEFT JOIN facility_allocated fa ON fa.facility_id = ft.facility_id
  LEFT JOIN facility_allocated_owned fao ON fao.facility_id = ft.facility_id
  ORDER BY ft.facility_name;
END;
$$;

COMMENT ON FUNCTION get_facility_unallocated_capacity IS 'Returns the unallocated emission capacity for each facility in an organization';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_facility_unallocated_capacity TO authenticated;

-- ============================================================================
-- Add trigger to update updated_at on facility_product_assignments
-- ============================================================================

CREATE OR REPLACE FUNCTION update_facility_product_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fpa_updated_at ON facility_product_assignments;
CREATE TRIGGER trigger_update_fpa_updated_at
  BEFORE UPDATE ON facility_product_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_facility_product_assignments_updated_at();
