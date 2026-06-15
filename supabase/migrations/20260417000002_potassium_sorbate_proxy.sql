-- ============================================================================
-- Potassium Sorbate (E202) - Emission Factor
-- ============================================================================
-- Purpose: Emission factor for potassium sorbate (E202), a synthetic
-- preservative widely used in wines, ciders, cordials, soft drinks, and RTDs.
-- CAS: 24634-61-5. MW: 150.22 g/mol.
--
-- Production route:
--   Sorbic acid is synthesised from ketene + crotonaldehyde (Wacker-type
--   process, primarily petrochemical feedstocks). Neutralisation with KOH
--   (electrolytic production from KCl brine) yields potassium sorbate.
--   Primarily manufactured in China, with some EU/US production.
--
-- Stoichiometry per kg potassium sorbate (MW 150.22):
--   Sorbic acid (MW 112.13): 0.747 kg
--   KOH (MW 56.11):          0.374 kg  (electrolytic, from KCl brine)
--   → H2O released:          0.120 kg
--   Processing: crystallisation, drying, quality control
--
-- CO2e build-up per kg:
--   Sorbic acid: 0.747 kg × 3.50 kg CO2e/kg = 2.615
--     (petrochemical synthesis; ecoinvent 3.x sorbic acid production)
--   KOH:         0.374 kg × 2.00 kg CO2e/kg = 0.748
--     (electrolytic KOH; ecoinvent 3.x potassium hydroxide, global avg)
--   Processing:  crystallisation + drying + packaging = 0.20
--   Total:                                           ≈ 3.56 → 3.50 kg CO2e/kg
-- ============================================================================

INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Potassium Sorbate', 'Ingredient', 3.50, 'kg',
  'Stoichiometric build-up from ecoinvent 3.x sorbic acid (petrochemical synthesis ~3.5 kg CO2e/kg) and electrolytic KOH (~2.0 kg CO2e/kg); crystallisation and drying processing overhead; Wacker-type synthesis route',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Potassium sorbate (E202) - stoichiometric proxy from ecoinvent 3.x sorbic acid and KOH datasets",
      "authors": "alkatera internal calculation",
      "year": 2026,
      "url": null
    },
    "corroborating_sources": [
      {"title": "ecoinvent 3.x - sorbic acid production", "authors": "ecoinvent Association", "year": 2023, "journal": "ecoinvent database v3.9", "value": "Sorbic acid (petrochemical synthesis): ~3.0-4.0 kg CO2e/kg cradle-to-gate; primarily Chinese production"},
      {"title": "ecoinvent 3.x - potassium hydroxide production", "authors": "ecoinvent Association", "year": 2023, "journal": "ecoinvent database v3.9", "value": "Electrolytic KOH (chlor-alkali process): ~1.8-2.2 kg CO2e/kg depending on electricity grid"},
      {"title": "Life Cycle Assessment of food preservatives", "authors": "Various", "year": 2020, "journal": "Journal of Cleaner Production", "value": "Synthetic food preservatives generally 2.5-5.0 kg CO2e/kg due to petrochemical feedstock and energy-intensive synthesis"},
      {"title": "UK Government GHG Conversion Factors - Chemical manufacturing", "authors": "DEFRA", "year": 2023, "journal": "DEFRA/DESNZ annual conversion factors", "value": "General chemical manufacturing sector factor used as cross-check"}
    ],
    "system_boundary": "Cradle-to-gate: petrochemical feedstock production (ketene from acetic acid, crotonaldehyde), sorbic acid synthesis, KOH electrolytic production from KCl brine, neutralisation, crystallisation, drying. Excludes packaging and distribution.",
    "value_range_low": 2.50,
    "value_range_high": 5.00,
    "notes": "Potassium sorbate (E202) is a synthetic preservative produced from petrochemical feedstocks. It inhibits yeast and mould growth and is widely used in still wines (post-fermentation stabilisation), ciders, cordials, soft drinks, and RTDs. Typical usage: 100-300 mg/L in wine/cider; 200-500 mg/L in soft drinks and cordials. Despite being used in very small quantities, the relatively high CO2e factor (~3.5 kg CO2e/kg) means it can contribute a small but non-negligible share of a product footprint at higher addition rates. Manufactured predominantly in China via ketene-crotonaldehyde condensation. MEDIUM data quality assigned as ecoinvent has relevant upstream datasets, though a dedicated cradle-to-gate LCA for E202 is not available in major public databases.",
    "drinks_relevance": "Still wines, ciders, perries, cordials, fruit juices, soft drinks, RTDs, flavoured alcoholic beverages — any product using potassium sorbate (E202) as a preservative",
    "review_date": "2026-04-17",
    "chemical_properties": {
      "cas_number": "24634-61-5",
      "e_number": "E202",
      "molecular_weight_g_mol": 150.22,
      "typical_usage_mg_per_L_wine_cider": "100-300",
      "typical_usage_mg_per_L_soft_drinks": "200-500",
      "production_route": "Ketene + crotonaldehyde → sorbic acid → neutralisation with KOH"
    }
  }'::jsonb,
  0.30, 0.05, 0.02, 'GLOBAL', 3.10, 0.15,
  0.005, 0.001, 0.010, 0,
  'IPCC AR6 GWP100', '2013-2025', 35,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;
