-- =============================================================================
-- Sample Supplier Products for Testing
-- =============================================================================
-- Adds 12 realistic supplier products to the existing "TEst supplier" account
-- (timjudge@yahoo.co.uk), covering both ingredient and packaging types, with
-- varying data completeness to exercise edge cases (zero values, partial data,
-- tiny decimals, liquid units, etc.)
-- =============================================================================

DO $$
DECLARE
  v_supplier_id   uuid;
  v_org_id        uuid;
  v_user_id       uuid;
  v_now           timestamptz := now();

  -- Packaging product IDs (needed for component references)
  v_glass_bottle_id     uuid;
  v_frugal_bottle_id    uuid;
  v_alu_can_id          uuid;
  v_shipper_id          uuid;
  v_label_id            uuid;
BEGIN

  -- =========================================================================
  -- 1. Use the existing "TEst supplier" (timjudge@yahoo.co.uk)
  -- =========================================================================
  v_supplier_id := 'c50f5599-3a90-409b-96d3-fd2bfd460083';

  SELECT organization_id INTO v_org_id
    FROM public.suppliers WHERE id = v_supplier_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Supplier c50f5599-3a90-409b-96d3-fd2bfd460083 not found.';
  END IF;

  -- Look up the user_id for verified_by
  SELECT user_id INTO v_user_id
    FROM public.suppliers WHERE id = v_supplier_id;

  -- =========================================================================
  -- 2. INGREDIENT PRODUCTS (7)
  -- =========================================================================

  -- (1) Organic Barley Malt - full data, primary verified
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, origin_country_code,
    impact_climate, impact_water, impact_waste, impact_land,
    ghg_fossil, ghg_biogenic,
    water_blue, water_green, water_grey,
    data_quality_score, methodology_standard, data_source_type,
    certifications,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    'b0000000-0000-4000-8000-000000000001',
    v_supplier_id, v_org_id,
    'Organic Barley Malt',
    'Premium floor-malted barley from East Anglia. Full primary LCA data.',
    'Grains & Cereals', 'kg',
    'ingredient', 'GB',
    0.520000, 1.400000, 0.030000, 2.800000,
    0.440000, 0.080000,
    0.900000, 0.400000, 0.100000,
    2.0, 'ISO 14067', 'primary_verified',
    ARRAY['Organic', 'ISO 14001'],
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- (2) Cascade Hops - moderate data quality
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, origin_country_code,
    impact_climate, impact_water, impact_waste, impact_land,
    data_quality_score,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    'b0000000-0000-4000-8000-000000000002',
    v_supplier_id, v_org_id,
    'Cascade Hops',
    'Whole leaf Cascade hops from Yakima Valley, Washington State.',
    'Hops', 'kg',
    'ingredient', 'US',
    2.700000, 3.200000, 0.080000, 5.100000,
    3.0,
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- (3) Cane Sugar (Fairtrade) - with certifications
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, origin_country_code,
    impact_climate, impact_water, impact_waste, impact_land,
    certifications,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    'b0000000-0000-4000-8000-000000000003',
    v_supplier_id, v_org_id,
    'Cane Sugar (Fairtrade)',
    'Fairtrade and organic certified cane sugar from Sao Paulo region.',
    'Sugars & Syrups', 'kg',
    'ingredient', 'BR',
    0.450000, 1.800000, 0.020000, 1.900000,
    ARRAY['Fairtrade', 'Organic'],
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- (4) Grape Juice Concentrate - liquid unit (L), tests normalisation
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, origin_country_code,
    impact_climate, impact_water, impact_waste, impact_land,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    'b0000000-0000-4000-8000-000000000004',
    v_supplier_id, v_org_id,
    'Grape Juice Concentrate',
    'Concentrated grape juice from Puglia. Liquid unit tests normalisation.',
    'Fruit & Juice', 'L',
    'ingredient', 'IT',
    1.150000, 0.950000, 0.040000, 3.400000,
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- (5) Juniper Berries (Wild Harvested) - partial data (climate only)
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, origin_country_code,
    impact_climate, impact_water, impact_waste, impact_land,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    'b0000000-0000-4000-8000-000000000005',
    v_supplier_id, v_org_id,
    'Juniper Berries (Wild Harvested)',
    'Wild harvested juniper. Climate-only data tests partial data handling.',
    'Botanicals', 'kg',
    'ingredient', 'MK',
    0.850000, NULL, NULL, NULL,
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- (6) Carbon-Neutral Oat Milk - zero climate value (tests zero-value bug)
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, origin_country_code,
    impact_climate, impact_water, impact_waste, impact_land,
    is_externally_verified, verifier_name,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    'b0000000-0000-4000-8000-000000000006',
    v_supplier_id, v_org_id,
    'Carbon-Neutral Oat Milk',
    'Carbon Trust certified carbon-neutral oat milk. Zero climate value tests the zero-value bug fix.',
    'Dairy & Alternatives', 'kg',
    'ingredient', 'SE',
    0.000000, 0.800000, 0.010000, 1.200000,
    true, 'Carbon Trust',
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- (7) Yorkshire Spring Water - very small values, tests numeric precision
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, origin_country_code,
    impact_climate, impact_water, impact_waste, impact_land,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    'b0000000-0000-4000-8000-000000000007',
    v_supplier_id, v_org_id,
    'Yorkshire Spring Water',
    'Natural spring water. Very small impact values test numeric precision.',
    'Water', 'L',
    'ingredient', 'GB',
    0.000300, 0.001000, 0.000100, NULL,
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- 3. PACKAGING PRODUCTS (5)
  -- =========================================================================

  v_glass_bottle_id  := 'b0000000-0000-4000-8000-000000000008';
  v_frugal_bottle_id := 'b0000000-0000-4000-8000-000000000009';
  v_alu_can_id       := 'b0000000-0000-4000-8000-00000000000a';
  v_shipper_id       := 'b0000000-0000-4000-8000-00000000000b';
  v_label_id         := 'b0000000-0000-4000-8000-00000000000c';

  -- (8) 750ml Glass Bottle (Green)
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, packaging_category, weight_g, primary_material,
    epr_material_code, epr_is_drinks_container,
    impact_climate, recycled_content_pct,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    v_glass_bottle_id,
    v_supplier_id, v_org_id,
    '750ml Glass Bottle (Green)',
    'Standard 750ml green glass wine/spirits bottle with 68% recycled content.',
    'Bottles', 'container',
    'packaging', 'container', 360.00, 'glass',
    'GL', true,
    0.850000, 68.00,
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- (9) Frugal Bottle 750ml
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, packaging_category, weight_g, primary_material,
    impact_climate, recycled_content_pct,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    v_frugal_bottle_id,
    v_supplier_id, v_org_id,
    'Frugal Bottle 750ml',
    'Lightweight recycled paperboard bottle. 84% lower carbon than glass.',
    'Bottles', 'container',
    'packaging', 'container', 83.00, 'paper_cardboard',
    0.180000, 80.00,
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- (10) Aluminium Can 330ml
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, packaging_category, weight_g, primary_material,
    epr_material_code, epr_is_drinks_container,
    impact_climate, recycled_content_pct,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    v_alu_can_id,
    v_supplier_id, v_org_id,
    'Aluminium Can 330ml',
    'Standard 330ml aluminium drinks can with pull-tab.',
    'Cans', 'container',
    'packaging', 'container', 14.50, 'aluminium',
    'AL', true,
    0.210000, 45.00,
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- (11) Corrugated Shipper (12-pack) - secondary packaging
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, packaging_category, weight_g, primary_material,
    impact_climate, recycled_content_pct,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    v_shipper_id,
    v_supplier_id, v_org_id,
    'Corrugated Shipper (12-pack)',
    'Standard corrugated cardboard shipper for 12 bottles. Tests units_per_group allocation.',
    'Shippers', 'secondary',
    'packaging', 'secondary', 450.00, 'paper_cardboard',
    0.650000, 90.00,
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- (12) Self-Adhesive Paper Label
  INSERT INTO public.supplier_products (
    id, supplier_id, organization_id, name, description, category, unit,
    product_type, packaging_category, weight_g, primary_material,
    impact_climate, recycled_content_pct,
    is_verified, verified_by, verified_at, is_active,
    created_at, updated_at
  ) VALUES (
    v_label_id,
    v_supplier_id, v_org_id,
    'Self-Adhesive Paper Label',
    'Pressure-sensitive paper label with adhesive backing. Tiny weight, label category.',
    'Labels', 'label',
    'packaging', 'label', 2.50, 'paper_cardboard',
    0.005000, 0.00,
    true, v_user_id, v_now, true,
    v_now, v_now
  ) ON CONFLICT DO NOTHING;

  -- =========================================================================
  -- 4. PACKAGING COMPONENTS
  -- =========================================================================

  -- Components for (8) 750ml Glass Bottle (Green)
  INSERT INTO public.supplier_product_components (
    supplier_product_id, component_name, epr_material_type,
    weight_grams, percentage, recycled_content_pct, is_recyclable
  ) VALUES
    (v_glass_bottle_id, 'Body',    'glass',           340, 94.44, 70.00, true),
    (v_glass_bottle_id, 'Closure', 'aluminium',        15,  4.17, 50.00, true),
    (v_glass_bottle_id, 'Label',   'paper_cardboard',   5,  1.39,  0.00, true)
  ON CONFLICT DO NOTHING;

  -- Components for (9) Frugal Bottle 750ml
  INSERT INTO public.supplier_product_components (
    supplier_product_id, component_name, epr_material_type,
    weight_grams, percentage, recycled_content_pct, is_recyclable
  ) VALUES
    (v_frugal_bottle_id, 'Outer Shell',  'paper_cardboard', 65, 78.31, 85.00, true),
    (v_frugal_bottle_id, 'Inner Pouch',  'plastic_flexible', 13, 15.66, 0.00, false),
    (v_frugal_bottle_id, 'Cap',          'plastic_rigid',     5,  6.02, 0.00, true)
  ON CONFLICT DO NOTHING;

  -- Components for (10) Aluminium Can 330ml
  INSERT INTO public.supplier_product_components (
    supplier_product_id, component_name, epr_material_type,
    weight_grams, percentage, recycled_content_pct, is_recyclable
  ) VALUES
    (v_alu_can_id, 'Can Body', 'aluminium', 12.5, 86.21, 48.00, true),
    (v_alu_can_id, 'End/Tab',  'aluminium',  2.0, 13.79, 30.00, true)
  ON CONFLICT DO NOTHING;

END $$;

-- Notify PostgREST to pick up any changes
NOTIFY pgrst, 'reload schema';
