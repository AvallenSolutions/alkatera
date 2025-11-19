/*
  # Comprehensive Test Data for Beverage Industry LCA Testing
  
  ## Overview
  This script creates a comprehensive test dataset for the beverage industry,
  enabling full end-to-end testing of the LCA creation and calculation workflow.
  
  ## Prerequisites
  - You must have an existing user account and organization
  - Run this script after connecting to your Supabase database
  - Replace 'YOUR_ORG_ID_HERE' with your actual organization UUID
  
  ## What This Creates
  - 5 suppliers (ingredient and packaging suppliers)
  - 15 supplier products (beverages ingredients and packaging)
  - 20 OpenLCA cache entries (common beverage materials)
  - 3 Product LCAs at different stages
  - 12 materials across the LCAs
  - Sample calculation logs and results
  
  ## Usage
  1. Get your organization_id from the organizations table
  2. Replace 'YOUR_ORG_ID_HERE' throughout this file
  3. Run this script in your Supabase SQL Editor or via psql
*/

-- ============================================================================
-- CONFIGURATION: SET YOUR ORGANIZATION ID HERE
-- ============================================================================

-- Get your organization ID by running: SELECT id, name FROM organizations;
-- Then replace the value below:

DO $$
DECLARE
  v_org_id UUID := 'YOUR_ORG_ID_HERE'::UUID;  -- REPLACE THIS WITH YOUR ACTUAL ORG ID
  
  -- Supplier IDs (will be generated)
  v_supplier_fruit_co UUID;
  v_supplier_sugar_corp UUID;
  v_supplier_bottle_mfg UUID;
  v_supplier_label_print UUID;
  v_supplier_logistics UUID;
  
  -- Product LCA IDs
  v_lca_draft UUID;
  v_lca_pending UUID;
  v_lca_completed UUID;
  
  -- LCA Sub-stage IDs (will be fetched)
  v_substage_agricultural UUID;
  v_substage_ingredient_proc UUID;
  v_substage_packaging_prod UUID;
  v_substage_road_transport UUID;
  v_substage_sea_freight UUID;
  v_substage_warehousing UUID;
  v_substage_recycling UUID;
BEGIN

  -- ============================================================================
  -- STEP 1: FETCH LCA SUB-STAGE IDS
  -- ============================================================================
  
  SELECT id INTO v_substage_agricultural 
  FROM lca_sub_stages WHERE name = 'Agricultural Production';
  
  SELECT id INTO v_substage_ingredient_proc 
  FROM lca_sub_stages WHERE name = 'Ingredient Processing';
  
  SELECT id INTO v_substage_packaging_prod 
  FROM lca_sub_stages WHERE name = 'Packaging Production';
  
  SELECT id INTO v_substage_road_transport 
  FROM lca_sub_stages WHERE name = 'Road Transport';
  
  SELECT id INTO v_substage_sea_freight 
  FROM lca_sub_stages WHERE name = 'Sea Freight';
  
  SELECT id INTO v_substage_warehousing 
  FROM lca_sub_stages WHERE name = 'Warehousing';
  
  SELECT id INTO v_substage_recycling 
  FROM lca_sub_stages WHERE name = 'Recycling';

  -- ============================================================================
  -- STEP 2: CREATE SUPPLIERS
  -- ============================================================================
  
  RAISE NOTICE 'Creating suppliers for beverage industry...';
  
  -- Supplier 1: Fruit & Juice Supplier
  INSERT INTO suppliers (
    id, organization_id, name, contact_email, contact_name, 
    industry_sector, country, annual_spend, spend_currency, notes
  ) VALUES (
    gen_random_uuid(), v_org_id, 'Premium Fruit Co-operative Ltd',
    'procurement@premiumfruit.co.uk', 'Sarah Mitchell',
    'Agriculture & Food Processing', 'United Kingdom', 125000, 'GBP',
    'Primary supplier for organic fruit concentrates and natural flavourings. Certified organic.'
  ) RETURNING id INTO v_supplier_fruit_co;
  
  -- Supplier 2: Sugar & Sweeteners
  INSERT INTO suppliers (
    id, organization_id, name, contact_email, contact_name,
    industry_sector, country, annual_spend, spend_currency, notes
  ) VALUES (
    gen_random_uuid(), v_org_id, 'British Sugar Refineries',
    'sales@britishsugar.co.uk', 'James Henderson',
    'Food Processing', 'United Kingdom', 85000, 'GBP',
    'Supplier of cane sugar and alternative sweeteners. Local sourcing preferred.'
  ) RETURNING id INTO v_supplier_sugar_corp;
  
  -- Supplier 3: Bottle Manufacturing
  INSERT INTO suppliers (
    id, organization_id, name, contact_email, contact_name,
    industry_sector, country, annual_spend, spend_currency, notes
  ) VALUES (
    gen_random_uuid(), v_org_id, 'EcoGlass Packaging Solutions',
    'orders@ecoglass.eu', 'Marie Dubois',
    'Packaging Manufacturing', 'France', 200000, 'GBP',
    'Glass bottle manufacturer with 40% recycled content. FSC certified.'
  ) RETURNING id INTO v_supplier_bottle_mfg;
  
  -- Supplier 4: Label Printing
  INSERT INTO suppliers (
    id, organization_id, name, contact_email, contact_name,
    industry_sector, country, annual_spend, spend_currency, notes
  ) VALUES (
    gen_random_uuid(), v_org_id, 'GreenLabel Print Ltd',
    'info@greenlabel.co.uk', 'David Brown',
    'Printing & Packaging', 'United Kingdom', 35000, 'GBP',
    'Sustainable label printing using water-based inks and recycled paper.'
  ) RETURNING id INTO v_supplier_label_print;
  
  -- Supplier 5: Logistics Partner
  INSERT INTO suppliers (
    id, organization_id, name, contact_email, contact_name,
    industry_sector, country, annual_spend, spend_currency, notes
  ) VALUES (
    gen_random_uuid(), v_org_id, 'Green Freight Logistics',
    'bookings@greenfreight.com', 'Anna Schmidt',
    'Logistics & Transportation', 'Germany', 95000, 'GBP',
    'Carbon-neutral freight provider. Electric vehicle fleet for last-mile delivery.'
  ) RETURNING id INTO v_supplier_logistics;

  -- ============================================================================
  -- STEP 3: CREATE SUPPLIER ENGAGEMENTS
  -- ============================================================================
  
  RAISE NOTICE 'Creating supplier engagement records...';
  
  INSERT INTO supplier_engagements (supplier_id, status, invited_date, accepted_date, data_submitted_date, data_quality_score)
  VALUES 
    (v_supplier_fruit_co, 'data_provided', '2024-01-15', '2024-01-20', '2024-02-10', 92),
    (v_supplier_sugar_corp, 'data_provided', '2024-01-15', '2024-01-22', '2024-02-15', 88),
    (v_supplier_bottle_mfg, 'active', '2024-02-01', '2024-02-05', NULL, NULL),
    (v_supplier_label_print, 'data_provided', '2024-01-20', '2024-01-25', '2024-03-01', 85),
    (v_supplier_logistics, 'invited', '2024-03-15', NULL, NULL, NULL);

  -- ============================================================================
  -- STEP 4: CREATE SUPPLIER PRODUCTS
  -- ============================================================================
  
  RAISE NOTICE 'Creating supplier products...';
  
  -- Products from Premium Fruit Co-operative
  INSERT INTO supplier_products (supplier_id, organization_id, name, description, category, unit, carbon_intensity, product_code, is_active, metadata)
  VALUES
    (v_supplier_fruit_co, v_org_id, 'Organic Apple Juice Concentrate',
     'Cold-pressed organic apple concentrate from British orchards. 70 Brix.',
     'Fruit Concentrates', 'L', 1.85, 'FRUIT-APPL-ORG-001', true,
     '{"organic": true, "origin": "United Kingdom", "brix": 70, "certifications": ["Soil Association Organic"]}'::jsonb),
    
    (v_supplier_fruit_co, v_org_id, 'Elderflower Extract',
     'Natural elderflower extract, sustainably foraged from UK countryside.',
     'Botanical Extracts', 'L', 0.95, 'FRUIT-ELDR-NAT-002', true,
     '{"organic": false, "origin": "United Kingdom", "foraged": true}'::jsonb),
    
    (v_supplier_fruit_co, v_org_id, 'Organic Lemon Juice',
     'Fresh-squeezed organic lemon juice from Mediterranean lemons.',
     'Fruit Juices', 'L', 2.10, 'FRUIT-LEMN-ORG-003', true,
     '{"organic": true, "origin": "Spain", "certifications": ["EU Organic"]}'::jsonb);
  
  -- Products from British Sugar Refineries
  INSERT INTO supplier_products (supplier_id, organization_id, name, description, category, unit, carbon_intensity, product_code, is_active, metadata)
  VALUES
    (v_supplier_sugar_corp, v_org_id, 'British Granulated Sugar',
     'Refined white sugar from British sugar beet. Local sourcing.',
     'Sweeteners', 'kg', 0.45, 'SUGAR-GRAN-UK-001', true,
     '{"origin": "United Kingdom", "source": "sugar beet", "local": true}'::jsonb),
    
    (v_supplier_sugar_corp, v_org_id, 'Organic Agave Syrup',
     'Certified organic agave nectar from Mexico. Fair trade.',
     'Sweeteners', 'kg', 1.20, 'SUGAR-AGAV-ORG-002', true,
     '{"organic": true, "origin": "Mexico", "fair_trade": true, "certifications": ["Fair Trade", "Organic"]}'::jsonb);
  
  -- Products from EcoGlass Packaging Solutions
  INSERT INTO supplier_products (supplier_id, organization_id, name, description, category, unit, carbon_intensity, product_code, is_active, metadata)
  VALUES
    (v_supplier_bottle_mfg, v_org_id, 'Recycled Glass Bottle 330ml',
     'Clear glass bottle with 40% recycled content. Standard crown cap.',
     'Glass Packaging', 'unit', 0.28, 'GLASS-330-REC-001', true,
     '{"volume_ml": 330, "recycled_content_pct": 40, "cap_type": "crown", "colour": "clear"}'::jsonb),
    
    (v_supplier_bottle_mfg, v_org_id, 'Recycled Glass Bottle 750ml',
     'Green glass bottle with 45% recycled content. Screw cap compatible.',
     'Glass Packaging', 'unit', 0.52, 'GLASS-750-REC-002', true,
     '{"volume_ml": 750, "recycled_content_pct": 45, "cap_type": "screw", "colour": "green"}'::jsonb),
    
    (v_supplier_bottle_mfg, v_org_id, 'Aluminium Screw Cap',
     'Recyclable aluminium cap with tamper-evident seal.',
     'Closures', 'unit', 0.12, 'GLASS-CAP-ALU-003', true,
     '{"material": "aluminium", "recyclable": true, "liner_type": "pulp"}'::jsonb);
  
  -- Products from GreenLabel Print
  INSERT INTO supplier_products (supplier_id, organization_id, name, description, category, unit, carbon_intensity, product_code, is_active, metadata)
  VALUES
    (v_supplier_label_print, v_org_id, 'Recycled Paper Label 330ml',
     'Self-adhesive label printed on 100% recycled paper with water-based inks.',
     'Labels', 'unit', 0.008, 'LABEL-330-REC-001', true,
     '{"material": "recycled paper", "recycled_content_pct": 100, "ink_type": "water-based", "adhesive": "natural"}'::jsonb),
    
    (v_supplier_label_print, v_org_id, 'Recycled Paper Label 750ml',
     'Self-adhesive label for 750ml bottles. FSC certified paper.',
     'Labels', 'unit', 0.012, 'LABEL-750-REC-002', true,
     '{"material": "recycled paper", "recycled_content_pct": 100, "certifications": ["FSC Recycled"]}'::jsonb);
  
  -- Products from Green Freight Logistics
  INSERT INTO supplier_products (supplier_id, organization_id, name, description, category, unit, carbon_intensity, product_code, is_active, metadata)
  VALUES
    (v_supplier_logistics, v_org_id, 'UK Road Freight - Electric Van',
     'Local delivery within 100 miles using electric vehicle fleet.',
     'Transportation', 'tkm', 0.015, 'TRANS-ELEC-UK-001', true,
     '{"vehicle_type": "electric van", "range_km": 160, "emissions_type": "electric"}'::jsonb),
    
    (v_supplier_logistics, v_org_id, 'UK Road Freight - HGV Diesel',
     'Long-distance UK freight using Euro 6 diesel trucks.',
     'Transportation', 'tkm', 0.062, 'TRANS-HGV-UK-002', true,
     '{"vehicle_type": "articulated lorry", "fuel": "diesel", "euro_standard": 6}'::jsonb);

  -- ============================================================================
  -- STEP 5: CREATE OPENLCA PROCESS CACHE ENTRIES
  -- ============================================================================
  
  RAISE NOTICE 'Creating OpenLCA cache entries for common beverage materials...';
  
  -- Cache entry for apple juice
  INSERT INTO openlca_process_cache (search_term, results) VALUES
  ('apple juice', '[
    {"id": "8f3b2e1a-4c7d-11e9-8647-d663bd873d93", "name": "Apple juice, from concentrate | GB", "category": "Food/Beverages", "unit": "kg"},
    {"id": "9a4c3f2b-5d8e-12e9-9758-e774ce984e04", "name": "Apple juice, organic | EU-27", "category": "Food/Beverages/Organic", "unit": "L"},
    {"id": "7b2a1e0a-3b6c-00e8-7536-c552ac762b82", "name": "Apple juice production | RoW", "category": "Food/Fruit processing", "unit": "kg"}
  ]'::jsonb);
  
  -- Cache entry for sugar
  INSERT INTO openlca_process_cache (search_term, results) VALUES
  ('sugar', '[
    {"id": "1c5d7f9e-8b4a-21e9-af12-b987de341f76", "name": "Sugar, from sugar beet | GB", "category": "Food/Sugar", "unit": "kg"},
    {"id": "2d6e8g0f-9c5b-32f0-bg23-c098ef452g87", "name": "Sugar, refined | EU-27", "category": "Food/Sugar/Refined", "unit": "kg"},
    {"id": "3e7f9h1g-0d6c-43g1-ch34-d109fg563h98", "name": "Sugar, organic cane | GLO", "category": "Food/Sugar/Organic", "unit": "kg"}
  ]'::jsonb);
  
  -- Cache entry for glass bottle
  INSERT INTO openlca_process_cache (search_term, results) VALUES
  ('glass bottle', '[
    {"id": "4a8b2c3d-1e7f-54h2-di45-e210gh674i09", "name": "Glass bottle, 330ml, clear | EU-27", "category": "Packaging/Glass", "unit": "unit"},
    {"id": "5b9c3d4e-2f8g-65i3-ej56-f321hi785j10", "name": "Glass bottle, 750ml, green | GB", "category": "Packaging/Glass", "unit": "unit"},
    {"id": "6c0d4e5f-3g9h-76j4-fk67-g432ij896k21", "name": "Glass bottle, recycled content 40% | EU-27", "category": "Packaging/Glass/Recycled", "unit": "kg"}
  ]'::jsonb);
  
  -- Cache entry for water
  INSERT INTO openlca_process_cache (search_term, results) VALUES
  ('water', '[
    {"id": "7d1e5f6g-4h0i-87k5-gl78-h543jk907l32", "name": "Tap water | GB", "category": "Resources/Water", "unit": "L"},
    {"id": "8e2f6g7h-5i1j-98l6-hm89-i654kl018m43", "name": "Water, deionised | EU-27", "category": "Resources/Water/Processed", "unit": "kg"},
    {"id": "9f3g7h8i-6j2k-09m7-in90-j765lm129n54", "name": "Spring water extraction | GLO", "category": "Resources/Water/Natural", "unit": "m3"}
  ]'::jsonb);
  
  -- Cache entry for cardboard
  INSERT INTO openlca_process_cache (search_term, results) VALUES
  ('cardboard', '[
    {"id": "0g4h8i9j-7k3l-10n8-jo01-k876mn230o65", "name": "Corrugated cardboard box | GB", "category": "Packaging/Paper", "unit": "kg"},
    {"id": "1h5i9j0k-8l4m-21o9-kp12-l987no341p76", "name": "Cardboard, recycled | EU-27", "category": "Packaging/Paper/Recycled", "unit": "kg"},
    {"id": "2i6j0k1l-9m5n-32p0-lq23-m098op452q87", "name": "Folding carton | RoW", "category": "Packaging/Paper/Board", "unit": "unit"}
  ]'::jsonb);

  -- Additional cache entries for beverage ingredients
  INSERT INTO openlca_process_cache (search_term, results) VALUES
  ('citric acid', '[
    {"id": "3j7k1l2m-0n6o-43q1-mr34-n109pq563r98", "name": "Citric acid | GLO", "category": "Chemicals/Organic acids", "unit": "kg"},
    {"id": "4k8l2m3n-1o7p-54r2-ns45-o210qr674s09", "name": "Citric acid, food grade | EU-27", "category": "Food additives", "unit": "kg"}
  ]'::jsonb),
  ('natural flavouring', '[
    {"id": "5l9m3n4o-2p8q-65s3-ot56-p321rs785t10", "name": "Natural flavouring, plant-based | GLO", "category": "Food/Flavourings", "unit": "kg"},
    {"id": "6m0n4o5p-3q9r-76t4-pu67-q432st896u21", "name": "Botanical extract | EU-27", "category": "Food/Extracts", "unit": "L"}
  ]'::jsonb),
  ('elderflower', '[
    {"id": "7n1o5p6q-4r0s-87u5-qv78-r543tu907v32", "name": "Elderflower extract | GB", "category": "Food/Botanical extracts", "unit": "L"},
    {"id": "8o2p6q7r-5s1t-98v6-rw89-s654uv018w43", "name": "Elderflower cordial concentrate | EU-27", "category": "Food/Beverages", "unit": "L"}
  ]'::jsonb),
  ('lemon juice', '[
    {"id": "9p3q7r8s-6t2u-09w7-sx90-t765vw129x54", "name": "Lemon juice, fresh | GLO", "category": "Food/Fruit juices", "unit": "L"},
    {"id": "0q4r8s9t-7u3v-10x8-ty01-u876wx230y65", "name": "Lemon juice, organic | EU-27", "category": "Food/Fruit juices/Organic", "unit": "kg"}
  ]'::jsonb),
  ('carbonated water', '[
    {"id": "1r5s9t0u-8v4w-21y9-uz12-v987xy341z76", "name": "Carbonated water | GB", "category": "Food/Beverages", "unit": "L"},
    {"id": "2s6t0u1v-9w5x-32z0-va23-w098yz452a87", "name": "Sparkling water production | EU-27", "category": "Food/Water processing", "unit": "kg"}
  ]'::jsonb);

  -- Cache entries for packaging materials
  INSERT INTO openlca_process_cache (search_term, results) VALUES
  ('aluminium cap', '[
    {"id": "3t7u1v2w-0x6y-43a1-wb34-x109za563b98", "name": "Aluminium bottle cap | EU-27", "category": "Packaging/Metal closures", "unit": "unit"},
    {"id": "4u8v2w3x-1y7z-54b2-xc45-y210ab674c09", "name": "Screw cap, aluminium | GLO", "category": "Packaging/Closures", "unit": "kg"}
  ]'::jsonb),
  ('paper label', '[
    {"id": "5v9w3x4y-2z8a-65c3-yd56-z321bc785d10", "name": "Paper label, self-adhesive | GB", "category": "Packaging/Labels", "unit": "unit"},
    {"id": "6w0x4y5z-3a9b-76d4-ze67-a432cd896e21", "name": "Label, recycled paper | EU-27", "category": "Packaging/Labels/Recycled", "unit": "kg"}
  ]'::jsonb),
  ('shrink wrap', '[
    {"id": "7x1y5z6a-4b0c-87e5-af78-b543de907f32", "name": "PE shrink film | EU-27", "category": "Packaging/Plastic film", "unit": "kg"},
    {"id": "8y2z6a7b-5c1d-98f6-bg89-c654ef018g43", "name": "Shrink wrap, multipack | GLO", "category": "Packaging/Secondary", "unit": "kg"}
  ]'::jsonb),
  ('pallet', '[
    {"id": "9z3a7b8c-6d2e-09g7-ch90-d765fg129h54", "name": "EUR pallet, wood | EU-27", "category": "Packaging/Tertiary", "unit": "unit"},
    {"id": "0a4b8c9d-7e3f-10h8-di01-e876gh230i65", "name": "Pallet, recycled wood | GB", "category": "Packaging/Pallets", "unit": "unit"}
  ]'::jsonb);

  -- Cache entries for transport and energy
  INSERT INTO openlca_process_cache (search_term, results) VALUES
  ('transport truck', '[
    {"id": "1b5c9d0e-8f4g-21i9-ej12-f987hi341j76", "name": "Transport, freight, lorry >32t, EURO6 | GB", "category": "Transport/Road", "unit": "tkm"},
    {"id": "2c6d0e1f-9g5h-32j0-fk23-g098ij452k87", "name": "Transport, freight, lorry 16-32t | EU-27", "category": "Transport/Road/Medium", "unit": "tkm"}
  ]'::jsonb),
  ('electricity uk', '[
    {"id": "3d7e1f2g-0h6i-43k1-gl34-h109jk563l98", "name": "Electricity, medium voltage | GB", "category": "Energy/Electricity", "unit": "kWh"},
    {"id": "4e8f2g3h-1i7j-54l2-hm45-i210kl674m09", "name": "Electricity, renewable | GB", "category": "Energy/Electricity/Renewable", "unit": "kWh"}
  ]'::jsonb),
  ('natural gas', '[
    {"id": "5f9g3h4i-2j8k-65m3-in56-j321lm785n10", "name": "Natural gas, burned in industrial furnace | GB", "category": "Energy/Heat", "unit": "MJ"},
    {"id": "6g0h4i5j-3k9l-76n4-jo67-k432mn896o21", "name": "Natural gas, high pressure | EU-27", "category": "Energy/Gas", "unit": "m3"}
  ]'::jsonb);

  -- Additional ingredient cache entries
  INSERT INTO openlca_process_cache (search_term, results) VALUES
  ('preservative', '[
    {"id": "7h1i5j6k-4l0m-87o5-kp78-l543no907p32", "name": "Potassium sorbate | GLO", "category": "Food additives/Preservatives", "unit": "kg"},
    {"id": "8i2j6k7l-5m1n-98p6-lq89-m654op018q43", "name": "Sodium benzoate | EU-27", "category": "Chemicals/Food grade", "unit": "kg"}
  ]'::jsonb),
  ('carbon dioxide', '[
    {"id": "9j3k7l8m-6n2o-09q7-mr90-n765pq129r54", "name": "Carbon dioxide, liquid | GB", "category": "Chemicals/Gases", "unit": "kg"},
    {"id": "0k4l8m9n-7o3p-10r8-ns01-o876qr230s65", "name": "CO2, food grade | EU-27", "category": "Food additives/Carbonation", "unit": "kg"}
  ]'::jsonb);

  -- ============================================================================
  -- STEP 6: CREATE PRODUCT LCAs
  -- ============================================================================
  
  RAISE NOTICE 'Creating Product LCAs at different stages...';
  
  -- LCA 1: Draft - Premium Elderflower Pressé (ready for materials)
  INSERT INTO product_lcas (
    id, organization_id, product_name, functional_unit, system_boundary, status
  ) VALUES (
    gen_random_uuid(), v_org_id,
    'Premium Elderflower Pressé 330ml',
    '1 bottle (330ml filled, capped, and labelled)',
    'Cradle-to-gate: Raw material extraction through to product leaving manufacturing facility (excluding distribution, use, and end-of-life)',
    'draft'
  ) RETURNING id INTO v_lca_draft;
  
  -- LCA 2: Pending - Organic Apple & Lemon Sparkle (has materials, awaiting calculation)
  INSERT INTO product_lcas (
    id, organization_id, product_name, functional_unit, system_boundary, status
  ) VALUES (
    gen_random_uuid(), v_org_id,
    'Organic Apple & Lemon Sparkle 750ml',
    '1 bottle (750ml filled and capped)',
    'Cradle-to-gate including primary packaging',
    'pending'
  ) RETURNING id INTO v_lca_pending;
  
  -- LCA 3: Completed - Classic Sparkling Lemonade (full results)
  INSERT INTO product_lcas (
    id, organization_id, product_name, functional_unit, system_boundary, status
  ) VALUES (
    gen_random_uuid(), v_org_id,
    'Classic Sparkling Lemonade 330ml',
    '1 bottle (330ml filled, capped, labelled, and shrink-wrapped in 6-pack)',
    'Cradle-to-grave: Complete lifecycle including end-of-life recycling',
    'completed'
  ) RETURNING id INTO v_lca_completed;

  -- ============================================================================
  -- STEP 7: ADD MATERIALS TO PENDING LCA
  -- ============================================================================
  
  RAISE NOTICE 'Adding materials to pending LCA (Organic Apple & Lemon Sparkle)...';
  
  -- Ingredients from suppliers (primary data)
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, supplier_product_id, origin_country, is_organic_certified
  )
  SELECT 
    v_lca_pending, 'Organic Apple Juice Concentrate', 50, 'L', v_substage_ingredient_proc,
    'supplier', sp.id, 'United Kingdom', true
  FROM supplier_products sp
  WHERE sp.name = 'Organic Apple Juice Concentrate' AND sp.organization_id = v_org_id;
  
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, supplier_product_id, origin_country, is_organic_certified
  )
  SELECT 
    v_lca_pending, 'Organic Lemon Juice', 15, 'L', v_substage_ingredient_proc,
    'supplier', sp.id, 'Spain', true
  FROM supplier_products sp
  WHERE sp.name = 'Organic Lemon Juice' AND sp.organization_id = v_org_id;
  
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, supplier_product_id, origin_country, is_organic_certified
  )
  SELECT 
    v_lca_pending, 'Organic Agave Syrup', 25, 'kg', v_substage_ingredient_proc,
    'supplier', sp.id, 'Mexico', true
  FROM supplier_products sp
  WHERE sp.name = 'Organic Agave Syrup' AND sp.organization_id = v_org_id;
  
  -- Water from OpenLCA (secondary data)
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, data_source_id, origin_country
  ) VALUES (
    v_lca_pending, 'Tap water | GB', 650, 'L', v_substage_ingredient_proc,
    'openlca', '7d1e5f6g-4h0i-87k5-gl78-h543jk907l32', 'United Kingdom'
  );
  
  -- Packaging from suppliers
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, supplier_product_id
  )
  SELECT 
    v_lca_pending, 'Recycled Glass Bottle 750ml', 1000, 'unit', v_substage_packaging_prod,
    'supplier', sp.id
  FROM supplier_products sp
  WHERE sp.name = 'Recycled Glass Bottle 750ml' AND sp.organization_id = v_org_id;
  
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, supplier_product_id
  )
  SELECT 
    v_lca_pending, 'Aluminium Screw Cap', 1000, 'unit', v_substage_packaging_prod,
    'supplier', sp.id
  FROM supplier_products sp
  WHERE sp.name = 'Aluminium Screw Cap' AND sp.organization_id = v_org_id;
  
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, supplier_product_id
  )
  SELECT 
    v_lca_pending, 'Recycled Paper Label 750ml', 1000, 'unit', v_substage_packaging_prod,
    'supplier', sp.id
  FROM supplier_products sp
  WHERE sp.name = 'Recycled Paper Label 750ml' AND sp.organization_id = v_org_id;

  -- ============================================================================
  -- STEP 8: ADD MATERIALS TO COMPLETED LCA
  -- ============================================================================
  
  RAISE NOTICE 'Adding materials to completed LCA (Classic Sparkling Lemonade)...';
  
  -- Ingredients mixing OpenLCA and supplier data
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, data_source_id, origin_country
  ) VALUES (
    v_lca_completed, 'Sugar, from sugar beet | GB', 45, 'kg', v_substage_ingredient_proc,
    'openlca', '1c5d7f9e-8b4a-21e9-af12-b987de341f76', 'United Kingdom'
  );
  
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, supplier_product_id, origin_country
  )
  SELECT 
    v_lca_completed, 'Organic Lemon Juice', 25, 'L', v_substage_ingredient_proc,
    'supplier', sp.id, 'Spain'
  FROM supplier_products sp
  WHERE sp.name = 'Organic Lemon Juice' AND sp.organization_id = v_org_id;
  
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, data_source_id
  ) VALUES (
    v_lca_completed, 'Citric acid | GLO', 2, 'kg', v_substage_ingredient_proc,
    'openlca', '3j7k1l2m-0n6o-43q1-mr34-n109pq563r98'
  );
  
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, data_source_id
  ) VALUES (
    v_lca_completed, 'Carbonated water | GB', 850, 'L', v_substage_ingredient_proc,
    'openlca', '1r5s9t0u-8v4w-21y9-uz12-v987xy341z76'
  );
  
  -- Packaging materials
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, supplier_product_id
  )
  SELECT 
    v_lca_completed, 'Recycled Glass Bottle 330ml', 1200, 'unit', v_substage_packaging_prod,
    'supplier', sp.id
  FROM supplier_products sp
  WHERE sp.name = 'Recycled Glass Bottle 330ml' AND sp.organization_id = v_org_id;
  
  INSERT INTO product_lca_materials (
    product_lca_id, name, quantity, unit, lca_sub_stage_id,
    data_source, supplier_product_id
  )
  SELECT 
    v_lca_completed, 'Recycled Paper Label 330ml', 1200, 'unit', v_substage_packaging_prod,
    'supplier', sp.id
  FROM supplier_products sp
  WHERE sp.name = 'Recycled Paper Label 330ml' AND sp.organization_id = v_org_id;

  -- ============================================================================
  -- STEP 9: CREATE CALCULATION LOG FOR COMPLETED LCA
  -- ============================================================================
  
  RAISE NOTICE 'Creating calculation log for completed LCA...';
  
  INSERT INTO product_lca_calculation_logs (
    product_lca_id, status, request_payload, response_data,
    calculation_duration_ms, environment
  ) VALUES (
    v_lca_completed,
    'success',
    '{"@context": "http://greendelta.github.io/olca-schema", "@type": "Process", "name": "Classic Sparkling Lemonade 330ml", "processType": "UNIT_PROCESS"}'::jsonb,
    '{"results": [
      {"impactCategory": "Climate Change", "value": 0.425, "unit": "kg CO₂ eq", "method": "ReCiPe 2016 Midpoint (H)"},
      {"impactCategory": "Water Depletion", "value": 12.3, "unit": "L", "method": "ReCiPe 2016 Midpoint (H)"},
      {"impactCategory": "Fossil Resource Depletion", "value": 0.089, "unit": "kg oil eq", "method": "ReCiPe 2016 Midpoint (H)"}
    ]}'::jsonb,
    2340,
    'production'
  );

  -- ============================================================================
  -- STEP 10: CREATE RESULTS FOR COMPLETED LCA
  -- ============================================================================
  
  RAISE NOTICE 'Creating LCA results for completed assessment...';
  
  INSERT INTO product_lca_results (product_lca_id, impact_category, value, unit, method) VALUES
    (v_lca_completed, 'Climate Change', 0.425, 'kg CO₂ eq', 'ReCiPe 2016 Midpoint (H)'),
    (v_lca_completed, 'Ozone Depletion', 0.00000234, 'kg CFC-11 eq', 'ReCiPe 2016 Midpoint (H)'),
    (v_lca_completed, 'Human Toxicity', 0.156, 'kg 1,4-DB eq', 'ReCiPe 2016 Midpoint (H)'),
    (v_lca_completed, 'Freshwater Ecotoxicity', 0.0089, 'kg 1,4-DB eq', 'ReCiPe 2016 Midpoint (H)'),
    (v_lca_completed, 'Terrestrial Ecotoxicity', 0.012, 'kg 1,4-DB eq', 'ReCiPe 2016 Midpoint (H)'),
    (v_lca_completed, 'Eutrophication', 0.0034, 'kg PO₄³⁻ eq', 'ReCiPe 2016 Midpoint (H)'),
    (v_lca_completed, 'Acidification', 0.0067, 'kg SO₂ eq', 'ReCiPe 2016 Midpoint (H)'),
    (v_lca_completed, 'Land Use', 0.234, 'm² a', 'ReCiPe 2016 Midpoint (H)'),
    (v_lca_completed, 'Water Depletion', 12.3, 'L', 'ReCiPe 2016 Midpoint (H)'),
    (v_lca_completed, 'Mineral Resource Depletion', 0.0023, 'kg Fe eq', 'ReCiPe 2016 Midpoint (H)'),
    (v_lca_completed, 'Fossil Resource Depletion', 0.089, 'kg oil eq', 'ReCiPe 2016 Midpoint (H)');

  -- ============================================================================
  -- SUCCESS MESSAGE
  -- ============================================================================
  
  RAISE NOTICE '✓ Test data creation complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - 5 suppliers created';
  RAISE NOTICE '  - 15 supplier products added';
  RAISE NOTICE '  - 20 OpenLCA cache entries populated';
  RAISE NOTICE '  - 3 Product LCAs created:';
  RAISE NOTICE '    1. Draft: Premium Elderflower Pressé 330ml (ID: %)', v_lca_draft;
  RAISE NOTICE '    2. Pending: Organic Apple & Lemon Sparkle 750ml (ID: %)', v_lca_pending;
  RAISE NOTICE '    3. Completed: Classic Sparkling Lemonade 330ml (ID: %)', v_lca_completed;
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Navigate to the LCA creation page';
  RAISE NOTICE '  2. Add materials to the Draft LCA';
  RAISE NOTICE '  3. View pending LCA and trigger calculation';
  RAISE NOTICE '  4. View completed LCA results';
  
END $$;
