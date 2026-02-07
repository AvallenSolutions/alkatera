-- Add missing emission factors for wine industry materials
-- These are required for complete LCA calculations on wine products
-- Sources: DEFRA 2024, ecoinvent 3.12, peer-reviewed literature

-- ================================================
-- Foil Capsule (aluminium, wine bottle closure)
-- Source: ecoinvent 3.12 (aluminium foil production) + DEFRA 2024 (aluminium processing)
-- Typical wine capsule weighs 3-5g, made from aluminium or tin
-- ================================================
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit,
  source, metadata,
  water_factor, land_factor, waste_factor,
  co2_fossil_factor, co2_biogenic_factor,
  terrestrial_ecotoxicity_factor,
  freshwater_eutrophication_factor,
  terrestrial_acidification_factor,
  freshwater_ecotoxicity_factor,
  marine_ecotoxicity_factor,
  marine_eutrophication_factor,
  geographic_scope, gwp_methodology, confidence_score
) VALUES (
  NULL,
  'Foil Capsule',
  'Packaging',
  9.16,
  'kg',
  'ecoinvent 3.12 (aluminium foil production, wrapping quality); DEFRA 2024 Conversion Factors; EAA Environmental Profile Report 2018',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Aluminium foil production, wrapping quality",
      "authors": "ecoinvent Centre",
      "year": 2024,
      "database": "ecoinvent 3.12"
    },
    "corroborating_sources": [
      {"title": "Environmental Profile Report", "authors": "European Aluminium Association (EAA)", "year": 2018},
      {"title": "UK Government GHG Conversion Factors for Company Reporting", "authors": "DEFRA/BEIS", "year": 2024}
    ],
    "system_boundary": "Cradle-to-gate: bauxite mining, alumina refining, aluminium smelting, foil rolling, capsule forming",
    "value_range_low": 8.0,
    "value_range_high": 12.0,
    "drinks_relevance": "Wine bottles — decorative/protective capsule over cork or screw cap closure. Typical weight 3-5g per capsule.",
    "notes": "Factor covers primary aluminium foil production. Recycled content reduces impact significantly but capsules are rarely recycled separately. Tin capsules have similar footprint."
  }'::jsonb,
  0.035, 0.008, 0.15,
  8.90, 0.26,
  0.85, 0.0012, 0.045, 0.15, 0.22, 0.00008,
  'GLO', 'IPCC AR6 GWP100', 70
)
ON CONFLICT DO NOTHING;

-- ================================================
-- Green Glass Bottle 750ml (80% recycled content)
-- Source: FEVE (European Container Glass Federation) 2023; ecoinvent 3.12
-- Higher recycled content significantly reduces carbon footprint
-- ================================================
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit,
  source, metadata,
  water_factor, land_factor, waste_factor,
  co2_fossil_factor, co2_biogenic_factor,
  terrestrial_ecotoxicity_factor,
  freshwater_eutrophication_factor,
  terrestrial_acidification_factor,
  freshwater_ecotoxicity_factor,
  marine_ecotoxicity_factor,
  marine_eutrophication_factor,
  geographic_scope, gwp_methodology, confidence_score
) VALUES (
  NULL,
  'Green Glass Bottle 750ml (80% recycled)',
  'Packaging',
  0.45,
  'kg',
  'FEVE Container Glass Recycling Data 2023; ecoinvent 3.12 (glass production, green); British Glass Sustainability Report 2023',
  '{
    "data_quality_grade": "HIGH",
    "literature_source": {
      "title": "EU Container Glass: Carbon Footprint with Recycled Content",
      "authors": "FEVE (European Container Glass Federation)",
      "year": 2023,
      "url": "https://feve.org/glass-recycling-stats/"
    },
    "corroborating_sources": [
      {"title": "Environmental Profile of Glass Packaging", "authors": "British Glass", "year": 2023},
      {"title": "Glass container production, green", "authors": "ecoinvent Centre", "year": 2024, "database": "ecoinvent 3.12"}
    ],
    "system_boundary": "Cradle-to-gate: cullet collection, sorting, melting with 80% recycled content, bottle forming, annealing",
    "value_range_low": 0.38,
    "value_range_high": 0.55,
    "drinks_relevance": "Standard 750ml wine bottle in green glass. 80% recycled content is achievable in regions with good glass recycling (EU average ~76%). Green glass used for red wines, some whites.",
    "notes": "Each 10% increase in recycled content reduces CO2 by ~5%. 80% cullet reduces energy by ~2.5% per 10% increase. Virgin green glass ~0.85 kg CO2e/kg."
  }'::jsonb,
  0.003, 0.002, 0.02,
  0.44, 0.01,
  0.08, 0.00045, 0.003, 0.02, 0.028, 0.000015,
  'GLO', 'IPCC AR6 GWP100', 80
)
ON CONFLICT DO NOTHING;

-- ================================================
-- Traditional Cork (natural wine closure)
-- Source: Amorim Cork/PwC 2020 Carbon Footprint Study; ecoinvent 3.12
-- Note: This is a production-only factor (conservative), actual net may be negative
-- ================================================
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit,
  source, metadata,
  water_factor, land_factor, waste_factor,
  co2_fossil_factor, co2_biogenic_factor,
  terrestrial_ecotoxicity_factor,
  freshwater_eutrophication_factor,
  terrestrial_acidification_factor,
  freshwater_ecotoxicity_factor,
  marine_ecotoxicity_factor,
  marine_eutrophication_factor,
  geographic_scope, gwp_methodology, confidence_score
) VALUES (
  NULL,
  'Traditional Cork',
  'Packaging',
  1.36,
  'kg',
  'Amorim Cork/PwC 2020; Cork Forest Conservation Alliance; ecoinvent 3.12 (cork stopper production)',
  '{
    "data_quality_grade": "HIGH",
    "literature_source": {
      "title": "Carbon Footprint of Natural Cork Stoppers",
      "authors": "PricewaterhouseCoopers for Amorim Cork",
      "year": 2020,
      "url": "https://www.amorimcork.com/xms/files/Studies/Carbon_Footprint_PWC_AC_Naturity_Executive_summary.pdf"
    },
    "corroborating_sources": [
      {"title": "Environmental impacts of cork production", "authors": "Demertzi et al.", "year": 2016, "journal": "Journal of Cleaner Production"},
      {"title": "Cork Oak Forests as Carbon Sinks", "authors": "Cork Forest Conservation Alliance", "year": 2019}
    ],
    "system_boundary": "Cradle-to-gate: cork oak bark harvest through stopper production (production emissions only, excludes biogenic carbon sequestration)",
    "value_range_low": 1.00,
    "value_range_high": 2.50,
    "drinks_relevance": "Wine bottles, premium spirits — natural cork closures. Single cork weighs 3-5g. Traditional material with strong sustainability story.",
    "notes": "PRODUCTION EMISSIONS ONLY. Cork oak forests sequester significant carbon — net carbon balance is likely negative (~-309g CO2/stopper per EY/Amorim studies). Conservative approach: report production emissions only.",
    "biogenic_carbon_note": "Cork oak (Quercus suber) forests sequester ~14.7 tonnes CO2/ha/year. Net balance per cork is carbon-negative."
  }'::jsonb,
  0.015, 0.85, 0.01,
  1.20, 0.16,
  0.02, 0.00008, 0.005, 0.003, 0.004, 0.00002,
  'PT', 'IPCC AR6 GWP100', 85
)
ON CONFLICT DO NOTHING;

-- ================================================
-- Pinot Noir Grapes (wine grape variety)
-- Source: ADEME Base Carbone 2023 (French wine grapes); OIV 2022
-- Also accessible as a global factor for any NZ/French Pinot Noir
-- ================================================
INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit,
  source, metadata,
  water_factor, land_factor, waste_factor,
  co2_fossil_factor, co2_biogenic_factor,
  ch4_factor, n2o_factor,
  terrestrial_ecotoxicity_factor,
  freshwater_eutrophication_factor,
  terrestrial_acidification_factor,
  freshwater_ecotoxicity_factor,
  marine_ecotoxicity_factor,
  marine_eutrophication_factor,
  geographic_scope, gwp_methodology, confidence_score
) VALUES (
  NULL,
  'Pinot Noir Grapes',
  'Ingredient',
  0.58,
  'kg',
  'ADEME Base Carbone 2023; OIV Greenhouse Gas Accounting Protocol 2022; ecoinvent 3.12 (grape production, FR)',
  '{
    "data_quality_grade": "HIGH",
    "literature_source": {
      "title": "Base Carbone - Raisin de cuve (wine grape), conventional",
      "authors": "ADEME (French Environment and Energy Management Agency)",
      "year": 2023,
      "url": "https://base-empreinte.ademe.fr/"
    },
    "corroborating_sources": [
      {"title": "OIV Guidelines for GHG Accounting in the Wine Sector", "authors": "International Organisation of Vine and Wine (OIV)", "year": 2022},
      {"title": "Carbon footprint of wine grape production", "authors": "Rugani et al.", "year": 2013, "journal": "Journal of Cleaner Production"}
    ],
    "system_boundary": "Cradle-to-farm-gate: vineyard establishment (amortised), cultivation (spraying, irrigation, pruning), harvesting, on-farm energy",
    "value_range_low": 0.35,
    "value_range_high": 0.85,
    "drinks_relevance": "Core grape variety for premium red wines (Burgundy, Central Otago, Oregon). Emission factor covers conventional viticulture including field operations and fertiliser use.",
    "notes": "Pinot Noir has similar footprint to other Vitis vinifera varieties. Main GHG drivers: N-fertiliser (direct + indirect N2O), diesel for tractor operations, fungicides. Cool climate regions (NZ, Burgundy) typically lower end of range."
  }'::jsonb,
  0.80, 1.55, 0.05,
  0.38, 0.13,
  0.0012, 0.0035,
  0.015, 0.0025, 0.008, 0.005, 0.007, 0.003,
  'GLO', 'IPCC AR6 GWP100', 80
)
ON CONFLICT DO NOTHING;

-- ================================================
-- SUMMARY OF ADDED FACTORS:
-- 1. Foil Capsule — 9.16 kg CO2e/kg (aluminium-based wine capsule)
-- 2. Green Glass Bottle 750ml (80% recycled) — 0.45 kg CO2e/kg
-- 3. Traditional Cork — 1.36 kg CO2e/kg (production only)
-- 4. Pinot Noir Grapes — 0.58 kg CO2e/kg (wine grape variety)
--
-- These factors enable complete LCA calculations for wine products
-- like "Central Otago Pinot Noir 750ml" without data gaps.
-- ================================================
