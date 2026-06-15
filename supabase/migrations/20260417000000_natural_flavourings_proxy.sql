-- ============================================================================
-- Natural Flavourings - Composite Catch-All Proxy Emission Factor
-- ============================================================================
-- Purpose: Catch-all proxy for natural flavourings used in beverages.
-- Covers EU Reg (EC) No 1334/2008 "natural flavouring substances" derived
-- from plant, animal, or microbiological source material.
-- No single product-level LCA exists for the category. Built from component
-- analysis of a typical liquid natural flavouring (botanical/fruit-derived,
-- ethanol-carried).
--
-- Typical composition per kg of liquid natural flavouring:
--   Botanical extract solids: 0.10 kg (dried plant material, 8-12% active)
--   Ethanol carrier (96%):    0.40 kg (~43% vol/vol at 0.93 kg/L density)
--   Water:                    0.50 kg  (balance/dilution)
--   Processing: solvent or steam extraction, filtration, standardisation
--
-- CO2e build-up per kg:
--   Botanical raw material: 0.10 kg × 2.50 kg CO2e/kg = 0.250
--     (dried herbs/spices/fruits: DEFRA UK 2023, Agribalyse 3.2 range 1.5-3.5)
--   Ethanol carrier:        0.40 kg × 1.20 kg CO2e/kg = 0.480
--     (grain neutral spirit: Munoz et al. 2013)
--   Processing overhead:    extraction, evaporation, QC = 0.270
--     (energy-intensive solvent or steam extraction; lower than distillation)
--   N2O from crop agri:     ~0.03 kg CO2e (background agricultural N2O)
--   Total:                                            ≈ 1.03 → 1.00 kg CO2e/kg
--
-- Uncertainty is HIGH (50%) given the enormous diversity of source materials
-- (citrus, berry, herbal, floral, spice, vegetable). This proxy should be
-- replaced with a product-specific factor wherever source material is known.
-- ============================================================================

INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Natural Flavourings', 'Ingredient', 1.00, 'kg',
  'Composite catch-all proxy: DEFRA UK 2023 herbs/spices 1.5-3.5 kg CO2e/kg; Agribalyse 3.2 dried plant materials; Munoz et al. (2013) grain ethanol 1.2 kg CO2e/kg carrier; BIER processing benchmarks; EU Reg (EC) No 1334/2008 compositional context',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Composite catch-all proxy - natural flavourings category (EU Reg 1334/2008)",
      "authors": "alkatera internal calculation",
      "year": 2026,
      "url": null
    },
    "corroborating_sources": [
      {"title": "UK Government GHG Conversion Factors", "authors": "DEFRA", "year": 2023, "journal": "DEFRA/DESNZ annual conversion factors", "value": "Herbs and spices: 1.5-3.5 kg CO2e/kg dried (cradle-to-gate)"},
      {"title": "Agribalyse 3.2 - Dried plant materials", "authors": "ADEME", "year": 2023, "journal": "Agribalyse database", "value": "Dried herbs/botanicals: 1.8-4.5 kg CO2e/kg depending on crop type and origin"},
      {"title": "LCA of bio-based ethanol from different feedstocks", "authors": "Munoz et al.", "year": 2013, "journal": "Int J LCA / ESU-services", "value": "1.2 kg CO2e/kg grain neutral spirit (cradle-to-gate)"},
      {"title": "Research on the Carbon Footprint of Spirits", "authors": "BIER (Beverage Industry Environmental Roundtable)", "year": 2012, "value": "Processing overhead benchmarks for extraction-based production"},
      {"title": "European Flavour Association (EFFA) sustainability framework", "authors": "EFFA", "year": 2022, "journal": "EFFA position papers", "value": "Natural flavourings broadly 1.0-3.0 kg CO2e/kg reported by member companies"}
    ],
    "system_boundary": "Cradle-to-gate: agricultural cultivation of source material, drying/primary processing, solvent or steam extraction, filtration, standardisation, blending to final concentration in carrier. Excludes packaging and distribution.",
    "value_range_low": 0.50,
    "value_range_high": 3.50,
    "notes": "Catch-all proxy for any ingredient listed as Natural Flavouring(s) in a beverage recipe. Defined under EU Reg (EC) No 1334/2008 as flavouring substances obtained by physical, microbiological, or enzymatic processes from plant, animal, or microbiological source materials. Typical form: liquid concentrate in ethanol or propylene glycol carrier (5-20% active flavour fraction). Usage rate in final beverages: 0.1-10 g/L. Carbon footprint is dominated by the carrier ethanol and the processing energy for extraction and standardisation. Source-material diversity (citrus peel, berries, herbs, flowers, spices, roots) means actual values range from ~0.5 kg CO2e/kg (simple aqueous fruit extracts) to >3.5 kg CO2e/kg (labour/energy-intensive aromatic extracts). Replace with a specific ingredient factor wherever source material is known.",
    "drinks_relevance": "Flavoured spirits (gin, vodka, liqueurs), RTDs, cordials, soft drinks, pre-mixes — any product listing Natural Flavouring as an ingredient",
    "review_date": "2026-04-17",
    "composition_per_kg": {
      "botanical_extract_solids_kg": 0.10,
      "ethanol_carrier_kg": 0.40,
      "water_kg": 0.50,
      "active_fraction_percent": "8-12",
      "typical_usage_g_per_L_final_product": "0.1-10"
    }
  }'::jsonb,
  1.50, 1.80, 0.03, 'GLOBAL', 1.30, 0.50,
  0.003, 0.002, 0.020, 0,
  'IPCC AR6 GWP100', '2013-2025', 50,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;
