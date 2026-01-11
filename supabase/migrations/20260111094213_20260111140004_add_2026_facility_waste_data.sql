/*
  # Add 2026 Facility Waste Data
  
  This migration adds current year (2026) waste data for all test facilities
  so the waste metrics dashboard displays correctly.
  
  ## Data Added
  - Waste entries for January 2026 across all 4 test facilities
  - Categories: food_waste, packaging_waste, process_waste, hazardous
  - Treatment methods: recycling, composting, anaerobic_digestion, reuse, landfill
  
  ## Scope: Cradle-to-Gate (Owned Operations Only)
  Per GHG Protocol Scope 3 Category 5 and CSRD ESRS E5 requirements
*/

DO $$
DECLARE
  v_org_id UUID := '2d86de84-e24e-458b-84b9-fd4057998bda';
  v_bottling_id UUID;
  v_brewery_id UUID;
  v_distillery_id UUID;
  v_winery_id UUID;
BEGIN
  SELECT id INTO v_bottling_id FROM facilities WHERE name = 'Test Bottling Plant' AND organization_id = v_org_id;
  SELECT id INTO v_brewery_id FROM facilities WHERE name = 'Test Brewery' AND organization_id = v_org_id;
  SELECT id INTO v_distillery_id FROM facilities WHERE name = 'Test Distillery' AND organization_id = v_org_id;
  SELECT id INTO v_winery_id FROM facilities WHERE name = 'Test Winery' AND organization_id = v_org_id;

  -- Test Distillery - January 2026 waste data
  IF v_distillery_id IS NOT NULL THEN
    INSERT INTO facility_activity_entries (
      facility_id, organization_id, activity_category, activity_date,
      reporting_period_start, reporting_period_end, quantity, unit,
      waste_category, waste_treatment_method, waste_recovery_percentage,
      hazard_classification, disposal_facility_type, data_provenance,
      confidence_score, notes
    ) VALUES
    (v_distillery_id, v_org_id, 'waste_general', '2026-01-10',
     '2026-01-01', '2026-01-31', 4500, 'kg',
     'food_waste', 'anaerobic_digestion', 95,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Spent grain from distillation sent to AD plant'),
    (v_distillery_id, v_org_id, 'waste_recycling', '2026-01-10',
     '2026-01-01', '2026-01-31', 1200, 'kg',
     'packaging_waste', 'recycling', 98,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Broken bottles and glass cullet recycled'),
    (v_distillery_id, v_org_id, 'waste_recycling', '2026-01-10',
     '2026-01-01', '2026-01-31', 850, 'kg',
     'packaging_waste', 'recycling', 95,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Packaging cardboard baled and recycled'),
    (v_distillery_id, v_org_id, 'waste_general', '2026-01-10',
     '2026-01-01', '2026-01-31', 180, 'kg',
     'process_waste', 'incineration_with_recovery', 70,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     90, 'Cradle-to-gate: Filters and cleaning materials'),
    (v_distillery_id, v_org_id, 'waste_hazardous', '2026-01-10',
     '2026-01-01', '2026-01-31', 35, 'kg',
     'hazardous', 'incineration_with_recovery', 0,
     'hazardous', 'third_party_licensed', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Spent cleaning chemicals disposed via licensed contractor');
  END IF;

  -- Test Brewery - January 2026 waste data  
  IF v_brewery_id IS NOT NULL THEN
    INSERT INTO facility_activity_entries (
      facility_id, organization_id, activity_category, activity_date,
      reporting_period_start, reporting_period_end, quantity, unit,
      waste_category, waste_treatment_method, waste_recovery_percentage,
      hazard_classification, disposal_facility_type, data_provenance,
      confidence_score, notes
    ) VALUES
    (v_brewery_id, v_org_id, 'waste_general', '2026-01-10',
     '2026-01-01', '2026-01-31', 15000, 'kg',
     'food_waste', 'anaerobic_digestion', 98,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Spent grain to local farm AD'),
    (v_brewery_id, v_org_id, 'waste_general', '2026-01-10',
     '2026-01-01', '2026-01-31', 2500, 'kg',
     'food_waste', 'composting', 100,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Excess yeast composted'),
    (v_brewery_id, v_org_id, 'waste_recycling', '2026-01-10',
     '2026-01-01', '2026-01-31', 2800, 'kg',
     'packaging_waste', 'recycling', 99,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Damaged cans recycled'),
    (v_brewery_id, v_org_id, 'waste_recycling', '2026-01-10',
     '2026-01-01', '2026-01-31', 550, 'kg',
     'packaging_waste', 'reuse', 100,
     'non_hazardous', 'in_house', 'primary_measured_onsite',
     98, 'Cradle-to-gate: Kegs cleaned and reused'),
    (v_brewery_id, v_org_id, 'waste_general', '2026-01-10',
     '2026-01-01', '2026-01-31', 320, 'kg',
     'process_waste', 'landfill', 0,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     90, 'Cradle-to-gate: Non-recyclable operational waste');
  END IF;

  -- Test Bottling Plant - January 2026 waste data
  IF v_bottling_id IS NOT NULL THEN
    INSERT INTO facility_activity_entries (
      facility_id, organization_id, activity_category, activity_date,
      reporting_period_start, reporting_period_end, quantity, unit,
      waste_category, waste_treatment_method, waste_recovery_percentage,
      hazard_classification, disposal_facility_type, data_provenance,
      confidence_score, notes
    ) VALUES
    (v_bottling_id, v_org_id, 'waste_recycling', '2026-01-10',
     '2026-01-01', '2026-01-31', 3200, 'kg',
     'packaging_waste', 'recycling', 98,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Line breakage glass cullet'),
    (v_bottling_id, v_org_id, 'waste_recycling', '2026-01-10',
     '2026-01-01', '2026-01-31', 420, 'kg',
     'packaging_waste', 'recycling', 85,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     90, 'Cradle-to-gate: LDPE shrink wrap recycled'),
    (v_bottling_id, v_org_id, 'waste_general', '2026-01-10',
     '2026-01-01', '2026-01-31', 1800, 'kg',
     'food_waste', 'composting', 100,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     92, 'Cradle-to-gate: Line spillage composted'),
    (v_bottling_id, v_org_id, 'waste_general', '2026-01-10',
     '2026-01-01', '2026-01-31', 280, 'kg',
     'process_waste', 'landfill', 0,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     85, 'Cradle-to-gate: Mixed non-recyclable waste');
  END IF;

  -- Test Winery - January 2026 waste data
  IF v_winery_id IS NOT NULL THEN
    INSERT INTO facility_activity_entries (
      facility_id, organization_id, activity_category, activity_date,
      reporting_period_start, reporting_period_end, quantity, unit,
      waste_category, waste_treatment_method, waste_recovery_percentage,
      hazard_classification, disposal_facility_type, data_provenance,
      confidence_score, notes
    ) VALUES
    (v_winery_id, v_org_id, 'waste_general', '2026-01-10',
     '2026-01-01', '2026-01-31', 8500, 'kg',
     'food_waste', 'composting', 100,
     'non_hazardous', 'in_house', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Grape skins/seeds composted on-site'),
    (v_winery_id, v_org_id, 'waste_general', '2026-01-10',
     '2026-01-01', '2026-01-31', 2200, 'kg',
     'food_waste', 'anaerobic_digestion', 95,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Wine lees to AD plant'),
    (v_winery_id, v_org_id, 'waste_recycling', '2026-01-10',
     '2026-01-01', '2026-01-31', 1450, 'kg',
     'packaging_waste', 'recycling', 98,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Damaged bottles recycled'),
    (v_winery_id, v_org_id, 'waste_recycling', '2026-01-10',
     '2026-01-01', '2026-01-31', 180, 'kg',
     'packaging_waste', 'recycling', 90,
     'non_hazardous', 'third_party_licensed', 'primary_measured_onsite',
     90, 'Cradle-to-gate: Cork recycling programme'),
    (v_winery_id, v_org_id, 'waste_hazardous', '2026-01-10',
     '2026-01-01', '2026-01-31', 25, 'kg',
     'hazardous', 'incineration_with_recovery', 0,
     'hazardous', 'third_party_licensed', 'primary_measured_onsite',
     95, 'Cradle-to-gate: Spent sanitiser disposed safely');
  END IF;
END $$;
