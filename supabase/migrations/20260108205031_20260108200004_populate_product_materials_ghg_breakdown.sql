/*
  # Populate Product LCA Materials with GHG Gas Breakdown

  ## Purpose
  Updates existing product_lca_materials with detailed CH4 and N2O emissions
  based on EcoInvent 3.9+ typical compositions.

  ## Methodology
  - GWP values: IPCC AR6 GWP100 (2021)
  - CH4 fossil: 29.8
  - CH4 biogenic: 27.2
  - N2O: 273

  ## Data Sources
  - EcoInvent 3.9+ database typical values
  - DEFRA 2025 emission factors
  - ISO 14067:2018 compliant breakdowns
*/

-- ============================================================================
-- Update Glass Bottles - Industrial process, predominantly fossil CH4
-- Typical: 96% CO2, 1.3% CH4, 2.5% N2O, 0.2% HFC
-- ============================================================================
UPDATE public.product_lca_materials
SET 
  ch4_fossil_kg = impact_climate * 0.00045,
  ch4_biogenic_kg = 0,
  n2o_kg = impact_climate * 0.00009,
  ch4_fossil_kg_co2e = impact_climate * 0.00045 * 29.8,
  ch4_biogenic_kg_co2e = 0,
  n2o_kg_co2e = impact_climate * 0.00009 * 273,
  hfc_pfc_kg_co2e = impact_climate * 0.002,
  gwp_method = 'IPCC AR6 GWP100',
  gwp_ch4_fossil = 29.8,
  gwp_ch4_biogenic = 27.2,
  gwp_n2o = 273,
  ghg_data_quality = 'secondary'
WHERE name ILIKE '%glass%' OR material_name ILIKE '%glass%';

-- ============================================================================
-- Update Organic Apples - Agricultural, high biogenic CH4, significant N2O
-- Typical: 57% CO2 fossil, 20% CO2 bio, 8% CH4 bio, 15% N2O
-- ============================================================================
UPDATE public.product_lca_materials
SET 
  ch4_fossil_kg = 0,
  ch4_biogenic_kg = impact_climate * 0.003,
  n2o_kg = impact_climate * 0.00055,
  ch4_fossil_kg_co2e = 0,
  ch4_biogenic_kg_co2e = impact_climate * 0.003 * 27.2,
  n2o_kg_co2e = impact_climate * 0.00055 * 273,
  hfc_pfc_kg_co2e = 0,
  gwp_method = 'IPCC AR6 GWP100',
  gwp_ch4_fossil = 29.8,
  gwp_ch4_biogenic = 27.2,
  gwp_n2o = 273,
  ghg_data_quality = 'secondary'
WHERE name ILIKE '%apple%' OR material_name ILIKE '%apple%';

-- ============================================================================
-- Update Grapes - Wine production, agricultural
-- Typical: 57% CO2 fossil, 20% CO2 bio, 7% CH4 bio, 16% N2O
-- ============================================================================
UPDATE public.product_lca_materials
SET 
  ch4_fossil_kg = 0,
  ch4_biogenic_kg = impact_climate * 0.0026,
  n2o_kg = impact_climate * 0.00059,
  ch4_fossil_kg_co2e = 0,
  ch4_biogenic_kg_co2e = impact_climate * 0.0026 * 27.2,
  n2o_kg_co2e = impact_climate * 0.00059 * 273,
  hfc_pfc_kg_co2e = 0,
  gwp_method = 'IPCC AR6 GWP100',
  gwp_ch4_fossil = 29.8,
  gwp_ch4_biogenic = 27.2,
  gwp_n2o = 273,
  ghg_data_quality = 'secondary'
WHERE name ILIKE '%grape%' OR material_name ILIKE '%grape%';

-- ============================================================================
-- Update Malted Barley - High N2O from fertilizers
-- Typical: 56% CO2 fossil, 25% CO2 bio, 6% CH4 bio, 11% N2O, 2% dLUC
-- ============================================================================
UPDATE public.product_lca_materials
SET 
  ch4_fossil_kg = 0,
  ch4_biogenic_kg = impact_climate * 0.0023,
  n2o_kg = impact_climate * 0.0004,
  ch4_fossil_kg_co2e = 0,
  ch4_biogenic_kg_co2e = impact_climate * 0.0023 * 27.2,
  n2o_kg_co2e = impact_climate * 0.0004 * 273,
  hfc_pfc_kg_co2e = 0,
  gwp_method = 'IPCC AR6 GWP100',
  gwp_ch4_fossil = 29.8,
  gwp_ch4_biogenic = 27.2,
  gwp_n2o = 273,
  ghg_data_quality = 'secondary'
WHERE name ILIKE '%barley%' OR name ILIKE '%malt%' 
   OR material_name ILIKE '%barley%' OR material_name ILIKE '%malt%';

-- ============================================================================
-- Update Hops - High N2O from fertilizers
-- Typical: 55% CO2 fossil, 21% CO2 bio, 7.5% CH4 bio, 16% N2O
-- ============================================================================
UPDATE public.product_lca_materials
SET 
  ch4_fossil_kg = 0,
  ch4_biogenic_kg = impact_climate * 0.0028,
  n2o_kg = impact_climate * 0.0006,
  ch4_fossil_kg_co2e = 0,
  ch4_biogenic_kg_co2e = impact_climate * 0.0028 * 27.2,
  n2o_kg_co2e = impact_climate * 0.0006 * 273,
  hfc_pfc_kg_co2e = 0,
  gwp_method = 'IPCC AR6 GWP100',
  gwp_ch4_fossil = 29.8,
  gwp_ch4_biogenic = 27.2,
  gwp_n2o = 273,
  ghg_data_quality = 'secondary'
WHERE name ILIKE '%hop%' OR material_name ILIKE '%hop%';

-- ============================================================================
-- Update Aluminium - Industrial, predominantly fossil
-- Typical: 96% CO2 fossil, 1.1% CH4 fossil, 2.7% N2O, 0.2% HFC
-- ============================================================================
UPDATE public.product_lca_materials
SET 
  ch4_fossil_kg = impact_climate * 0.00037,
  ch4_biogenic_kg = 0,
  n2o_kg = impact_climate * 0.0001,
  ch4_fossil_kg_co2e = impact_climate * 0.00037 * 29.8,
  ch4_biogenic_kg_co2e = 0,
  n2o_kg_co2e = impact_climate * 0.0001 * 273,
  hfc_pfc_kg_co2e = impact_climate * 0.002,
  gwp_method = 'IPCC AR6 GWP100',
  gwp_ch4_fossil = 29.8,
  gwp_ch4_biogenic = 27.2,
  gwp_n2o = 273,
  ghg_data_quality = 'secondary'
WHERE name ILIKE '%aluminium%' OR name ILIKE '%aluminum%' OR name ILIKE '%foil%' OR name ILIKE '%can%'
   OR material_name ILIKE '%aluminium%' OR material_name ILIKE '%aluminum%';

-- ============================================================================
-- Update Water - Minimal footprint
-- Typical: 85% CO2 fossil, 10% CH4 fossil, 5% N2O
-- ============================================================================
UPDATE public.product_lca_materials
SET 
  ch4_fossil_kg = impact_climate * 0.0034,
  ch4_biogenic_kg = 0,
  n2o_kg = impact_climate * 0.00018,
  ch4_fossil_kg_co2e = impact_climate * 0.0034 * 29.8,
  ch4_biogenic_kg_co2e = 0,
  n2o_kg_co2e = impact_climate * 0.00018 * 273,
  hfc_pfc_kg_co2e = 0,
  gwp_method = 'IPCC AR6 GWP100',
  gwp_ch4_fossil = 29.8,
  gwp_ch4_biogenic = 27.2,
  gwp_n2o = 273,
  ghg_data_quality = 'secondary'
WHERE name ILIKE '%water%' OR material_name ILIKE '%water%';

-- ============================================================================
-- Update Cork - Wine closures
-- Typical: 65% CO2 fossil, 18% CO2 bio, 5% CH4 bio, 12% N2O
-- ============================================================================
UPDATE public.product_lca_materials
SET 
  ch4_fossil_kg = 0,
  ch4_biogenic_kg = impact_climate * 0.0018,
  n2o_kg = impact_climate * 0.00044,
  ch4_fossil_kg_co2e = 0,
  ch4_biogenic_kg_co2e = impact_climate * 0.0018 * 27.2,
  n2o_kg_co2e = impact_climate * 0.00044 * 273,
  hfc_pfc_kg_co2e = 0,
  gwp_method = 'IPCC AR6 GWP100',
  gwp_ch4_fossil = 29.8,
  gwp_ch4_biogenic = 27.2,
  gwp_n2o = 273,
  ghg_data_quality = 'secondary'
WHERE name ILIKE '%cork%' OR material_name ILIKE '%cork%';

-- ============================================================================
-- Update Paper/Labels - Mixed fossil/biogenic
-- Typical: 55% CO2 fossil, 32% CO2 bio, 3% CH4 fossil, 5% CH4 bio, 5% N2O
-- ============================================================================
UPDATE public.product_lca_materials
SET 
  ch4_fossil_kg = impact_climate * 0.001,
  ch4_biogenic_kg = impact_climate * 0.0018,
  n2o_kg = impact_climate * 0.00018,
  ch4_fossil_kg_co2e = impact_climate * 0.001 * 29.8,
  ch4_biogenic_kg_co2e = impact_climate * 0.0018 * 27.2,
  n2o_kg_co2e = impact_climate * 0.00018 * 273,
  hfc_pfc_kg_co2e = 0,
  gwp_method = 'IPCC AR6 GWP100',
  gwp_ch4_fossil = 29.8,
  gwp_ch4_biogenic = 27.2,
  gwp_n2o = 273,
  ghg_data_quality = 'secondary'
WHERE name ILIKE '%paper%' OR name ILIKE '%label%' OR name ILIKE '%cardboard%'
   OR material_name ILIKE '%paper%' OR material_name ILIKE '%label%';

-- ============================================================================
-- Set default values for any remaining materials without GHG breakdown
-- Use generic industrial profile: 90% CO2, 5% CH4, 5% N2O
-- ============================================================================
UPDATE public.product_lca_materials
SET 
  ch4_fossil_kg = COALESCE(ch4_fossil_kg, impact_climate * 0.0017),
  ch4_biogenic_kg = COALESCE(ch4_biogenic_kg, 0),
  n2o_kg = COALESCE(n2o_kg, impact_climate * 0.00018),
  ch4_fossil_kg_co2e = COALESCE(ch4_fossil_kg_co2e, impact_climate * 0.0017 * 29.8),
  ch4_biogenic_kg_co2e = COALESCE(ch4_biogenic_kg_co2e, 0),
  n2o_kg_co2e = COALESCE(n2o_kg_co2e, impact_climate * 0.00018 * 273),
  hfc_pfc_kg_co2e = COALESCE(hfc_pfc_kg_co2e, 0),
  gwp_method = COALESCE(gwp_method, 'IPCC AR6 GWP100'),
  gwp_ch4_fossil = COALESCE(gwp_ch4_fossil, 29.8),
  gwp_ch4_biogenic = COALESCE(gwp_ch4_biogenic, 27.2),
  gwp_n2o = COALESCE(gwp_n2o, 273),
  ghg_data_quality = COALESCE(ghg_data_quality, 'tertiary')
WHERE impact_climate IS NOT NULL AND impact_climate > 0;
