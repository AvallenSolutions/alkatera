/*
  # Add Staging Emission Factors for Test Materials

  1. Purpose
     - Populate staging_emission_factors with factors for test product materials
     - Enable impact waterfall resolver to find impact data
     - Support LCA calculation validation and execution

  2. Data Sources
     - Aligned with ecoinvent 3.9.1 database
     - DEFRA 2025 conversion factors for transport
     - Impact values per kilogram of material

  3. Impact Categories
     - Climate Change (GWP100): kg CO2e per kg
     - Water Consumption: m³ per kg
     - Land Use: m² year per kg
     - Waste Generation: kg per kg
*/

-- Delete existing test material factors if they exist
DELETE FROM staging_emission_factors 
WHERE name IN (
  'Ethanol from molasses',
  'Purified water',
  'Natural vanilla essence',
  'Cinnamon sticks (ground)',
  'Amber glass bottle 700ml',
  'Natural cork stopper',
  'Printed paper label',
  'PVC shrink capsule',
  'Malted wheat',
  'English hops',
  'Brewing water',
  'Saccharomyces cerevisiae (brewing yeast)',
  'Aluminium can 330ml with printing',
  'Recycled cardboard carrier'
);

-- =============================================================================
-- INGREDIENTS
-- =============================================================================

-- Ethanol from molasses (Caribbean production)
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Ethanol from molasses', 'Ingredient',
  1.85, 0.80, 0.05, 0.02,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "Caribbean", "confidence": "medium", "notes": "Ethanol production from molasses, includes fermentation and distillation"}'::jsonb
);

-- Purified water (UK treatment)
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Purified water', 'Ingredient',
  0.0003, 1.0, 0.0001, 0.0001,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "UK", "confidence": "high", "notes": "Tap water with treatment, low impact"}'::jsonb
);

-- Brewing water (same as purified water)
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Brewing water', 'Ingredient',
  0.0003, 1.0, 0.0001, 0.0001,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "UK", "confidence": "high", "notes": "Brewing quality water with treatment"}'::jsonb
);

-- Natural vanilla essence (Madagascar)
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Natural vanilla essence', 'Ingredient',
  8.50, 1.20, 2.80, 0.15,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "Madagascar", "confidence": "medium", "notes": "Natural vanilla extract, high impact due to intensive cultivation and processing"}'::jsonb
);

-- Cinnamon sticks ground (Sri Lanka)
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Cinnamon sticks (ground)', 'Ingredient',
  3.20, 0.85, 1.50, 0.12,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "Sri Lanka", "confidence": "medium", "notes": "Ground cinnamon from Ceylon cinnamon trees"}'::jsonb
);

-- Malted wheat (UK regional)
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Malted wheat', 'Ingredient',
  0.65, 0.90, 1.20, 0.08,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "UK", "confidence": "high", "notes": "Malted wheat for brewing, includes malting process"}'::jsonb
);

-- English hops (UK regional)
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'English hops', 'Ingredient',
  2.80, 1.50, 3.20, 0.10,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "UK", "confidence": "medium", "notes": "Fresh hops from UK farms, intensive cultivation"}'::jsonb
);

-- Brewing yeast
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Saccharomyces cerevisiae (brewing yeast)', 'Ingredient',
  4.50, 0.20, 0.05, 0.12,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "Europe", "confidence": "medium", "notes": "Commercial brewing yeast production"}'::jsonb
);

-- =============================================================================
-- PACKAGING
-- =============================================================================

-- Amber glass bottle 700ml
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Amber glass bottle 700ml', 'Packaging',
  1.10, 0.005, 0.02, 0.05,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "Europe", "confidence": "high", "notes": "Standard amber/brown glass bottle, virgin material"}'::jsonb
);

-- Natural cork stopper
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Natural cork stopper', 'Packaging',
  0.45, 0.10, 0.35, 0.08,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "Portugal", "confidence": "medium", "notes": "Natural cork from cork oak trees, sustainable harvest"}'::jsonb
);

-- Printed paper label
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Printed paper label', 'Packaging',
  0.95, 0.35, 1.80, 0.02,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "Europe", "confidence": "high", "notes": "Paper label with wet glue and printing"}'::jsonb
);

-- PVC shrink capsule
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'PVC shrink capsule', 'Packaging',
  3.20, 0.08, 0.01, 0.15,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "Europe", "confidence": "high", "notes": "PVC plastic shrink capsule for bottle neck"}'::jsonb
);

-- Aluminium can with printing
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Aluminium can 330ml with printing', 'Packaging',
  9.20, 0.18, 0.08, 0.05,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "Europe", "confidence": "high", "notes": "Aluminium beverage can with printed finish"}'::jsonb
);

-- Recycled cardboard carrier
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Recycled cardboard carrier', 'Packaging',
  0.52, 0.25, 1.40, 0.02,
  'kg', 'ecoinvent 3.9.1',
  '{"region": "Europe", "confidence": "high", "notes": "Corrugated cardboard from recycled fibre"}'::jsonb
);

-- Verification
DO $$
DECLARE
  factor_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO factor_count
  FROM staging_emission_factors
  WHERE name IN (
    'Ethanol from molasses',
    'Purified water',
    'Natural vanilla essence',
    'Cinnamon sticks (ground)',
    'Amber glass bottle 700ml',
    'Natural cork stopper',
    'Printed paper label',
    'PVC shrink capsule',
    'Malted wheat',
    'English hops',
    'Brewing water',
    'Saccharomyces cerevisiae (brewing yeast)',
    'Aluminium can 330ml with printing',
    'Recycled cardboard carrier'
  );
  
  RAISE NOTICE 'Successfully added % staging emission factors for test materials', factor_count;
  
  IF factor_count < 14 THEN
    RAISE WARNING 'Expected 14 factors but only created %', factor_count;
  END IF;
END $$;
