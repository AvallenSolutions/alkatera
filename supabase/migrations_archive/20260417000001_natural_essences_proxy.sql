-- ============================================================================
-- Natural Essences - Composite Catch-All Proxy Emission Factor
-- ============================================================================
-- Purpose: Catch-all proxy for natural essences used in beverages.
-- Natural essences are highly concentrated, typically alcohol-distilled or
-- CO2-extracted fractions of plant material (fruits, botanicals, herbs).
-- They are more concentrated and more processing-intensive than general
-- natural flavourings. No category-level LCA exists in public databases
-- (ecoinvent, Agribalyse, DEFRA). Built from component analysis.
--
-- Typical composition per kg of natural essence (liquid, alcohol-based):
--   Botanical source material: 0.20 kg dried (20-30% active fraction)
--   Ethanol carrier (96%):     0.55 kg (~59% vol/vol at 0.91 kg/L density)
--   Water:                     0.25 kg (balance)
--   Processing: steam/vacuum distillation or supercritical CO2 extraction,
--               rectification, quality control, standardisation
--
-- CO2e build-up per kg:
--   Botanical raw material: 0.20 kg × 2.50 kg CO2e/kg = 0.500
--     (dried herbs/fruits: DEFRA UK 2023, Agribalyse 3.2 range 1.5-3.5)
--   Ethanol carrier:        0.55 kg × 1.20 kg CO2e/kg = 0.660
--     (grain neutral spirit: Munoz et al. 2013)
--   Processing overhead:    distillation, rectification, QC  = 0.370
--     (higher energy intensity than solvent extraction)
--   N2O from crop agri:     ~0.03 kg CO2e (background agricultural N2O)
--   Total:                                            ≈ 1.56 → 1.60 kg CO2e/kg
--
-- Uncertainty is HIGH (50%) given the diversity of source materials and
-- production techniques (steam distillation, cold pressing, CO2 extraction).
-- This proxy should be replaced with a product-specific factor wherever
-- source material and process route are known.
-- ============================================================================

INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Natural Essences', 'Ingredient', 1.60, 'kg',
  'Composite catch-all proxy: DEFRA UK 2023 herbs/spices 1.5-3.5 kg CO2e/kg; Agribalyse 3.2 dried plant materials; Munoz et al. (2013) grain ethanol 1.2 kg CO2e/kg carrier; higher processing overhead for distillation/CO2 extraction vs simple solvent extraction',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Composite catch-all proxy - natural essences category",
      "authors": "alkatera internal calculation",
      "year": 2026,
      "url": null
    },
    "corroborating_sources": [
      {"title": "UK Government GHG Conversion Factors", "authors": "DEFRA", "year": 2023, "journal": "DEFRA/DESNZ annual conversion factors", "value": "Herbs and spices: 1.5-3.5 kg CO2e/kg dried (cradle-to-gate)"},
      {"title": "Agribalyse 3.2 - Dried plant materials", "authors": "ADEME", "year": 2023, "journal": "Agribalyse database", "value": "Dried botanicals/herbs: 1.8-4.5 kg CO2e/kg depending on crop type and origin"},
      {"title": "LCA of bio-based ethanol from different feedstocks", "authors": "Munoz et al.", "year": 2013, "journal": "Int J LCA / ESU-services", "value": "1.2 kg CO2e/kg grain neutral spirit carrier (cradle-to-gate)"},
      {"title": "Life Cycle Assessment of essential oil production", "authors": "Piccinno et al.", "year": 2016, "journal": "Int J Life Cycle Assessment", "value": "Steam distillation adds 0.3-0.7 kg CO2e/kg product vs cold-press extraction; essential oils 2-8 kg CO2e/kg depending on yield"},
      {"title": "Research on the Carbon Footprint of Spirits", "authors": "BIER (Beverage Industry Environmental Roundtable)", "year": 2012, "value": "Processing overhead benchmarks for distillation-based production"}
    ],
    "system_boundary": "Cradle-to-gate: agricultural cultivation of source material, drying/primary processing, steam distillation or CO2 extraction, rectification, standardisation, blending to final concentration in ethanol carrier. Excludes packaging and distribution.",
    "value_range_low": 0.80,
    "value_range_high": 5.00,
    "notes": "Catch-all proxy for any ingredient listed as Natural Essence(s) in a beverage recipe. Natural essences are concentrated, typically alcohol-distilled or supercritical CO2-extracted fractions of botanical or fruit source material, with a higher active fraction (15-30%) than general natural flavourings (5-15%). Common examples: vanilla essence, almond essence, peppermint essence, lemon essence, orange blossom essence. Usage rate in final beverages: 0.01-2 g/L (significantly lower than general flavourings). Higher concentration factor and more energy-intensive production methods (steam distillation, CO2 extraction, vacuum rectification) drive a higher CO2e per kg vs the Natural Flavourings proxy. Actual values range from ~0.8 kg CO2e/kg (simple aqueous citrus essences) to >5 kg CO2e/kg (labour/energy-intensive rose or jasmine absolutes). Replace with a specific ingredient factor wherever source material and process route are known.",
    "drinks_relevance": "Premium spirits, liqueurs, bitters, cordials, flavoured waters — any product listing Natural Essence as a flavouring ingredient",
    "review_date": "2026-04-17",
    "composition_per_kg": {
      "botanical_source_material_dried_kg": 0.20,
      "ethanol_carrier_kg": 0.55,
      "water_kg": 0.25,
      "active_fraction_percent": "15-30",
      "typical_usage_g_per_L_final_product": "0.01-2"
    }
  }'::jsonb,
  1.20, 2.10, 0.03, 'GLOBAL', 1.60, 0.70,
  0.003, 0.002, 0.025, 0,
  'IPCC AR6 GWP100', '2013-2025', 50,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;
