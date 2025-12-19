/*
  # Create Test Calvados Contract Manufacturer Allocation

  This migration creates a contract manufacturer allocation for the TEST CALVADOS product
  manufactured at the Test Distillery facility with 3,750 kg CO2e of emissions.

  ## Details
  - Product: TEST CALVADOS
  - Facility: Test Distillery (third-party manufacturer in Normandy, France)
  - Total Emissions: 3,750 kg CO2e
  - Scope 1 (35%): 1,313 kg CO2e (on-site fuel combustion, distillation process)
  - Scope 2 (65%): 2,438 kg CO2e (purchased electricity for operations)
  - Reporting Period: Q1-Q4 2024
  - Production Volume: 1,000 units
  - Attribution Ratio: 100% (dedicated production run)

  ## Purpose
  This provides realistic test data demonstrating how contract manufacturer
  emissions flow into product LCA calculations through the allocation system.
*/

DO $$
DECLARE
  v_org_id UUID := '1a82261c-0722-4e9f-9b92-bf8ac914f77e'; -- Test organization
  v_calvados_id BIGINT;
  v_distillery_id UUID;
BEGIN
  -- Get the Test Calvados product ID
  SELECT id INTO v_calvados_id
  FROM products
  WHERE organization_id = v_org_id
    AND name = 'TEST CALVADOS'
  LIMIT 1;

  -- Get the Test Distillery facility ID
  SELECT id INTO v_distillery_id
  FROM facilities
  WHERE organization_id = v_org_id
    AND name = 'Test Distillery'
  LIMIT 1;

  -- Only proceed if both IDs were found
  IF v_calvados_id IS NOT NULL AND v_distillery_id IS NOT NULL THEN
    -- Check if allocation already exists
    IF NOT EXISTS (
      SELECT 1 FROM contract_manufacturer_allocations
      WHERE product_id = v_calvados_id
        AND facility_id = v_distillery_id
    ) THEN
      -- Create the contract manufacturer allocation
      INSERT INTO contract_manufacturer_allocations (
        organization_id,
        product_id,
        facility_id,
        reporting_period_start,
        reporting_period_end,
        total_facility_production_volume,
        production_volume_unit,
        total_facility_co2e_kg,
        co2e_entry_method,
        emission_factor_year,
        emission_factor_source,
        client_production_volume,
        attribution_ratio,
        allocated_emissions_kg_co2e,
        scope1_emissions_kg_co2e,
        scope2_emissions_kg_co2e,
        scope3_emissions_kg_co2e,
        emission_intensity_kg_co2e_per_unit,
        status,
        is_energy_intensive_process,
        data_source_tag,
        data_quality_score
      ) VALUES (
        v_org_id,
        v_calvados_id,
        v_distillery_id,
        '2024-01-01'::DATE,
        '2024-12-31'::DATE,
        1000, -- Total facility production: 1,000 units
        'units',
        3750.00, -- Total facility emissions: 3,750 kg CO2e
        'direct', -- Direct CO2e entry (not calculated from energy)
        2024,
        'Facility-specific data',
        1000, -- Client production: 1,000 units (100% attribution)
        1.0, -- 100% attribution ratio
        3750.00, -- Allocated emissions: 3,750 kg CO2e (100% of facility)
        1312.50, -- Scope 1: 35% = 1,312.5 kg CO2e
        2437.50, -- Scope 2: 65% = 2,437.5 kg CO2e
        0, -- Scope 3: 0 kg CO2e (minimal for manufacturing)
        3.75, -- Intensity: 3.75 kg CO2e per unit
        'verified',
        true, -- Energy-intensive distillation process
        'Primary - Allocated',
        4 -- High quality score (verified primary data)
      );

      RAISE NOTICE 'Created contract manufacturer allocation for TEST CALVADOS at Test Distillery: 3,750 kg CO2e';
    ELSE
      RAISE NOTICE 'Allocation already exists for TEST CALVADOS at Test Distillery';
    END IF;
  ELSE
    RAISE NOTICE 'Could not find TEST CALVADOS product or Test Distillery facility';
  END IF;
END $$;
