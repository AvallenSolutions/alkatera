/*
  # Add DEFRA 2025 Freight Transport Emission Factors

  1. Purpose
     - Add freight transport emission factors for product LCA calculations
     - Enable accurate transport emissions for ingredients and packaging
     - Support ISO 14067 compliant carbon footprinting with DEFRA data

  2. Data Sources (DEFRA 2025 Conversion Factors)
     - Tab: "Freighting goods" - Road, Rail, Sea, and Air freight
     - Emission factors include direct emissions (tank-to-wheel)
     - Values in kgCO2e per tonne-kilometre

  3. New Factors Added (4 factors)
     - Freight - Road (HGV - All diesel, Average laden)
     - Freight - Rail (Freight train, UK average)
     - Freight - Sea (Container ship, Average)
     - Freight - Air (Dedicated freight service, Average)

  4. Notes
     - These factors are for upstream transport in product LCAs
     - Different from passenger transport factors
     - UK-specific where available, global averages for international transport
*/

-- =====================================================
-- INSERT DEFRA 2025 FREIGHT EMISSION FACTORS
-- =====================================================

-- Freight - Road (HGV)
INSERT INTO staging_emission_factors (
  organization_id,
  name,
  category,
  co2_factor,
  reference_unit,
  source,
  metadata
) VALUES (
  NULL,
  'Freight - Road (HGV, Average laden)',
  'Transport',
  0.062,
  'tkm',
  'DEFRA 2025',
  jsonb_build_object(
    'description', 'Heavy Goods Vehicle (HGV) - All diesel, Average laden. Emission factor for road freight in the UK.',
    'transport_mode', 'truck',
    'data_quality', 'Primary',
    'geographic_scope', 'UK',
    'year', 2025,
    'source_reference', 'DEFRA Greenhouse Gas Conversion Factors 2025 - Freighting goods',
    'includes', 'Tank-to-wheel emissions (direct)',
    'methodology', 'Activity-based, per tonne-kilometre'
  )
) ON CONFLICT DO NOTHING;

-- Freight - Rail
INSERT INTO staging_emission_factors (
  organization_id,
  name,
  category,
  co2_factor,
  reference_unit,
  source,
  metadata
) VALUES (
  NULL,
  'Freight - Rail (Freight train, UK average)',
  'Transport',
  0.028,
  'tkm',
  'DEFRA 2025',
  jsonb_build_object(
    'description', 'Freight train - UK average. Emission factor for rail freight transport.',
    'transport_mode', 'train',
    'data_quality', 'Primary',
    'geographic_scope', 'UK',
    'year', 2025,
    'source_reference', 'DEFRA Greenhouse Gas Conversion Factors 2025 - Freighting goods',
    'includes', 'Tank-to-wheel emissions (direct)',
    'methodology', 'Activity-based, per tonne-kilometre'
  )
) ON CONFLICT DO NOTHING;

-- Freight - Sea
INSERT INTO staging_emission_factors (
  organization_id,
  name,
  category,
  co2_factor,
  reference_unit,
  source,
  metadata
) VALUES (
  NULL,
  'Freight - Sea (Container ship, Average)',
  'Transport',
  0.011,
  'tkm',
  'DEFRA 2025',
  jsonb_build_object(
    'description', 'Container ship - Average. Emission factor for sea freight transport.',
    'transport_mode', 'ship',
    'data_quality', 'Primary',
    'geographic_scope', 'Global',
    'year', 2025,
    'source_reference', 'DEFRA Greenhouse Gas Conversion Factors 2025 - Freighting goods',
    'includes', 'Tank-to-wheel emissions (direct)',
    'methodology', 'Activity-based, per tonne-kilometre'
  )
) ON CONFLICT DO NOTHING;

-- Freight - Air
INSERT INTO staging_emission_factors (
  organization_id,
  name,
  category,
  co2_factor,
  reference_unit,
  source,
  metadata
) VALUES (
  NULL,
  'Freight - Air (Dedicated freight service, Average)',
  'Transport',
  0.602,
  'tkm',
  'DEFRA 2025',
  jsonb_build_object(
    'description', 'Air freight - Dedicated freight service, Average. Emission factor for air cargo transport.',
    'transport_mode', 'air',
    'data_quality', 'Primary',
    'geographic_scope', 'Global',
    'year', 2025,
    'source_reference', 'DEFRA Greenhouse Gas Conversion Factors 2025 - Freighting goods',
    'includes', 'Tank-to-wheel emissions (direct)',
    'methodology', 'Activity-based, per tonne-kilometre'
  )
) ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Query to verify the inserted freight factors
-- Uncomment to test:
-- SELECT 
--   name,
--   co2_factor,
--   reference_unit,
--   source,
--   metadata->>'transport_mode' as transport_mode,
--   metadata->>'geographic_scope' as geographic_scope
-- FROM staging_emission_factors
-- WHERE category = 'Transport'
-- AND source = 'DEFRA 2025'
-- AND metadata->>'transport_mode' IS NOT NULL
-- ORDER BY co2_factor ASC;