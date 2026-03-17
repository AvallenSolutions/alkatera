-- ============================================================================
-- Rosso Vermouth 15% - Composite Proxy Emission Factor
-- ============================================================================
-- Purpose: Proxy for Italian-style rosso/sweet vermouth (15% ABV).
-- Reference product: Martini Rosso.
-- No product-level LCA exists from Bacardi-Martini or any public database
-- (ecoinvent, Agribalyse, DEFRA). Built from component analysis.
--
-- Composition per litre (15% ABV, based on Martini Rosso profile):
--   Base white wine:  0.75 L  (Trebbiano/Catarratto, ~12% ABV)
--   Grape spirit 96%: 0.063 L (to fortify from 12% to 15%)
--   Cane sugar:       0.150 kg (~150g/L, defines sweet/rosso style)
--   Caramel E150d:    0.007 kg (colour)
--   Botanicals:       0.005 kg dried (40+ herbs: wormwood, gentian,
--                     cinnamon, marjoram, star anise, vanilla)
--   Water:            balance (~30ml)
--   Processing:       maceration, blending, filtration
--
-- CO2e build-up per litre:
--   White wine:  0.75 L  x 1.10 kg CO2e/L = 0.825
--   Grape spirit:0.063 L x 3.00 kg CO2e/L = 0.189
--   Sugar:       0.150 kg x 0.57 kg CO2e/kg = 0.086
--   Caramel:     0.007 kg x 1.50 kg CO2e/kg = 0.011
--   Botanicals:  0.005 kg x 0.80 kg CO2e/kg = 0.004
--   Processing:  maceration + blending + filtration = 0.040
--   Total per litre:                            ~ 1.16 kg CO2e/L
--
-- Density at 15% ABV, 150g/L sugar: ~1.055 kg/L
-- Per kg: 1.16 / 1.055 = ~1.10 kg CO2e/kg
-- ============================================================================

INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Rosso Vermouth 15%', 'Ingredient', 1.10, 'kg',
  'Composite proxy: Agribalyse 3.2 Italian/French white wine ~1.1 kg CO2e/L (ADEME); grape spirit via Munoz et al. (2013) ethanol + distillation overhead; alkatera global library Cane Sugar 0.57 kg CO2e/kg; caramel colouring estimated; Clemente et al. (2018) dried botanicals',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Composite proxy - no published product-level LCA for rosso vermouth",
      "authors": "alkatera internal calculation",
      "year": 2026,
      "url": null
    },
    "corroborating_sources": [
      {"title": "Agribalyse 3.2 - Dry white wine (vin blanc sec)", "authors": "ADEME", "year": 2023, "journal": "Agribalyse database", "value": "1.22 kg CO2e/kg French dry white wine (cradle-to-gate); used as base wine proxy"},
      {"title": "LCA of bio-based ethanol from different feedstocks", "authors": "Munoz et al.", "year": 2013, "journal": "Int J LCA / ESU-services", "value": "1.2 kg CO2e/kg grain ethanol; grape spirit estimated at 3.0 kg CO2e/L at 96% ABV including grape cultivation and distillation"},
      {"title": "Carbon Footprint of Valencian Oranges", "authors": "Clemente et al.", "year": 2018, "journal": "Int J Life Cycle Assessment", "value": "dried botanicals ~0.8 kg CO2e/kg"},
      {"title": "Eco-innovation in wine production", "authors": "Various", "year": 2024, "journal": "Nature Comms Earth & Environment", "value": "Mediterranean white wine 0.9-1.3 kg CO2e/L range"},
      {"title": "Research on the Carbon Footprint of Spirits", "authors": "BIER (Beverage Industry Environmental Roundtable)", "year": 2012, "value": "2.7-3.0 kg CO2e per 750ml packaged spirit (cradle-to-grave)"}
    ],
    "system_boundary": "Cradle-to-gate: grape cultivation, vinification, grape spirit distillation, sugar production, caramel colouring production, botanical cultivation/drying, maceration, blending, filtration. Excludes packaging and distribution.",
    "value_range_low": 0.90,
    "value_range_high": 1.35,
    "notes": "Proxy for Italian-style rosso/sweet vermouth at 15% ABV. Reference: Martini Rosso (Bacardi-Martini). Composition: 75% base white wine (Trebbiano/Catarratto from Piemonte/Sicily), fortified with grape spirit, 150g/L sugar (high sweetness defines the rosso style), caramel E150d for colour, 40+ botanicals including wormwood, gentian, cinnamon, marjoram, star anise, vanilla. Bacardi (parent company) publishes only group-level Scope 1/2/3 data. Lower ABV than dry vermouth means less spirit needed, but higher sugar content. Wine component dominates the footprint (~71%). Higher density from sugar means lower per-kg factor despite similar per-litre factor.",
    "drinks_relevance": "Sweet/rosso vermouth for cocktails (Negroni, Manhattan, Americano), aperitif wines, cooking",
    "review_date": "2026-03-17",
    "composition_per_litre": {
      "base_wine_litres": 0.75,
      "grape_spirit_96pct_litres": 0.063,
      "sugar_kg": 0.150,
      "caramel_e150d_kg": 0.007,
      "dried_botanicals_kg": 0.005,
      "water_ml": 30,
      "abv_percent": 15,
      "density_kg_per_l": 1.055
    }
  }'::jsonb,
  0.90, 1.55, 0.02, 'EU', 0.82, 0.18,
  0.004, 0.003, 0.015, 0,
  'IPCC AR6 GWP100', '2013-2025', 30,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;
