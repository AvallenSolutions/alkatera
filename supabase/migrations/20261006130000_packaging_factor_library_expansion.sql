-- Curated Global Drinks Factor Library: packaging gap-fill.
--
-- The guided packaging wizard offers materials the curated library didn't yet
-- cover (PET, HDPE, steel cans, cartons, labels, caps, films, etc.), so those
-- searches fell through to live ecoinvent/Agribalyse and sometimes mismatched.
-- These rows give the wizard a curated, citable packaging-material factor to
-- land on. Names are chosen to match the wizard's search queries in
-- lib/constants/packaging-catalogue.ts (e.g. "PET Bottle", "Steel Can
-- (tinplate)", "Corrugated Board Box").
--
-- Global factors: organization_id IS NULL, category 'Packaging'. Idempotent via
-- the partial unique index idx_staging_ef_global_name (LOWER(name) WHERE
-- organization_id IS NULL) → ON CONFLICT DO NOTHING.
--
-- co2_factor is kg CO2e per kg of material, cradle-to-gate (virgin/typical
-- unless noted). Values are literature midpoints with ranges + citations in
-- metadata; most are graded MEDIUM/LOW pending primary-source review.

ALTER TABLE staging_emission_factors ADD COLUMN IF NOT EXISTS confidence_score numeric;

INSERT INTO staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit,
  source, co2_fossil_factor, co2_biogenic_factor,
  geographic_scope, gwp_methodology, confidence_score, metadata
) VALUES
  (NULL, 'PET Bottle', 'Packaging', 2.7, 'kg',
   'PlasticsEurope Eco-profile (PET, bottle grade) 2021; ecoinvent 3.12 (PET granulate + stretch blow moulding)',
   2.70, 0.0, 'GLO', 'IPCC AR6 GWP100', 65,
   '{"data_quality_grade":"MEDIUM","value_range_low":2.2,"value_range_high":3.2,"drinks_relevance":"Virgin PET bottles. Recycled (rPET) content lowers this materially.","notes":"Granulate ~2.15 + conversion ~0.5."}'::jsonb),

  (NULL, 'HDPE Bottle', 'Packaging', 1.9, 'kg',
   'PlasticsEurope Eco-profile (HDPE) 2021; ecoinvent 3.12 (HDPE granulate + blow moulding)',
   1.90, 0.0, 'GLO', 'IPCC AR6 GWP100', 65,
   '{"data_quality_grade":"MEDIUM","value_range_low":1.6,"value_range_high":2.3,"drinks_relevance":"Virgin HDPE bottles (milk, juice, some spirits)."}'::jsonb),

  (NULL, 'Steel Can (tinplate)', 'Packaging', 2.8, 'kg',
   'worldsteel LCI 2022; ecoinvent 3.12 (tinplate steel, sheet rolling, can forming)',
   2.80, 0.0, 'GLO', 'IPCC AR6 GWP100', 65,
   '{"data_quality_grade":"MEDIUM","value_range_low":2.3,"value_range_high":3.3,"drinks_relevance":"Tinplate steel cans (some RTDs, energy drinks). Recycled content reduces impact."}'::jsonb),

  (NULL, 'Beverage Carton (liquid packaging board)', 'Packaging', 1.1, 'kg',
   'IVL/Tetra Pak LCA 2021; ecoinvent 3.12 (liquid packaging board + PE + Al laminate)',
   1.00, 0.10, 'GLO', 'IPCC AR6 GWP100', 60,
   '{"data_quality_grade":"MEDIUM","value_range_low":0.8,"value_range_high":1.5,"drinks_relevance":"Tetra Pak style cartons (juice, plant milk). Composite board + thin PE + aluminium layer."}'::jsonb),

  (NULL, 'Stand-up Pouch (plastic laminate)', 'Packaging', 3.3, 'kg',
   'PlasticsEurope (PET/PE film) 2021; ecoinvent 3.12 (multi-material laminate, metallised film)',
   3.30, 0.0, 'GLO', 'IPCC AR6 GWP100', 50,
   '{"data_quality_grade":"LOW","value_range_low":2.5,"value_range_high":4.5,"drinks_relevance":"Flexible stand-up pouches/sachets. High per-kg impact from multi-material laminate; near-unrecyclable.","notes":"Wide range; depends on layer structure (with/without aluminium)."}'::jsonb),

  (NULL, 'Bag-in-Box (composite)', 'Packaging', 1.6, 'kg',
   'ecoinvent 3.12 (corrugated board box + LDPE bag + LDPE/PP tap), weighted by typical mass split',
   1.60, 0.05, 'GLO', 'IPCC AR6 GWP100', 50,
   '{"data_quality_grade":"LOW","value_range_low":1.1,"value_range_high":2.2,"drinks_relevance":"Bag-in-box (boxed wine, syrups). Cardboard outer + plastic inner bag + tap.","notes":"Composite; per-kg blends low-impact board with higher-impact film."}'::jsonb),

  (NULL, 'Crown Cap (steel)', 'Packaging', 2.8, 'kg',
   'worldsteel LCI 2022; ecoinvent 3.12 (tinplate steel, stamping)',
   2.80, 0.0, 'GLO', 'IPCC AR6 GWP100', 65,
   '{"data_quality_grade":"MEDIUM","value_range_low":2.3,"value_range_high":3.3,"drinks_relevance":"Beer/soft-drink crown caps. ~2g each.","notes":"Tinplate steel with a sealing liner."}'::jsonb),

  (NULL, 'Aluminium Screw Cap', 'Packaging', 9.0, 'kg',
   'European Aluminium Environmental Profile 2018; ecoinvent 3.12 (primary aluminium, sheet, ROPP forming)',
   9.00, 0.0, 'GLO', 'IPCC AR6 GWP100', 65,
   '{"data_quality_grade":"MEDIUM","value_range_low":7.5,"value_range_high":11.0,"drinks_relevance":"ROPP/screw caps on spirits and wine. High per-kg from primary aluminium; caps are light (~2-5g).","notes":"Comparable to the existing Foil Capsule factor."}'::jsonb),

  (NULL, 'Plastic Screw Cap', 'Packaging', 2.2, 'kg',
   'PlasticsEurope (PP/HDPE) 2021; ecoinvent 3.12 (polypropylene + injection moulding)',
   2.20, 0.0, 'GLO', 'IPCC AR6 GWP100', 65,
   '{"data_quality_grade":"MEDIUM","value_range_low":1.8,"value_range_high":2.8,"drinks_relevance":"PP/HDPE screw caps on PET bottles, cartons, pouches."}'::jsonb),

  (NULL, 'Paper Label', 'Packaging', 1.3, 'kg',
   'ecoinvent 3.12 (label paper + offset printing); CEPI 2021',
   1.10, 0.20, 'GLO', 'IPCC AR6 GWP100', 60,
   '{"data_quality_grade":"MEDIUM","value_range_low":1.0,"value_range_high":1.8,"drinks_relevance":"Paper bottle labels incl. adhesive + ink. ~1-3g each."}'::jsonb),

  (NULL, 'Plastic Film Label', 'Packaging', 2.8, 'kg',
   'PlasticsEurope (PP/PET film) 2021; ecoinvent 3.12 (BOPP/PET film + printing)',
   2.80, 0.0, 'GLO', 'IPCC AR6 GWP100', 50,
   '{"data_quality_grade":"LOW","value_range_low":2.2,"value_range_high":3.5,"drinks_relevance":"Self-adhesive plastic / shrink-sleeve labels. Higher impact and harder to recycle than paper."}'::jsonb),

  (NULL, 'Corrugated Board Box', 'Packaging', 0.8, 'kg',
   'FEFCO European Database for Corrugated Board LCI 2021; ecoinvent 3.12 (corrugated board box)',
   0.70, 0.10, 'GLO', 'IPCC AR6 GWP100', 70,
   '{"data_quality_grade":"MEDIUM","value_range_low":0.6,"value_range_high":1.0,"drinks_relevance":"Secondary/shipping cases and multipacks. High recycled content; widely recycled."}'::jsonb),

  (NULL, 'Folding Carton (multipack)', 'Packaging', 0.9, 'kg',
   'ECMA/Pro Carton LCI 2022; ecoinvent 3.12 (folding boxboard carton)',
   0.80, 0.10, 'GLO', 'IPCC AR6 GWP100', 65,
   '{"data_quality_grade":"MEDIUM","value_range_low":0.7,"value_range_high":1.2,"drinks_relevance":"Printed folding-carton multipack wraps (4/6-pack sleeves)."}'::jsonb),

  (NULL, 'Shrink Wrap (LDPE film)', 'Packaging', 2.3, 'kg',
   'PlasticsEurope Eco-profile (LDPE film) 2021; ecoinvent 3.12 (LDPE + blown film extrusion)',
   2.30, 0.0, 'GLO', 'IPCC AR6 GWP100', 65,
   '{"data_quality_grade":"MEDIUM","value_range_low":1.9,"value_range_high":2.8,"drinks_relevance":"Shrink/stretch film around multipacks and pallets."}'::jsonb),

  (NULL, 'Stainless Steel Keg', 'Packaging', 6.5, 'kg',
   'worldsteel LCI 2022; ecoinvent 3.12 (chromium steel 18/8, deep drawing)',
   6.50, 0.0, 'GLO', 'IPCC AR6 GWP100', 60,
   '{"data_quality_grade":"MEDIUM","value_range_low":5.5,"value_range_high":7.5,"drinks_relevance":"Reusable stainless kegs. Per kg of material; the wizard amortises this across ~150 reuse trips, so per-serving impact is small."}'::jsonb)
ON CONFLICT DO NOTHING;
