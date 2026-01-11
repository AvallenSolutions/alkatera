/*
  # Seed Comprehensive Facility Waste Data for Cradle-to-Gate Analysis
  
  1. Purpose
    - Populate realistic operational waste data for beverage production facilities
    - Data represents CRADLE-TO-GATE scope (production operations only)
    - Does NOT include consumer end-of-life waste (cradle-to-grave)
  
  2. Scope Clarification
    - This is OPERATIONAL waste only (GHG Protocol Scope 3 Category 5)
    - Cradle-to-gate: raw material extraction through product leaving factory gate
    - Does NOT include downstream waste (consumer disposal)
  
  3. Data Sources
    - Primary measured data from facility waste manifests
    - Reporting period: 2024 calendar year
    - All quantities in kg
*/

-- Insert waste data for Test Bottling Plant
INSERT INTO facility_activity_entries (
  id, facility_id, organization_id, activity_category, activity_date,
  reporting_period_start, reporting_period_end, quantity, unit,
  data_provenance, confidence_score, waste_category, waste_treatment_method,
  waste_recovery_percentage, hazard_classification, disposal_facility_type, notes
)
SELECT
  gen_random_uuid(),
  'e8faa811-18f7-4690-b8f4-69e0583d9ed2'::uuid,
  '2d86de84-e24e-458b-84b9-fd4057998bda'::uuid,
  activity_category,
  '2024-12-31'::date,
  '2024-01-01'::date,
  '2024-12-31'::date,
  quantity,
  'kg',
  'primary_measured_onsite'::data_provenance_enum,
  confidence,
  waste_cat::waste_category_enum,
  treatment::waste_treatment_method_enum,
  recovery_pct,
  hazard_class,
  disposal_type,
  notes
FROM (VALUES
  ('waste_recycling'::facility_activity_category_enum, 2850, 95, 'packaging_waste', 'recycling', 98.0, 'non_hazardous', 'third_party_licensed', 'Damaged/rejected glass bottles sent for cullet recycling. Cradle-to-gate: production rejects only.'),
  ('waste_recycling'::facility_activity_category_enum, 1420, 92, 'packaging_waste', 'recycling', 95.0, 'non_hazardous', 'in_house', 'Cardboard from incoming raw materials and damaged secondary packaging. Baled on-site.'),
  ('waste_recycling'::facility_activity_category_enum, 680, 88, 'packaging_waste', 'recycling', 85.0, 'non_hazardous', 'third_party_licensed', 'LDPE shrink wrap from incoming pallets. Operational waste.'),
  ('waste_general'::facility_activity_category_enum, 1850, 90, 'food_waste', 'composting', 100.0, 'non_hazardous', 'third_party_licensed', 'Fruit pulp and juice extraction residues. Production process waste (cradle-to-gate).'),
  ('waste_general'::facility_activity_category_enum, 420, 85, 'process_waste', 'landfill', 0.0, 'non_hazardous', 'third_party_licensed', 'Mixed production waste not suitable for recycling. Minimised through waste segregation.'),
  ('waste_general'::facility_activity_category_enum, 180, 82, 'process_waste', 'incineration_with_recovery', 75.0, 'non_hazardous', 'third_party_licensed', 'Contaminated rags, filters, and cleaning materials. Energy recovered.'),
  ('waste_hazardous'::facility_activity_category_enum, 85, 95, 'hazardous', 'incineration_with_recovery', 60.0, 'hazardous', 'third_party_licensed', 'Cleaning chemical residues and lab waste. Properly manifested.')
) AS waste_data(activity_category, quantity, confidence, waste_cat, treatment, recovery_pct, hazard_class, disposal_type, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM facility_activity_entries 
  WHERE facility_id = 'e8faa811-18f7-4690-b8f4-69e0583d9ed2'
  AND activity_category IN ('waste_general', 'waste_hazardous', 'waste_recycling')
  AND waste_category IS NOT NULL
  LIMIT 1
);

-- Insert waste data for Test Brewery
INSERT INTO facility_activity_entries (
  id, facility_id, organization_id, activity_category, activity_date,
  reporting_period_start, reporting_period_end, quantity, unit,
  data_provenance, confidence_score, waste_category, waste_treatment_method,
  waste_recovery_percentage, hazard_classification, disposal_facility_type, notes
)
SELECT
  gen_random_uuid(),
  '459842ff-783c-4f76-ae54-53c267b54a66'::uuid,
  '2d86de84-e24e-458b-84b9-fd4057998bda'::uuid,
  activity_category,
  '2024-12-31'::date,
  '2024-01-01'::date,
  '2024-12-31'::date,
  quantity,
  'kg',
  'primary_measured_onsite'::data_provenance_enum,
  confidence,
  waste_cat::waste_category_enum,
  treatment::waste_treatment_method_enum,
  recovery_pct,
  hazard_class,
  disposal_type,
  notes
FROM (VALUES
  ('waste_general'::facility_activity_category_enum, 12500, 95, 'food_waste', 'anaerobic_digestion', 100.0, 'non_hazardous', 'in_house', 'Spent grain from mashing. Major cradle-to-gate byproduct sent to on-site AD for biogas.'),
  ('waste_general'::facility_activity_category_enum, 3200, 92, 'food_waste', 'composting', 100.0, 'non_hazardous', 'third_party_licensed', 'Surplus brewing yeast sent to farms for composting/animal feed. Production residue.'),
  ('waste_general'::facility_activity_category_enum, 1850, 90, 'food_waste', 'composting', 100.0, 'non_hazardous', 'third_party_licensed', 'Trub, hop residues, protein coagulate from brewing. Operational waste.'),
  ('waste_recycling'::facility_activity_category_enum, 450, 88, 'packaging_waste', 'reuse', 100.0, 'non_hazardous', 'third_party_licensed', 'Damaged kegs sent for repair/refurbishment. Circular economy.'),
  ('waste_recycling'::facility_activity_category_enum, 380, 90, 'packaging_waste', 'recycling', 98.0, 'non_hazardous', 'third_party_licensed', 'Damaged/rejected aluminium cans. High-value recycling stream.'),
  ('waste_recycling'::facility_activity_category_enum, 2100, 92, 'packaging_waste', 'recycling', 95.0, 'non_hazardous', 'third_party_licensed', 'Cardboard packaging, labels, office paper. Segregated at source.'),
  ('waste_general'::facility_activity_category_enum, 680, 85, 'process_waste', 'landfill', 0.0, 'non_hazardous', 'third_party_licensed', 'Spent diatomaceous earth and filter media. Investigating recycling.'),
  ('waste_general'::facility_activity_category_enum, 220, 82, 'process_waste', 'incineration_with_recovery', 70.0, 'non_hazardous', 'third_party_licensed', 'Oil-contaminated rags, used PPE, mixed contaminated waste.'),
  ('waste_hazardous'::facility_activity_category_enum, 65, 95, 'hazardous', 'incineration_with_recovery', 55.0, 'hazardous', 'third_party_licensed', 'QC laboratory chemicals, sanitiser concentrates. Fully manifested.')
) AS waste_data(activity_category, quantity, confidence, waste_cat, treatment, recovery_pct, hazard_class, disposal_type, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM facility_activity_entries 
  WHERE facility_id = '459842ff-783c-4f76-ae54-53c267b54a66'
  AND activity_category IN ('waste_general', 'waste_hazardous', 'waste_recycling')
  AND waste_category IS NOT NULL
  LIMIT 1
);

-- Insert waste data for Test Distillery
INSERT INTO facility_activity_entries (
  id, facility_id, organization_id, activity_category, activity_date,
  reporting_period_start, reporting_period_end, quantity, unit,
  data_provenance, confidence_score, waste_category, waste_treatment_method,
  waste_recovery_percentage, hazard_classification, disposal_facility_type, notes
)
SELECT
  gen_random_uuid(),
  '574aea99-f60f-4bf0-bdbc-6514bf08c1f0'::uuid,
  '2d86de84-e24e-458b-84b9-fd4057998bda'::uuid,
  activity_category,
  '2024-12-31'::date,
  '2024-01-01'::date,
  '2024-12-31'::date,
  quantity,
  'kg',
  'primary_measured_onsite'::data_provenance_enum,
  confidence,
  waste_cat::waste_category_enum,
  treatment::waste_treatment_method_enum,
  recovery_pct,
  hazard_class,
  disposal_type,
  notes
FROM (VALUES
  ('waste_general'::facility_activity_category_enum, 8500, 95, 'food_waste', 'anaerobic_digestion', 100.0, 'non_hazardous', 'in_house', 'Pot ale and spent wash from distillation converted to biogas on-site. Primary byproduct.'),
  ('waste_general'::facility_activity_category_enum, 4200, 92, 'food_waste', 'composting', 100.0, 'non_hazardous', 'third_party_licensed', 'Draff (distillers grains) for animal feed/composting. Traditional valorisation.'),
  ('waste_recycling'::facility_activity_category_enum, 1200, 90, 'packaging_waste', 'reuse', 100.0, 'non_hazardous', 'third_party_licensed', 'Damaged oak casks sent for repair or furniture. Circular approach.'),
  ('waste_recycling'::facility_activity_category_enum, 920, 92, 'packaging_waste', 'recycling', 98.0, 'non_hazardous', 'third_party_licensed', 'Damaged spirit bottles from filling line. Production rejects.'),
  ('waste_recycling'::facility_activity_category_enum, 580, 88, 'packaging_waste', 'recycling', 94.0, 'non_hazardous', 'third_party_licensed', 'Damaged presentation packaging and cardboard outers.'),
  ('waste_general'::facility_activity_category_enum, 340, 85, 'process_waste', 'incineration_with_recovery', 65.0, 'non_hazardous', 'third_party_licensed', 'Spent activated carbon and charcoal from filtration.'),
  ('waste_general'::facility_activity_category_enum, 180, 82, 'process_waste', 'landfill', 0.0, 'non_hazardous', 'third_party_licensed', 'Residual mixed waste after maximum segregation efforts.'),
  ('waste_hazardous'::facility_activity_category_enum, 95, 95, 'hazardous', 'incineration_with_recovery', 50.0, 'hazardous', 'third_party_licensed', 'Alcohol-based cleaning residues and lab solvents.')
) AS waste_data(activity_category, quantity, confidence, waste_cat, treatment, recovery_pct, hazard_class, disposal_type, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM facility_activity_entries 
  WHERE facility_id = '574aea99-f60f-4bf0-bdbc-6514bf08c1f0'
  AND activity_category IN ('waste_general', 'waste_hazardous', 'waste_recycling')
  AND waste_category IS NOT NULL
  LIMIT 1
);

-- Insert waste data for Test Winery
INSERT INTO facility_activity_entries (
  id, facility_id, organization_id, activity_category, activity_date,
  reporting_period_start, reporting_period_end, quantity, unit,
  data_provenance, confidence_score, waste_category, waste_treatment_method,
  waste_recovery_percentage, hazard_classification, disposal_facility_type, notes
)
SELECT
  gen_random_uuid(),
  '16e80d3a-cb15-4530-9c04-781317b33427'::uuid,
  '2d86de84-e24e-458b-84b9-fd4057998bda'::uuid,
  activity_category,
  '2024-12-31'::date,
  '2024-01-01'::date,
  '2024-12-31'::date,
  quantity,
  'kg',
  'primary_measured_onsite'::data_provenance_enum,
  confidence,
  waste_cat::waste_category_enum,
  treatment::waste_treatment_method_enum,
  recovery_pct,
  hazard_class,
  disposal_type,
  notes
FROM (VALUES
  ('waste_general'::facility_activity_category_enum, 6800, 95, 'food_waste', 'composting', 100.0, 'non_hazardous', 'in_house', 'Grape pomace (skins, seeds, stems) returned to vineyard as compost. Circular viticulture.'),
  ('waste_general'::facility_activity_category_enum, 2400, 92, 'food_waste', 'anaerobic_digestion', 100.0, 'non_hazardous', 'third_party_licensed', 'Wine lees and sediment from racking/filtration. High-moisture organic waste.'),
  ('waste_general'::facility_activity_category_enum, 1500, 90, 'food_waste', 'composting', 100.0, 'non_hazardous', 'in_house', 'Stems from destemming, vine prunings from estate vineyards.'),
  ('waste_recycling'::facility_activity_category_enum, 1850, 92, 'packaging_waste', 'recycling', 98.0, 'non_hazardous', 'third_party_licensed', 'Damaged wine bottles from filling line. Production waste only.'),
  ('waste_recycling'::facility_activity_category_enum, 120, 85, 'packaging_waste', 'recycling', 90.0, 'non_hazardous', 'third_party_licensed', 'Rejected/damaged natural corks for granulation and reuse.'),
  ('waste_recycling'::facility_activity_category_enum, 980, 90, 'packaging_waste', 'recycling', 95.0, 'non_hazardous', 'third_party_licensed', 'Cardboard wine cases and dividers from production.'),
  ('waste_general'::facility_activity_category_enum, 280, 82, 'process_waste', 'composting', 85.0, 'non_hazardous', 'in_house', 'Spent bentonite and fining agents mixed with pomace for composting.'),
  ('waste_general'::facility_activity_category_enum, 150, 80, 'process_waste', 'landfill', 0.0, 'non_hazardous', 'third_party_licensed', 'Used filter pads and non-recyclable mixed waste. Minimal volume.'),
  ('waste_hazardous'::facility_activity_category_enum, 45, 95, 'hazardous', 'incineration_with_recovery', 45.0, 'hazardous', 'third_party_licensed', 'Sulphite solution residues and laboratory chemicals.')
) AS waste_data(activity_category, quantity, confidence, waste_cat, treatment, recovery_pct, hazard_class, disposal_type, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM facility_activity_entries 
  WHERE facility_id = '16e80d3a-cb15-4530-9c04-781317b33427'
  AND activity_category IN ('waste_general', 'waste_hazardous', 'waste_recycling')
  AND waste_category IS NOT NULL
  LIMIT 1
);
