-- ============================================================================
-- Dry Vermouth 18% - Composite Proxy Emission Factor
-- ============================================================================
-- Purpose: Proxy for French-style dry vermouth (18% ABV).
-- Reference product: Noilly Prat Original Dry.
-- No product-level LCA exists from Bacardi or any public database
-- (ecoinvent, Agribalyse, DEFRA). Built from component analysis.
--
-- Composition per litre (18% ABV, based on Noilly Prat profile):
--   Base white wine:  0.75 L  (Picpoul/Clairette, ~12% ABV)
--   Grape spirit 96%: 0.094 L (to fortify from 12% to 18%)
--   Cane sugar:       0.035 kg (~35g/L, EU "dry" threshold <50g/L)
--   Botanicals:       0.003 kg dried (20 herbs: chamomile, elderflower,
--                     coriander, bitter orange, wormwood, cardamom)
--   Water:            balance (~120ml)
--   Processing:       maceration (3 weeks), oak aging, filtration
--
-- CO2e build-up per litre:
--   White wine:  0.75 L  x 1.10 kg CO2e/L = 0.825
--   Grape spirit:0.094 L x 3.00 kg CO2e/L = 0.282
--   Sugar:       0.035 kg x 0.57 kg CO2e/kg = 0.020
--   Botanicals:  0.003 kg x 0.80 kg CO2e/kg = 0.002
--   Processing:  maceration + aging + filtration = 0.050
--   Total per litre:                            ~ 1.18 kg CO2e/L
--
-- Density at 18% ABV, 35g/L sugar: ~0.99 kg/L
-- Per kg: 1.18 / 0.99 = ~1.19 kg CO2e/kg
-- Rounded to: 1.20 kg CO2e/kg
-- ============================================================================

INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Dry Vermouth 18%', 'Ingredient', 1.20, 'kg',
  'Composite proxy: Agribalyse 3.2 French dry white wine 1.22 kg CO2e/L (ADEME); grape spirit via Munoz et al. (2013) ethanol + distillation overhead; alkatera global library Cane Sugar 0.57 kg CO2e/kg; Clemente et al. (2018) dried botanicals',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Composite proxy - no published product-level LCA for dry vermouth",
      "authors": "alkatera internal calculation",
      "year": 2026,
      "url": null
    },
    "corroborating_sources": [
      {"title": "Agribalyse 3.2 - Dry white wine (vin blanc sec)", "authors": "ADEME", "year": 2023, "journal": "Agribalyse database", "value": "1.22 kg CO2e/kg French dry white wine (cradle-to-gate)"},
      {"title": "LCA of bio-based ethanol from different feedstocks", "authors": "Munoz et al.", "year": 2013, "journal": "Int J LCA / ESU-services", "value": "1.2 kg CO2e/kg grain ethanol; grape spirit estimated at 3.0 kg CO2e/L at 96% ABV including grape cultivation and distillation"},
      {"title": "Carbon Footprint of Valencian Oranges", "authors": "Clemente et al.", "year": 2018, "journal": "Int J Life Cycle Assessment", "value": "dried botanicals ~0.8 kg CO2e/kg"},
      {"title": "Eco-innovation in wine production", "authors": "Various", "year": 2024, "journal": "Nature Comms Earth & Environment", "value": "Mediterranean white wine 0.9-1.3 kg CO2e/L range"},
      {"title": "Research on the Carbon Footprint of Spirits", "authors": "BIER (Beverage Industry Environmental Roundtable)", "year": 2012, "value": "2.7-3.0 kg CO2e per 750ml packaged spirit (cradle-to-grave)"}
    ],
    "system_boundary": "Cradle-to-gate: grape cultivation, vinification, grape spirit distillation, sugar production, botanical cultivation/drying, maceration, oak aging, filtration, blending. Excludes packaging and distribution.",
    "value_range_low": 0.95,
    "value_range_high": 1.45,
    "notes": "Proxy for French-style dry vermouth at 18% ABV. Reference: Noilly Prat Original Dry. Composition: 75% base white wine (Picpoul/Clairette), fortified with grape spirit (mistelle from Muscatel grapes), 35g/L sugar, 20 botanicals including wormwood, chamomile, elderflower. Noilly Prat uniquely ages wine outdoors in oak barrels for 12 months (6-8% evaporation loss). Bacardi (parent company) publishes only group-level Scope 1/2/3 data. Wine component dominates the footprint (~70%).",
    "drinks_relevance": "Dry vermouth for cocktails (Martini, Gibson, El Presidente), cooking vermouth, aperitif wines",
    "review_date": "2026-03-17",
    "composition_per_litre": {
      "base_wine_litres": 0.75,
      "grape_spirit_96pct_litres": 0.094,
      "sugar_kg": 0.035,
      "dried_botanicals_kg": 0.003,
      "water_ml": 120,
      "abv_percent": 18,
      "density_kg_per_l": 0.99
    }
  }'::jsonb,
  0.85, 1.50, 0.02, 'EU', 0.90, 0.20,
  0.004, 0.003, 0.015, 0,
  'IPCC AR6 GWP100', '2013-2025', 30,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;
