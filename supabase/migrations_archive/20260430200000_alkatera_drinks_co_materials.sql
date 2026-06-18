-- ============================================================================
-- alkatera Drinks Co: Product Ingredients & Packaging
-- Adds materials data for all 5 demo products
-- ============================================================================

-- ==========================================================================
-- 1. COTSWOLDS ESTATE BACCHUS 2024 (WINE-BCH-24)
-- ==========================================================================

-- Ingredients
INSERT INTO "public"."product_materials" (product_id, material_name, material_type, quantity, unit, origin_country, origin_country_code)
SELECT p.id, v.material_name, 'ingredient', v.quantity, v.unit, v.origin_country, v.origin_country_code
FROM "public"."products" p
CROSS JOIN (VALUES
  ('Bacchus Grapes',         1.200, 'kg', 'United Kingdom', 'GB'),
  ('Wine Yeast (S. cerevisiae)', 0.0003, 'kg', 'France', 'FR'),
  ('Water',                  0.500, 'l',  'United Kingdom', 'GB'),
  ('Bentonite Fining Agent', 0.001, 'kg', 'Germany', 'DE'),
  ('Potassium Metabisulphite', 0.0001, 'kg', 'United Kingdom', 'GB')
) AS v(material_name, quantity, unit, origin_country, origin_country_code)
WHERE p.sku = 'WINE-BCH-24'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001';

-- Packaging
INSERT INTO "public"."product_materials" (product_id, material_name, material_type, packaging_category, quantity, unit, total_weight_kg, net_weight_g, recycled_content_percentage, epr_material_type, epr_is_drinks_container, origin_country, origin_country_code)
SELECT p.id, v.material_name, 'packaging', v.packaging_category, v.quantity, 'unit', v.total_weight_kg, v.net_weight_g, v.recycled_pct, v.epr_material, v.is_drinks, v.origin_country, v.origin_country_code
FROM "public"."products" p
CROSS JOIN (VALUES
  ('750ml Glass Bottle',   'container', 1, 0.500, 500.0, 0,   'glass',          true,  'United Kingdom', 'GB'),
  ('Natural Cork',         'closure',   1, 0.005,   5.0, 0,   'wood',           false, 'Portugal',       'PT'),
  ('Aluminium Foil Cap',   'closure',   1, 0.003,   3.0, 0,   'aluminium',      false, 'United Kingdom', 'GB'),
  ('Paper Label',          'label',     1, 0.004,   4.0, 80,  'paper_cardboard', false, 'United Kingdom', 'GB'),
  ('Cardboard Case (6pk)', 'secondary', 0.166667, 0.150, 150.0, 85, 'paper_cardboard', false, 'United Kingdom', 'GB')
) AS v(material_name, packaging_category, quantity, total_weight_kg, net_weight_g, recycled_pct, epr_material, is_drinks, origin_country, origin_country_code)
WHERE p.sku = 'WINE-BCH-24'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001';

-- ==========================================================================
-- 2. HIGHLAND RESERVE 12YR SINGLE MALT (WHSK-HR-12)
-- ==========================================================================

-- Ingredients
INSERT INTO "public"."product_materials" (product_id, material_name, material_type, quantity, unit, origin_country, origin_country_code)
SELECT p.id, v.material_name, 'ingredient', v.quantity, v.unit, v.origin_country, v.origin_country_code
FROM "public"."products" p
CROSS JOIN (VALUES
  ('Organic Malted Barley', 0.800, 'kg', 'United Kingdom', 'GB'),
  ('Distillers Yeast',      0.001, 'kg', 'United Kingdom', 'GB'),
  ('Highland Spring Water', 1.500, 'l',  'United Kingdom', 'GB')
) AS v(material_name, quantity, unit, origin_country, origin_country_code)
WHERE p.sku = 'WHSK-HR-12'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001';

-- Packaging
INSERT INTO "public"."product_materials" (product_id, material_name, material_type, packaging_category, quantity, unit, total_weight_kg, net_weight_g, recycled_content_percentage, epr_material_type, epr_is_drinks_container, origin_country, origin_country_code)
SELECT p.id, v.material_name, 'packaging', v.packaging_category, v.quantity, 'unit', v.total_weight_kg, v.net_weight_g, v.recycled_pct, v.epr_material, v.is_drinks, v.origin_country, v.origin_country_code
FROM "public"."products" p
CROSS JOIN (VALUES
  ('700ml Heavy Flint Glass Bottle', 'container', 1, 0.750, 750.0, 0,   'glass',           true,  'United Kingdom', 'GB'),
  ('Natural Cork Stopper',           'closure',   1, 0.008,   8.0, 0,   'wood',            false, 'Portugal',       'PT'),
  ('Wooden Bar Top',                 'closure',   1, 0.015,  15.0, 0,   'wood',            false, 'United Kingdom', 'GB'),
  ('Aluminium Foil Capsule',         'closure',   1, 0.004,   4.0, 0,   'aluminium',       false, 'United Kingdom', 'GB'),
  ('Paper Label (Front & Back)',     'label',     1, 0.006,   6.0, 80,  'paper_cardboard', false, 'United Kingdom', 'GB'),
  ('Cardboard Gift Box',            'secondary',  1, 0.180, 180.0, 70,  'paper_cardboard', false, 'United Kingdom', 'GB')
) AS v(material_name, packaging_category, quantity, total_weight_kg, net_weight_g, recycled_pct, epr_material, is_drinks, origin_country, origin_country_code)
WHERE p.sku = 'WHSK-HR-12'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001';

-- ==========================================================================
-- 3. WEST COUNTRY SESSION ALE (BEER-WCSA-01)
-- ==========================================================================

-- Ingredients
INSERT INTO "public"."product_materials" (product_id, material_name, material_type, quantity, unit, origin_country, origin_country_code)
SELECT p.id, v.material_name, 'ingredient', v.quantity, v.unit, v.origin_country, v.origin_country_code
FROM "public"."products" p
CROSS JOIN (VALUES
  ('Maris Otter Pale Malt',  0.085, 'kg', 'United Kingdom', 'GB'),
  ('Crystal Malt 60L',       0.008, 'kg', 'United Kingdom', 'GB'),
  ('Wheat Malt',              0.005, 'kg', 'United Kingdom', 'GB'),
  ('East Kent Goldings Hops', 0.003, 'kg', 'United Kingdom', 'GB'),
  ('Fuggle Hops',             0.002, 'kg', 'United Kingdom', 'GB'),
  ('Ale Yeast (S. cerevisiae)', 0.0005, 'kg', 'United Kingdom', 'GB'),
  ('Water',                   0.350, 'l',  'United Kingdom', 'GB'),
  ('Calcium Sulphate (Gypsum)', 0.0002, 'kg', 'United Kingdom', 'GB')
) AS v(material_name, quantity, unit, origin_country, origin_country_code)
WHERE p.sku = 'BEER-WCSA-01'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001';

-- Packaging
INSERT INTO "public"."product_materials" (product_id, material_name, material_type, packaging_category, quantity, unit, total_weight_kg, net_weight_g, recycled_content_percentage, epr_material_type, epr_is_drinks_container, origin_country, origin_country_code)
SELECT p.id, v.material_name, 'packaging', v.packaging_category, v.quantity, 'unit', v.total_weight_kg, v.net_weight_g, v.recycled_pct, v.epr_material, v.is_drinks, v.origin_country, v.origin_country_code
FROM "public"."products" p
CROSS JOIN (VALUES
  ('330ml Aluminium Can',               'container', 1,          0.015,  15.0, 100, 'aluminium',       true,  'United Kingdom', 'GB'),
  ('Aluminium Ring Pull Lid',           'closure',   1,          0.003,   3.0, 100, 'aluminium',       false, 'United Kingdom', 'GB'),
  ('Printed Shrink Sleeve Label',       'label',     1,          0.002,   2.0, 0,   'plastic_flexible', false, 'United Kingdom', 'GB'),
  ('Cardboard 24-Pack Case',            'secondary', 0.041667,   0.025,  25.0, 90,  'paper_cardboard', false, 'United Kingdom', 'GB'),
  ('LDPE Shrink Wrap (24-pack)',        'secondary', 0.041667,   0.002,   2.0, 30,  'plastic_flexible', false, 'United Kingdom', 'GB')
) AS v(material_name, packaging_category, quantity, total_weight_kg, net_weight_g, recycled_pct, epr_material, is_drinks, origin_country, origin_country_code)
WHERE p.sku = 'BEER-WCSA-01'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001';

-- ==========================================================================
-- 4. BOTANICA ZERO (NALC-BZ-01)
-- ==========================================================================

-- Ingredients
INSERT INTO "public"."product_materials" (product_id, material_name, material_type, quantity, unit, origin_country, origin_country_code)
SELECT p.id, v.material_name, 'ingredient', v.quantity, v.unit, v.origin_country, v.origin_country_code
FROM "public"."products" p
CROSS JOIN (VALUES
  ('Juniper Berries',    0.0200, 'kg', 'United Kingdom', 'GB'),
  ('Coriander Seed',     0.0050, 'kg', 'United Kingdom', 'GB'),
  ('Angelica Root',      0.0030, 'kg', 'United Kingdom', 'GB'),
  ('Orris Root',         0.0025, 'kg', 'United Kingdom', 'GB'),
  ('Lemon Peel',         0.0080, 'kg', 'Spain',          'ES'),
  ('Orange Peel',        0.0060, 'kg', 'Spain',          'ES'),
  ('Liquorice Root',     0.0020, 'kg', 'United Kingdom', 'GB'),
  ('Filtered Water',     0.450,  'l',  'United Kingdom', 'GB'),
  ('Glycerine (Vegetable)', 0.015, 'kg', 'Germany',      'DE'),
  ('Citric Acid',        0.002,  'kg', 'United Kingdom', 'GB'),
  ('Natural Sweetener',  0.005,  'kg', 'United Kingdom', 'GB')
) AS v(material_name, quantity, unit, origin_country, origin_country_code)
WHERE p.sku = 'NALC-BZ-01'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001';

-- Packaging
INSERT INTO "public"."product_materials" (product_id, material_name, material_type, packaging_category, quantity, unit, total_weight_kg, net_weight_g, recycled_content_percentage, epr_material_type, epr_is_drinks_container, origin_country, origin_country_code)
SELECT p.id, v.material_name, 'packaging', v.packaging_category, v.quantity, 'unit', v.total_weight_kg, v.net_weight_g, v.recycled_pct, v.epr_material, v.is_drinks, v.origin_country, v.origin_country_code
FROM "public"."products" p
CROSS JOIN (VALUES
  ('500ml Lightweight Flint Glass Bottle', 'container', 1, 0.400, 400.0, 55, 'glass',           true,  'United Kingdom', 'GB'),
  ('Aluminium Screw Cap',                  'closure',   1, 0.005,   5.0, 0,  'aluminium',       false, 'United Kingdom', 'GB'),
  ('Paper Label (Front & Back)',           'label',     1, 0.004,   4.0, 80, 'paper_cardboard', false, 'United Kingdom', 'GB'),
  ('Cardboard Case (12pk)',                'secondary', 0.083333, 0.060, 60.0, 85, 'paper_cardboard', false, 'United Kingdom', 'GB')
) AS v(material_name, packaging_category, quantity, total_weight_kg, net_weight_g, recycled_pct, epr_material, is_drinks, origin_country, origin_country_code)
WHERE p.sku = 'NALC-BZ-01'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001';

-- ==========================================================================
-- 5. BATH DRY GIN (GIN-BDG-01)
-- Note: Botanicals already added in previous migration. Adding NGS + packaging.
-- ==========================================================================

-- Additional ingredient: Neutral Grain Spirit
INSERT INTO "public"."product_materials" (product_id, material_name, material_type, quantity, unit, origin_country, origin_country_code)
SELECT p.id, v.material_name, 'ingredient', v.quantity, v.unit, v.origin_country, v.origin_country_code
FROM "public"."products" p
CROSS JOIN (VALUES
  ('Neutral Grain Spirit (96% ABV)', 0.350, 'l', 'United Kingdom', 'GB'),
  ('Water',                          0.300, 'l', 'United Kingdom', 'GB')
) AS v(material_name, quantity, unit, origin_country, origin_country_code)
WHERE p.sku = 'GIN-BDG-01'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001';

-- Packaging
INSERT INTO "public"."product_materials" (product_id, material_name, material_type, packaging_category, quantity, unit, total_weight_kg, net_weight_g, recycled_content_percentage, epr_material_type, epr_is_drinks_container, origin_country, origin_country_code)
SELECT p.id, v.material_name, 'packaging', v.packaging_category, v.quantity, 'unit', v.total_weight_kg, v.net_weight_g, v.recycled_pct, v.epr_material, v.is_drinks, v.origin_country, v.origin_country_code
FROM "public"."products" p
CROSS JOIN (VALUES
  ('700ml Recycled Green Glass Bottle', 'container', 1, 0.600, 600.0, 100, 'glass',           true,  'United Kingdom', 'GB'),
  ('Natural Cork Stopper',              'closure',   1, 0.006,   6.0, 0,   'wood',            false, 'Portugal',       'PT'),
  ('Metal Bar Top Stopper',             'closure',   1, 0.035,  35.0, 0,   'steel',           false, 'United Kingdom', 'GB'),
  ('Paper Label (Front & Back)',        'label',     1, 0.005,   5.0, 80,  'paper_cardboard', false, 'United Kingdom', 'GB'),
  ('Cardboard Case (6pk)',              'secondary', 0.166667, 0.120, 120.0, 85, 'paper_cardboard', false, 'United Kingdom', 'GB')
) AS v(material_name, packaging_category, quantity, total_weight_kg, net_weight_g, recycled_pct, epr_material, is_drinks, origin_country, origin_country_code)
WHERE p.sku = 'GIN-BDG-01'
  AND p.organization_id = 'b0a00000-0000-4000-8000-000000000001';
