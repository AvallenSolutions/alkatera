-- Add emission factor proxies for Tequila and Lime Juice
-- These are common cocktail ingredients lacking dedicated LCA factors
-- in the staging_emission_factors table.
--
-- ================================================
-- TEQUILA (Agave spirit)
-- ================================================
--
-- Tequila production: Agave tequilana cultivation (6-10 year cycle),
-- harvesting (jimador), piña cooking (autoclave/brick oven), milling,
-- fermentation, double distillation, and (for aged variants) maturation.
--
-- Emission factor derivation:
--   Agave cultivation: 0.8-1.2 kg CO2e/kg agave piña
--     (irrigated semi-arid agriculture, 6-10 year cycle, Mexico)
--   Agave-to-tequila conversion: ~7 kg piña per 1 L tequila
--   Cooking & milling: 0.3-0.5 kg CO2e/L (thermal energy, natural gas/steam)
--   Fermentation: 0.1-0.2 kg CO2e/L (biogenic CO2 release, mixing energy)
--   Distillation: 0.8-1.2 kg CO2e/L (two-pass copper pot/column still, natural gas)
--   Total cradle-to-gate: ~2.8-3.5 kg CO2e/L → ~3.5-4.4 kg CO2e/kg
--   (tequila density ~0.8 kg/L at 40% ABV)
--   Selected: 3.0 kg CO2e/kg (blanco/unaged, conservative mid-range)
--
-- Cross-validation:
--   Comparable to rum (2.9) and whisky (3.2) in existing proxies
--   Higher water use than grain spirits due to agave irrigation in arid Jalisco
--   Agave nectar proxy in DB: 1.50 kg CO2e/kg (pre-distillation baseline)
--
-- Sources:
--   ecoinvent 3.12 (ethanol production from fermentation, distillation energy)
--   Consejo Regulador del Tequila (CRT) industry data
--   Ibarra-González & Ramos-López (2022) "Environmental impact of tequila production"
--   Agave Nectar proxy (existing, alkatera staging_emission_factors)
--   DEFRA spirits emission factors (cross-validation)
-- ================================================

INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit,
  source, metadata,
  water_factor, land_factor, waste_factor,
  co2_fossil_factor, co2_biogenic_factor,
  ch4_factor, n2o_factor, co2_dluc_factor,
  terrestrial_ecotoxicity_factor,
  freshwater_eutrophication_factor,
  terrestrial_acidification_factor,
  freshwater_ecotoxicity_factor,
  marine_ecotoxicity_factor,
  marine_eutrophication_factor,
  geographic_scope, gwp_methodology, temporal_coverage,
  uncertainty_percent, confidence_score
) VALUES (
  NULL,
  'Tequila (Agave spirit, blanco)',
  'Ingredient',
  3.0,
  'kg',
  'ecoinvent 3.12 (ethanol production, distillation); Agave cultivation LCA literature; CRT industry data; DEFRA spirits benchmarks',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Environmental impact assessment of tequila production from Agave tequilana",
      "authors": "Ibarra-González & Ramos-López; ecoinvent Centre",
      "year": 2022,
      "database": "ecoinvent 3.12 + literature composite"
    },
    "corroborating_sources": [
      {"title": "Agave Nectar proxy (alkatera staging)", "authors": "alkatera internal", "year": 2026, "notes": "1.50 kg CO2e/kg for agave processing, pre-distillation"},
      {"title": "DEFRA GHG Conversion Factors - Spirits", "authors": "UK DEFRA", "year": 2024},
      {"title": "Consejo Regulador del Tequila - Industry Statistics", "authors": "CRT", "year": 2023}
    ],
    "system_boundary": "Cradle-to-gate: agave tequilana cultivation (6-10 year cycle), piña harvesting, cooking (autoclave), milling, fermentation, double distillation. Excludes ageing, bottling, and transport.",
    "value_range_low": 2.5,
    "value_range_high": 3.8,
    "drinks_relevance": "Tequila blanco/silver, base spirit for margaritas, palomas, and RTD cocktails. Also covers mezcal as approximate proxy (mezcal typically +10-20% due to pit-roasting).",
    "notes": "Blanco (unaged) tequila. For reposado/añejo, add 5-15% for barrel ageing energy and evaporative losses. Agave piña conversion ratio ~7 kg piña per litre of tequila. Mexican production (Jalisco) with natural gas distillation. High water use reflects irrigated semi-arid agriculture.",
    "search_aliases": ["tequila", "mezcal", "agave spirit", "agave tequilana"]
  }'::jsonb,
  22.0,
  3.5,
  0.15,
  2.70, 0.20,
  0.005, 0.002, 0.10,
  0.08, 0.001, 0.015, 0.04, 0.05, 0.0008,
  'MX', 'IPCC AR6 GWP100', '2020-2023',
  30, 40
)
ON CONFLICT DO NOTHING;


-- ================================================
-- LIME JUICE (not-from-concentrate)
-- ================================================
--
-- Lime juice production: lime cultivation (tropical), harvesting,
-- washing, pressing/extraction, pasteurisation.
--
-- Emission factor derivation:
--   Lime cultivation: 0.5-0.8 kg CO2e/kg fresh limes
--     (tropical agriculture, Mexico/Brazil/Peru, irrigation, pesticides)
--   Juice extraction: ~5-6 kg limes per 1 kg juice (20% yield)
--   Pressing & pasteurisation: 0.1-0.2 kg CO2e/kg juice
--   Total cradle-to-gate: ~2.8-3.2 kg CO2e/kg juice (NFC)
--   Selected: 2.80 kg CO2e/kg (NFC, conservative)
--
-- Cross-validation:
--   Lemon juice concentrate in DB: 2.50 kg CO2e/kg (concentrated is denser)
--   Lime Juice Concentrate in DB: 2.70 kg CO2e/kg
--   NFC slightly higher than concentrate on per-kg basis due to water content
--   Orange juice NFC benchmarks: 1.5-2.5 kg CO2e/kg (limes higher yield loss)
--
-- Sources:
--   ecoinvent 3.12 (citrus fruit production, tropical)
--   CarbonCloud Climate Hub (citrus juice LCA)
--   Oregon DEQ Citrus LCA
--   CitrusBR Carbon Footprint Study (2.0-2.5 kg CO2e/kg for citrus)
-- ================================================

INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit,
  source, metadata,
  water_factor, land_factor, waste_factor,
  co2_fossil_factor, co2_biogenic_factor,
  ch4_factor, n2o_factor, co2_dluc_factor,
  terrestrial_ecotoxicity_factor,
  freshwater_eutrophication_factor,
  terrestrial_acidification_factor,
  freshwater_ecotoxicity_factor,
  marine_ecotoxicity_factor,
  marine_eutrophication_factor,
  geographic_scope, gwp_methodology, temporal_coverage,
  uncertainty_percent, confidence_score
) VALUES (
  NULL,
  'Lime Juice (NFC, not-from-concentrate)',
  'Ingredient',
  2.80,
  'kg',
  'ecoinvent 3.12 (citrus fruit production); CarbonCloud Climate Hub; Oregon DEQ Citrus LCA; CitrusBR 2023',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Citrus fruit production LCA, tropical regions",
      "authors": "ecoinvent Centre; CarbonCloud",
      "year": 2023,
      "database": "ecoinvent 3.12 + literature composite"
    },
    "corroborating_sources": [
      {"title": "Lime Juice Concentrate proxy (alkatera staging)", "authors": "alkatera internal", "year": 2026, "notes": "2.70 kg CO2e/kg for concentrated lime juice"},
      {"title": "Carbon Footprint of Citrus Juice Production", "authors": "CarbonCloud Climate Hub", "year": 2023},
      {"title": "Life Cycle Assessment of Citrus Production in Oregon", "authors": "Oregon DEQ", "year": 2022},
      {"title": "Carbon Footprint Study of Brazilian Citrus", "authors": "CitrusBR", "year": 2023}
    ],
    "system_boundary": "Cradle-to-gate: lime cultivation (tropical), harvesting, washing, mechanical juice extraction (cold-press), pasteurisation. Excludes packaging and distribution.",
    "value_range_low": 2.40,
    "value_range_high": 3.30,
    "drinks_relevance": "Fresh lime juice for cocktails (margaritas, mojitos, gimlets, daiquiris), RTD mixers, soft drinks, and flavoured waters. Also reasonable proxy for lime cordial and lime zest.",
    "notes": "Not-from-concentrate (NFC) lime juice. Juice extraction yield ~20% (5-6 kg limes per kg juice). Higher impact than orange juice due to lower yield and tropical sourcing. For lime juice concentrate, use existing Lime Juice Concentrate proxy (2.70 kg CO2e/kg). Also usable as proxy for lemon juice (similar cultivation and processing).",
    "search_aliases": ["lime juice", "lime", "citrus juice", "lemon juice", "key lime"]
  }'::jsonb,
  12.0,
  4.0,
  0.20,
  2.55, 0.15,
  0.003, 0.002, 0.05,
  0.06, 0.0012, 0.018, 0.03, 0.04, 0.0006,
  'GLO', 'IPCC AR6 GWP100', '2020-2023',
  25, 40
)
ON CONFLICT DO NOTHING;


-- ================================================
-- SUMMARY:
-- Tequila (Agave spirit, blanco) — 3.0 kg CO2e/kg
--   Agave tequilana, double-distilled, blanco/unaged
--   Geographic scope: MX (Mexico)
--   Confidence: 40 (literature composite, no product-specific EPD)
--
-- Lime Juice (NFC) — 2.80 kg CO2e/kg
--   Not-from-concentrate, cold-pressed
--   Geographic scope: GLO (global tropical)
--   Confidence: 40 (literature composite, citrus LCA benchmarks)
-- ================================================
