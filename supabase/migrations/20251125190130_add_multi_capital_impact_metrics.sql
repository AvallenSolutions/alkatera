/*
  # Multi-Capital Impact Metrics Storage (CSRD/TNFD Compliance)

  ## Purpose
  Upgrade calculation_logs and related tables to store ReCiPe 2016 Midpoint (H)
  multi-capital impact assessment results for CSRD and TNFD reporting.

  ## Changes

  ### 1. Calculation Logs Enhancement
    - Add `impact_metrics` JSONB column to store 8 environmental impact categories
    - Add `impact_assessment_method` text field (e.g., "ReCiPe 2016 Midpoint (H)")
    - Add `csrd_compliant` boolean flag
    - Add `location_country_code` for spatially-explicit water scarcity (AWARE)

  ### 2. Impact Metrics Structure (JSONB Schema)
    Required fields in impact_metrics JSONB:
    - climate_change_gwp100 (kg CO2eq) - CSRD E1
    - water_consumption (m³) - CSRD E3
    - water_scarcity_aware (m³ world eq) - CSRD E3 / AWARE method
    - land_use (m²a crop eq) - CSRD E4 / TNFD
    - terrestrial_ecotoxicity (kg 1,4-DCB) - CSRD E4
    - freshwater_eutrophication (kg P eq) - CSRD E2
    - terrestrial_acidification (kg SO2 eq) - CSRD E2
    - fossil_resource_scarcity (kg oil eq) - CSRD E5

  ## Rationale
  - CSRD requires disclosure across 5 environmental standards (E1-E5)
  - TNFD requires biodiversity and land use metrics
  - JSONB provides schema flexibility as regulations evolve
  - Allows backward compatibility while expanding reporting scope

  ## Migration Safety
  - All new columns nullable for backward compatibility
  - Existing records remain functional
  - No data loss or breaking changes
*/

-- =====================================================
-- CALCULATION LOGS: Multi-Capital Impact Storage
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_calculation_logs'
    AND column_name = 'impact_metrics'
  ) THEN
    ALTER TABLE product_lca_calculation_logs
    ADD COLUMN impact_metrics JSONB DEFAULT NULL;

    COMMENT ON COLUMN product_lca_calculation_logs.impact_metrics IS
    'Multi-capital impact assessment results (ReCiPe 2016 Midpoint H). Contains 8 CSRD/TNFD impact categories.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_calculation_logs'
    AND column_name = 'impact_assessment_method'
  ) THEN
    ALTER TABLE product_lca_calculation_logs
    ADD COLUMN impact_assessment_method TEXT DEFAULT NULL;

    COMMENT ON COLUMN product_lca_calculation_logs.impact_assessment_method IS
    'LCIA method used (e.g., "ReCiPe 2016 Midpoint (H)", "IPCC GWP100"). Required for regulatory compliance.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_calculation_logs'
    AND column_name = 'csrd_compliant'
  ) THEN
    ALTER TABLE product_lca_calculation_logs
    ADD COLUMN csrd_compliant BOOLEAN DEFAULT false;

    COMMENT ON COLUMN product_lca_calculation_logs.csrd_compliant IS
    'True if all materials used OpenLCA/Ecoinvent data (no fallback proxies). Required for CSRD audit.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_calculation_logs'
    AND column_name = 'location_country_code'
  ) THEN
    ALTER TABLE product_lca_calculation_logs
    ADD COLUMN location_country_code TEXT DEFAULT NULL;

    COMMENT ON COLUMN product_lca_calculation_logs.location_country_code IS
    'ISO 3166-1 alpha-2 country code for AWARE water scarcity calculation (e.g., "ES", "GB"). Required for CSRD E3.';
  END IF;
END $$;

-- =====================================================
-- PRODUCT LCAs: Multi-Capital Results Storage
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas'
    AND column_name = 'aggregated_impacts'
  ) THEN
    ALTER TABLE product_lcas
    ADD COLUMN aggregated_impacts JSONB DEFAULT NULL;

    COMMENT ON COLUMN product_lcas.aggregated_impacts IS
    'Sum of all material-level impact_metrics. Used for Company Vitality dashboard and CSRD reporting.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas'
    AND column_name = 'csrd_compliant'
  ) THEN
    ALTER TABLE product_lcas
    ADD COLUMN csrd_compliant BOOLEAN DEFAULT false;

    COMMENT ON COLUMN product_lcas.csrd_compliant IS
    'True if entire product LCA used OpenLCA/Ecoinvent (no proxy data). CSRD audit requirement.';
  END IF;
END $$;

-- =====================================================
-- FACILITIES: Location Data for Water Scarcity
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities'
    AND column_name = 'location_country_code'
  ) THEN
    ALTER TABLE facilities
    ADD COLUMN location_country_code TEXT DEFAULT NULL;

    COMMENT ON COLUMN facilities.location_country_code IS
    'ISO 3166-1 alpha-2 country code for facility location. Used for spatially-explicit AWARE water scarcity factors (CSRD E3).';
  END IF;
END $$;

-- =====================================================
-- CALCULATED EMISSIONS: Multi-Capital Expansion
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calculated_emissions'
    AND column_name = 'impact_metrics'
  ) THEN
    ALTER TABLE calculated_emissions
    ADD COLUMN impact_metrics JSONB DEFAULT NULL;

    COMMENT ON COLUMN calculated_emissions.impact_metrics IS
    'Multi-capital impacts for this specific emission source. Enables drill-down from aggregated facility totals.';
  END IF;
END $$;

-- =====================================================
-- INDEXES: Performance Optimization for JSONB Queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_calculation_logs_impact_metrics
ON product_lca_calculation_logs USING GIN (impact_metrics);

CREATE INDEX IF NOT EXISTS idx_product_lcas_aggregated_impacts
ON product_lcas USING GIN (aggregated_impacts);

CREATE INDEX IF NOT EXISTS idx_calculated_emissions_impact_metrics
ON calculated_emissions USING GIN (impact_metrics);

CREATE INDEX IF NOT EXISTS idx_calculation_logs_csrd_compliant
ON product_lca_calculation_logs (csrd_compliant)
WHERE csrd_compliant = true;

CREATE INDEX IF NOT EXISTS idx_product_lcas_csrd_compliant
ON product_lcas (csrd_compliant)
WHERE csrd_compliant = true;

CREATE INDEX IF NOT EXISTS idx_calculation_logs_location
ON product_lca_calculation_logs (location_country_code)
WHERE location_country_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facilities_location
ON facilities (location_country_code)
WHERE location_country_code IS NOT NULL;