-- Curated Global Drinks Factor Library: two follow-up packaging factors.
--
-- 1. Printing Ink — the wizard now offers "Printed directly (no label)" for
--    cans and bottles; the only added material is the ink itself (~0.1-2 g).
-- 2. Carton Board Box (flat cardboard) — drinks cases are almost always flat
--    folding carton board, not corrugated shipping board; this gives the
--    "Cardboard case or box (flat)" wizard option a curated factor that the
--    query 'carton board box' hits directly (ecoinvent live "carton board box
--    production service" remains the live alternative).
--
-- Idempotent via idx_staging_ef_global_name (LOWER(name) WHERE organization_id
-- IS NULL) → ON CONFLICT DO NOTHING. co2_factor is kg CO2e per kg of material,
-- cradle-to-gate; literature midpoints with ranges + citations in metadata.

ALTER TABLE staging_emission_factors ADD COLUMN IF NOT EXISTS confidence_score numeric;

INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit,
  source, co2_fossil_factor, co2_biogenic_factor,
  geographic_scope, gwp_methodology, confidence_score, metadata
) VALUES
  (NULL, 'Printing Ink (container decoration)', 'Packaging', 3.0, 'kg',
   'EuPIA environmental data 2021; ecoinvent 3.12 (printing ink, offset/UV-curable)',
   3.00, 0.0, 'GLO', 'IPCC AR6 GWP100', 50,
   '{"data_quality_grade":"LOW","value_range_low":2.0,"value_range_high":5.0,"drinks_relevance":"Direct-to-container printing on cans and bottles (no label substrate). Typical applied ink mass is 0.1-2 g per container, so the absolute impact is tiny.","notes":"Covers ink manufacture only; curing energy sits within the filler/decorator site and is excluded here."}'::jsonb),

  (NULL, 'Carton Board Box (flat cardboard)', 'Packaging', 0.9, 'kg',
   'Pro Carton European Carton Industry LCI 2022; ecoinvent 3.12 (carton board box production)',
   0.80, 0.10, 'GLO', 'IPCC AR6 GWP100', 65,
   '{"data_quality_grade":"MEDIUM","value_range_low":0.7,"value_range_high":1.2,"drinks_relevance":"Flat folding carton board cases and boxes (the usual drinks case format, as opposed to corrugated transit shippers).","notes":"Folding boxboard; high recycled content typical in the UK/EU."}'::jsonb)
ON CONFLICT DO NOTHING;
