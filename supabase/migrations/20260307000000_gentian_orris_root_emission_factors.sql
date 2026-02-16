-- Add Gentian Root and Orris Root (Iris) emission factors to the global data library.
-- Both are commonly used botanicals in spirits (gin, amaro, vermouth) with no published
-- LCA data in ecoinvent or Agribalyse. Proxy estimates derived from analogous root crop
-- and botanical LCA literature.

-- Gentian Root (Gentiana lutea)
-- Alpine/mountain perennial root harvested after 3-5 years. Moderate cultivation intensity,
-- dried and cut for use. Primary producers: France (Auvergne), Germany, Switzerland.
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Gentian Root', 'Ingredient', 1.20, 'kg',
  'Proxy: perennial root crop LCA literature + drying energy estimate. No published gentian-specific LCA exists.',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Proxy based on analogous perennial root crop production with drying energy",
      "authors": "Estimated from root vegetable/herb LCA literature",
      "year": 2024
    },
    "proxy_methodology": "Based on low-input perennial root crop cultivation (~0.3-0.5 kg CO2e/kg fresh root) plus standard drying energy (~0.5-0.8 kg CO2e/kg). Gentian is a hardy alpine perennial requiring minimal inputs (no irrigation, low fertiliser) with 3-5 year growth cycle before harvest. Lower intensity than annual root crops.",
    "system_boundary": "Cradle-to-gate: cultivation through drying and cutting",
    "value_range_low": 0.60,
    "value_range_high": 2.00,
    "notes": "NO PUBLISHED LCA for gentian root. This is a proxy estimate with high uncertainty. Gentiana lutea grown in alpine/mountain regions of France, Germany, Switzerland. Low-input perennial with minimal fertiliser and no irrigation. Wild-harvested gentian is increasingly replaced by cultivated stock due to CITES/conservation concerns.",
    "drinks_relevance": "Gin — key botanical for bitterness. Angostura and cocktail bitters. Suze, Salers, Avèze (gentian liqueurs). Amaro, vermouth, Chartreuse.",
    "review_date": "2026-03-07"
  }'::jsonb,
  0.40, 1.80, 0.04, 'EU', 0.95, 0.12,
  0, 0.001, 0.00015, 0,
  'IPCC AR6 GWP100', '2020-2024', 55,
  0, 0
);

-- Orris Root (Iris pallida / Iris germanica)
-- Iris rhizome harvested after 2-3 years, then dried and aged for 2-5 years to develop
-- characteristic violet/powdery aroma. Extended ageing process is energy-intensive.
-- Primary producers: Italy (Tuscany/Florence region), Morocco.
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Orris Root', 'Ingredient', 2.00, 'kg',
  'Proxy: perennial rhizome crop LCA literature + extended drying/ageing energy estimate. No published orris-specific LCA exists.',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Proxy based on analogous rhizome crop production with extended drying and ageing energy",
      "authors": "Estimated from root/rhizome crop LCA literature",
      "year": 2024
    },
    "proxy_methodology": "Based on iris rhizome cultivation (~0.4-0.6 kg CO2e/kg fresh root, moderate-input perennial) plus extended drying and ageing energy over 2-5 years (~1.0-1.5 kg CO2e/kg). The prolonged ageing period in controlled conditions is the dominant energy contributor, distinguishing orris from simpler dried root ingredients.",
    "system_boundary": "Cradle-to-gate: cultivation through multi-year drying, ageing and peeling",
    "value_range_low": 1.20,
    "value_range_high": 3.50,
    "notes": "NO PUBLISHED LCA for orris root. This is a proxy estimate with high uncertainty. Iris pallida / Iris germanica rhizomes grown primarily in Tuscany (Italy) and Morocco. After 2-3 year growth, rhizomes are harvested, peeled, and dried/aged for 2-5 years. This extended ageing is essential for aroma development and adds significant processing energy. Orris is one of the most expensive botanicals in perfumery and spirits.",
    "drinks_relevance": "Gin — prized botanical for floral/violet notes and as a fixative. Bombay Sapphire, Hendricks, and many premium gins. Vermouth, amaro.",
    "review_date": "2026-03-07"
  }'::jsonb,
  0.55, 2.20, 0.05, 'EU', 1.60, 0.18,
  0, 0.001, 0.00020, 0,
  'IPCC AR6 GWP100', '2020-2024', 65,
  0, 0
);
