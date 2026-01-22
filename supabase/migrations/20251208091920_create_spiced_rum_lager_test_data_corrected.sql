/*
  # Create Test Data: Spiced Rum 700ml & Lager Beer 330ml with Transport

  1. Purpose
     - Create comprehensive test data for validating LCA calculations with transport
     - Test all four transport modes (truck, train, ship, air)
     - Validate multi-capital impact calculations
     - Demonstrate global vs local supply chain scenarios

  2. Test Products

     **Product 1: Spiced Rum 700ml (Global Supply Chain)**
     - Ethanol from molasses (Caribbean - ship transport 8,800 km)
     - Water (local - truck 25 km)
     - Vanilla essence (Madagascar - air freight 8,500 km)
     - Cinnamon sticks (Sri Lanka - ship transport 8,300 km)
     - Packaging: Glass bottle (truck 150 km), cork (truck 1,800 km), label (truck 30 km), capsule (truck 120 km)

     **Product 2: Lager Beer 330ml (Local Sourcing)**
     - Malted wheat (regional farm - truck 80 km)
     - Hops (regional - truck 120 km)
     - Water (local - truck 25 km)
     - Brewing yeast (national - train 450 km)
     - Packaging: Aluminium can (truck 200 km), cardboard carrier (truck 90 km)

  3. Expected Results

     **Spiced Rum 700ml:**
     - Climate Change (materials): 1.236 kg CO2e
     - Transport emissions: ~0.176 kg CO2e (12.5% of total)
     - Total: ~1.412 kg CO2e

     **Lager Beer 330ml:**
     - Climate Change (materials): 0.153 kg CO2e
     - Transport emissions: ~0.001 kg CO2e (0.8% of total)
     - Total: ~0.154 kg CO2e
*/

-- =============================================================================
-- PRODUCT 1: SPICED RUM 700ML (GLOBAL SUPPLY CHAIN)
-- =============================================================================

-- Create the product
INSERT INTO products (
  id, organization_id, name, sku, is_draft, system_boundary, functional_unit
) VALUES (
  1001, '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Test Spiced Rum 700ml', 'TEST-RUM-001', false, 'cradle-to-gate', '1 bottle (700ml)'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, sku = EXCLUDED.sku, system_boundary = EXCLUDED.system_boundary,
  functional_unit = EXCLUDED.functional_unit, updated_at = now();

-- Create the product LCA
INSERT INTO product_lcas (
  id, organization_id, product_name, functional_unit, system_boundary,
  status, reference_year, product_id
) VALUES (
  'b0000000-0000-0000-0000-000000000001'::UUID,
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Test Spiced Rum 700ml', '1 bottle (700ml)',
  'Cradle-to-gate: Raw material extraction through bottling', 'draft', 2024, 1001
) ON CONFLICT (id) DO UPDATE SET
  product_name = EXCLUDED.product_name, functional_unit = EXCLUDED.functional_unit,
  system_boundary = EXCLUDED.system_boundary, reference_year = EXCLUDED.reference_year;

-- Delete existing materials
DELETE FROM product_lca_materials WHERE product_lca_id = 'b0000000-0000-0000-0000-000000000001';

-- INGREDIENT 1: Ethanol from Molasses (450g) - Ship from Barbados
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, origin_address, origin_lat, origin_lng,
  transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000001', 'Ethanol from molasses', 0.45, 'kg',
  1.85, 0.80, 0.05, 0.02, 'secondary_modelled',
  'Bridgetown, Barbados', 13.0969, -59.6145, 'ship', 8800
);

-- INGREDIENT 2: Water (200g) - Truck from local treatment plant
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, origin_address, origin_lat, origin_lng,
  transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000001', 'Purified water', 0.20, 'kg',
  0.0003, 1.0, 0.0001, 0.0001, 'secondary_modelled',
  'Bristol Water Treatment Plant, UK', 51.4700, -2.5500, 'truck', 25
);

-- INGREDIENT 3: Vanilla Essence (1.5g) - Air freight from Madagascar
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, origin_address, origin_lat, origin_lng,
  transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000001', 'Natural vanilla essence', 0.0015, 'kg',
  8.50, 1.20, 2.80, 0.15, 'secondary_modelled',
  'Antananarivo, Madagascar', -18.8792, 47.5079, 'air', 8500
);

-- INGREDIENT 4: Cinnamon Sticks (0.3g) - Ship from Sri Lanka
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, origin_address, origin_lat, origin_lng,
  transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000001', 'Cinnamon sticks (ground)', 0.0003, 'kg',
  3.20, 0.85, 1.50, 0.12, 'secondary_modelled',
  'Colombo, Sri Lanka', 6.9271, 79.8612, 'ship', 8300
);

-- PACKAGING 1: Amber Glass Bottle (350g) - Truck from regional supplier
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, packaging_category, origin_address,
  origin_lat, origin_lng, transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000001', 'Amber glass bottle 700ml', 0.35, 'kg',
  1.10, 0.005, 0.02, 0.05, 'secondary_modelled', 'container',
  'Doncaster Glass Works, UK', 53.5228, -1.1285, 'truck', 150
);

-- PACKAGING 2: Natural Cork Stopper (4g) - Truck from Portugal
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, packaging_category, origin_address,
  origin_lat, origin_lng, transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000001', 'Natural cork stopper', 0.004, 'kg',
  0.45, 0.10, 0.35, 0.08, 'secondary_modelled', 'closure',
  'Lisbon, Portugal', 38.7223, -9.1393, 'truck', 1800
);

-- PACKAGING 3: Paper Label (2g) - Truck from local printer
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, packaging_category, origin_address,
  origin_lat, origin_lng, transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000001', 'Printed paper label', 0.002, 'kg',
  0.95, 0.35, 1.80, 0.02, 'secondary_modelled', 'label',
  'Bath Printers, UK', 51.3751, -2.3697, 'truck', 30
);

-- PACKAGING 4: Shrink Capsule (0.5g) - Truck from regional manufacturer
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, packaging_category, origin_address,
  origin_lat, origin_lng, transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000001', 'PVC shrink capsule', 0.0005, 'kg',
  3.20, 0.08, 0.01, 0.15, 'secondary_modelled', 'closure',
  'Birmingham, UK', 52.4862, -1.8904, 'truck', 120
);

-- =============================================================================
-- PRODUCT 2: LAGER BEER 330ML (LOCAL SOURCING)
-- =============================================================================

-- Create the product
INSERT INTO products (
  id, organization_id, name, sku, is_draft, system_boundary, functional_unit
) VALUES (
  1002, '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Test Lager Beer 330ml', 'TEST-LAGER-001', false, 'cradle-to-gate', '1 can (330ml)'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, sku = EXCLUDED.sku, system_boundary = EXCLUDED.system_boundary,
  functional_unit = EXCLUDED.functional_unit, updated_at = now();

-- Create the product LCA
INSERT INTO product_lcas (
  id, organization_id, product_name, functional_unit, system_boundary,
  status, reference_year, product_id
) VALUES (
  'b0000000-0000-0000-0000-000000000002'::UUID,
  '2d86de84-e24e-458b-84b9-fd4057998bda'::UUID,
  'Test Lager Beer 330ml', '1 can (330ml)',
  'Cradle-to-gate: Raw material extraction through packaging', 'draft', 2024, 1002
) ON CONFLICT (id) DO UPDATE SET
  product_name = EXCLUDED.product_name, functional_unit = EXCLUDED.functional_unit,
  system_boundary = EXCLUDED.system_boundary, reference_year = EXCLUDED.reference_year;

-- Delete existing materials
DELETE FROM product_lca_materials WHERE product_lca_id = 'b0000000-0000-0000-0000-000000000002';

-- INGREDIENT 1: Malted Wheat (12g) - Truck from regional farm
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, origin_address, origin_lat, origin_lng,
  transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000002', 'Malted wheat', 0.012, 'kg',
  0.65, 0.90, 1.20, 0.08, 'secondary_modelled',
  'Gloucester Farm, UK', 51.8642, -2.2381, 'truck', 80
);

-- INGREDIENT 2: Hops (0.2g) - Truck from regional hop farm
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, origin_address, origin_lat, origin_lng,
  transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000002', 'English hops', 0.0002, 'kg',
  2.80, 1.50, 3.20, 0.10, 'secondary_modelled',
  'Hereford Hop Farm, UK', 52.0565, -2.7160, 'truck', 120
);

-- INGREDIENT 3: Water (300g) - Truck from local treatment plant
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, origin_address, origin_lat, origin_lng,
  transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000002', 'Brewing water', 0.30, 'kg',
  0.0003, 1.0, 0.0001, 0.0001, 'secondary_modelled',
  'Bristol Water Treatment Plant', 51.4700, -2.5500, 'truck', 25
);

-- INGREDIENT 4: Brewing Yeast (0.5g) - Train from Scotland
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, origin_address, origin_lat, origin_lng,
  transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000002', 'Saccharomyces cerevisiae (brewing yeast)', 0.0005, 'kg',
  4.50, 0.20, 0.05, 0.12, 'secondary_modelled',
  'Edinburgh Yeast Lab, Scotland', 55.9533, -3.1883, 'train', 450
);

-- PACKAGING 1: Aluminium Can (15g) - Truck from regional manufacturer
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, packaging_category, origin_address,
  origin_lat, origin_lng, transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000002', 'Aluminium can 330ml with printing', 0.015, 'kg',
  9.20, 0.18, 0.08, 0.05, 'secondary_modelled', 'container',
  'Warrington Can Plant, UK', 53.3900, -2.5970, 'truck', 200
);

-- PACKAGING 2: Cardboard Carrier (8g) - Truck from regional supplier
INSERT INTO product_lca_materials (
  product_lca_id, name, quantity, unit, impact_climate, impact_water,
  impact_land, impact_waste, impact_source, packaging_category, origin_address,
  origin_lat, origin_lng, transport_mode, distance_km
) VALUES (
  'b0000000-0000-0000-0000-000000000002', 'Recycled cardboard carrier', 0.008, 'kg',
  0.52, 0.25, 1.40, 0.02, 'secondary_modelled', 'secondary',
  'Cardiff Packaging, Wales', 51.4816, -3.1791, 'truck', 90
);
