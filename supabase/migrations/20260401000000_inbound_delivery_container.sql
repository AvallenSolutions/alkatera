-- Inbound Delivery Container support for ingredient rows
--
-- Spirits, wine and other bulk-delivered ingredients often arrive in IBCs,
-- drums, flexitanks or road tankers rather than bottles. This migration adds:
--
--   1. Five nullable columns on product_materials (ingredient rows only) to
--      record the inbound container type, dimensions, reuse cycles, and an
--      optional EF override.
--
--   2. Two audit columns on product_carbon_footprint_materials so the per-unit
--      container CO₂ is stored alongside the ingredient impact for traceability.
--
--   3. Emission factors for the five preset container types (category =
--      'Inbound Container', reference_unit = 'kg').
--
-- Container carbon formula (ISO 14044 §4.3.4.2 physical allocation by volume):
--   ef_per_fill        = container_ef_kg_per_kg × tare_kg / reuse_cycles
--   fill_fraction      = ingredient_qty_litres / container_volume_l
--   container_co2/unit = ef_per_fill × fill_fraction
--
-- One-way containers (reuse_cycles = 1): full embodied carbon per delivery.
-- Reusable containers (reuse_cycles > 1): carbon amortised over the fleet
-- lifecycle (e.g. stainless steel road tanker: ~300 cycles → near-zero per trip).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. New columns on product_materials
-- ----------------------------------------------------------------------------

ALTER TABLE product_materials
  ADD COLUMN IF NOT EXISTS inbound_container_type         text,
  ADD COLUMN IF NOT EXISTS inbound_container_volume_l     numeric,
  ADD COLUMN IF NOT EXISTS inbound_container_tare_kg      numeric,
  ADD COLUMN IF NOT EXISTS inbound_container_reuse_cycles integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS inbound_container_ef           numeric;

COMMENT ON COLUMN product_materials.inbound_container_type IS
  'Preset container type key or ''custom''. NULL = no container recorded. '
  'Bulk: ibc_1000l, ibc_500l, drum_200l, flexitank_24000l, bulk_tanker_25000l. '
  'Bottles: bottle_700ml_glass, bottle_750ml_glass, bottle_1l_glass. Or: custom.';

COMMENT ON COLUMN product_materials.inbound_container_volume_l IS
  'Nominal container volume in litres. Pre-populated from preset; editable for ''custom''.';

COMMENT ON COLUMN product_materials.inbound_container_tare_kg IS
  'Empty container weight in kg. Pre-populated from preset; editable for ''custom''.';

COMMENT ON COLUMN product_materials.inbound_container_reuse_cycles IS
  'Number of times this container is reused (including this trip). '
  '1 = one-way; >1 = reusable (carbon amortised across cycles).';

COMMENT ON COLUMN product_materials.inbound_container_ef IS
  'Override emission factor in kg CO₂e/kg container material. '
  'NULL = auto-lookup from staging_emission_factors by container type. '
  'Only used for ''custom'' container entries.';

-- reuse_cycles must be at least 1 when set
ALTER TABLE product_materials
  ADD CONSTRAINT inbound_container_reuse_cycles_min
    CHECK (inbound_container_reuse_cycles IS NULL OR inbound_container_reuse_cycles >= 1);

-- container fields are only valid on ingredient rows (belt-and-suspenders; UI enforces too)
ALTER TABLE product_materials
  ADD CONSTRAINT inbound_container_ingredient_only
    CHECK (inbound_container_type IS NULL OR material_type = 'ingredient');


-- ----------------------------------------------------------------------------
-- 2. Audit columns on product_carbon_footprint_materials
-- ----------------------------------------------------------------------------

ALTER TABLE product_carbon_footprint_materials
  ADD COLUMN IF NOT EXISTS inbound_container_type        text,
  ADD COLUMN IF NOT EXISTS inbound_container_co2_per_unit numeric DEFAULT 0;

COMMENT ON COLUMN product_carbon_footprint_materials.inbound_container_type IS
  'Container type key recorded at calculation time for audit traceability.';

COMMENT ON COLUMN product_carbon_footprint_materials.inbound_container_co2_per_unit IS
  'Amortised container embodied carbon per functional unit (kg CO₂e). '
  'Already included in impact_climate. Stored separately for reporting breakdown.';


-- ----------------------------------------------------------------------------
-- 3. Emission factors for preset inbound container types
--
-- All factors:
--   category         = 'Inbound Container'
--   reference_unit   = 'kg'  (factor per kg of container material)
--   confidence_score = 55    (MEDIUM — composite literature estimates, no product EPDs)
--   geographic_scope = 'GLO'
--   gwp_methodology  = 'IPCC AR6 GWP100'
--
-- Secondary impact factors (water, land, waste) are approximate literature
-- estimates; GHG breakdown uses fossil CO₂ as primary contributor.
-- ----------------------------------------------------------------------------


-- IBC 1000L (HDPE, one-way)
-- Standard 1000-litre HDPE intermediate bulk container (IBC).
-- Tare weight: ~25 kg (Schutz, Mauser, WERIT specifications).
-- Material: high-density polyethylene cage + steel cage frame.
-- Factor based on HDPE resin production (cradle-to-gate).
--
-- EF derivation:
--   HDPE granulate (ecoinvent 3.12, RER): 1.85 kg CO₂e/kg
--   Blow moulding / injection moulding: +0.08 kg CO₂e/kg
--   Weighted composite (HDPE body ~90%, steel cage ~10%):
--     (0.90 × 1.93) + (0.10 × 1.83) ≈ 1.93 kg CO₂e/kg
--   Using 1.93 kg CO₂e/kg as conservative rounded estimate.
--
-- Sources:
--   ecoinvent 3.12 — polyethylene production, high density, granulate, RER
--   PlasticsEurope Eco-profiles: HDPE 2023
--   DEFRA 2025 — Plastics: Average plastic (1.85 kg CO₂e/kg)
--   Mauser Group IBC specifications (mauser.com)
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
  'Inbound Container - IBC 1000L (HDPE)',
  'Inbound Container',
  1.93,
  'kg',
  'ecoinvent 3.12 (HDPE granulate, RER); PlasticsEurope Eco-profiles 2023; DEFRA 2025 Plastics; Mauser IBC specs',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Polyethylene production, high density, granulate, RER",
      "authors": "ecoinvent Centre",
      "year": 2024,
      "database": "ecoinvent 3.12"
    },
    "corroborating_sources": [
      {"title": "Eco-profiles of the European Plastics Industry: HDPE", "authors": "PlasticsEurope", "year": 2023},
      {"title": "Greenhouse Gas Conversion Factors 2025 — Plastics", "authors": "DEFRA / BEIS", "year": 2025}
    ],
    "system_boundary": "Cradle-to-gate: crude oil extraction, naphtha cracking, HDPE polymerisation, granulate production, injection moulding of IBC body. Excludes transport to producer.",
    "value_range_low": 1.75,
    "value_range_high": 2.15,
    "container_type_key": "ibc_1000l",
    "tare_weight_kg": 25,
    "capacity_l": 1000,
    "material": "HDPE (body + lid) with steel cage frame",
    "is_reusable": false,
    "typical_reuse_cycles": 1,
    "drinks_relevance": "Standard 1000L HDPE IBC for bulk spirit, wine, tequila, beer concentrate, juice. Most common inbound container for spirits producers buying direct from distillery.",
    "notes": "Factor represents HDPE body (~90% by mass) + steel cage frame (~10%). Steel frame not separately modelled — composite 1.93 kg CO₂e/kg is conservative. One-way use; HDPE body recyclable in most EU/UK streams."
  }'::jsonb,
  0.018, 0.002, 0.12,
  1.88, 0.05,
  0.08, 0.0012, 0.018, 0.055, 0.065, 0.00008,
  'GLO', 'IPCC AR6 GWP100', 55
)
ON CONFLICT DO NOTHING;


-- IBC 500L (HDPE, one-way)
-- 500-litre HDPE IBC. Same HDPE material as 1000L — identical EF per kg.
-- Tare weight: ~16 kg (Mauser, Schutz 500L IBC specifications).
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
  'Inbound Container - IBC 500L (HDPE)',
  'Inbound Container',
  1.93,
  'kg',
  'ecoinvent 3.12 (HDPE granulate, RER); PlasticsEurope Eco-profiles 2023; DEFRA 2025 Plastics',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Polyethylene production, high density, granulate, RER",
      "authors": "ecoinvent Centre",
      "year": 2024,
      "database": "ecoinvent 3.12"
    },
    "corroborating_sources": [
      {"title": "Eco-profiles of the European Plastics Industry: HDPE", "authors": "PlasticsEurope", "year": 2023}
    ],
    "system_boundary": "Cradle-to-gate: HDPE resin production, injection moulding, assembly. Excludes transport to producer.",
    "value_range_low": 1.75,
    "value_range_high": 2.15,
    "container_type_key": "ibc_500l",
    "tare_weight_kg": 16,
    "capacity_l": 500,
    "material": "HDPE (body + lid) with steel cage frame",
    "is_reusable": false,
    "typical_reuse_cycles": 1,
    "drinks_relevance": "500L HDPE IBC for smaller bulk deliveries of spirit, wine or other liquid ingredients."
  }'::jsonb,
  0.018, 0.002, 0.12,
  1.88, 0.05,
  0.08, 0.0012, 0.018, 0.055, 0.065, 0.00008,
  'GLO', 'IPCC AR6 GWP100', 55
)
ON CONFLICT DO NOTHING;


-- Drum 200L (HDPE, one-way)
-- Standard UN-certified 200-litre HDPE drum (tight-head or open-head).
-- Tare weight: ~8.5 kg (Greif, Mauser UN 1H2 drum specifications).
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
  'Inbound Container - Drum 200L (HDPE)',
  'Inbound Container',
  1.93,
  'kg',
  'ecoinvent 3.12 (HDPE granulate, RER); PlasticsEurope Eco-profiles 2023; DEFRA 2025 Plastics; Greif drum specifications',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Polyethylene production, high density, granulate, RER",
      "authors": "ecoinvent Centre",
      "year": 2024,
      "database": "ecoinvent 3.12"
    },
    "corroborating_sources": [
      {"title": "Eco-profiles of the European Plastics Industry: HDPE", "authors": "PlasticsEurope", "year": 2023}
    ],
    "system_boundary": "Cradle-to-gate: HDPE resin production, blow moulding (drum body). Excludes transport to producer.",
    "value_range_low": 1.75,
    "value_range_high": 2.15,
    "container_type_key": "drum_200l",
    "tare_weight_kg": 8.5,
    "capacity_l": 200,
    "material": "HDPE (blow-moulded body, UN certified)",
    "is_reusable": false,
    "typical_reuse_cycles": 1,
    "drinks_relevance": "200L HDPE drum for fruit juices, concentrates, syrups, spirits, wine. Common for smaller volume ingredients or specialty items."
  }'::jsonb,
  0.018, 0.002, 0.12,
  1.88, 0.05,
  0.08, 0.0012, 0.018, 0.055, 0.065, 0.00008,
  'GLO', 'IPCC AR6 GWP100', 55
)
ON CONFLICT DO NOTHING;


-- Flexitank 24000L (LDPE film bladder, one-way)
-- Single-use LDPE flexitank installed inside a 20ft ISO shipping container.
-- Tare weight: ~30 kg dry weight (bladder only; steel container excluded —
-- the container is the carrier's asset, not the ingredient buyer's).
-- Material: multilayer LDPE/LLDPE film bladder.
--
-- EF derivation:
--   LDPE film (ecoinvent 3.12, RER): 2.10 kg CO₂e/kg
--   Cross-validated: Franklin Associates "Cradle-to-Gate LCA of Nine Plastic
--     Resins" (2011) — LDPE 1.88–2.28 kg CO₂e/kg range.
--   Using 2.10 kg CO₂e/kg (mid-range, conservative for film extrusion).
--
-- Sources:
--   ecoinvent 3.12 — polyethylene production, low density, granulate, RER
--   Franklin Associates (2011) — Cradle-to-Gate LCI of Nine Plastic Resins
--   Flexitank Alliance technical data (flexitankalliance.com)
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
  'Inbound Container - Flexitank 24000L (LDPE)',
  'Inbound Container',
  2.10,
  'kg',
  'ecoinvent 3.12 (LDPE granulate, RER); Franklin Associates Cradle-to-Gate LCI of Plastic Resins 2011; Flexitank Alliance specs',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Polyethylene production, low density, granulate, RER",
      "authors": "ecoinvent Centre",
      "year": 2024,
      "database": "ecoinvent 3.12"
    },
    "corroborating_sources": [
      {"title": "Cradle-to-Gate Life Cycle Inventory of Nine Plastic Resins and Four Polyurethane Precursors", "authors": "Franklin Associates Ltd", "year": 2011}
    ],
    "system_boundary": "Cradle-to-gate: LDPE/LLDPE resin production, film extrusion, flexitank bladder manufacturing. Excludes ISO shipping container (carrier asset). Excludes transport to producer.",
    "value_range_low": 1.90,
    "value_range_high": 2.35,
    "container_type_key": "flexitank_24000l",
    "tare_weight_kg": 30,
    "capacity_l": 24000,
    "material": "LDPE/LLDPE multilayer film bladder",
    "is_reusable": false,
    "typical_reuse_cycles": 1,
    "drinks_relevance": "Single-use 24000L flexitank for bulk wine, juice, spirit base stock, and other food-grade liquids in ISO shipping containers. Common for intercontinental bulk imports.",
    "notes": "Tare weight is the flexitank bladder only (~30 kg). The ISO steel container is the carrier''s asset and its carbon is not included here. One-way single use; LDPE film technically recyclable but recovery rate is low in practice."
  }'::jsonb,
  0.020, 0.002, 0.14,
  2.05, 0.05,
  0.09, 0.0014, 0.020, 0.060, 0.070, 0.00009,
  'GLO', 'IPCC AR6 GWP100', 55
)
ON CONFLICT DO NOTHING;


-- Bulk Tanker 25000L (stainless steel, reusable)
-- Stainless steel road tanker with ~25,000L capacity.
-- Tare weight: ~20,000 kg (typical SS road tanker without tractor unit).
-- This container is highly reusable (typical service life: 25–30 years,
-- ~300+ trips). Users MUST set inbound_container_reuse_cycles to reflect
-- actual fleet lifecycle — default in the UI is 300.
--
-- EF derivation:
--   Stainless steel (World Steel Association LCI 2023, EU average):
--     2.89 kg CO₂e/kg (includes ~60% recycled content EAF route average)
--   Cross-validated: ecoinvent 3.12 "Steel, chromium steel 18/8, at plant, RER":
--     ~4.0 kg CO₂e/kg (virgin, higher); WAS LCI 2023 preferred (EU EAF average).
--
-- At 300 reuse cycles and 25,000L capacity:
--   ef_per_fill = 2.89 × 20,000 / 300 = 192.7 kg CO₂e per trip
--   Per 1L of ingredient = 192.7 / 25,000 = 0.0077 kg CO₂e/L
--   Per 750ml bottle     = 0.0077 × 0.75  = 0.006 kg CO₂e — near-negligible.
--
-- Sources:
--   World Steel Association — Life Cycle Inventory Data for Steel Products 2023
--   ecoinvent 3.12 — steel, chromium steel production, RER
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
  'Inbound Container - Bulk Tanker 25000L (Stainless steel)',
  'Inbound Container',
  2.89,
  'kg',
  'World Steel Association LCI Data for Steel Products 2023 (EU EAF average); ecoinvent 3.12 (chromium steel production, RER)',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Life Cycle Inventory Data for Steel Products",
      "authors": "World Steel Association",
      "year": 2023,
      "database": "World Steel LCI 2023 — EU average, EAF route (~60% recycled content)"
    },
    "corroborating_sources": [
      {"title": "Steel, chromium steel 18/8, at plant, RER", "authors": "ecoinvent Centre", "year": 2024, "database": "ecoinvent 3.12"}
    ],
    "system_boundary": "Cradle-to-gate: stainless steel production (EU EAF average, ~60% recycled scrap), tanker fabrication. Excludes tractor unit (separate fleet asset). Excludes washing/cleaning between trips.",
    "value_range_low": 2.40,
    "value_range_high": 4.20,
    "container_type_key": "bulk_tanker_25000l",
    "tare_weight_kg": 20000,
    "capacity_l": 25000,
    "material": "Stainless steel (304 or 316 food-grade SS)",
    "is_reusable": true,
    "typical_reuse_cycles": 300,
    "drinks_relevance": "25,000L stainless steel road tanker for bulk wine, beer, spirits, juice, and other food-grade liquids. Used for large-volume domestic and cross-border deliveries within Europe and UK. Highly reusable — set reuse_cycles to actual fleet service life (default 300 trips, typical 25–30 year lifecycle).",
    "notes": "IMPORTANT: The tare weight (20,000 kg) must be amortised over reuse cycles. At the default 300 cycles, per-trip container CO₂ is ~192 kg; per litre of product is ~0.008 kg CO₂e. If reuse_cycles is left at 1 (one-way), the impact will be ~57,800 kg CO₂e — clearly wrong. The UI enforces a default of 300 for this container type and shows a live impact preview to catch mis-entry."
  }'::jsonb,
  0.045, 0.005, 0.25,
  2.75, 0.14,
  0.35, 0.0055, 0.085, 0.28, 0.32, 0.00035,
  'EU', 'IPCC AR6 GWP100', 55
)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Inbound container emission factors added:
--
--   IBC 1000L  (HDPE, one-way)         1.93 kg CO₂e/kg  tare 25kg    1000L
--   IBC 500L   (HDPE, one-way)         1.93 kg CO₂e/kg  tare 16kg     500L
--   Drum 200L  (HDPE, one-way)         1.93 kg CO₂e/kg  tare  8.5kg   200L
--   Flexitank  (LDPE film, one-way)    2.10 kg CO₂e/kg  tare 30kg   24000L
--   Bulk Tanker (SS, reusable ×300)    2.89 kg CO₂e/kg  tare 20000kg 25000L
--
-- Schema additions:
--   product_materials:                 5 new nullable columns + 2 CHECK constraints
--   product_carbon_footprint_materials: 2 new audit columns
-- ============================================================================
