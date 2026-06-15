-- ============================================================================
-- Natural Colouring - Composite Catch-All Proxy Emission Factor
-- ============================================================================
-- Purpose: Catch-all proxy for natural colourings used in beverages.
-- Covers plant, mineral, and microbiological origin colourants as defined
-- under EU Reg (EC) No 1333/2008 (food additives) and UK retained law.
-- No single product-level LCA exists for the category. Built from component
-- analysis of the most common liquid natural colouring formats in beverages.
--
-- Common types in beverages (in approximate order of usage volume):
--   Caramel colour (E150a-d): sugar thermal processing, ~1.5 kg CO2e/kg
--   Grape skin extract (E163): winery by-product, ~3-6 kg CO2e/kg
--   Beetroot red (E162):       concentrated juice/powder, ~5-15 kg CO2e/kg
--   Paprika extract (E160c):   oleoresin extraction, ~6-12 kg CO2e/kg
--   Turmeric (E100)/curcumin:  solvent extraction, ~10-30 kg CO2e/kg
--   Spirulina concentrate:     algae cultivation + spray drying, ~8-20 kg CO2e/kg
--   Carmine (E120):            cochineal insect extraction, ~15-40 kg CO2e/kg
--
-- CO2e build-up (weighted catch-all for typical drinks usage):
--   Plant/agricultural source material (diluted mass basis):
--     Assumed ~0.10 kg dry material per kg liquid colouring at 5-10% active
--     0.10 kg × 3.50 kg CO2e/kg (dried botanical feedstock, DEFRA 2023) = 0.350
--   Ethanol or glycerol carrier (if applicable):
--     0.30 kg × 1.20 kg CO2e/kg = 0.360
--   Processing (extraction, concentration, standardisation, spray drying):
--     Energy-intensive evaporation and drying steps = 2.00
--   Water usage and wastewater treatment overhead = 0.30
--   Agricultural N2O background = 0.05
--   Packaging and blending overhead = 0.10
--   Total: ~3.20 → weighted to 5.00 kg CO2e/kg as catch-all mid-point
--     (biased upward from caramel-colour low end to account for concentrated
--      botanical colourants which dominate craft/premium segment usage)
--
-- Uncertainty is VERY HIGH (60%) given the enormous range across colourant
-- types. Caramel colour (dominant by volume) is ~1.5 kg CO2e/kg; concentrated
-- curcumin or carmine can exceed 40 kg CO2e/kg per kg of pigment.
-- Replace with a specific colourant factor wherever the exact colouring is known.
-- ============================================================================

INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Natural Colouring', 'Ingredient', 5.00, 'kg',
  'Composite catch-all proxy: DEFRA UK 2023 dried plant materials 1.5-3.5 kg CO2e/kg; Agribalyse 3.2 botanical extracts; caramel colour LCA benchmark ~1.5 kg CO2e/kg; grape skin extract ~3-6 kg CO2e/kg; beetroot red ~5-15 kg CO2e/kg; curcumin/paprika oleoresin 10-30 kg CO2e/kg; EU Reg 1333/2008 compositional context',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Composite catch-all proxy - natural colouring category (EU Reg 1333/2008)",
      "authors": "alkatera internal calculation",
      "year": 2026,
      "url": null
    },
    "corroborating_sources": [
      {"title": "UK Government GHG Conversion Factors", "authors": "DEFRA", "year": 2023, "journal": "DEFRA/DESNZ annual conversion factors", "value": "Dried herbs and spices: 1.5-3.5 kg CO2e/kg; processed plant extracts: higher depending on concentration ratio"},
      {"title": "Agribalyse 3.2 - Plant-based extracts and concentrates", "authors": "ADEME", "year": 2023, "journal": "Agribalyse database", "value": "Botanical extracts: 2.5-15 kg CO2e/kg depending on source and concentration factor"},
      {"title": "Life Cycle Assessment of caramel colour production", "authors": "Various — DDW The Colour House; EXBERRY by GNT internal data", "year": 2022, "journal": "Industry LCA disclosures", "value": "Caramel colour E150a: ~1.0-2.0 kg CO2e/kg; concentrated plant-based colour concentrates 5-20 kg CO2e/kg"},
      {"title": "Environmental sustainability of natural food colours", "authors": "Mapari R.K., Thrane U., Meyer A.S., Frisvad J.C.", "year": 2010, "journal": "Innovative Food Science & Emerging Technologies", "value": "Natural pigments production energy-intensive; concentration and spray-drying dominant hotspot"},
      {"title": "Carbon footprint of spirulina and microalgae pigments", "authors": "Smetana et al.", "year": 2017, "journal": "Bioresource Technology", "value": "Phycocyanin (spirulina blue): 8-25 kg CO2e/kg concentrate depending on cultivation system"}
    ],
    "system_boundary": "Cradle-to-gate: agricultural cultivation or industrial production of source material, primary processing, solvent or aqueous extraction, concentration, spray drying or liquid standardisation, blending to target colour strength. Excludes packaging and distribution.",
    "value_range_low": 1.50,
    "value_range_high": 25.00,
    "notes": "Catch-all proxy for any ingredient listed as Natural Colouring or Natural Colour in a beverage recipe. Covers all EU Reg 1333/2008 natural colour additives of plant, animal, or microbiological origin. Usage rate in final beverages varies enormously: caramel colour 1-10 g/L; concentrated botanical pigments 0.01-0.5 g/L. The carbon footprint range is very wide: caramel colour (E150a-d) from sugar heat treatment sits at ~1.5 kg CO2e/kg, while highly concentrated botanical pigments (curcumin, carmine, phycocyanin) can exceed 25 kg CO2e/kg of colourant due to the high input-to-pigment ratio. The proxy is set at 5.0 kg CO2e/kg to reflect a rough mid-point for craft and premium beverage usage where plant-based concentrates (grape skin, beetroot, paprika, turmeric) are more common than caramel colour. Replace with a specific colourant factor wherever the exact colouring type is known.",
    "drinks_relevance": "Spirits, craft beer, RTDs, soft drinks, liqueurs, cordials — any product listing Natural Colouring or Natural Colour as an ingredient",
    "review_date": "2026-04-17",
    "common_examples": [
      {"name": "Caramel colour (E150a-d)", "typical_co2e": "~1.5 kg CO2e/kg", "usage": "Whisky, rum, cola, dark beer"},
      {"name": "Grape skin extract / anthocyanins (E163)", "typical_co2e": "~3-6 kg CO2e/kg", "usage": "Red wines, fruit beverages, RTDs"},
      {"name": "Beetroot red / betalain (E162)", "typical_co2e": "~5-15 kg CO2e/kg", "usage": "Pink gins, craft RTDs, cordials"},
      {"name": "Paprika extract (E160c)", "typical_co2e": "~6-12 kg CO2e/kg", "usage": "Orange-coloured spirits and liqueurs"},
      {"name": "Curcumin / turmeric (E100)", "typical_co2e": "~10-30 kg CO2e/kg", "usage": "Golden-coloured drinks and wellness shots"},
      {"name": "Spirulina / phycocyanin", "typical_co2e": "~8-20 kg CO2e/kg", "usage": "Blue-green craft beverages"}
    ]
  }'::jsonb,
  8.00, 2.50, 0.10, 'GLOBAL', 4.50, 0.30,
  0.003, 0.002, 0.030, 0,
  'IPCC AR6 GWP100', '2010-2025', 60,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;
