/*
  # Populate GHG Gas Breakdown for Staging Emission Factors

  ## Purpose
  Updates existing staging_emission_factors with detailed GHG gas breakdowns
  based on EcoInvent 3.9+ typical compositions for beverage industry materials.

  ## Standards Compliance
  - ISO 14067:2018: Individual GHG quantification
  - GHG Protocol: Gas-by-gas reporting
  - IPCC AR6: GWP100 characterization factors (2021)

  ## GWP Values Used (IPCC AR6 GWP100)
  - CO2: 1
  - CH4 fossil: 29.8
  - CH4 biogenic: 27.2
  - N2O: 273
*/

-- ============================================================================
-- Update Malted Barley - High agricultural N2O
-- Total: 1.30 kg CO2eq/kg
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = 0.73,
  co2_biogenic_factor = 0.32,
  ch4_fossil_factor = 0,
  ch4_biogenic_factor = 0.0030,
  n2o_factor = 0.00050,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2020-2023',
  ecoinvent_reference = 'barley grain production | barley grain | APOS, U - GB',
  uncertainty_percent = 15
WHERE name ILIKE '%barley%' OR name ILIKE '%malt%';

-- ============================================================================
-- Update Hops - High agricultural footprint
-- Total: 4.00 kg CO2eq/kg
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = 2.20,
  co2_biogenic_factor = 0.84,
  ch4_fossil_factor = 0,
  ch4_biogenic_factor = 0.011,
  n2o_factor = 0.0024,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2020-2023',
  ecoinvent_reference = 'hop production | hop | APOS, U - DE',
  uncertainty_percent = 20
WHERE name ILIKE '%hop%';

-- ============================================================================
-- Update Aluminium - Industrial, predominantly fossil
-- Total: 9.20 kg CO2eq/kg
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = 8.85,
  co2_biogenic_factor = 0,
  ch4_fossil_factor = 0.0034,
  ch4_biogenic_factor = 0,
  n2o_factor = 0.00091,
  hfc_pfc_factor = 0.002,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2020-2023',
  ecoinvent_reference = 'aluminium, wrought alloy | aluminium, wrought alloy | APOS, U - GLO',
  uncertainty_percent = 10
WHERE name ILIKE '%aluminium%' OR name ILIKE '%aluminum%' OR name ILIKE '%foil%';

-- ============================================================================
-- Update Glass - Industrial process
-- Total varies by recycled content
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = co2_factor * 0.96,
  co2_biogenic_factor = 0,
  ch4_fossil_factor = co2_factor * 0.00045,
  ch4_biogenic_factor = 0,
  n2o_factor = co2_factor * 0.00008,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2020-2023',
  ecoinvent_reference = 'packaging glass | packaging glass | APOS, U - RER',
  uncertainty_percent = 10
WHERE name ILIKE '%glass%' AND name ILIKE '%bottle%';

-- ============================================================================
-- Update Water - Minimal footprint
-- Total: 0.0003 kg CO2eq/kg
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = 0.00025,
  co2_biogenic_factor = 0,
  ch4_fossil_factor = 0.0000015,
  ch4_biogenic_factor = 0,
  n2o_factor = 0.00000008,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2020-2023',
  ecoinvent_reference = 'tap water production | tap water | APOS, U - RER',
  uncertainty_percent = 10
WHERE name ILIKE '%water%';

-- ============================================================================
-- Update Paper/Labels
-- Total: ~1.0 kg CO2eq/kg
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = co2_factor * 0.55,
  co2_biogenic_factor = co2_factor * 0.32,
  ch4_fossil_factor = co2_factor * 0.0007,
  ch4_biogenic_factor = co2_factor * 0.0018,
  n2o_factor = co2_factor * 0.00015,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2020-2023',
  ecoinvent_reference = 'paper, woodfree, coated | paper, woodfree, coated | APOS, U - RER',
  uncertainty_percent = 12
WHERE name ILIKE '%paper%' OR name ILIKE '%label%';

-- ============================================================================
-- Update Grapes - Wine production
-- Total: 0.60 kg CO2eq/kg
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = 0.34,
  co2_biogenic_factor = 0.12,
  ch4_fossil_factor = 0,
  ch4_biogenic_factor = 0.0014,
  n2o_factor = 0.00038,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2020-2023',
  ecoinvent_reference = 'grape production | grape | APOS, U - FR/NZ',
  uncertainty_percent = 20
WHERE name ILIKE '%grape%';

-- ============================================================================
-- Update Apples - Calvados production
-- Total: 0.30 kg CO2eq/kg (organic)
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = 0.17,
  co2_biogenic_factor = 0.06,
  ch4_fossil_factor = 0,
  ch4_biogenic_factor = 0.0008,
  n2o_factor = 0.00020,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2020-2023',
  ecoinvent_reference = 'apple production, organic | apple | APOS, U - FR',
  uncertainty_percent = 18
WHERE name ILIKE '%apple%';

-- ============================================================================
-- Update Cork - Wine/spirits closures
-- Total: 1.00 kg CO2eq/kg
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = 0.65,
  co2_biogenic_factor = 0.18,
  ch4_fossil_factor = 0,
  ch4_biogenic_factor = 0.0020,
  n2o_factor = 0.00030,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2020-2023',
  ecoinvent_reference = 'cork stopper production | cork stopper | APOS, U - PT',
  uncertainty_percent = 25
WHERE name ILIKE '%cork%';

-- ============================================================================
-- Update Transport - Road freight
-- Total: 0.062 kg CO2eq/tkm
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = 0.058,
  co2_biogenic_factor = 0,
  ch4_fossil_factor = 0.000012,
  ch4_biogenic_factor = 0,
  n2o_factor = 0.0000032,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2025',
  ecoinvent_reference = 'DEFRA 2025: transport, freight, lorry 16-32 metric ton',
  uncertainty_percent = 8
WHERE name ILIKE '%road%' OR name ILIKE '%HGV%';

-- ============================================================================
-- Update Transport - Rail freight
-- Total: 0.028 kg CO2eq/tkm
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = 0.026,
  co2_biogenic_factor = 0,
  ch4_fossil_factor = 0.000006,
  ch4_biogenic_factor = 0,
  n2o_factor = 0.0000018,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2025',
  ecoinvent_reference = 'DEFRA 2025: transport, freight, rail',
  uncertainty_percent = 10
WHERE name ILIKE '%rail%';

-- ============================================================================
-- Update Transport - Sea freight
-- Total: 0.011 kg CO2eq/tkm
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = 0.0102,
  co2_biogenic_factor = 0,
  ch4_fossil_factor = 0.0000022,
  ch4_biogenic_factor = 0,
  n2o_factor = 0.0000006,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2025',
  ecoinvent_reference = 'DEFRA 2025: transport, freight, sea, container ship',
  uncertainty_percent = 15
WHERE name ILIKE '%sea%' OR name ILIKE '%ship%';

-- ============================================================================
-- Update Transport - Air freight
-- Total: 0.602 kg CO2eq/tkm
-- ============================================================================
UPDATE public.staging_emission_factors
SET 
  co2_fossil_factor = 0.58,
  co2_biogenic_factor = 0,
  ch4_fossil_factor = 0.00006,
  ch4_biogenic_factor = 0,
  n2o_factor = 0.000018,
  hfc_pfc_factor = 0,
  gwp_methodology = 'IPCC AR6 GWP100',
  temporal_coverage = '2025',
  ecoinvent_reference = 'DEFRA 2025: transport, freight, aircraft',
  uncertainty_percent = 12
WHERE name ILIKE '%air%';
