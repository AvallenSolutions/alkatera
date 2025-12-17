/*
  # Complete Staging Emission Factors for All Test Products

  1. Purpose
     - Add staging emission factors for all 14 unique materials across TEST CALVADOS,
       TEST NON-ALC BEER, and TEST WINE
     - Enable successful LCA calculation for all 3 test products
     - Provide complete 4-capital coverage (GHG, water, land, waste) per CSRD ESRS E1

  2. Test Products Coverage
     **TEST CALVADOS (5 materials):**
       - Organic Apples, Process Water, Glass Bottle 700ml (65% recycled),
         Paper Label (100% recycled), Traditional Wood and Cork Stopper

     **TEST NON-ALC BEER (4 materials):**
       - Malted Barley, Hops, Brewing Water, Aluminium Can 330ml (direct print)

     **TEST WINE (6 materials):**
       - Pinot Noir Grapes, Process Water, Green Glass Bottle 750ml (80% recycled),
         Paper Label, Traditional Cork, Foil Capsule

  3. Data Sources
     - Ecoinvent 3.12 database (primary source)
     - DEFRA 2024 conversion factors (UK-specific)
     - ReCiPe 2016 Midpoint (H) methodology
     - Regional specificity: FR (France), GB (UK), NZ (New Zealand), EU (Europe)

  4. Impact Categories (Multi-Capital Framework)
     - Climate Change (GWP100): kg CO2e per reference unit
     - Water Consumption: m³ per reference unit (consumptive use)
     - Land Use: m² per reference unit (occupation)
     - Waste Generation: kg per reference unit (non-recycled residuals)

  5. Unique Materials: 14 total
     - 13 new factors created by this migration
     - 1 existing factor (Brewing Water) may be updated if present
*/

DO $$
DECLARE
  v_org_id UUID := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  v_factor_count INTEGER;
BEGIN

  DELETE FROM staging_emission_factors
  WHERE organization_id = v_org_id
    AND name IN (
      'Organic Apples',
      'Process Water',
      'Glass Bottle 700ml (65% recycled)',
      'Paper Label (100% recycled)',
      'Traditional Wood and Cork Stopper',
      'Malted Barley',
      'Hops',
      'Brewing Water',
      'Aluminium Can 330ml (direct print)',
      'Pinot Noir Grapes',
      'Green Glass Bottle 750ml (80% recycled)',
      'Paper Label',
      'Traditional Cork',
      'Foil Capsule'
    );

  -- =====================================================================
  -- TEST CALVADOS INGREDIENTS
  -- =====================================================================

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Organic Apples',
    'Ingredient',
    0.30,
    0.60,
    1.50,
    0.05,
    'kg',
    'Ecoinvent 3.12: Apple production, organic | FR',
    'test-organic-apples-fr-001',
    '{"data_quality": "medium", "temporal": "2022-2024", "geographical": "FR", "region": "Normandy", "notes": "Organic apple production in France, includes cultivation, harvest, storage. Lower pesticide impact but similar land use to conventional."}'::jsonb
  );

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Process Water',
    'Ingredient',
    0.0003,
    1.00,
    0.0001,
    0.0001,
    'L',
    'Ecoinvent 3.12: Tap water, at user | FR/NZ',
    'test-process-water-001',
    '{"data_quality": "high", "temporal": "2022-2024", "geographical": "GLO", "notes": "Municipal water treatment and distribution. Low carbon intensity, high water consumption by definition."}'::jsonb
  );

  -- =====================================================================
  -- TEST CALVADOS PACKAGING
  -- =====================================================================

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Glass Bottle 700ml (65% recycled)',
    'Packaging',
    0.70,
    0.00396,
    0.01396,
    0.03,
    'kg',
    'Ecoinvent 3.12: Packaging glass, white, at plant | EU (65% PCR adjusted)',
    'test-glass-bottle-700ml-65pcr-001',
    '{"data_quality": "medium", "temporal": "2022-2024", "geographical": "EU", "recycled_content": "65%", "notes": "700ml spirits bottle with 65% post-consumer recycled content. Recycled content reduces virgin glass demand and energy consumption."}'::jsonb
  );

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Paper Label (100% recycled)',
    'Packaging',
    0.56,
    0.04,
    0.46,
    0.02,
    'kg',
    'Ecoinvent 3.12: Paper, recycled, at plant | EU',
    'test-paper-label-100pcr-001',
    '{"data_quality": "medium", "temporal": "2022-2024", "geographical": "EU", "recycled_content": "100%", "notes": "100% recycled paper label with wet glue application. Minimal virgin fibre impact."}'::jsonb
  );

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Traditional Wood and Cork Stopper',
    'Packaging',
    1.00,
    0.30,
    8.00,
    0.0533,
    'kg',
    'Ecoinvent 3.12: Cork stopper, at plant | PT',
    'test-wood-cork-stopper-001',
    '{"data_quality": "medium", "temporal": "2022-2024", "geographical": "PT", "notes": "Traditional wood-topped natural cork stopper from Portuguese cork oak. High land occupation reflects sustainable forestry practices."}'::jsonb
  );

  -- =====================================================================
  -- TEST NON-ALC BEER INGREDIENTS
  -- =====================================================================

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Malted Barley',
    'Ingredient',
    1.30,
    1.20,
    2.20,
    0.10,
    'kg',
    'DEFRA 2024 + Ecoinvent 3.12: Malt, at regional storehouse | GB',
    'test-malted-barley-gb-001',
    '{"data_quality": "high", "temporal": "2023-2024", "geographical": "GB", "region": "East Anglia", "notes": "UK-grown barley malted for brewing. Includes cultivation, harvest, malting process. DEFRA GWP verified."}'::jsonb
  );

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Hops',
    'Ingredient',
    4.00,
    3.00,
    9.00,
    0.10,
    'kg',
    'Ecoinvent 3.12: Hop production | GB',
    'test-hops-gb-001',
    '{"data_quality": "medium", "temporal": "2022-2024", "geographical": "GB", "region": "Kent", "notes": "English hops cultivation. High land use due to trellising systems and low yield per hectare. Intensive irrigation in dry seasons."}'::jsonb
  );

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Brewing Water',
    'Ingredient',
    0.0003,
    1.00,
    0.0001,
    0.0001,
    'L',
    'Ecoinvent 3.12: Tap water, at user | GB',
    'test-brewing-water-gb-001',
    '{"data_quality": "high", "temporal": "2022-2024", "geographical": "GB", "notes": "Municipal brewing-quality water. Low environmental impact per litre."}'::jsonb
  );

  -- =====================================================================
  -- TEST NON-ALC BEER PACKAGING
  -- =====================================================================

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Aluminium Can 330ml (direct print)',
    'Packaging',
    9.20,
    0.0153,
    0.05,
    0.20,
    'kg',
    'Ecoinvent 3.12: Aluminium can, at plant | EU (60% recycled)',
    'test-aluminium-can-330ml-001',
    '{"data_quality": "high", "temporal": "2022-2024", "geographical": "EU", "recycled_content": "60%", "notes": "330ml aluminium beverage can with direct printing. 60% recycled content reduces primary aluminium demand significantly."}'::jsonb
  );

  -- =====================================================================
  -- TEST WINE INGREDIENTS
  -- =====================================================================

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Pinot Noir Grapes',
    'Ingredient',
    0.60,
    3.00,
    4.00,
    0.10,
    'kg',
    'Ecoinvent 3.12: Grape production, at farm | NZ',
    'test-pinot-noir-grapes-nz-001',
    '{"data_quality": "high", "temporal": "2022-2024", "geographical": "NZ", "region": "Central Otago", "notes": "Pinot Noir grape cultivation in New Zealand. Cool climate viticulture with moderate irrigation. Includes vineyard operations and harvest."}'::jsonb
  );

  -- =====================================================================
  -- TEST WINE PACKAGING
  -- =====================================================================

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Green Glass Bottle 750ml (80% recycled)',
    'Packaging',
    0.55,
    0.0036,
    0.011,
    0.025,
    'kg',
    'Ecoinvent 3.12: Packaging glass, green, at plant | NZ (80% PCR adjusted)',
    'test-green-glass-bottle-750ml-80pcr-001',
    '{"data_quality": "medium", "temporal": "2022-2024", "geographical": "NZ", "recycled_content": "80%", "notes": "750ml wine bottle with 80% post-consumer recycled content. High recycled content significantly reduces energy demand and GHG emissions."}'::jsonb
  );

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Paper Label',
    'Packaging',
    1.10,
    0.08,
    0.90,
    0.05,
    'kg',
    'Ecoinvent 3.12: Paper, woodfree, coated, at plant | EU',
    'test-paper-label-virgin-001',
    '{"data_quality": "medium", "temporal": "2022-2024", "geographical": "EU", "recycled_content": "0%", "notes": "Virgin paper label with coating and printing. Higher impact than recycled alternative due to forestry and pulping processes."}'::jsonb
  );

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Traditional Cork',
    'Packaging',
    1.00,
    0.30,
    8.00,
    0.05,
    'kg',
    'Ecoinvent 3.12: Cork stopper, at plant | PT',
    'test-traditional-cork-001',
    '{"data_quality": "medium", "temporal": "2022-2024", "geographical": "PT", "notes": "Natural cork closure from Portuguese cork oak forests. Carbon sequestration during growth partially offsets processing emissions. High land occupation reflects sustainable forestry."}'::jsonb
  );

  INSERT INTO staging_emission_factors (
    organization_id, name, category, co2_factor, water_factor, land_factor, waste_factor,
    reference_unit, source, uuid_ref, metadata
  ) VALUES (
    v_org_id,
    'Foil Capsule',
    'Packaging',
    9.20,
    0.015,
    0.05,
    0.20,
    'kg',
    'Ecoinvent 3.12: Aluminium foil, at plant | EU',
    'test-foil-capsule-001',
    '{"data_quality": "medium", "temporal": "2022-2024", "geographical": "EU", "notes": "Aluminium foil capsule for wine bottle neck. High embodied energy due to aluminium production. Recyclable but often not recovered."}'::jsonb
  );

  -- =====================================================================
  -- VERIFICATION
  -- =====================================================================

  SELECT COUNT(*) INTO v_factor_count
  FROM staging_emission_factors
  WHERE organization_id = v_org_id
    AND name IN (
      'Organic Apples',
      'Process Water',
      'Glass Bottle 700ml (65% recycled)',
      'Paper Label (100% recycled)',
      'Traditional Wood and Cork Stopper',
      'Malted Barley',
      'Hops',
      'Brewing Water',
      'Aluminium Can 330ml (direct print)',
      'Pinot Noir Grapes',
      'Green Glass Bottle 750ml (80% recycled)',
      'Paper Label',
      'Traditional Cork',
      'Foil Capsule'
    );

  IF v_factor_count < 14 THEN
    RAISE WARNING 'Expected 14 factors but only found %. Some test products may not calculate correctly.', v_factor_count;
  END IF;

END $$;
