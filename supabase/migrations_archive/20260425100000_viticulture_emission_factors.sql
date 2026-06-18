-- Viticulture Emission Factors
--
-- Seeds the staging_emission_factors table with curated emission factors
-- for vineyard/viticulture LCA inputs. These are used by the viticulture
-- calculator as fallback factors for Phase 1 (simple questionnaire mode).
--
-- Sources:
--   - ecoinvent 3.9 (fertiliser and pesticide production)
--   - IPCC 2019 Refinement (N2O emission factors are in code, not here)
--   - DEFRA 2025 (fuel combustion factors already in platform)

INSERT INTO public.staging_emission_factors (
  name, category, co2_factor, reference_unit, source, metadata,
  water_factor, land_factor, waste_factor,
  co2_fossil_factor, co2_biogenic_factor, n2o_factor,
  geographic_scope, gwp_methodology, temporal_coverage,
  uncertainty_percent, category_type
) VALUES
-- Synthetic nitrogen fertiliser production (per kg N)
-- Covers: Haber-Bosch process, granulation, packaging
-- Does NOT include field N2O (calculated separately by viticulture-calculator.ts)
(
  'Synthetic nitrogen fertiliser (production, per kg N)',
  'Ingredient',
  6.747,          -- kg CO2e per kg N
  'kg',
  'ecoinvent 3.9: ammonium nitrate production, RER; IPCC AR6 GWP100',
  '{"viticulture": true, "notes": "Production emissions only. Field N2O calculated separately via IPCC Tier 1 in viticulture-calculator.ts"}'::jsonb,
  0.012,          -- m3 water per kg N
  0.0,            -- m2 land per kg N
  0.001,          -- kg waste per kg N
  6.747,          -- all fossil
  0.0,            -- no biogenic
  0.0,            -- field N2O handled by calculator, not this factor
  'EU-27',
  'IPCC AR6 GWP100',
  '2020-2023',
  15.0,
  NULL
),

-- Organic fertiliser: manure (per kg fresh weight)
(
  'Organic fertiliser (manure, per kg fresh weight)',
  'Ingredient',
  0.216,
  'kg',
  'DEFRA 2024; IPCC 2019 Tier 1 for application emissions',
  '{"viticulture": true, "notes": "Includes transport and spreading. Field N2O calculated separately."}'::jsonb,
  0.0,
  0.0,
  0.0,
  0.180,
  0.036,
  0.0,
  'GB',
  'IPCC AR6 GWP100',
  '2023-2024',
  25.0,
  NULL
),

-- Organic fertiliser: compost (per kg fresh weight)
(
  'Organic fertiliser (compost, per kg fresh weight)',
  'Ingredient',
  0.115,
  'kg',
  'DEFRA 2024; ecoinvent 3.9 composting process',
  '{"viticulture": true, "notes": "Includes processing and application. Field N2O calculated separately."}'::jsonb,
  0.0,
  0.0,
  0.0,
  0.095,
  0.020,
  0.0,
  'GB',
  'IPCC AR6 GWP100',
  '2023-2024',
  20.0,
  NULL
),

-- Pesticide production: generic active ingredient
-- Phase 2 will add specific active ingredients (glyphosate, copper, sulphur, etc.)
(
  'Pesticide (generic active ingredient, production)',
  'Ingredient',
  10.97,
  'kg',
  'ecoinvent 3.9: pesticide production, unspecified, RER',
  '{"viticulture": true, "notes": "Generic proxy. Phase 2 adds specific AIs: glyphosate, copper sulphate, sulphur, folpet etc."}'::jsonb,
  0.025,
  0.0,
  0.002,
  10.97,
  0.0,
  0.0,
  'EU-27',
  'IPCC AR6 GWP100',
  '2020-2023',
  30.0,
  NULL
),

-- Herbicide production: generic active ingredient
(
  'Herbicide (generic active ingredient, production)',
  'Ingredient',
  6.30,
  'kg',
  'ecoinvent 3.9: herbicide production, unspecified, RER',
  '{"viticulture": true, "notes": "Generic proxy. Many vineyards use mechanical weeding instead."}'::jsonb,
  0.015,
  0.0,
  0.001,
  6.30,
  0.0,
  0.0,
  'EU-27',
  'IPCC AR6 GWP100',
  '2020-2023',
  30.0,
  NULL
),

-- Petrol (vineyard equipment) - DEFRA 2025
-- Diesel is already in the platform via DEFRA fallback library
(
  'Petrol (vineyard equipment)',
  'Energy',
  2.31,
  'L',
  'DEFRA 2025 GHG Conversion Factors: petrol (average biofuel blend)',
  '{"viticulture": true, "notes": "For small vineyard equipment (strimmers, chainsaws, ATVs)"}'::jsonb,
  0.0,
  0.0,
  0.0,
  2.31,
  0.0,
  0.0,
  'GB',
  'IPCC AR6 GWP100',
  '2024-2025',
  5.0,
  'SCOPE_1_2_ENERGY'
);
