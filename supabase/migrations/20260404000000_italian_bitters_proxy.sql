-- ============================================================================
-- Italian Bitters 25% - Composite Proxy Emission Factor
-- ============================================================================
-- Purpose: Proxy for Campari-style Italian bitter liqueurs (25% ABV).
-- No product-level LCA exists from Campari Group or any public database
-- (ecoinvent, Agribalyse, DEFRA). Built from component analysis.
--
-- Composition per litre (25% ABV, based on Campari profile):
--   Ethanol:    0.197 kg (250ml pure EtOH via 96% neutral grain spirit)
--   Cane sugar: 0.250 kg (~250g/L, balances bitterness)
--   Botanicals: 0.008 kg dried (bitter orange peel, chinotto, cascarilla bark)
--   Water:      balance (~500ml)
--   Processing: maceration, filtration, blending (low energy vs distillation)
--
-- CO2e build-up per kg (density ~1.06 kg/L):
--   Ethanol:    0.186 kg × 1.20 kg CO2e/kg = 0.224
--   Sugar:      0.236 kg × 0.57 kg CO2e/kg = 0.134
--   Botanicals: 0.008 kg × 0.80 kg CO2e/kg = 0.006
--   Processing: maceration + filtration energy  = 0.050
--   Total:                                      ≈ 0.42 kg CO2e/kg
-- ============================================================================

INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Italian Bitters 25%', 'Ingredient', 0.42, 'kg',
  'Composite proxy: Munoz et al. (2013) ESU/ecoinvent grain ethanol 1.2 kg CO2e/kg; alkatera global library Cane Sugar 0.57 kg CO2e/kg; Clemente et al. (2018) Int J LCA citrus peel; BIER spirits processing benchmarks',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Composite proxy - no published product-level LCA for Italian bitter liqueurs",
      "authors": "alkatera internal calculation",
      "year": 2026,
      "url": null
    },
    "corroborating_sources": [
      {"title": "LCA of bio-based ethanol from different feedstocks", "authors": "Munoz et al.", "year": 2013, "journal": "Int J LCA / ESU-services", "value": "1.2 kg CO2e/kg grain ethanol (cradle-to-gate)"},
      {"title": "Carbon Footprint of Valencian Oranges", "authors": "Clemente et al.", "year": 2018, "journal": "Int J Life Cycle Assessment", "value": "0.3-0.5 kg CO2e/kg fresh citrus; dried peel ~0.8 kg CO2e/kg"},
      {"title": "Research on the Carbon Footprint of Spirits", "authors": "BIER (Beverage Industry Environmental Roundtable)", "year": 2012, "value": "2.7-3.0 kg CO2e per 750ml packaged spirit (cradle-to-grave)"}
    ],
    "system_boundary": "Cradle-to-gate: grain cultivation, distillation to neutral spirit, sugar production, botanical cultivation/drying, maceration, filtration, blending. Excludes packaging and distribution.",
    "value_range_low": 0.30,
    "value_range_high": 0.55,
    "notes": "Proxy for Campari-style Italian bitters at 25% ABV. Composition: ~25% ethanol by volume, ~250g/L sugar, trace botanicals (60+ herbs/spices, primarily bitter orange peel, chinotto, cascarilla bark). Processing is maceration-based (not redistilled), so energy intensity is lower than distilled spirits. Sugar content is significant and contributes ~32% of total footprint. Campari Group publishes only group-level Scope 1/2/3 data, no product-level LCA.",
    "drinks_relevance": "Campari, Aperol-style bitters, Italian amari, bitter liqueurs used in cocktails (Negroni, Americano, Spritz)",
    "review_date": "2026-03-17",
    "composition_per_litre": {
      "ethanol_kg": 0.197,
      "sugar_kg": 0.250,
      "dried_botanicals_kg": 0.008,
      "water_ml": 500,
      "abv_percent": 25,
      "density_kg_per_l": 1.06
    }
  }'::jsonb,
  0.78, 0.82, 0.02, 'EU', 0.30, 0.08,
  0.005, 0.003, 0.02, 0,
  'IPCC AR6 GWP100', '2013-2025', 35,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;
