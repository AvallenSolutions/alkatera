/*
  # Refactor Emissions Calculations to Consumer Units

  ## Problem Statement
  The current system has an ambiguity: LCA functional units say "1 x 700ml bottle" but some
  calculations use bulk volume (hectolitres), creating confusion. Users want to know emissions
  PER UNIT (per bottle, can, etc.) not per bulk volume.

  ## Solution
  Standardize ALL emissions and impact calculations to consumer units. This makes the system
  intuitive and aligns with how products are actually sold and consumed.

  ## Changes

  1. **Clarify product_lcas table semantics**
     - Add explicit comment that total_ghg_emissions is per functional unit (per bottle/can)
     - Add per_unit_emissions_verified boolean to track if values are correctly per-unit
     - Add bulk_volume_per_functional_unit for conversion (e.g., 0.7 L for a 700ml bottle)

  2. **Update production_logs to track consumer units**
     - Add units_produced column (number of bottles/cans)
     - Make volume optional (for backwards compatibility)
     - Add conversion_factor column

  3. **Update facility_emissions_aggregated**
     - Add units_produced column
     - Clarify that calculated_intensity should be per consumer unit
     - Add intensity_basis column ('per_unit' vs 'per_hectolitre' for legacy data)

  4. **Update product_lca_production_sites**
     - Clarify production_volume is in consumer units
     - Update comments to reflect per-unit basis

  5. **Create view for per-unit reporting**
     - Make it easy to query emissions per bottle/can across all products
*/

-- =====================================================================
-- 1. PRODUCT LCAs: Add per-unit tracking fields
-- =====================================================================

ALTER TABLE public.product_lcas
  ADD COLUMN IF NOT EXISTS per_unit_emissions_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bulk_volume_per_functional_unit NUMERIC,
  ADD COLUMN IF NOT EXISTS volume_unit TEXT;

COMMENT ON TABLE public.product_lcas IS 'Product LCA results. CRITICAL: All emissions values are per functional unit (per bottle/can/unit), NOT per bulk volume.';
COMMENT ON COLUMN public.product_lcas.total_ghg_emissions IS 'Total GHG emissions per functional unit (kg CO2e per bottle/can). This is the emissions for ONE consumer unit.';
COMMENT ON COLUMN public.product_lcas.per_unit_emissions_verified IS 'TRUE if emissions have been verified to be per consumer unit, FALSE if legacy data may be per bulk volume';
COMMENT ON COLUMN public.product_lcas.bulk_volume_per_functional_unit IS 'Bulk volume represented by one functional unit (e.g., 0.7 L for a 700ml bottle, 0.33 L for 330ml can)';
COMMENT ON COLUMN public.product_lcas.volume_unit IS 'Unit of measurement for bulk_volume_per_functional_unit (typically L or ml)';

-- =====================================================================
-- 2. PRODUCTION LOGS: Add consumer units tracking
-- =====================================================================

ALTER TABLE public.production_logs
  ADD COLUMN IF NOT EXISTS units_produced NUMERIC,
  ADD COLUMN IF NOT EXISTS product_sku TEXT,
  ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC DEFAULT 1;

COMMENT ON COLUMN public.production_logs.units_produced IS 'Number of consumer units produced (bottles, cans, packages). This is the PRIMARY production metric.';
COMMENT ON COLUMN public.production_logs.volume IS 'Bulk volume produced (litres, hectolitres). OPTIONAL - for backwards compatibility.';
COMMENT ON COLUMN public.production_logs.conversion_factor IS 'Conversion factor from bulk volume to units (e.g., 142.86 bottles per hectolitre for 700ml bottles)';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_production_logs_product_date
  ON public.production_logs(product_id, date DESC);

-- =====================================================================
-- 3. FACILITY EMISSIONS AGGREGATED: Add per-unit intensity
-- =====================================================================

ALTER TABLE public.facility_emissions_aggregated
  ADD COLUMN IF NOT EXISTS units_produced NUMERIC,
  ADD COLUMN IF NOT EXISTS intensity_basis TEXT DEFAULT 'per_unit' CHECK (intensity_basis IN ('per_unit', 'per_bulk_volume', 'legacy'));

COMMENT ON COLUMN public.facility_emissions_aggregated.calculated_intensity IS 'Emission intensity per consumer unit (kg CO2e per bottle/can/unit). If intensity_basis is legacy, may need conversion.';
COMMENT ON COLUMN public.facility_emissions_aggregated.units_produced IS 'Total number of consumer units produced at this facility during the reporting period';
COMMENT ON COLUMN public.facility_emissions_aggregated.total_production_volume IS 'Total bulk production volume (litres, hectolitres). OPTIONAL - units_produced is the primary metric.';
COMMENT ON COLUMN public.facility_emissions_aggregated.intensity_basis IS 'Basis for calculated_intensity: per_unit (per bottle/can), per_bulk_volume (per hectolitre), or legacy (unknown, needs verification)';

-- =====================================================================
-- 4. PRODUCTION SITES: Clarify per-unit semantics
-- =====================================================================

COMMENT ON COLUMN public.product_lca_production_sites.production_volume IS 'Number of CONSUMER UNITS (bottles, cans) produced at this facility for this product during the reporting period';
COMMENT ON COLUMN public.product_lca_production_sites.facility_intensity IS 'Facility emission intensity per consumer unit (kg CO2e per bottle/can). Cached from facility_emissions_aggregated.';
COMMENT ON COLUMN public.product_lca_production_sites.attributable_emissions_per_unit IS 'Weighted emissions per consumer unit allocated from this facility to this product';

-- =====================================================================
-- 5. CREATE VIEW: Per-Unit Emissions Summary
-- =====================================================================

CREATE OR REPLACE VIEW public.product_emissions_per_unit AS
SELECT 
  p.id AS product_id,
  p.name AS product_name,
  p.sku,
  p.unit_size_value,
  p.unit_size_unit,
  p.functional_unit,
  p.product_category,
  lca.functional_unit AS lca_functional_unit,
  lca.total_ghg_emissions AS kg_co2e_per_unit,
  lca.per_unit_emissions_verified,
  lca.bulk_volume_per_functional_unit,
  
  -- Calculate per-litre emissions for comparison
  CASE 
    WHEN lca.bulk_volume_per_functional_unit > 0 THEN
      lca.total_ghg_emissions / lca.bulk_volume_per_functional_unit
    ELSE NULL
  END AS kg_co2e_per_litre,
  
  -- Production data
  SUM(pl.units_produced) AS total_units_produced,
  SUM(pl.units_produced * lca.total_ghg_emissions) AS total_emissions_kg_co2e,
  
  lca.created_at AS lca_created_at,
  lca.updated_at AS lca_updated_at,
  p.organization_id
  
FROM public.products p
LEFT JOIN public.product_lcas lca ON lca.id = p.latest_lca_id
LEFT JOIN public.production_logs pl ON pl.product_id = p.id
GROUP BY p.id, p.name, p.sku, p.unit_size_value, p.unit_size_unit, p.functional_unit,
  p.product_category, lca.functional_unit, lca.total_ghg_emissions,
  lca.per_unit_emissions_verified, lca.bulk_volume_per_functional_unit,
  lca.created_at, lca.updated_at, p.organization_id;

COMMENT ON VIEW public.product_emissions_per_unit IS 'Per-unit emissions summary. Shows emissions per bottle/can for each product with production totals.';

-- Grant access to authenticated users
GRANT SELECT ON public.product_emissions_per_unit TO authenticated;

-- =====================================================================
-- 6. ADD HELPER FUNCTION: Convert bulk volume to units
-- =====================================================================

CREATE OR REPLACE FUNCTION public.bulk_volume_to_units(
  p_bulk_volume NUMERIC,
  p_bulk_unit TEXT,
  p_unit_size_value NUMERIC,
  p_unit_size_unit TEXT
) RETURNS NUMERIC AS $$
DECLARE
  bulk_litres NUMERIC;
  unit_litres NUMERIC;
BEGIN
  -- Convert bulk volume to litres
  bulk_litres := CASE 
    WHEN LOWER(p_bulk_unit) = 'hectolitres' THEN p_bulk_volume * 100
    WHEN LOWER(p_bulk_unit) = 'litres' THEN p_bulk_volume
    WHEN LOWER(p_bulk_unit) = 'l' THEN p_bulk_volume
    ELSE p_bulk_volume
  END;
  
  -- Convert unit size to litres
  unit_litres := CASE
    WHEN LOWER(p_unit_size_unit) = 'ml' THEN p_unit_size_value / 1000.0
    WHEN LOWER(p_unit_size_unit) = 'l' THEN p_unit_size_value
    WHEN LOWER(p_unit_size_unit) = 'litres' THEN p_unit_size_value
    ELSE p_unit_size_value
  END;
  
  -- Calculate number of units
  IF unit_litres > 0 THEN
    RETURN bulk_litres / unit_litres;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.bulk_volume_to_units IS 'Convert bulk volume (hectolitres/litres) to number of consumer units (bottles/cans) based on product unit size';

-- =====================================================================
-- 7. ADD HELPER FUNCTION: Calculate per-unit emissions from production data
-- =====================================================================

CREATE OR REPLACE FUNCTION public.calculate_per_unit_facility_intensity(
  p_facility_id UUID,
  p_reporting_period_start DATE DEFAULT NULL,
  p_reporting_period_end DATE DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
  total_emissions NUMERIC;
  total_units NUMERIC;
  intensity NUMERIC;
BEGIN
  -- Get total emissions and units for the facility in the reporting period
  SELECT 
    COALESCE(SUM(fea.total_co2e), 0),
    COALESCE(SUM(fea.units_produced), 0)
  INTO total_emissions, total_units
  FROM public.facility_emissions_aggregated fea
  WHERE fea.facility_id = p_facility_id
    AND (p_reporting_period_start IS NULL OR fea.reporting_period_start >= p_reporting_period_start)
    AND (p_reporting_period_end IS NULL OR fea.reporting_period_end <= p_reporting_period_end);
  
  -- Calculate intensity (emissions per unit)
  IF total_units > 0 THEN
    intensity := total_emissions / total_units;
  ELSE
    intensity := 0;
  END IF;
  
  RETURN intensity;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_per_unit_facility_intensity IS 'Calculate emission intensity per consumer unit for a facility based on total emissions and units produced';

-- =====================================================================
-- 8. UPDATE EXISTING DATA: Mark as requiring verification
-- =====================================================================

-- Mark all existing LCAs as requiring per-unit verification
UPDATE public.product_lcas
SET per_unit_emissions_verified = false,
    bulk_volume_per_functional_unit = CASE
      WHEN functional_unit LIKE '%ml%' THEN 
        -- Extract numeric value from functional unit (e.g., "1 x 700ml bottle" -> 0.7)
        (SELECT CAST(NULLIF(regexp_replace(functional_unit, '[^0-9.]', '', 'g'), '') AS NUMERIC) / 1000.0)
      ELSE NULL
    END,
    volume_unit = 'L'
WHERE per_unit_emissions_verified IS NULL;

-- =====================================================================
-- 9. ADD PRODUCTION LOG TRIGGER: Auto-calculate units from volume
-- =====================================================================

CREATE OR REPLACE FUNCTION public.calculate_units_from_volume()
RETURNS TRIGGER AS $$
DECLARE
  product_unit_size NUMERIC;
  product_unit TEXT;
BEGIN
  -- If units_produced is not provided but volume is, calculate it
  IF NEW.units_produced IS NULL AND NEW.volume IS NOT NULL AND NEW.product_id IS NOT NULL THEN
    -- Get product unit size
    SELECT unit_size_value, unit_size_unit
    INTO product_unit_size, product_unit
    FROM public.products
    WHERE id = NEW.product_id;
    
    -- Calculate units produced
    IF product_unit_size IS NOT NULL THEN
      NEW.units_produced := public.bulk_volume_to_units(
        NEW.volume,
        NEW.unit,
        product_unit_size,
        product_unit
      );
      
      -- Calculate conversion factor for reference
      IF NEW.volume > 0 THEN
        NEW.conversion_factor := NEW.units_produced / NEW.volume;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_units_from_volume ON public.production_logs;
CREATE TRIGGER trigger_calculate_units_from_volume
  BEFORE INSERT OR UPDATE ON public.production_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_units_from_volume();

COMMENT ON FUNCTION public.calculate_units_from_volume IS 'Auto-calculate units_produced from bulk volume when production log is created/updated';

