/*
  # Populate product_materials for test products

  1. Purpose
     - Copy material data from product_lca_materials to product_materials table
     - Enable UI to display ingredients and packaging for test products
     - Maintain all transport and origin data

  2. Affected Products
     - Product 1001: Test Spiced Rum 700ml
     - Product 1002: Test Lager Beer 330ml

  3. Data Mapping
     - Ingredients: materials without packaging_category
     - Packaging: materials with packaging_category
     - All transport data preserved
*/

-- Delete any existing product_materials for test products
DELETE FROM product_materials WHERE product_id IN (1001, 1002);

-- =============================================================================
-- PRODUCT 1: SPICED RUM 700ML
-- =============================================================================

-- Copy materials from product_lca_materials to product_materials
-- Ingredients (no packaging_category)
INSERT INTO product_materials (
  product_id,
  material_name,
  material_type,
  quantity,
  unit,
  data_source,
  transport_mode,
  distance_km,
  origin_country,
  notes
)
SELECT 
  1001,
  m.name,
  'ingredient',
  m.quantity,
  m.unit,
  NULL, -- data_source must be NULL or 'openlca'/'supplier' with IDs
  m.transport_mode,
  m.distance_km,
  CASE 
    WHEN m.origin_address LIKE '%Barbados%' THEN 'Barbados'
    WHEN m.origin_address LIKE '%Madagascar%' THEN 'Madagascar'
    WHEN m.origin_address LIKE '%Sri Lanka%' THEN 'Sri Lanka'
    WHEN m.origin_address LIKE '%UK%' THEN 'United Kingdom'
    ELSE NULL
  END,
  'Test data - Origin: ' || COALESCE(m.origin_address, 'Unknown')
FROM product_lca_materials m
JOIN product_lcas l ON l.id = m.product_lca_id
WHERE l.product_id = 1001
  AND m.packaging_category IS NULL;

-- Packaging (has packaging_category)
INSERT INTO product_materials (
  product_id,
  material_name,
  material_type,
  quantity,
  unit,
  packaging_category,
  data_source,
  transport_mode,
  distance_km,
  origin_country,
  notes
)
SELECT 
  1001,
  m.name,
  'packaging',
  m.quantity,
  m.unit,
  m.packaging_category,
  NULL,
  m.transport_mode,
  m.distance_km,
  CASE 
    WHEN m.origin_address LIKE '%Portugal%' THEN 'Portugal'
    WHEN m.origin_address LIKE '%UK%' THEN 'United Kingdom'
    ELSE 'United Kingdom'
  END,
  'Test data - Origin: ' || COALESCE(m.origin_address, 'Unknown')
FROM product_lca_materials m
JOIN product_lcas l ON l.id = m.product_lca_id
WHERE l.product_id = 1001
  AND m.packaging_category IS NOT NULL;

-- =============================================================================
-- PRODUCT 2: LAGER BEER 330ML
-- =============================================================================

-- Ingredients (no packaging_category)
INSERT INTO product_materials (
  product_id,
  material_name,
  material_type,
  quantity,
  unit,
  data_source,
  transport_mode,
  distance_km,
  origin_country,
  notes
)
SELECT 
  1002,
  m.name,
  'ingredient',
  m.quantity,
  m.unit,
  NULL,
  m.transport_mode,
  m.distance_km,
  CASE 
    WHEN m.origin_address LIKE '%Scotland%' THEN 'United Kingdom'
    WHEN m.origin_address LIKE '%UK%' THEN 'United Kingdom'
    ELSE 'United Kingdom'
  END,
  'Test data - Origin: ' || COALESCE(m.origin_address, 'Unknown')
FROM product_lca_materials m
JOIN product_lcas l ON l.id = m.product_lca_id
WHERE l.product_id = 1002
  AND m.packaging_category IS NULL;

-- Packaging (has packaging_category)
INSERT INTO product_materials (
  product_id,
  material_name,
  material_type,
  quantity,
  unit,
  packaging_category,
  data_source,
  transport_mode,
  distance_km,
  origin_country,
  notes
)
SELECT 
  1002,
  m.name,
  'packaging',
  m.quantity,
  m.unit,
  m.packaging_category,
  NULL,
  m.transport_mode,
  m.distance_km,
  CASE 
    WHEN m.origin_address LIKE '%Wales%' THEN 'United Kingdom'
    ELSE 'United Kingdom'
  END,
  'Test data - Origin: ' || COALESCE(m.origin_address, 'Unknown')
FROM product_lca_materials m
JOIN product_lcas l ON l.id = m.product_lca_id
WHERE l.product_id = 1002
  AND m.packaging_category IS NOT NULL;

-- Verify the data was inserted correctly
DO $$
DECLARE
  rum_ingredient_count INTEGER;
  rum_packaging_count INTEGER;
  lager_ingredient_count INTEGER;
  lager_packaging_count INTEGER;
BEGIN
  -- Count materials for each product
  SELECT COUNT(*) INTO rum_ingredient_count
  FROM product_materials
  WHERE product_id = 1001 AND material_type = 'ingredient';
  
  SELECT COUNT(*) INTO rum_packaging_count
  FROM product_materials
  WHERE product_id = 1001 AND material_type = 'packaging';
  
  SELECT COUNT(*) INTO lager_ingredient_count
  FROM product_materials
  WHERE product_id = 1002 AND material_type = 'ingredient';
  
  SELECT COUNT(*) INTO lager_packaging_count
  FROM product_materials
  WHERE product_id = 1002 AND material_type = 'packaging';
  
  -- Log the results
  RAISE NOTICE 'Test Spiced Rum 700ml: % ingredients, % packaging items', 
    rum_ingredient_count, rum_packaging_count;
  RAISE NOTICE 'Test Lager Beer 330ml: % ingredients, % packaging items', 
    lager_ingredient_count, lager_packaging_count;
  
  -- Verify we have the expected counts
  IF rum_ingredient_count < 4 OR rum_packaging_count < 4 THEN
    RAISE WARNING 'Spiced Rum may be missing materials (expected 4 ingredients and 4 packaging)';
  END IF;
  
  IF lager_ingredient_count < 4 OR lager_packaging_count < 2 THEN
    RAISE WARNING 'Lager Beer may be missing materials (expected 4 ingredients and 2 packaging)';
  END IF;
END $$;
