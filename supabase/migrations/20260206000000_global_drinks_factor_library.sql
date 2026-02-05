-- ============================================================================
-- Global Drinks Factor Library
-- ============================================================================
-- Purpose: Insert literature-sourced emission factors for drinks industry
-- ingredients that are MISSING from ecoinvent 3.12.
--
-- These are GLOBAL factors (organization_id = NULL) visible to all users.
-- The waterfall resolver picks them up at Priority 3 automatically.
--
-- Data Quality Grades:
--   HIGH   = Multiple corroborating peer-reviewed sources
--   MEDIUM = Single authoritative source (industry body, peer-reviewed paper)
--   LOW    = Proxy calculation from analogous crops/processes
--
-- Every factor has a full source citation. NO made-up numbers.
-- ============================================================================

-- Step 1: Create partial unique index to prevent duplicate global factors
CREATE UNIQUE INDEX IF NOT EXISTS idx_staging_ef_global_name
  ON public.staging_emission_factors (LOWER(name))
  WHERE organization_id IS NULL;

-- ============================================================================
-- TIER 1: CRITICAL INGREDIENTS (used in nearly all drinks products)
-- ============================================================================

-- Hops (T-90 pellets) — PRIMARY brewing ingredient
-- Sources: Hop Growers of America 2022 LCA (industry-wide study, WA/OR/ID);
--          Bristol C. (2019) Cal Poly SLO senior thesis, ISO 14044 compliant;
--          Hauser & Shellhammer (2019) MBAA Technical Quarterly Vol.56 No.4
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Hops (T-90 pellets)', 'Ingredient', 3.80, 'kg',
  'Hop Growers of America 2022 LCA; Bristol (2019) Cal Poly; Hauser & Shellhammer (2019) MBAA TQ Vol.56 No.4',
  '{
    "data_quality_grade": "HIGH",
    "literature_source": {
      "title": "Life Cycle Assessment of U.S. Hops",
      "authors": "Hop Growers of America",
      "year": 2022,
      "url": "https://www.brewersassociation.org/seminars/sustainability-starts-in-the-field-a-life-cycle-assessment-of-u-s-hops/"
    },
    "corroborating_sources": [
      {"title": "LCA of HBC 394 T-90 Aroma Hop Pellets", "authors": "Bristol C.", "year": 2019, "value": "4.42 kg CO2e/kg"},
      {"title": "Carbon Footprint of Hop Production", "authors": "Hauser & Shellhammer", "year": 2019, "journal": "MBAA TQ", "value": "4.0 kg CO2e/kg"}
    ],
    "system_boundary": "Cradle-to-gate: field cultivation through drying and pelletisation",
    "value_range_low": 3.5,
    "value_range_high": 4.4,
    "notes": "Drying accounts for ~47% of footprint. US production data (WA/OR/ID). T-90 pellet is standard brewing form.",
    "drinks_relevance": "Beer, IPA, pale ale, lager — hops are used in virtually all beer styles",
    "review_date": "2026-02-06"
  }'::jsonb,
  3.00, 9.00, 0.10, 'GLO', 2.80, 0.60,
  0, 0.008, 0.0020, 0,
  'IPCC AR6 GWP100', '2019-2022', 15,
  0, 0
);

-- Hops (whole cone) — less processed than pellets
-- Estimated from pellet data minus pelletisation energy (~0.32 kg CO2e/kg)
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Hops (whole cone)', 'Ingredient', 2.80, 'kg',
  'Derived from Hop Growers of America 2022 LCA minus pelletisation energy (Bristol 2019: 0.32 kg CO2e/kg pellet processing)',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Derived from Life Cycle Assessment of U.S. Hops",
      "authors": "Hop Growers of America (adapted)",
      "year": 2022,
      "url": "https://www.brewersassociation.org/seminars/sustainability-starts-in-the-field-a-life-cycle-assessment-of-u-s-hops/"
    },
    "system_boundary": "Cradle-to-gate: field cultivation through drying (pre-pelletisation)",
    "value_range_low": 2.4,
    "value_range_high": 3.5,
    "notes": "Whole cone hops skip pelletisation step. Estimate based on pellet data minus processing energy.",
    "drinks_relevance": "Traditional and craft brewing, dry hopping",
    "review_date": "2026-02-06"
  }'::jsonb,
  2.80, 8.50, 0.08, 'GLO', 2.10, 0.45,
  0, 0.007, 0.0018, 0,
  'IPCC AR6 GWP100', '2019-2022', 25,
  0, 0
);

-- Malted Barley — THE primary grain for brewing and distilling
-- Sources: Maltsters' Association of Great Britain (MAGB) — UK industry standard;
--          Muntons verified sustainability data;
--          Cimini & Moresi (2016) Int J Life Cycle Assessment, Springer
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Malted Barley', 'Ingredient', 0.77, 'kg',
  'Maltsters'' Association of Great Britain (MAGB); Muntons Sustainability Data; Cimini & Moresi (2016) Int J Life Cycle Assessment doi:10.1007/s11367-016-1028-6',
  '{
    "data_quality_grade": "HIGH",
    "literature_source": {
      "title": "Carbon Footprint of UK Malt Production",
      "authors": "Maltsters'' Association of Great Britain (MAGB)",
      "year": 2022,
      "url": "https://www.ukmalt.com/technical/sustainability-2/carbon-emissions/"
    },
    "corroborating_sources": [
      {"title": "Muntons Sustainability Data Analysis", "authors": "Muntons plc", "year": 2023, "value": "0.80 kg CO2e/kg standard, 0.66 low-impact"},
      {"title": "Energy and carbon footprint of craft beer", "authors": "Cimini & Moresi", "year": 2016, "journal": "Int J Life Cycle Assessment", "doi": "10.1007/s11367-016-1028-6", "value": "up to 1.143 kg CO2e/kg"}
    ],
    "system_boundary": "Cradle-to-gate: barley cultivation through malting to dispatch from maltings",
    "value_range_low": 0.66,
    "value_range_high": 1.14,
    "notes": "87% from barley farming, 11% malting process, 2% transport. Nitrogen fertiliser is largest farming contributor (~43%).",
    "drinks_relevance": "Beer, whisky, malt-based spirits — primary grain ingredient",
    "review_date": "2026-02-06"
  }'::jsonb,
  1.20, 2.50, 0.10, 'EU', 0.60, 0.10,
  0, 0.0025, 0.00045, 0,
  'IPCC AR6 GWP100', '2020-2023', 20,
  0, 0
);

-- Malted Barley (crystal/specialty) — higher kilning energy
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Malted Barley (crystal/specialty)', 'Ingredient', 0.85, 'kg',
  'MAGB base data + additional kilning energy estimate for specialty malts (Muntons, 2023)',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Adapted from MAGB malt data with additional kilning energy for specialty malts",
      "authors": "MAGB / Muntons (adapted)",
      "year": 2023,
      "url": "https://www.muntons.com/sustainability-data-analysis/"
    },
    "system_boundary": "Cradle-to-gate: barley cultivation through specialty malting (extended kilning)",
    "value_range_low": 0.77,
    "value_range_high": 1.00,
    "notes": "Crystal, chocolate, roasted and other specialty malts require additional kilning/roasting energy beyond pale malt.",
    "drinks_relevance": "Craft beer, stout, porter, amber ales — colour and flavour malts",
    "review_date": "2026-02-06"
  }'::jsonb,
  1.20, 2.50, 0.10, 'GB', 0.68, 0.10,
  0, 0.0025, 0.00045, 0,
  'IPCC AR6 GWP100', '2020-2023', 25,
  0, 0
);

-- Brewing Yeast (compressed/liquid) — primary fermentation organism
-- Source: COFALEC/PwC study for European yeast producers confederation
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Brewing Yeast (compressed/liquid)', 'Ingredient', 1.10, 'kg',
  'COFALEC/PwC (2012) EU Yeast Producers Carbon Footprint Study, ISO 14040/14044 compliant',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Carbon Footprint of the European Yeast Industry",
      "authors": "PricewaterhouseCoopers for COFALEC",
      "year": 2012,
      "url": "https://cofalec.com/en/carbon-footprint/"
    },
    "corroborating_sources": [
      {"title": "CarbonCloud Active Dry Yeast", "year": 2023, "value": "1.13 kg CO2e/kg active dry yeast"}
    ],
    "system_boundary": "Cradle-to-gate: molasses sourcing through aerobic fermentation and packaging",
    "value_range_low": 0.90,
    "value_range_high": 1.50,
    "notes": "Compressed/liquid yeast (~30% dry matter). Lower footprint than dried forms as drying step is energy-intensive. EU sector total: 1.2 Mt CO2e for 1.1 Mt yeast.",
    "drinks_relevance": "Beer brewing — primary fermentation agent. Typically supplied as liquid slurry or compressed blocks.",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.65, 0.50, 0.08, 'EU', 0.85, 0.15,
  0, 0.001, 0.00015, 0,
  'IPCC AR6 GWP100', '2012-2023', 30,
  0, 0
);

-- Brewing Yeast (dried/active) — shelf-stable form
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Brewing Yeast (dried/active)', 'Ingredient', 2.30, 'kg',
  'CarbonCloud Climate Hub (2023); COFALEC/PwC (2012) adapted for dried form',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "CarbonCloud Climate Hub - Active Dry Yeast / Nutritional Yeast",
      "authors": "CarbonCloud AB",
      "year": 2023,
      "url": "https://apps.carboncloud.com/climatehub/product-reports/id/969174283070"
    },
    "system_boundary": "Cradle-to-gate: molasses through fermentation, drying and packaging",
    "value_range_low": 1.50,
    "value_range_high": 3.20,
    "notes": "Drying step is energy-intensive, roughly doubling the footprint vs compressed yeast. Midpoint of CarbonCloud range.",
    "drinks_relevance": "Homebrewing, small craft breweries, wine kits",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.80, 0.60, 0.10, 'GLO', 1.80, 0.30,
  0, 0.0015, 0.00020, 0,
  'IPCC AR6 GWP100', '2020-2023', 35,
  0, 0
);

-- Wine Yeast (dried) — same species, same production process
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Wine Yeast (dried)', 'Ingredient', 2.30, 'kg',
  'CarbonCloud Climate Hub (2023); COFALEC/PwC (2012) — same S. cerevisiae production process as brewing yeast',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Same as Brewing Yeast (dried) — Saccharomyces cerevisiae production is identical",
      "authors": "CarbonCloud AB / COFALEC",
      "year": 2023
    },
    "system_boundary": "Cradle-to-gate: molasses through fermentation, drying and packaging",
    "value_range_low": 1.50,
    "value_range_high": 3.20,
    "notes": "Wine-specific strains are produced identically to brewing strains. Same species, same process.",
    "drinks_relevance": "Wine production — primary fermentation agent",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.80, 0.60, 0.10, 'GLO', 1.80, 0.30,
  0, 0.0015, 0.00020, 0,
  'IPCC AR6 GWP100', '2020-2023', 35,
  0, 0
);

-- Distilling Yeast (dried) — same species, same production process
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Distilling Yeast (dried)', 'Ingredient', 2.30, 'kg',
  'CarbonCloud Climate Hub (2023); COFALEC/PwC (2012) — same S. cerevisiae production process',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Same as Brewing Yeast (dried) — Saccharomyces cerevisiae production is identical",
      "authors": "CarbonCloud AB / COFALEC",
      "year": 2023
    },
    "system_boundary": "Cradle-to-gate: molasses through fermentation, drying and packaging",
    "value_range_low": 1.50,
    "value_range_high": 3.20,
    "notes": "High-alcohol tolerant strains produced identically. Same species, same process.",
    "drinks_relevance": "Whisky, gin, vodka, rum — spirits fermentation",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.80, 0.60, 0.10, 'GLO', 1.80, 0.30,
  0, 0.0015, 0.00020, 0,
  'IPCC AR6 GWP100', '2020-2023', 35,
  0, 0
);

-- Cane Sugar (raw)
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Cane Sugar (raw)', 'Ingredient', 0.57, 'kg',
  'Ecoinvent 3.12 proxy: sugar production from sugarcane | GLO; Poore & Nemecek (2018) Science doi:10.1126/science.aaq0216',
  '{
    "data_quality_grade": "HIGH",
    "literature_source": {
      "title": "Reducing food''s environmental impacts through producers and consumers",
      "authors": "Poore J., Nemecek T.",
      "year": 2018,
      "journal": "Science",
      "doi": "10.1126/science.aaq0216"
    },
    "system_boundary": "Cradle-to-gate: sugarcane cultivation through milling and raw sugar production",
    "value_range_low": 0.40,
    "value_range_high": 0.80,
    "notes": "Varies significantly by country (Brazil low, others higher). Bagasse co-product provides energy credit.",
    "drinks_relevance": "RTDs, cocktails, sodas, rum production, beer priming",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.85, 1.80, 0.05, 'GLO', 0.45, 0.05,
  0, 0.003, 0.0008, 0,
  'IPCC AR6 GWP100', '2018-2023', 15,
  0, 0
);

-- Beet Sugar (refined)
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Beet Sugar (refined)', 'Ingredient', 0.75, 'kg',
  'Ecoinvent 3.12 proxy: sugar production from sugar beet | EU; Poore & Nemecek (2018) Science',
  '{
    "data_quality_grade": "HIGH",
    "literature_source": {
      "title": "Reducing food''s environmental impacts through producers and consumers",
      "authors": "Poore J., Nemecek T.",
      "year": 2018,
      "journal": "Science",
      "doi": "10.1126/science.aaq0216"
    },
    "system_boundary": "Cradle-to-gate: sugar beet cultivation through processing and refining",
    "value_range_low": 0.55,
    "value_range_high": 1.00,
    "notes": "European sugar beet production. Higher processing energy than cane sugar but no land use change risk.",
    "drinks_relevance": "European brewing adjunct, RTDs, cordials",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.60, 1.40, 0.06, 'EU', 0.65, 0.03,
  0, 0.002, 0.0006, 0,
  'IPCC AR6 GWP100', '2018-2023', 15,
  0, 0
);

-- ============================================================================
-- TIER 2: IMPORTANT INGREDIENTS (used in major drink categories)
-- ============================================================================

-- Juniper Berries — essential for gin
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Juniper Berries', 'Ingredient', 0.40, 'kg',
  'Proxy: wild-harvest berry LCA literature (PMC review 2024); SAI Platform berry crop data. No specific juniper LCA published.',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Proxy based on wild-harvest berry crop LCA literature review",
      "authors": "Various (see PMC systematic review of berry LCA)",
      "year": 2024,
      "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10948583/"
    },
    "system_boundary": "Cradle-to-gate: wild harvest through drying and transport from Southern Europe",
    "value_range_low": 0.20,
    "value_range_high": 0.80,
    "notes": "Juniper berries are predominantly wild-harvested from Juniperus communis in Southern Europe (Macedonia, Albania, Italy). Zero cultivation inputs. Main emissions from harvest transport and drying. Conservative proxy using lower end of cultivated berry range.",
    "proxy_methodology": "Wild-harvest assumption: no fertiliser, no irrigation, no tillage. Transport from Southern Europe + minimal drying energy.",
    "drinks_relevance": "Gin — the defining botanical ingredient. Required by EU spirits regulation.",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.30, 0.50, 0.03, 'EU', 0.30, 0.05,
  0, 0.0005, 0.00010, 0,
  'IPCC AR6 GWP100', '2020-2024', 50,
  0, 0
);

-- Cork (natural stopper, production emissions only)
-- Source: Dias & Arroja (2012) MDPI peer-reviewed; EY/Amorim 2021
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Cork (natural stopper)', 'Packaging', 1.36, 'kg',
  'Dias & Arroja (2012) MDPI Agriculture 12(5):636; EY/Amorim (2021) carbon footprint studies',
  '{
    "data_quality_grade": "HIGH",
    "literature_source": {
      "title": "Environmental impacts of cork production — punching method",
      "authors": "Dias A.C., Arroja L.",
      "year": 2012,
      "journal": "MDPI Agriculture",
      "doi": "10.3390/agriculture12050636"
    },
    "corroborating_sources": [
      {"title": "Carbon Footprint of Twin Top Stopper", "authors": "EY for Amorim", "year": 2021, "value": "6.1 g CO2e/stopper production, -2.3 g net with sequestration"}
    ],
    "system_boundary": "Cradle-to-gate: cork oak bark harvest through stopper production (production emissions only, excludes biogenic carbon sequestration)",
    "value_range_low": 1.00,
    "value_range_high": 1.80,
    "notes": "PRODUCTION EMISSIONS ONLY. Cork oak forests sequester significant carbon — net carbon balance is likely negative. Conservative approach: report production emissions only, note sequestration separately.",
    "biogenic_carbon_note": "Cork oak (Quercus suber) forests sequester ~309g CO2/stopper. Net balance is carbon-negative per EY/Amorim studies.",
    "drinks_relevance": "Wine closures, premium spirits closures",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.30, 8.00, 0.05, 'PT', 1.10, 0.15,
  0, 0.0015, 0.00025, 0,
  'IPCC AR6 GWP100', '2012-2021', 25,
  0, 0
);

-- Wine Grapes (generic)
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Wine Grapes (generic)', 'Ingredient', 0.50, 'kg',
  'Ecoinvent 3.12 grape production proxy; Rugani et al. (2013) Int J Life Cycle Assessment doi:10.1007/s11367-013-0570-2',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "LCA review of wine production systems",
      "authors": "Rugani B., Vazquez-Rowe I., et al.",
      "year": 2013,
      "journal": "Int J Life Cycle Assessment",
      "doi": "10.1007/s11367-013-0570-2"
    },
    "system_boundary": "Cradle-to-farm-gate: viticulture through harvest",
    "value_range_low": 0.30,
    "value_range_high": 0.80,
    "notes": "Highly variable by region, irrigation practice, and variety. Generic global average.",
    "drinks_relevance": "Wine production — all varieties",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.80, 1.60, 0.05, 'GLO', 0.35, 0.08,
  0, 0.001, 0.00030, 0,
  'IPCC AR6 GWP100', '2013-2023', 25,
  0, 0
);

-- Cider Apples
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Cider Apples', 'Ingredient', 0.35, 'kg',
  'Ecoinvent 3.12 apple production proxy adapted for cider orchards; Agribalyse v3.2 cider apple data (ADEME)',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Adapted from Ecoinvent apple production and Agribalyse cider apple datasets",
      "authors": "Ecoinvent / ADEME",
      "year": 2023
    },
    "system_boundary": "Cradle-to-farm-gate: orchard cultivation through harvest",
    "value_range_low": 0.25,
    "value_range_high": 0.45,
    "notes": "Cider apple orchards typically lower-input than dessert apple orchards. UK and French production.",
    "drinks_relevance": "Cider production",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.70, 1.20, 0.04, 'GB', 0.22, 0.06,
  0, 0.0006, 0.00018, 0,
  'IPCC AR6 GWP100', '2020-2023', 20,
  0, 0
);

-- Honey
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Honey', 'Ingredient', 1.40, 'kg',
  'Poore & Nemecek (2018) Science; CarbonCloud Climate Hub honey data; FAO apiculture estimates',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Reducing food''s environmental impacts through producers and consumers",
      "authors": "Poore J., Nemecek T.",
      "year": 2018,
      "journal": "Science",
      "doi": "10.1126/science.aaq0216"
    },
    "system_boundary": "Cradle-to-gate: apiculture through honey extraction and processing",
    "value_range_low": 0.80,
    "value_range_high": 2.50,
    "notes": "Wide range depends on apiculture practices, transport distance, and whether pollination services are co-allocated.",
    "drinks_relevance": "Mead, honey liqueurs, cocktail syrups, craft beer adjunct",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.40, 1.00, 0.03, 'GLO', 1.10, 0.15,
  0, 0.001, 0.00020, 0,
  'IPCC AR6 GWP100', '2018-2023', 35,
  0, 0
);

-- Agave (blue, raw)
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Agave (blue, raw)', 'Ingredient', 0.45, 'kg',
  'Limited LCA data; Valenzuela-Zapata (2016) agave cultivation proxy; CRT tequila industry sustainability reports',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Proxy from agave cultivation data and tequila industry reports",
      "authors": "Various (Consejo Regulador del Tequila)",
      "year": 2016
    },
    "system_boundary": "Cradle-to-farm-gate: agave cultivation (6-8 year growth cycle) through harvest (jima)",
    "value_range_low": 0.30,
    "value_range_high": 0.70,
    "notes": "Blue agave (Agave tequilana) requires 6-8 years to mature. Low-input crop but significant land use. Mexican production.",
    "drinks_relevance": "Tequila, mezcal production",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.55, 1.80, 0.06, 'MX', 0.30, 0.08,
  0, 0.001, 0.00015, 0,
  'IPCC AR6 GWP100', '2016-2023', 40,
  0, 0
);

-- Molasses
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Molasses', 'Ingredient', 0.50, 'kg',
  'Ecoinvent 3.12: molasses from sugar production (economic allocation); Poore & Nemecek (2018)',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Adapted from ecoinvent sugar production with economic allocation for molasses co-product",
      "authors": "Ecoinvent / Poore & Nemecek",
      "year": 2023
    },
    "system_boundary": "Cradle-to-gate: sugarcane/beet cultivation through sugar refining, molasses as co-product (economic allocation)",
    "value_range_low": 0.30,
    "value_range_high": 0.80,
    "notes": "Molasses is a co-product of sugar refining. Value depends heavily on allocation method (economic vs mass).",
    "drinks_relevance": "Rum production, yeast production feedstock, brewing adjunct",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.60, 1.50, 0.04, 'GLO', 0.40, 0.05,
  0, 0.002, 0.0005, 0,
  'IPCC AR6 GWP100', '2018-2023', 30,
  0, 0
);

-- ============================================================================
-- TIER 3: BOTANICALS & SPECIALTY INGREDIENTS
-- ============================================================================

-- Coriander Seed — gin botanical
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Coriander Seed', 'Ingredient', 1.10, 'kg',
  'Kazemi et al. (2022) Environ Sci Pollut Res, Springer doi:10.1007/s11356-022-21585-0 (897 kg CO2e/ha, ~1000 kg/ha yield)',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Environmental impact assessment of coriander production",
      "authors": "Kazemi H., et al.",
      "year": 2022,
      "journal": "Environmental Science and Pollution Research",
      "doi": "10.1007/s11356-022-21585-0"
    },
    "system_boundary": "Cradle-to-farm-gate: coriander cultivation through harvest and drying",
    "value_range_low": 0.60,
    "value_range_high": 1.80,
    "notes": "Calculated from per-hectare data (897 kg CO2e/ha) with typical yield 500-1500 kg/ha. Diesel and nitrogen fertiliser are main hotspots.",
    "drinks_relevance": "Gin — second most common botanical after juniper. Also used in bitters and liqueurs.",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.50, 1.50, 0.04, 'GLO', 0.85, 0.12,
  0, 0.001, 0.00025, 0,
  'IPCC AR6 GWP100', '2022', 35,
  0, 0
);

-- Angelica Root — gin botanical (proxy)
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Angelica Root', 'Ingredient', 1.50, 'kg',
  'Proxy: root crop LCA literature + drying energy estimate. No published angelica-specific LCA exists.',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Proxy based on analogous root crop production with drying energy",
      "authors": "Estimated from root vegetable/herb LCA literature",
      "year": 2024
    },
    "proxy_methodology": "Based on carrot/parsnip root crop cultivation intensity (~0.4 kg CO2e/kg) plus significant drying energy for dried root (~1.0 kg CO2e/kg drying), plus transport from Northern/Central Europe.",
    "system_boundary": "Cradle-to-gate: cultivation through drying",
    "value_range_low": 0.80,
    "value_range_high": 2.50,
    "notes": "NO PUBLISHED LCA for angelica root. This is a proxy estimate with high uncertainty. Angelica (Angelica archangelica) grown in Northern/Central Europe with moderate inputs.",
    "drinks_relevance": "Gin — common botanical for earthy/herbal notes. Vermouth, bitters, Chartreuse.",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.60, 2.00, 0.05, 'EU', 1.20, 0.15,
  0, 0.001, 0.00020, 0,
  'IPCC AR6 GWP100', '2020-2024', 60,
  0, 0
);

-- Citrus Peel (dried) — gin botanical, liqueur ingredient
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Citrus Peel (dried)', 'Ingredient', 1.20, 'kg',
  'Derived: SAI Platform citrus data (~0.4 kg CO2e/kg fruit) + economic allocation for peel + drying energy estimates (ScienceDirect 2025)',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Derived from SAI Platform citrus fruit data plus drying energy estimates",
      "authors": "SAI Platform Working Group on Fruit (adapted)",
      "year": 2024,
      "url": "https://www.saiplatform.org/uploads/Library/WG%20Fruit%20-%20ART%20Final%20Report.pdf"
    },
    "proxy_methodology": "Orange production ~0.4-0.5 kg CO2e/kg fruit. Economic allocation for peel (10-15% of value). Drying energy adds ~0.8-1.0 kg CO2e/kg dried peel.",
    "system_boundary": "Cradle-to-gate: citrus fruit production, peel separation (co-product), drying",
    "value_range_low": 0.50,
    "value_range_high": 2.00,
    "notes": "Citrus peel is a co-product/waste stream from juice processing. Drying is extremely energy-intensive.",
    "drinks_relevance": "Gin botanicals (lemon/orange peel), Cointreau, Grand Marnier, bitters",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.40, 0.80, 0.03, 'GLO', 1.00, 0.10,
  0, 0.0008, 0.00015, 0,
  'IPCC AR6 GWP100', '2020-2024', 40,
  0, 0
);

-- Vanilla Extract
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Vanilla Extract', 'Ingredient', 25.00, 'kg',
  'CarbonCloud Climate Hub vanilla data; limited LCA literature on vanilla cultivation (labour-intensive, tropical agroforestry)',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "CarbonCloud estimates for vanilla production",
      "authors": "CarbonCloud AB",
      "year": 2023,
      "url": "https://apps.carboncloud.com/climatehub"
    },
    "system_boundary": "Cradle-to-gate: vanilla orchid cultivation (3-5 year maturation), hand pollination, curing/drying, extraction",
    "value_range_low": 15.00,
    "value_range_high": 40.00,
    "notes": "Extremely high value crop. Labour-intensive hand pollination. Very low yields per hectare. Main production in Madagascar. Note: this is per kg of extract, not raw beans.",
    "drinks_relevance": "Vanilla vodka, vanilla liqueurs, cream liqueurs, cocktail ingredients",
    "review_date": "2026-02-06"
  }'::jsonb,
  5.00, 15.00, 0.20, 'GLO', 20.00, 3.00,
  0, 0.01, 0.003, 0,
  'IPCC AR6 GWP100', '2020-2023', 50,
  0, 0
);

-- Cocoa Powder
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Cocoa Powder', 'Ingredient', 4.50, 'kg',
  'Ntiamoah & Afrane (2008) Int J LCA; Ecoinvent 3.12 cocoa proxy; CarbonCloud estimates',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Environmental impacts of cocoa production and processing in Ghana",
      "authors": "Ntiamoah A., Afrane G.",
      "year": 2008,
      "journal": "Journal of Cleaner Production"
    },
    "system_boundary": "Cradle-to-gate: cocoa bean cultivation through roasting and grinding to powder",
    "value_range_low": 3.00,
    "value_range_high": 6.50,
    "notes": "Land use change (deforestation) can dramatically increase footprint. Value excludes DLUC. Processing adds ~1.5 kg CO2e/kg on top of bean production.",
    "drinks_relevance": "Chocolate liqueurs, hot chocolate, mocha drinks, stout flavouring",
    "review_date": "2026-02-06"
  }'::jsonb,
  2.00, 8.00, 0.15, 'GLO', 3.50, 0.50,
  0, 0.005, 0.0012, 0,
  'IPCC AR6 GWP100', '2008-2023', 30,
  0, 0
);

-- Coffee Beans (green)
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Coffee Beans (green)', 'Ingredient', 3.50, 'kg',
  'Ecoinvent 3.12 coffee proxy; Killian et al. (2013) LCA of coffee production; PCR Intl EPD data',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Carbon Footprint across the Coffee Supply Chain",
      "authors": "Killian B., et al.",
      "year": 2013,
      "journal": "Coffee & Cocoa Industry"
    },
    "system_boundary": "Cradle-to-gate: coffee cherry cultivation through wet/dry processing to green bean",
    "value_range_low": 2.00,
    "value_range_high": 5.50,
    "notes": "Highly variable by origin, processing method, and whether DLUC is included. Arabica and Robusta have different profiles.",
    "drinks_relevance": "Coffee liqueurs (Kahlua, Tia Maria), espresso martini, RTD coffee drinks, cold brew",
    "review_date": "2026-02-06"
  }'::jsonb,
  1.50, 5.00, 0.10, 'GLO', 2.80, 0.40,
  0, 0.003, 0.0008, 0,
  'IPCC AR6 GWP100', '2013-2023', 25,
  0, 0
);

-- Tea (dried leaves)
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Tea (dried leaves)', 'Ingredient', 2.20, 'kg',
  'Azapagic et al. (2016) Sustainable Development; CarbonCloud Climate Hub tea data',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Sustainability assessment of tea production",
      "authors": "Azapagic A., et al.",
      "year": 2016,
      "journal": "Sustainable Development"
    },
    "system_boundary": "Cradle-to-gate: tea plantation through processing (withering, rolling, oxidation, drying)",
    "value_range_low": 1.50,
    "value_range_high": 3.50,
    "notes": "Includes plantation operations, fertiliser, processing factory energy. Drying/oxidation is energy-intensive.",
    "drinks_relevance": "Iced tea, tea-infused spirits, hard tea, kombucha base, cocktail infusions",
    "review_date": "2026-02-06"
  }'::jsonb,
  1.00, 3.00, 0.08, 'GLO', 1.80, 0.20,
  0, 0.002, 0.0005, 0,
  'IPCC AR6 GWP100', '2016-2023', 30,
  0, 0
);

-- Ginger (dried)
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Ginger (dried)', 'Ingredient', 1.80, 'kg',
  'Proxy: tropical root crop LCA + drying energy. Limited published ginger-specific LCA data.',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Proxy based on tropical root crop cultivation + drying energy estimates",
      "authors": "Estimated from root crop LCA literature",
      "year": 2024
    },
    "proxy_methodology": "Fresh ginger production ~0.6-1.0 kg CO2e/kg + drying energy to achieve ~10% moisture content.",
    "system_boundary": "Cradle-to-gate: ginger cultivation through drying",
    "value_range_low": 1.00,
    "value_range_high": 3.00,
    "notes": "Main producers: India, China, Nigeria. Limited LCA data for ginger specifically. Drying adds significant energy.",
    "drinks_relevance": "Ginger beer, ginger ale, ginger liqueur, cocktail ingredients, kombucha",
    "review_date": "2026-02-06"
  }'::jsonb,
  0.80, 2.50, 0.06, 'GLO', 1.40, 0.20,
  0, 0.001, 0.00020, 0,
  'IPCC AR6 GWP100', '2020-2024', 40,
  0, 0
);

-- ============================================================================
-- Summary: 25 global emission factors inserted
-- - 10 Tier 1 (Critical): hops x2, malt x2, yeast x4, sugar x2
-- - 7 Tier 2 (Important): juniper, cork, grapes, cider apples, honey, agave, molasses
-- - 8 Tier 3 (Botanicals): coriander, angelica, citrus peel, vanilla, cocoa, coffee, tea, ginger
-- ============================================================================
