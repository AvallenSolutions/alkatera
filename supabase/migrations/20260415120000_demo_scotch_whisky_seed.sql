-- ============================================================================
-- Demo seed: Speyside Single Malt 10 Year Old (alkatera Demo org)
-- ============================================================================
-- Purpose: Adds a realistic 10yo Single Malt Scotch Whisky product to the
-- alkatera Demo organisation so the sample LCA report workflow can be run
-- for prospective customers.
--
-- Scope:
--   1. products row: 700ml bottle at 46% ABV, Speyside single malt
--   2. product_materials rows:
--        - Ingredients: malted barley, Highland spring water, brewing yeast
--        - Packaging: flint glass bottle, cork & wood stopper, labels, gift tube
--   3. maturation_profiles row: 10 years in first-fill ex-bourbon American oak
--      barrels (cut-off allocation), dunnage warehouse in temperate climate
--
-- Quantities are per bottle (functional unit = 1 x 700ml bottle).
--
-- Methodology references:
--   - SWA (2006) Life Cycle Assessment of Scotch Whisky
--   - Pettersson (2016) Swedish single malt whisky LCA
--   - ISO 14044 cut-off allocation for barrel reuse
-- ============================================================================

DO $$
DECLARE
  new_product_id bigint;
  demo_org_id uuid := '2d86de84-e24e-458b-84b9-fd4057998bda';
BEGIN
  -- Safety: only seed if a product with this SKU does not already exist in the demo org
  IF EXISTS (
    SELECT 1 FROM public.products
    WHERE organization_id = demo_org_id AND sku = 'SSM-10YO-700'
  ) THEN
    RAISE NOTICE 'Speyside Single Malt 10YO already exists in Demo org, skipping.';
    RETURN;
  END IF;

  -- --------------------------------------------------------------------------
  -- 1. Product
  -- --------------------------------------------------------------------------
  INSERT INTO public.products (
    organization_id,
    name,
    sku,
    unit_size_value,
    unit_size_unit,
    product_description,
    functional_unit,
    system_boundary,
    product_category,
    is_draft
  ) VALUES (
    demo_org_id,
    'Speyside Single Malt 10 Year Old 700ml',
    'SSM-10YO-700',
    700,
    'ml',
    'Premium Speyside single malt Scotch whisky, distilled in traditional copper pot stills and aged for 10 years in first-fill ex-bourbon American white oak barrels. Made from 100% Scottish malted barley, soft Highland spring water, and brewing yeast. Non chill-filtered and bottled at 46% ABV in a heavyweight flint glass bottle with a natural cork and wooden top stopper, finished in a recyclable cardboard gift tube.',
    '1 x 700ml bottle of Speyside Single Malt Scotch Whisky at 46% ABV',
    'cradle_to_gate',
    'Single Malt Whisky',
    false
  )
  RETURNING id INTO new_product_id;

  -- --------------------------------------------------------------------------
  -- 2a. Ingredients (raw materials, A1-A3)
  -- --------------------------------------------------------------------------
  -- Quantities per 700ml bottle. Based on Pettersson (2016) yield of
  -- ~0.42 L pure alcohol per kg malt, adjusted for ~20% angel share loss
  -- over 10 years of maturation.
  INSERT INTO public.product_materials (
    product_id, material_name, material_type,
    quantity, unit,
    origin_country, origin_country_code, is_organic_certified,
    transport_mode, distance_km, notes
  ) VALUES
    (
      new_product_id,
      'Malted Barley (Scottish spring barley)',
      'ingredient',
      1.5000, 'kg',
      'Scotland, UK', 'GB', false,
      'truck', 120,
      '100% Scottish spring barley (Concerto variety), traditionally floor-malted, unpeated. Quantity accounts for distillation yield and 10 years angel share.'
    ),
    (
      new_product_id,
      'Highland Spring Water',
      'ingredient',
      15.0000, 'L',
      'Scotland, UK', 'GB', false,
      'truck', 5,
      'Process water drawn on-site from the distillery spring for mashing and reduction to bottling strength. Excludes non-contact cooling water.'
    ),
    (
      new_product_id,
      'Brewing Yeast (Saccharomyces cerevisiae)',
      'ingredient',
      0.0080, 'kg',
      'United Kingdom', 'GB', false,
      'truck', 300,
      'Distillers yeast slurry used for wort fermentation.'
    );

  -- --------------------------------------------------------------------------
  -- 2b. Packaging
  -- --------------------------------------------------------------------------
  -- Quantity expressed in kg per bottle (matches existing seed convention).
  -- net_weight_g is the per-unit mass of the component.
  INSERT INTO public.product_materials (
    product_id, material_name, material_type, packaging_category,
    quantity, unit,
    net_weight_g, total_weight_kg,
    recycled_content_percentage,
    origin_country, origin_country_code,
    epr_is_drinks_container,
    transport_mode, distance_km, notes
  ) VALUES
    (
      new_product_id,
      'Flint Glass Bottle 700ml (heavyweight)',
      'packaging', 'container',
      0.5500, 'kg',
      550, 0.5500,
      45,
      'United Kingdom', 'GB',
      true,
      'truck', 400,
      'Premium heavyweight flint glass bottle with 45% post-consumer recycled cullet content. Embossed shoulder, no external coating.'
    ),
    (
      new_product_id,
      'Natural Cork & Wooden Top Stopper',
      'packaging', 'closure',
      0.0080, 'kg',
      8, 0.0080,
      0,
      'Portugal', 'PT',
      false,
      'truck', 2500,
      'FSC-certified natural cork agglomerate bonded to a birch wood top with food-safe adhesive.'
    ),
    (
      new_product_id,
      'Paper Labels (front and back)',
      'packaging', 'label',
      0.0030, 'kg',
      3, 0.0030,
      70,
      'United Kingdom', 'GB',
      false,
      'truck', 400,
      'Uncoated recycled paper labels, front and back, applied with water-based adhesive.'
    ),
    (
      new_product_id,
      'Cardboard Gift Tube',
      'packaging', 'secondary',
      0.1500, 'kg',
      150, 0.1500,
      80,
      'United Kingdom', 'GB',
      false,
      'truck', 400,
      'Recyclable printed cardboard presentation tube with tin-plated steel end caps. 80% post-consumer recycled board.'
    );

  -- --------------------------------------------------------------------------
  -- 3. Maturation profile
  -- --------------------------------------------------------------------------
  -- 10 years in first-fill ex-bourbon American white oak (American Standard
  -- Barrel, 200L). Under ISO 14044 cut-off allocation the barrel carries
  -- minimal embodied burden as it is a by-product of bourbon production
  -- (barrel_use_number = 2). Scottish Speyside dunnage warehouse uses
  -- ~15 kWh/barrel/year baseline with ~2%/year angel share typical of the
  -- cool temperate climate.
  INSERT INTO public.maturation_profiles (
    product_id, organization_id,
    barrel_type, barrel_volume_litres, barrel_use_number,
    aging_duration_months, angel_share_percent_per_year, climate_zone,
    fill_volume_litres, number_of_barrels,
    warehouse_energy_kwh_per_barrel_year, warehouse_energy_source,
    allocation_method, notes
  ) VALUES (
    new_product_id, demo_org_id,
    'american_oak_200', 200, 2,
    120, 2.0, 'temperate',
    200, 1,
    15.0, 'grid_electricity',
    'cut_off',
    'Matured 10 years in first-fill ex-bourbon American white oak barrels (ASB, 200L). Cut-off allocation per ISO 14044: embodied barrel emissions attributed to bourbon production. Stored in a traditional Speyside dunnage warehouse with a ~2%/year angel share loss, classified as NMVOC.'
  );

  RAISE NOTICE 'Seeded Speyside Single Malt 10YO with product id = % into alkatera Demo org', new_product_id;
END $$;
