/*
  # Comprehensive Test Materials for LCA Calculation Testing
  
  1. Purpose
     - Create a complete set of beverage materials with full multi-capital impact factors
     - Enable end-to-end testing of LCA calculation accuracy
     - Provide materials with known, verifiable impact values
  
  2. Materials Created (10 total)
     **Ingredients:**
     - Water (Municipal Treatment): Minimal impacts baseline
     - Sugar (Cane - Global): High water/land use
     - Sugar (Beet - EU): Lower water/land alternative  
     - Citric Acid: Chemical processing impacts
     - Natural Flavouring: Moderate multi-capital
     - CO2 (Food Grade): Minimal waste, some climate
     
     **Packaging:**
     - Glass Bottle (Standard Flint): High energy, recyclable
     - Glass Bottle (60% PCR): Lower impact recycled option
     - Kraft Paper Label: Renewable, biodegradable
     - HDPE Cap: Plastic closure material
  
  3. Impact Factor Sources
     - Ecoinvent 3.8 database references
     - DEFRA 2025 conversion factors
     - Industry EPD data (beverage packaging)
     - Conservative estimates where specific data unavailable
  
  4. Multi-Capital Framework
     - Climate (CO2): kg CO2e per reference unit
     - Water: m³ per reference unit (consumptive use)
     - Land: m² per reference unit (occupation)
     - Waste: kg per reference unit (non-recycled residuals)
  
  5. Testing Strategy
     These materials enable creation of test LCAs with:
     - Predictable, calculable results
     - Multi-capital impact coverage
     - Real-world beverage industry relevance
     - Mix of high/low impact materials for contrast
*/

-- Delete any existing test materials first to avoid duplicates
DELETE FROM staging_emission_factors 
WHERE organization_id = '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID
  AND name IN (
    'Water (Municipal Treatment)',
    'Sugar (Cane - Global)',
    'Sugar (Beet - EU)',
    'Citric Acid',
    'Natural Flavouring',
    'CO2 (Food Grade)',
    'Glass Bottle (Standard Flint)',
    'Glass Bottle (60% PCR)',
    'Kraft Paper Label',
    'HDPE Cap'
  );

-- WATER (Municipal Treatment)
-- Baseline: minimal impacts, high water factor by definition
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, uuid_ref, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Water (Municipal Treatment)',
  'Ingredient',
  0.0003,  -- 0.3 g CO2e per kg (treatment energy)
  1.0,     -- 1 m³ water per m³ (definitional)
  0.0001,  -- Minimal land for treatment facility
  0.0001,  -- Minimal sludge waste
  'kg',
  'Ecoinvent 3.8: tap water, at user | GB',
  'ecoinvent-water-municipal-gb-001',
  '{"data_quality": "high", "temporal": "2020-2022", "geographical": "GB", "notes": "Municipal water treatment including distribution"}'::jsonb
);

-- SUGAR (Cane - Global)
-- High water and land use, significant waste
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, uuid_ref, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Sugar (Cane - Global)',
  'Ingredient',
  0.90,    -- 900 g CO2e per kg (cultivation + processing)
  0.25,    -- 250 L water per kg (irrigation + processing)
  1.40,    -- 1.4 m² per kg (cane cultivation area)
  0.10,    -- 100 g waste per kg (bagasse if not recovered)
  'kg',
  'Ecoinvent 3.8: sugar, from sugar cane | GLO',
  'ecoinvent-sugar-cane-global-001',
  '{"data_quality": "medium", "temporal": "2018-2021", "geographical": "GLO", "notes": "Global average cane sugar including cultivation, milling, refining"}'::jsonb
);

-- SUGAR (Beet - EU)
-- Lower water/land than cane, European production
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, uuid_ref, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Sugar (Beet - EU)',
  'Ingredient',
  0.55,    -- 550 g CO2e per kg (lower than cane)
  0.15,    -- 150 L water per kg (rain-fed in EU)
  1.20,    -- 1.2 m² per kg (beet cultivation)
  0.05,    -- 50 g waste per kg (beet pulp if not recovered)
  'kg',
  'Ecoinvent 3.8: sugar, from sugar beet | EU-27',
  'ecoinvent-sugar-beet-eu-001',
  '{"data_quality": "high", "temporal": "2019-2022", "geographical": "EU-27", "notes": "European beet sugar, typically rain-fed, lower impacts than cane"}'::jsonb
);

-- CITRIC ACID (Food Grade)
-- Chemical production, moderate impacts
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, uuid_ref, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Citric Acid',
  'Ingredient',
  1.20,    -- 1.2 kg CO2e per kg (fermentation + purification)
  0.80,    -- 800 L water per kg (process water)
  0.02,    -- 0.02 m² per kg (industrial facility)
  0.05,    -- 50 g waste per kg (fermentation residues)
  'kg',
  'Ecoinvent 3.8: citric acid | GLO',
  'ecoinvent-citric-acid-global-001',
  '{"data_quality": "medium", "temporal": "2018-2021", "geographical": "GLO", "notes": "Industrial fermentation process from molasses"}'::jsonb
);

-- NATURAL FLAVOURING (Plant-Based)
-- Botanical extraction, land use for cultivation
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, uuid_ref, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Natural Flavouring',
  'Ingredient',
  0.65,    -- 650 g CO2e per kg (cultivation + extraction)
  0.40,    -- 400 L water per kg (plant cultivation)
  1.20,    -- 1.2 m² per kg (botanical cultivation area)
  0.03,    -- 30 g waste per kg (extraction residues)
  'kg',
  'Industry EPD: natural plant extracts | EU',
  'epd-natural-flavour-eu-001',
  '{"data_quality": "medium", "temporal": "2020-2023", "geographical": "EU", "notes": "Concentrated botanical extracts from European herbs/flowers"}'::jsonb
);

-- CO2 (Food Grade)
-- Carbonation gas, minimal waste
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, uuid_ref, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'CO2 (Food Grade)',
  'Ingredient',
  0.15,    -- 150 g CO2e per kg (capture/compression energy)
  0.01,    -- 10 L water per kg (minimal cooling water)
  0.0,     -- No land use (industrial gas)
  0.0,     -- No waste (pure gas)
  'kg',
  'Ecoinvent 3.8: carbon dioxide, liquid | GLO',
  'ecoinvent-co2-liquid-global-001',
  '{"data_quality": "high", "temporal": "2019-2022", "geographical": "GLO", "notes": "Food-grade CO2 for carbonation, typically recovered from fermentation or industrial processes"}'::jsonb
);

-- GLASS BOTTLE (Standard Flint)
-- Virgin glass production, high energy
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, uuid_ref, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Glass Bottle (Standard Flint)',
  'Packaging',
  1.10,    -- 1.1 kg CO2e per kg (energy-intensive melting)
  0.005,   -- 5 L water per kg (cooling water)
  0.02,    -- 0.02 m² per kg (factory space)
  0.05,    -- 50 g waste per kg (cullet loss)
  'kg',
  'Ecoinvent 3.8: packaging glass, white | EU-27',
  'ecoinvent-glass-bottle-virgin-eu-001',
  '{"data_quality": "high", "temporal": "2020-2022", "geographical": "EU-27", "notes": "Virgin flint glass bottle production, 100% recyclable", "recycled_content": 0}'::jsonb
);

-- GLASS BOTTLE (60% PCR)
-- Recycled content glass, lower impacts
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, uuid_ref, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Glass Bottle (60% PCR)',
  'Packaging',
  0.65,    -- 650 g CO2e per kg (lower melting temp with cullet)
  0.003,   -- 3 L water per kg
  0.01,    -- 0.01 m² per kg
  0.02,    -- 20 g waste per kg (reduced losses)
  'kg',
  'Industry EPD: recycled content glass | EU',
  'epd-glass-bottle-60pcr-eu-001',
  '{"data_quality": "high", "temporal": "2021-2023", "geographical": "EU", "notes": "Glass bottle with 60% post-consumer recycled content", "recycled_content": 60}'::jsonb
);

-- KRAFT PAPER LABEL
-- Renewable, biodegradable labelling
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, uuid_ref, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Kraft Paper Label',
  'Packaging',
  0.95,    -- 950 g CO2e per kg (pulping + printing)
  0.35,    -- 350 L water per kg (paper production)
  1.80,    -- 1.8 m² per kg (forestry for pulp)
  0.02,    -- 20 g waste per kg (printing waste)
  'kg',
  'Ecoinvent 3.8: kraft paper, unbleached | EU-27',
  'ecoinvent-kraft-paper-eu-001',
  '{"data_quality": "high", "temporal": "2020-2022", "geographical": "EU-27", "notes": "Unbleached kraft paper labels, FSC certified, biodegradable"}'::jsonb
);

-- HDPE CAP
-- Plastic closure, fossil-based
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
  reference_unit, source, uuid_ref, metadata
) VALUES (
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'HDPE Cap',
  'Packaging',
  1.50,    -- 1.5 kg CO2e per kg (petrochemical production)
  0.12,    -- 120 L water per kg (process cooling)
  0.05,    -- 0.05 m² per kg (industrial facility)
  0.08,    -- 80 g waste per kg (if not recycled)
  'kg',
  'Ecoinvent 3.8: polyethylene, high density, granulate | EU-27',
  'ecoinvent-hdpe-granulate-eu-001',
  '{"data_quality": "high", "temporal": "2019-2022", "geographical": "EU-27", "notes": "HDPE resin for bottle caps, injection molded, recyclable"}'::jsonb
);
