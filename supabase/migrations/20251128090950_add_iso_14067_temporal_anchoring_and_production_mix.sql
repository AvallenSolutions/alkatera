/*
  # ISO 14067/14044 Compliance: Temporal Anchoring & Production Mix Allocation

  ## Overview
  Implements strict ISO 14067 temporal anchoring and ISO 14044 physical allocation
  for multi-facility product LCAs with production share percentage-based allocation.

  ## Changes

  1. **Temporal Anchoring (ISO 14067 Requirement)**
     - Add `reference_year` column to `product_lcas` table
     - Mandatory INTEGER field representing financial year for operational data
     - Ensures facility emissions and production volumes are from the same temporal period

  2. **Production Mix Allocation (ISO 14044 Physical Allocation)**
     - Create `lca_production_mix` table for percentage-based allocation
     - Store `production_share` as NUMERIC(5,4) representing decimal percentage (0.0 to 1.0)
     - Example: 60% allocation = 0.6000
     - Enforce 100% constraint via database trigger

  3. **Data Quality Enforcement**
     - Link to `facility_emissions_aggregated` for intensity values
     - Track `data_source_type` (Primary vs Secondary_Average)
     - Store facility operational metrics for audit trail

  4. **Security & Multi-Tenancy**
     - RLS policies for organization-level data isolation
     - Cascade deletion when LCA or facility is deleted

  ## Notes
  - Existing `product_lca_production_sites` table remains for backward compatibility
  - New `lca_production_mix` is the preferred allocation method
  - Validation trigger prevents production shares from exceeding 100%
  - Glass Box Protocol: All allocation logic is transparent and auditable
*/

-- ============================================================================
-- STEP 1: Add reference_year to product_lcas (Temporal Anchoring)
-- ============================================================================

ALTER TABLE product_lcas
  ADD COLUMN IF NOT EXISTS reference_year INTEGER;

COMMENT ON COLUMN product_lcas.reference_year IS
  'ISO 14067 Temporal Anchoring: Financial year for facility operational data (e.g., 2024). Ensures emissions and production volumes are from the same period.';

-- Set default value for existing records (current year)
UPDATE product_lcas
SET reference_year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
WHERE reference_year IS NULL;

-- Make mandatory for new records
ALTER TABLE product_lcas
  ALTER COLUMN reference_year SET NOT NULL;

-- Add constraint to ensure reasonable year values
DO $$ BEGIN
  ALTER TABLE product_lcas
    ADD CONSTRAINT chk_reference_year_range
    CHECK (reference_year >= 2000 AND reference_year <= 2100);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- STEP 2: Create lca_production_mix table (ISO 14044 Physical Allocation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lca_production_mix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lca_id UUID NOT NULL REFERENCES public.product_lcas(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,

    -- Production share as decimal (0.0 to 1.0, where 1.0 = 100%)
    production_share NUMERIC(5,4) NOT NULL
      CHECK (production_share >= 0 AND production_share <= 1),

    -- Facility operational metrics (for audit trail)
    facility_intensity NUMERIC,
    facility_total_emissions NUMERIC,
    facility_total_production NUMERIC,

    -- Data quality metadata
    data_source_type TEXT CHECK (data_source_type IN ('Primary', 'Secondary_Average')),
    notes TEXT,

    -- Audit timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Unique constraint to prevent duplicate facility allocations per LCA
    -- Using different name from product_lca_production_sites constraint
    CONSTRAINT uq_production_mix_lca_facility UNIQUE (lca_id, facility_id)
);

-- Add helpful comments
COMMENT ON TABLE lca_production_mix IS
  'ISO 14044 Physical Allocation: Production share percentages for multi-facility product LCAs. Shares must sum to exactly 1.0 (100%).';

COMMENT ON COLUMN lca_production_mix.production_share IS
  'Decimal representation of production share (0.0 to 1.0). Example: 60% = 0.6000. All shares for an LCA must sum to 1.0.';

COMMENT ON COLUMN lca_production_mix.facility_intensity IS
  'Emission intensity from facility_emissions_aggregated.calculated_intensity for the reference year (kg CO2e per unit).';

COMMENT ON COLUMN lca_production_mix.data_source_type IS
  'Primary = Verified utility bills, Secondary_Average = Industry average proxy. Inherited from facility_emissions_aggregated.';

-- ============================================================================
-- STEP 3: Validation Trigger (Enforce 100% Constraint)
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_production_mix_totals()
RETURNS TRIGGER AS $$
DECLARE
    total_share NUMERIC;
BEGIN
    -- Calculate sum of all production shares for this LCA (excluding current record if UPDATE)
    SELECT COALESCE(SUM(production_share), 0)
    INTO total_share
    FROM lca_production_mix
    WHERE lca_id = NEW.lca_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

    -- Add the new/updated share
    total_share := total_share + NEW.production_share;

    -- Allow small floating-point tolerance (0.0001 = 0.01%)
    IF total_share > 1.0001 THEN
        RAISE EXCEPTION 'Production mix allocation cannot exceed 100%%. Current total would be: %',
          (total_share * 100)
        USING HINT = 'The sum of production_share values for this LCA must equal 1.0 (100%)';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_validate_production_mix ON lca_production_mix;

-- Create trigger to validate on INSERT and UPDATE
CREATE TRIGGER trigger_validate_production_mix
  BEFORE INSERT OR UPDATE ON lca_production_mix
  FOR EACH ROW
  EXECUTE FUNCTION validate_production_mix_totals();

-- ============================================================================
-- STEP 4: Helper Function to Check if Production Mix is Complete
-- ============================================================================

CREATE OR REPLACE FUNCTION is_production_mix_complete(lca_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    total_share NUMERIC;
BEGIN
    SELECT COALESCE(SUM(production_share), 0)
    INTO total_share
    FROM lca_production_mix
    WHERE lca_id = lca_uuid;

    -- Allow small floating-point tolerance (0.9999 to 1.0001 = 99.99% to 100.01%)
    RETURN (total_share >= 0.9999 AND total_share <= 1.0001);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_production_mix_complete IS
  'Returns TRUE if production shares for an LCA sum to 100% (with 0.01% tolerance). Use before allowing calculation.';

-- ============================================================================
-- STEP 5: RLS Policies for Multi-Tenant Security
-- ============================================================================

-- Enable RLS
ALTER TABLE lca_production_mix ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view production mix for their organization" ON lca_production_mix;
DROP POLICY IF EXISTS "Users can insert production mix for their organization" ON lca_production_mix;
DROP POLICY IF EXISTS "Users can update production mix for their organization" ON lca_production_mix;
DROP POLICY IF EXISTS "Users can delete production mix for their organization" ON lca_production_mix;

-- Policy: SELECT (view production mix for organization's LCAs)
CREATE POLICY "Users can view production mix for their organization"
  ON lca_production_mix FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM product_lcas pl
      INNER JOIN organization_members om ON om.organization_id = pl.organization_id
      WHERE pl.id = lca_production_mix.lca_id
      AND om.user_id = auth.uid()
    )
  );

-- Policy: INSERT (create production mix for organization's LCAs)
CREATE POLICY "Users can insert production mix for their organization"
  ON lca_production_mix FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_lcas pl
      INNER JOIN organization_members om ON om.organization_id = pl.organization_id
      WHERE pl.id = lca_production_mix.lca_id
      AND om.user_id = auth.uid()
    )
  );

-- Policy: UPDATE (modify production mix for organization's LCAs)
CREATE POLICY "Users can update production mix for their organization"
  ON lca_production_mix FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM product_lcas pl
      INNER JOIN organization_members om ON om.organization_id = pl.organization_id
      WHERE pl.id = lca_production_mix.lca_id
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_lcas pl
      INNER JOIN organization_members om ON om.organization_id = pl.organization_id
      WHERE pl.id = lca_production_mix.lca_id
      AND om.user_id = auth.uid()
    )
  );

-- Policy: DELETE (remove production mix for organization's LCAs)
CREATE POLICY "Users can delete production mix for their organization"
  ON lca_production_mix FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM product_lcas pl
      INNER JOIN organization_members om ON om.organization_id = pl.organization_id
      WHERE pl.id = lca_production_mix.lca_id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: Create View for Easy Querying (with Weighted Average Calculation)
-- ============================================================================

CREATE OR REPLACE VIEW lca_production_mix_summary AS
SELECT
  pm.lca_id,
  pl.product_name,
  pl.reference_year,
  pl.organization_id,
  COUNT(pm.id) AS num_facilities,
  SUM(pm.production_share) AS total_share_allocated,
  is_production_mix_complete(pm.lca_id) AS is_complete,
  SUM(pm.facility_intensity * pm.production_share) AS weighted_avg_intensity,
  ARRAY_AGG(
    json_build_object(
      'facility_id', f.id,
      'facility_name', f.name,
      'production_share', pm.production_share,
      'production_share_percent', (pm.production_share * 100),
      'facility_intensity', pm.facility_intensity,
      'data_source_type', pm.data_source_type
    )
  ) AS facility_breakdown
FROM lca_production_mix pm
INNER JOIN product_lcas pl ON pl.id = pm.lca_id
INNER JOIN facilities f ON f.id = pm.facility_id
GROUP BY pm.lca_id, pl.product_name, pl.reference_year, pl.organization_id;

COMMENT ON VIEW lca_production_mix_summary IS
  'Summary view showing production mix allocation status, weighted average intensity, and per-facility breakdown for each LCA.';

-- ============================================================================
-- STEP 7: Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lca_production_mix_lca_id
  ON lca_production_mix(lca_id);

CREATE INDEX IF NOT EXISTS idx_lca_production_mix_facility_id
  ON lca_production_mix(facility_id);

CREATE INDEX IF NOT EXISTS idx_product_lcas_reference_year
  ON product_lcas(reference_year);

-- ============================================================================
-- STEP 8: Updated Timestamp Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_lca_production_mix_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lca_production_mix_timestamp ON lca_production_mix;

CREATE TRIGGER trigger_update_lca_production_mix_timestamp
  BEFORE UPDATE ON lca_production_mix
  FOR EACH ROW
  EXECUTE FUNCTION update_lca_production_mix_timestamp();
