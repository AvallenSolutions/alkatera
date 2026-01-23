/*
  # Populate missing scope, lifecycle, and GHG breakdown in aggregated_impacts

  Many completed PEIs have aggregated_impacts but are missing critical nested fields:
  - breakdown.by_scope (scope1, scope2, scope3)
  - breakdown.by_lifecycle_stage
  - ghg_breakdown

  This migration calculates and populates these fields from existing data in
  product_carbon_footprint_materials and product_carbon_footprint_production_sites.

  ## Why this is needed
  The Company Vitality dashboard expects these fields to be present.
  Without them, the Scope 3 categories, Lifecycle stages, and GHG inventory show as unavailable.
*/

-- ============================================================================
-- STEP 1: Populate breakdown.by_scope and breakdown.by_lifecycle_stage
-- ============================================================================

UPDATE product_carbon_footprints pcf
SET aggregated_impacts = pcf.aggregated_impacts ||
  jsonb_build_object(
    'breakdown', COALESCE(pcf.aggregated_impacts->'breakdown', '{}'::jsonb) ||
      jsonb_build_object(
        'by_scope', jsonb_build_object(
          'scope1', COALESCE((pcf.aggregated_impacts->'breakdown'->'by_scope'->'scope1')::numeric, 0),
          'scope2', COALESCE((pcf.aggregated_impacts->'breakdown'->'by_scope'->'scope2')::numeric, 0),
          'scope3', COALESCE(
            (pcf.aggregated_impacts->'breakdown'->'by_scope'->'scope3')::numeric,
            (pcf.aggregated_impacts->>'climate_change_gwp100')::numeric,
            (pcf.aggregated_impacts->>'total_carbon_footprint')::numeric,
            (
              SELECT COALESCE(SUM(COALESCE(m.impact_climate, 0) + COALESCE(m.impact_transport, 0)), 0)
              FROM product_carbon_footprint_materials m
              WHERE m.product_carbon_footprint_id = pcf.id
            )
          )
        ),
        'by_lifecycle_stage', CASE
          WHEN pcf.aggregated_impacts->'breakdown'->'by_lifecycle_stage' IS NOT NULL
          THEN pcf.aggregated_impacts->'breakdown'->'by_lifecycle_stage'
          ELSE jsonb_build_object(
            'raw_materials', (
              SELECT COALESCE(SUM(COALESCE(m.impact_climate, 0)), 0)
              FROM product_carbon_footprint_materials m
              WHERE m.product_carbon_footprint_id = pcf.id
              AND (m.material_type = 'ingredient' OR m.material_type IS NULL OR m.material_type = '')
            ),
            'packaging_stage', (
              SELECT COALESCE(SUM(COALESCE(m.impact_climate, 0)), 0)
              FROM product_carbon_footprint_materials m
              WHERE m.product_carbon_footprint_id = pcf.id
              AND m.material_type IN ('packaging', 'packaging_material')
            ),
            'distribution', (
              SELECT COALESCE(SUM(COALESCE(m.impact_transport, 0)), 0)
              FROM product_carbon_footprint_materials m
              WHERE m.product_carbon_footprint_id = pcf.id
            ),
            'processing', COALESCE(
              (pcf.aggregated_impacts->'breakdown'->'by_lifecycle_stage'->'processing')::numeric,
              0
            ),
            'use_phase', 0,
            'end_of_life', (
              SELECT COALESCE(SUM(
                CASE
                  WHEN m.material_type IN ('packaging', 'packaging_material')
                  THEN COALESCE(m.quantity, 0) * 0.05 * 0.30  -- 30% landfill rate, 0.05 EF
                  ELSE 0
                END
              ), 0)
              FROM product_carbon_footprint_materials m
              WHERE m.product_carbon_footprint_id = pcf.id
            )
          )
        END
      )
  )
WHERE pcf.status = 'completed'
  AND pcf.aggregated_impacts IS NOT NULL
  AND (
    pcf.aggregated_impacts->'breakdown'->'by_scope' IS NULL
    OR pcf.aggregated_impacts->'breakdown'->'by_lifecycle_stage' IS NULL
  );

-- ============================================================================
-- STEP 2: Populate ghg_breakdown from material carbon origin data
-- ============================================================================

UPDATE product_carbon_footprints pcf
SET aggregated_impacts = pcf.aggregated_impacts ||
  jsonb_build_object(
    'ghg_breakdown', CASE
      WHEN pcf.aggregated_impacts->'ghg_breakdown' IS NOT NULL
           AND pcf.aggregated_impacts->'ghg_breakdown'->'carbon_origin' IS NOT NULL
      THEN pcf.aggregated_impacts->'ghg_breakdown'
      ELSE jsonb_build_object(
        'carbon_origin', jsonb_build_object(
          'fossil', COALESCE(
            (pcf.aggregated_impacts->>'total_climate_fossil')::numeric,
            (
              SELECT COALESCE(SUM(COALESCE(m.impact_climate_fossil, 0)), 0)
              FROM product_carbon_footprint_materials m
              WHERE m.product_carbon_footprint_id = pcf.id
            ),
            -- Fallback: assume all is fossil if no split available
            (pcf.aggregated_impacts->>'climate_change_gwp100')::numeric,
            0
          ),
          'biogenic', COALESCE(
            (pcf.aggregated_impacts->>'total_climate_biogenic')::numeric,
            (
              SELECT COALESCE(SUM(COALESCE(m.impact_climate_biogenic, 0)), 0)
              FROM product_carbon_footprint_materials m
              WHERE m.product_carbon_footprint_id = pcf.id
            ),
            0
          ),
          'land_use_change', COALESCE(
            (pcf.aggregated_impacts->>'total_climate_dluc')::numeric,
            (
              SELECT COALESCE(SUM(COALESCE(m.impact_climate_dluc, 0)), 0)
              FROM product_carbon_footprint_materials m
              WHERE m.product_carbon_footprint_id = pcf.id
            ),
            0
          )
        ),
        'gas_inventory', jsonb_build_object(
          'co2_fossil', COALESCE(
            (pcf.aggregated_impacts->>'total_climate_fossil')::numeric,
            (pcf.aggregated_impacts->>'climate_change_gwp100')::numeric,
            0
          ),
          'co2_biogenic', COALESCE(
            (pcf.aggregated_impacts->>'total_climate_biogenic')::numeric,
            0
          ),
          'methane', 0,
          'methane_fossil', 0,
          'methane_biogenic', 0,
          'nitrous_oxide', 0,
          'hfc_pfc', 0
        ),
        'gwp_factors', jsonb_build_object(
          'ch4_fossil_gwp100', 29.8,
          'ch4_biogenic_gwp100', 27.2,
          'n2o_gwp100', 273,
          'method', 'IPCC AR6 GWP100'
        ),
        'data_quality', 'tertiary'
      )
    END
  )
WHERE pcf.status = 'completed'
  AND pcf.aggregated_impacts IS NOT NULL
  AND (
    pcf.aggregated_impacts->'ghg_breakdown' IS NULL
    OR pcf.aggregated_impacts->'ghg_breakdown'->'carbon_origin' IS NULL
  );

-- ============================================================================
-- STEP 3: Log what was updated
-- ============================================================================

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM product_carbon_footprints
  WHERE status = 'completed'
    AND aggregated_impacts IS NOT NULL
    AND aggregated_impacts->'breakdown'->'by_scope' IS NOT NULL
    AND aggregated_impacts->'ghg_breakdown'->'carbon_origin' IS NOT NULL;

  RAISE NOTICE 'Populated breakdown and GHG data for % completed PEIs', updated_count;
END $$;
