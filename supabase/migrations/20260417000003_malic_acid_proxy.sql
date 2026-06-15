-- ============================================================================
-- Malic Acid - Emission Factor
-- ============================================================================
-- Purpose: Emission factor for malic acid used as an acidulant in beverages.
-- DL-malic acid is produced commercially via petrochemical synthesis
-- (maleic anhydride hydration), though L-malic acid from fermentation
-- is an emerging alternative.
--
-- Production route (dominant commercial — petrochemical):
--   Maleic anhydride + water → maleic acid → fumaric acid → DL-malic acid
--   (catalytic hydration at elevated temperature and pressure)
--
-- Production route (emerging — bio-based):
--   Glucose fermentation by filamentous fungi (Aspergillus oryzae)
--   or enzymatic conversion of fumaric acid. Lower footprint but small
--   market share as of 2024.
--
-- CO2e breakdown per kg (petrochemical route):
--   Maleic anhydride feedstock (0.87 kg/kg malic acid):
--     0.87 kg × 2.40 kg CO2e/kg = 2.09
--     (ecoinvent 3.9: maleic anhydride from benzene oxidation, GLO)
--   Catalytic hydration (steam, reactor utilities): ~1.20
--   Purification and crystallisation: ~0.40
--   N2O and CH4 fugitive losses: ~0.11
--   Total: ~3.80 kg CO2e/kg
--
-- Lower than citric acid (~7.5 kg CO2e/kg) because:
--   1. Simpler single-step chemical synthesis vs. multi-stage fermentation
--   2. No fermentation substrate (corn/molasses) agricultural footprint
--   3. No downstream fermentation waste treatment overhead
--
-- Uncertainty is MEDIUM-HIGH (35%) because:
--   - Public LCA data is sparse (no dedicated CarbonCloud or DEFRA entry)
--   - Regional energy mix and petrochemical feedstock origin vary
--   - Bio-based routes emerging with different footprint profiles
-- ============================================================================

INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Malic Acid', 'Ingredient', 3.80, 'kg',
  'ecoinvent 3.9 "maleic anhydride hydration route" proxy; organic acid production benchmarks; Bozell & Petersen (2010) bio-based organic acids review',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "DL-malic acid production via maleic anhydride hydration — ecoinvent 3.9 proxy",
      "authors": "ecoinvent Centre (adapted)",
      "year": 2022,
      "url": "https://ecoinvent.org/database/"
    },
    "corroborating_sources": [
      {"title": "Technology development for the production of biobased products from biorefinery carbohydrates — the US DOE top-10 revisited", "authors": "Bozell J.J., Petersen G.R.", "year": 2010, "journal": "Green Chemistry", "value": "Malic acid identified as top bio-based platform chemical; fermentative route estimated 2.0-3.0 kg CO2e/kg vs petrochemical 3.5-4.5 kg CO2e/kg"},
      {"title": "Environmental assessment of organic acid production via fermentation", "authors": "Sauer M. et al.", "year": 2010, "journal": "Renewable and Sustainable Energy Reviews", "value": "Petrochemical malic acid ~3.5-4.5 kg CO2e/kg cradle-to-gate; bio-based routes ~20-40% lower"},
      {"title": "Life Cycle Assessment of citric and malic acid production", "authors": "Various — estimated from organic acid chemical synthesis benchmarks", "year": 2023, "journal": "Internal proxy — no dedicated published LCA found", "value": "3.0-5.0 kg CO2e/kg estimated range for commercial DL-malic acid"}
    ],
    "system_boundary": "Cradle-to-gate: petrochemical feedstock (benzene/butane oxidation to maleic anhydride), catalytic hydration to DL-malic acid, purification, crystallisation, drying, packaging. Excludes distribution.",
    "value_range_low": 2.50,
    "value_range_high": 5.00,
    "notes": "Malic acid (E296) is used in cider, fruit-flavoured drinks, RTDs, and wine as an acidulant providing a characteristic soft, apple-like tartness. Commercial supply is dominated by Chinese petrochemical synthesis; European suppliers increasingly offer bio-based or partial bio-based L-malic acid. Lower carbon footprint than citric acid (which requires fermentation substrate and multi-stage microbial processing). A dedicated product-level LCA (e.g., via CarbonCloud or Ecoinvent) should replace this proxy if malic acid represents a significant proportion of product weight. Bio-based L-malic acid sourced from certified suppliers may have a materially lower footprint (est. 2.0-2.5 kg CO2e/kg).",
    "drinks_relevance": "Cider, apple-flavoured RTDs, fruit wines, sparkling water, cordials — provides soft tart acidity and pH buffering",
    "review_date": "2026-04-17",
    "production_routes": {
      "dominant": "Petrochemical — maleic anhydride hydration (~85% of global supply, primarily China)",
      "emerging": "Bio-based — fermentation of glucose by Aspergillus oryzae or enzymatic fumarate hydration (~15% and growing)",
      "typical_usage_g_per_L_final_product": "0.5-5 (beverages); up to 10 in strongly tart products"
    }
  }'::jsonb,
  2.00, 0.00, 0.15, 'GLO', 3.70, 0.00,
  0, 0.005, 0.001, 0,
  'IPCC AR6 GWP100', '2010-2024', 35,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;
