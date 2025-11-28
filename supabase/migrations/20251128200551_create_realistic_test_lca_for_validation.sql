/*
  # Create Realistic Test LCA for Calculation Validation
  
  1. Purpose
     - Create a "Test Sparkling Lemonade 330ml" product with realistic quantities
     - Enable manual calculation verification
     - Provide clear expected results for testing
  
  2. Product Specification
     **Test Sparkling Lemonade (330ml glass bottle)**
     - 300ml carbonated water (0.3 kg)
     - 25g sugar (0.025 kg)
     - 0.5g citric acid (0.0005 kg)
     - 0.2g natural flavouring (0.0002 kg)
     - 200g glass bottle (0.2 kg)
     - 2g paper label (0.002 kg)
  
  3. Expected Calculation (Manual)
     **Climate Change (kg CO2e):**
     - Water: 0.3kg × 0.0003 = 0.00009 kg CO2e
     - Sugar: 0.025kg × 0.90 = 0.0225 kg CO2e
     - Citric Acid: 0.0005kg × 1.20 = 0.0006 kg CO2e
     - Natural Flavour: 0.0002kg × 0.65 = 0.00013 kg CO2e
     - Glass Bottle: 0.2kg × 1.10 = 0.22 kg CO2e
     - Paper Label: 0.002kg × 0.95 = 0.0019 kg CO2e
     - **TOTAL: 0.2452 kg CO2e**
     
     **Water Depletion (m³):**
     - Water: 0.3 × 1.0 = 0.3 m³
     - Sugar: 0.025 × 0.25 = 0.00625 m³
     - Citric Acid: 0.0005 × 0.80 = 0.0004 m³
     - Natural Flavour: 0.0002 × 0.40 = 0.00008 m³
     - Glass Bottle: 0.2 × 0.005 = 0.001 m³
     - Paper Label: 0.002 × 0.35 = 0.0007 m³
     - **TOTAL: 0.30843 m³ = 308.43 L**
     
     **Land Use (m²):**
     - Water: 0.3 × 0.0001 = 0.00003 m²
     - Sugar: 0.025 × 1.40 = 0.035 m²
     - Citric Acid: 0.0005 × 0.02 = 0.00001 m²
     - Natural Flavour: 0.0002 × 1.20 = 0.00024 m²
     - Glass Bottle: 0.2 × 0.02 = 0.004 m²
     - Paper Label: 0.002 × 1.80 = 0.0036 m²
     - **TOTAL: 0.04288 m²**
     
     **Waste Generation (kg):**
     - Water: 0.3 × 0.0001 = 0.00003 kg
     - Sugar: 0.025 × 0.10 = 0.0025 kg
     - Citric Acid: 0.0005 × 0.05 = 0.000025 kg
     - Natural Flavour: 0.0002 × 0.03 = 0.000006 kg
     - Glass Bottle: 0.2 × 0.05 = 0.01 kg
     - Paper Label: 0.002 × 0.02 = 0.00004 kg
     - **TOTAL: 0.01260 kg**
  
  4. Validation Criteria
     - Climate: 0.2452 kg CO2e (±5%)
     - Water: 0.30843 m³ (±5%)
     - Land: 0.04288 m² (±5%)
     - Waste: 0.01260 kg (±5%)
*/

-- Create the test LCA
INSERT INTO product_lcas (
  id,
  organization_id,
  product_name,
  functional_unit,
  system_boundary,
  status,
  reference_year
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Test Sparkling Lemonade 330ml',
  '1 bottle (330ml filled, capped, and labelled)',
  'Cradle-to-gate: Raw material extraction through product leaving facility',
  'draft',
  2024
) ON CONFLICT (id) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  functional_unit = EXCLUDED.functional_unit,
  system_boundary = EXCLUDED.system_boundary,
  status = 'draft',
  reference_year = 2024;

-- Delete any existing materials and results for this test LCA
DELETE FROM product_lca_materials 
WHERE product_lca_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM product_lca_results
WHERE product_lca_id = '00000000-0000-0000-0000-000000000001';

-- Add materials with pre-calculated impact factors

-- WATER: 300ml (0.3 kg)
INSERT INTO product_lca_materials (
  product_lca_id,
  name,
  quantity,
  unit,
  data_source,
  data_source_id,
  impact_climate,
  impact_water,
  impact_land,
  impact_waste,
  impact_source
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Water (Municipal Treatment)',
  0.3,
  'kg',
  'openlca',
  '830059ba-100c-434b-925c-598e57a982dd',
  0.00009,   -- 0.3 × 0.0003
  0.3,       -- 0.3 × 1.0 (m³)
  0.00003,   -- 0.3 × 0.0001
  0.00003,   -- 0.3 × 0.0001
  'secondary_modelled'
);

-- SUGAR: 25g (0.025 kg)
INSERT INTO product_lca_materials (
  product_lca_id,
  name,
  quantity,
  unit,
  data_source,
  data_source_id,
  impact_climate,
  impact_water,
  impact_land,
  impact_waste,
  impact_source
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Sugar (Cane - Global)',
  0.025,
  'kg',
  'openlca',
  '86125902-7800-4921-93d4-b885f18fb2d1',
  0.0225,    -- 0.025 × 0.90
  0.00625,   -- 0.025 × 0.25 (m³)
  0.035,     -- 0.025 × 1.40
  0.0025,    -- 0.025 × 0.10
  'secondary_modelled'
);

-- CITRIC ACID: 0.5g (0.0005 kg)
INSERT INTO product_lca_materials (
  product_lca_id,
  name,
  quantity,
  unit,
  data_source,
  data_source_id,
  impact_climate,
  impact_water,
  impact_land,
  impact_waste,
  impact_source
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Citric Acid',
  0.0005,
  'kg',
  'openlca',
  '9cc61ec3-f883-40e5-95a9-5f7ab624dc7b',
  0.0006,    -- 0.0005 × 1.20
  0.0004,    -- 0.0005 × 0.80 (m³)
  0.00001,   -- 0.0005 × 0.02
  0.000025,  -- 0.0005 × 0.05
  'secondary_modelled'
);

-- NATURAL FLAVOURING: 0.2g (0.0002 kg)
INSERT INTO product_lca_materials (
  product_lca_id,
  name,
  quantity,
  unit,
  data_source,
  data_source_id,
  impact_climate,
  impact_water,
  impact_land,
  impact_waste,
  impact_source
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Natural Flavouring',
  0.0002,
  'kg',
  'openlca',
  '38c2a1dc-8238-4b62-bd62-71536f14d6b1',
  0.00013,   -- 0.0002 × 0.65
  0.00008,   -- 0.0002 × 0.40 (m³)
  0.00024,   -- 0.0002 × 1.20
  0.000006,  -- 0.0002 × 0.03
  'secondary_modelled'
);

-- GLASS BOTTLE: 200g (0.2 kg)
INSERT INTO product_lca_materials (
  product_lca_id,
  name,
  quantity,
  unit,
  data_source,
  data_source_id,
  impact_climate,
  impact_water,
  impact_land,
  impact_waste,
  impact_source
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Glass Bottle (Standard Flint)',
  0.2,
  'kg',
  'openlca',
  '824dfe5a-1440-462a-bb3a-0a17ab074722',
  0.22,      -- 0.2 × 1.10
  0.001,     -- 0.2 × 0.005 (m³)
  0.004,     -- 0.2 × 0.02
  0.01,      -- 0.2 × 0.05
  'secondary_modelled'
);

-- PAPER LABEL: 2g (0.002 kg)
INSERT INTO product_lca_materials (
  product_lca_id,
  name,
  quantity,
  unit,
  data_source,
  data_source_id,
  impact_climate,
  impact_water,
  impact_land,
  impact_waste,
  impact_source
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Kraft Paper Label',
  0.002,
  'kg',
  'openlca',
  'cfd12354-ad6a-4d78-9f4f-8d1f68da9441',
  0.0019,    -- 0.002 × 0.95
  0.0007,    -- 0.002 × 0.35 (m³)
  0.0036,    -- 0.002 × 1.80
  0.00004,   -- 0.002 × 0.02
  'secondary_modelled'
);

-- Calculate and insert results
INSERT INTO product_lca_results (
  product_lca_id,
  impact_category,
  value,
  unit,
  method
) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Climate Change', 0.2452, 'kg CO₂ eq', 'Hybrid (Stored Material Factors)'),
  ('00000000-0000-0000-0000-000000000001', 'Water Depletion', 0.30843, 'm³', 'Hybrid (Stored Material Factors)'),
  ('00000000-0000-0000-0000-000000000001', 'Land Use', 0.04288, 'm²', 'Hybrid (Stored Material Factors)'),
  ('00000000-0000-0000-0000-000000000001', 'Waste Generation', 0.01260, 'kg', 'Hybrid (Stored Material Factors)');

-- Update LCA status to completed
UPDATE product_lcas
SET status = 'completed'
WHERE id = '00000000-0000-0000-0000-000000000001';
