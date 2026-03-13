-- Inbound Container: IBC reuse correction + glass bottle presets
--
-- Two changes:
--
--   1. IBC REUSE CORRECTION
--      IBCs (1000L and 500L) are rental-pool assets that are typically reused
--      8–12 times (WRAP guidance). The initial migration incorrectly marked
--      them as is_reusable=false / typical_reuse_cycles=1. This migration
--      corrects the metadata. The EF per kg of material (1.93) is unchanged.
--      The frontend CONTAINER_PRESETS now defaults to 10 reuse cycles for both
--      IBC sizes.
--
--   2. GLASS BOTTLE PRESETS (700ml, 750ml, 1L)
--      Cocktail brands and blenders often purchase ingredients (liqueurs,
--      spirits, bitters) in retail glass bottles. The glass bottle is an
--      inbound container and its embodied carbon should be attributed to the
--      product via the existing container formula.
--
--      Material: soda-lime container glass (container glass production, RER).
--      EF: 0.85 kg CO₂e/kg — ecoinvent 3.12 "glass production, container
--          glass, RER" cross-validated with FEVE LCI 2022.
--
-- Container carbon formula (unchanged):
--   ef_per_fill = ef × tare_kg / reuse_cycles
--   fill_fraction = ingredient_qty_l / container_volume_l
--   co2/unit = ef_per_fill × fill_fraction
--
-- Example: 25ml Campari from a 700ml glass bottle (tare 400g):
--   ef_per_fill  = 0.85 × 0.40 / 1 = 0.340 kg CO₂e
--   fill_fraction = 0.025 / 0.700 = 0.0357
--   co2/unit     = 0.340 × 0.0357 = 0.012 kg CO₂e
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Correct IBC reuse metadata in staging_emission_factors
--    (EF value is unchanged at 1.93 kg CO₂e/kg)
-- ----------------------------------------------------------------------------

UPDATE staging_emission_factors
SET metadata = metadata
  || '{"is_reusable": true, "typical_reuse_cycles": 10}'::jsonb
  || jsonb_build_object(
      'drinks_relevance',
      'Standard 1000L HDPE IBC for bulk spirit, wine, tequila, beer concentrate, juice. Most common inbound container for spirits producers buying direct from distillery. Typically rented from pool operators (Schütz, Mauser, WERIT) and returned for cleaning and refill — default 10 reuse cycles per WRAP guidance. Users can override with supplier-specific data.'
    )
WHERE name = 'Inbound Container - IBC 1000L (HDPE)'
  AND category = 'Inbound Container'
  AND organization_id IS NULL;

UPDATE staging_emission_factors
SET metadata = metadata
  || '{"is_reusable": true, "typical_reuse_cycles": 10}'::jsonb
  || jsonb_build_object(
      'drinks_relevance',
      '500L HDPE IBC for smaller bulk deliveries of spirit, wine or other liquid ingredients. Typically rented from pool operators and returned for cleaning and refill — default 10 reuse cycles per WRAP guidance. Users can override with supplier-specific data.'
    )
WHERE name = 'Inbound Container - IBC 500L (HDPE)'
  AND category = 'Inbound Container'
  AND organization_id IS NULL;


-- ----------------------------------------------------------------------------
-- 2. Glass bottle emission factors
--
-- All three bottle sizes use identical material (soda-lime container glass):
--   EF: 0.85 kg CO₂e/kg
--   Source: ecoinvent 3.12 "glass production, container glass, RER"
--   Cross-validated: FEVE (European Container Glass Federation) LCI Study 2022
--   DEFRA 2025 Conversion Factors: Glass 0.52 kg CO₂e/kg (recycled content
--     basis) to 0.88 kg CO₂e/kg (virgin basis) — 0.85 conservative mid-point.
--
-- Tare weights are industry-standard averages for standard-weight bottles.
-- Premium/heavy-weight bottles (e.g. 900g+ for prestige spirits) should use
-- the 'custom' container option.
--
-- All glass bottles are single-use inbound containers (reuse_cycles = 1).
-- ----------------------------------------------------------------------------

-- Glass bottle 700ml (standard weight ~400g)
-- Most common spirits bottle size in UK/Europe (70cl)
-- ============================================================================

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
  'Inbound Container - Glass Bottle 700ml (standard)',
  'Inbound Container',
  0.85,
  'kg',
  'ecoinvent 3.12 (container glass production, RER); FEVE LCI Study 2022; DEFRA Greenhouse Gas Conversion Factors 2025 — Glass',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Glass production, container glass, RER",
      "authors": "ecoinvent Centre",
      "year": 2024,
      "database": "ecoinvent 3.12"
    },
    "corroborating_sources": [
      {"title": "Life Cycle Inventory Study for Container Glass in Europe", "authors": "FEVE (European Container Glass Federation)", "year": 2022},
      {"title": "Greenhouse Gas Conversion Factors 2025 — Glass and ceramics", "authors": "DEFRA / BEIS", "year": 2025}
    ],
    "system_boundary": "Cradle-to-gate: silica sand mining, soda ash and limestone production, container glass melting and forming, bottle annealing and inspection. Excludes transport to filler.",
    "value_range_low": 0.70,
    "value_range_high": 1.05,
    "container_type_key": "bottle_700ml_glass",
    "tare_weight_kg": 0.40,
    "capacity_l": 0.7,
    "material": "Soda-lime container glass (clear / flint, standard weight)",
    "is_reusable": false,
    "typical_reuse_cycles": 1,
    "drinks_relevance": "Standard 700ml (70cl) glass spirits bottle used as inbound ingredient container. Applies when a cocktail brand or blender purchases a spirit, liqueur or other liquid ingredient in retail bottles (e.g. Campari, Aperol, Cointreau). The bottle is the buyer''s waste and its embodied carbon is an upstream Scope 3 input.",
    "notes": "Tare weight 400g is a standard-weight bottle average (BS EN ISO 12821). Premium or prestige bottles (heavy-weight, embossed) may weigh 600–1000g — use custom entry for these. EF of 0.85 kg CO₂e/kg applies to average EU container glass production mix (~30% recycled cullet); bottles with higher cullet content will have lower EF.",
    "assumption_summary": "Standard-weight 70cl spirits bottle. Tare 400g (industry average). EF 0.85 kg CO2e/kg (ecoinvent 3.12, ~30% recycled cullet, EU production)."
  }'::jsonb,
  0.012, 0.0008, 0.18,
  0.84, 0.01,
  0.015, 0.00035, 0.0042, 0.025, 0.030, 0.000015,
  'EU', 'IPCC AR6 GWP100', 55
)
ON CONFLICT DO NOTHING;


-- Glass bottle 750ml (standard weight ~450g)
-- Common in US-market spirits and some European brands (75cl)
-- ============================================================================

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
  'Inbound Container - Glass Bottle 750ml (standard)',
  'Inbound Container',
  0.85,
  'kg',
  'ecoinvent 3.12 (container glass production, RER); FEVE LCI Study 2022; DEFRA Greenhouse Gas Conversion Factors 2025 — Glass',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Glass production, container glass, RER",
      "authors": "ecoinvent Centre",
      "year": 2024,
      "database": "ecoinvent 3.12"
    },
    "corroborating_sources": [
      {"title": "Life Cycle Inventory Study for Container Glass in Europe", "authors": "FEVE (European Container Glass Federation)", "year": 2022},
      {"title": "Greenhouse Gas Conversion Factors 2025 — Glass and ceramics", "authors": "DEFRA / BEIS", "year": 2025}
    ],
    "system_boundary": "Cradle-to-gate: silica sand mining, soda ash and limestone production, container glass melting and forming, bottle annealing and inspection. Excludes transport to filler.",
    "value_range_low": 0.70,
    "value_range_high": 1.05,
    "container_type_key": "bottle_750ml_glass",
    "tare_weight_kg": 0.45,
    "capacity_l": 0.75,
    "material": "Soda-lime container glass (clear / flint, standard weight)",
    "is_reusable": false,
    "typical_reuse_cycles": 1,
    "drinks_relevance": "Standard 750ml (75cl) glass spirits bottle used as inbound ingredient container. Common US spirits measure; also used by some European and South American spirit brands imported into UK/EU markets.",
    "notes": "Tare weight 450g is a standard-weight bottle average. Same EF (0.85 kg CO₂e/kg) as 700ml — identical material, marginally heavier due to size.",
    "assumption_summary": "Standard-weight 75cl spirits bottle. Tare 450g (industry average). EF 0.85 kg CO2e/kg (ecoinvent 3.12, ~30% recycled cullet, EU production)."
  }'::jsonb,
  0.012, 0.0008, 0.18,
  0.84, 0.01,
  0.015, 0.00035, 0.0042, 0.025, 0.030, 0.000015,
  'EU', 'IPCC AR6 GWP100', 55
)
ON CONFLICT DO NOTHING;


-- Glass bottle 1L (standard weight ~500g)
-- Common for liqueurs (Cointreau, Baileys), some spirits and vermouth
-- ============================================================================

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
  'Inbound Container - Glass Bottle 1L (standard)',
  'Inbound Container',
  0.85,
  'kg',
  'ecoinvent 3.12 (container glass production, RER); FEVE LCI Study 2022; DEFRA Greenhouse Gas Conversion Factors 2025 — Glass',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Glass production, container glass, RER",
      "authors": "ecoinvent Centre",
      "year": 2024,
      "database": "ecoinvent 3.12"
    },
    "corroborating_sources": [
      {"title": "Life Cycle Inventory Study for Container Glass in Europe", "authors": "FEVE (European Container Glass Federation)", "year": 2022},
      {"title": "Greenhouse Gas Conversion Factors 2025 — Glass and ceramics", "authors": "DEFRA / BEIS", "year": 2025}
    ],
    "system_boundary": "Cradle-to-gate: silica sand mining, soda ash and limestone production, container glass melting and forming, bottle annealing and inspection. Excludes transport to filler.",
    "value_range_low": 0.70,
    "value_range_high": 1.05,
    "container_type_key": "bottle_1l_glass",
    "tare_weight_kg": 0.50,
    "capacity_l": 1.0,
    "material": "Soda-lime container glass (clear / flint, standard weight)",
    "is_reusable": false,
    "typical_reuse_cycles": 1,
    "drinks_relevance": "Standard 1L glass bottle used as inbound ingredient container. Common for liqueurs (Cointreau, Baileys, Kahlúa), vermouth (Martini, Noilly Prat), and duty-free/travel-retail spirits.",
    "notes": "Tare weight 500g is a standard-weight bottle average. Same EF (0.85 kg CO₂e/kg) as smaller sizes — identical material.",
    "assumption_summary": "Standard-weight 1L bottle. Tare 500g (industry average). EF 0.85 kg CO2e/kg (ecoinvent 3.12, ~30% recycled cullet, EU production)."
  }'::jsonb,
  0.012, 0.0008, 0.18,
  0.84, 0.01,
  0.015, 0.00035, 0.0042, 0.025, 0.030, 0.000015,
  'EU', 'IPCC AR6 GWP100', 55
)
ON CONFLICT DO NOTHING;


-- Also update the CONTAINER_FACTOR_NAMES map in product-lca-calculator.ts:
-- bottle_700ml_glass → 'Inbound Container - Glass Bottle 700ml (standard)'
-- bottle_750ml_glass → 'Inbound Container - Glass Bottle 750ml (standard)'
-- bottle_1l_glass    → 'Inbound Container - Glass Bottle 1L (standard)'
-- (These are code comments — the actual map lives in lib/product-lca-calculator.ts)


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Changes:
--
--   IBC metadata corrected:
--     IBC 1000L  is_reusable: false→true  typical_reuse_cycles: 1→10
--     IBC 500L   is_reusable: false→true  typical_reuse_cycles: 1→10
--     (EF 1.93 kg CO₂e/kg unchanged)
--
--   New emission factors added:
--     Glass Bottle 700ml  0.85 kg CO₂e/kg  tare 0.40kg   0.70L  single-use
--     Glass Bottle 750ml  0.85 kg CO₂e/kg  tare 0.45kg   0.75L  single-use
--     Glass Bottle 1L     0.85 kg CO₂e/kg  tare 0.50kg   1.00L  single-use
--
--   No schema changes — all new columns from 20260401000000 are reused.
-- ============================================================================
