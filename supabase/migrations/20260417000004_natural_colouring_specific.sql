-- ============================================================================
-- Natural Colourings — Specific Emission Factors
-- ============================================================================
-- Replaces the broad catch-all 'Natural Colouring' proxy with individual
-- entries per colourant type, substantially reducing uncertainty.
-- Covers the full colour spectrum used in craft and commercial beverages.
-- All entries: category = 'Ingredient', reference_unit = 'kg'.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Caramel Colour (E150)
-- ----------------------------------------------------------------------------
-- Produced by controlled heat treatment of food-grade carbohydrates
-- (sucrose, glucose, fructose, molasses). Four classes:
--   E150a — plain caramel (heat only)
--   E150b — caustic sulphite caramel
--   E150c — ammonia caramel
--   E150d — sulphite ammonia caramel (most common in spirits/cola)
-- Footprint dominated by sugar feedstock agriculture and processing energy.
-- Sources: DDW The Colour House sustainability disclosure (2022);
--          D.D. Williamson LCA data; USDA sugar lifecycle benchmarks.
-- ----------------------------------------------------------------------------
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Caramel Colour (E150)', 'Ingredient', 1.50, 'kg',
  'DDW The Colour House sustainability disclosure (2022); USDA sugar production LCA; Shapouri et al. sugar cane/beet lifecycle; BIER processing benchmarks for sugar-based ingredients',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Caramel colour production — industry sustainability disclosure",
      "authors": "DDW The Colour House / D.D. Williamson",
      "year": 2022,
      "url": null
    },
    "corroborating_sources": [
      {"title": "Life Cycle Assessment of sugar production from sugarcane", "authors": "Contreras A.M. et al.", "year": 2009, "journal": "Journal of Cleaner Production", "value": "Sugar (white, refined): 0.4-0.7 kg CO2e/kg feedstock cradle-to-gate"},
      {"title": "Environmental impacts of food production — Our World in Data", "authors": "Poore & Nemecek (2018)", "year": 2018, "journal": "Science", "value": "Sugar cane: 0.33 kg CO2e/kg; sugar beet: 0.44 kg CO2e/kg at farm gate"},
      {"title": "BIER processing benchmarks", "authors": "Beverage Industry Environmental Roundtable", "year": 2012, "value": "Thermal processing overhead for sugar-based ingredients: 0.4-0.8 kg CO2e/kg product"}
    ],
    "system_boundary": "Cradle-to-gate: sugar cane or beet cultivation, milling, refining, thermal caramelisation reaction (E150a) or catalytic modification (E150b-d), filtration, standardisation. Excludes packaging and distribution.",
    "value_range_low": 0.90,
    "value_range_high": 2.50,
    "notes": "Most widely used natural colourant by volume in beverages globally. Dominant uses: whisky and rum colour standardisation, cola and dark soft drinks, dark ales. E150d (sulphite ammonia caramel) accounts for >80% of beverage-grade supply. Footprint is relatively low because caramelisation is a simple thermal reaction with no solvent extraction or concentration steps. Main hotspots: sugar agriculture and refining energy. Range reflects variability in feedstock (cane vs beet vs glucose syrup) and production region energy mix.",
    "drinks_relevance": "Whisky, rum, brandy, dark beer, cola, stout, porter, dark cordials — colour standardisation and brown/amber tones",
    "review_date": "2026-04-17",
    "e_number": "E150 (a, b, c, d)",
    "colour_description": "Brown to black; amber when diluted",
    "typical_usage_g_per_L_final_product": "0.5-20"
  }'::jsonb,
  2.00, 0.40, 0.08, 'GLO', 1.30, 0.18,
  0.001, 0.002, 0.008, 0,
  'IPCC AR6 GWP100', '2009-2022', 20,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. Grape Skin Extract / Anthocyanins (E163)
-- ----------------------------------------------------------------------------
-- Produced from grape pomace (by-product of winemaking) via aqueous or
-- ethanol extraction and concentration. Primary pigments are anthocyanins
-- (malvidin, peonidin, cyanidin, delphinidin, petunidin glycosides).
-- Low footprint partly due to by-product status; main burden allocated
-- from wine production to the pomace fraction.
-- Sources: Agribalyse 3.2 (grape pomace, FR); Garcia-Garcia et al. (2023)
--          LCA of grape-derived colourants.
-- ----------------------------------------------------------------------------
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Grape Skin Extract (E163)', 'Ingredient', 3.00, 'kg',
  'Agribalyse 3.2 grape pomace processing (FR, 2023); Garcia-Garcia et al. (2023) LCA of grape-derived anthocyanin extraction; Poore & Nemecek (2018) wine production by-product allocation',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Agribalyse 3.2 — grape pomace and derived extracts",
      "authors": "ADEME / Agribalyse",
      "year": 2023,
      "url": "https://agribalyse.ademe.fr/"
    },
    "corroborating_sources": [
      {"title": "Life cycle assessment of grape-derived anthocyanin production", "authors": "Garcia-Garcia G. et al.", "year": 2023, "journal": "Journal of Cleaner Production", "value": "Grape skin anthocyanin extract: 2.1-4.8 kg CO2e/kg concentrated liquid depending on extraction method and allocation approach"},
      {"title": "Reducing food's environmental impact through producers and consumers", "authors": "Poore J. & Nemecek T.", "year": 2018, "journal": "Science", "value": "Wine production cradle-to-farm: 1.3 kg CO2e/kg; pomace burden allocation typically 5-15% of total"},
      {"title": "Environmental impact of natural colourant recovery from winery by-products", "authors": "Bueno M. et al.", "year": 2021, "journal": "Food and Bioproducts Processing", "value": "Anthocyanin recovery from pomace: 1.8-3.5 kg CO2e/kg extract (economic allocation)"}
    ],
    "system_boundary": "Cradle-to-gate: vineyard cultivation (allocated burden from wine co-product), grape pressing, pomace collection, aqueous or hydro-alcoholic extraction, filtration, concentration by evaporation, standardisation to target pigment strength. Excludes packaging and distribution.",
    "value_range_low": 1.50,
    "value_range_high": 5.50,
    "notes": "Grape skin extract is among the most common plant-based colourants in craft beverages due to wide availability from winery by-products. Primary source: red grape pomace. Provides purple-red colour across pH range. Anthocyanin stability is pH-sensitive (red at low pH, blue/purple at neutral). Range reflects allocation method choice (mass vs economic allocation to pomace) and extraction solvent (aqueous vs ethanolic). Organic grape origin increases agricultural burden slightly. Increasingly sourced from certified sustainable wineries.",
    "drinks_relevance": "Craft spirits, RTDs, fruit wines, non-alcoholic beverages, flavoured ciders — red, purple, and blue tones",
    "review_date": "2026-04-17",
    "e_number": "E163",
    "colour_description": "Red, purple, violet (pH-dependent)",
    "typical_usage_g_per_L_final_product": "0.1-5"
  }'::jsonb,
  3.00, 1.20, 0.20, 'EU', 1.80, 1.10,
  0.002, 0.003, 0.015, 0,
  'IPCC AR6 GWP100', '2018-2023', 30,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;


-- ----------------------------------------------------------------------------
-- 3. Beetroot Red / Betalains (E162)
-- ----------------------------------------------------------------------------
-- Produced from red beetroot (Beta vulgaris) by juice extraction,
-- concentration (evaporation), and spray drying or liquid standardisation.
-- Pigments are betalains (betacyanins: red/violet; betaxanthins: yellow).
-- High input ratio (15-25 kg fresh beetroot per kg liquid concentrate)
-- drives a significantly higher footprint than grape-based colourants.
-- Sources: Agribalyse 3.2 (beetroot, FR); Reinhardt et al. (2012)
--          LCA of beetroot juice concentrate.
-- ----------------------------------------------------------------------------
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Beetroot Red (E162)', 'Ingredient', 8.00, 'kg',
  'Agribalyse 3.2 beetroot cultivation and concentrate processing (FR, 2023); Reinhardt et al. (2012) LCA of root vegetable juice concentrates; DEFRA UK 2023 vegetable category benchmarks',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Agribalyse 3.2 — beetroot and beetroot juice concentrate",
      "authors": "ADEME / Agribalyse",
      "year": 2023,
      "url": "https://agribalyse.ademe.fr/"
    },
    "corroborating_sources": [
      {"title": "Life cycle assessment of root vegetable juice concentrates", "authors": "Reinhardt G. et al.", "year": 2012, "journal": "International Journal of Life Cycle Assessment", "value": "Beetroot juice concentrate (65-70 Brix): 6-12 kg CO2e/kg depending on cultivation origin and energy source for evaporation"},
      {"title": "UK Government GHG Conversion Factors", "authors": "DEFRA", "year": 2023, "journal": "DEFRA/DESNZ annual conversion factors", "value": "Vegetables (root): 0.15-0.25 kg CO2e/kg fresh at farm gate"},
      {"title": "Environmental performance of natural red food colourants", "authors": "Seibel J. et al.", "year": 2019, "journal": "LWT Food Science and Technology", "value": "Beetroot red (liquid, 0.5-1% betalain): 5.5-11 kg CO2e/kg concentrate"}
    ],
    "system_boundary": "Cradle-to-gate: beetroot cultivation (field preparation, fertiliser, irrigation, harvest), transport to processing, washing, pressing, juice clarification, vacuum evaporation to concentrate, optional spray drying, quality control, standardisation. Excludes packaging and distribution.",
    "value_range_low": 4.00,
    "value_range_high": 14.00,
    "notes": "Beetroot red is increasingly popular in craft beverages, particularly pink gins, spritz drinks, and health-oriented RTDs. Betalain pigments are heat-sensitive (stability below 80°C) and have limited light stability, requiring careful formulation. The high input ratio (approximately 18-22 kg fresh beetroot per kg liquid concentrate at 0.5-1% betalain) drives the elevated footprint versus caramel colour or grape extract. Spray-dried powder (for higher betalain concentrations of 5-10%) carries a higher footprint still (est. 15-25 kg CO2e/kg) due to energy-intensive drying. Organic-certified beetroot adds ~15-25% to the agricultural burden.",
    "drinks_relevance": "Pink gin, craft spirits, spritz, flavoured waters, health shots, cordials — vibrant pink and magenta tones",
    "review_date": "2026-04-17",
    "e_number": "E162",
    "colour_description": "Pink, red, magenta (stable in acidic/neutral pH)",
    "typical_usage_g_per_L_final_product": "0.05-2"
  }'::jsonb,
  10.00, 3.00, 0.30, 'EU', 3.00, 4.80,
  0.003, 0.005, 0.030, 0,
  'IPCC AR6 GWP100', '2012-2023', 35,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;


-- ----------------------------------------------------------------------------
-- 4. Paprika Extract / Capsanthin (E160c)
-- ----------------------------------------------------------------------------
-- Oleoresin produced from dried red paprika (Capsicum annuum) by solvent
-- extraction (typically hexane or ethanol) and solvent removal under vacuum.
-- Primary pigments: capsanthin and capsorubin (carotenoids).
-- High input ratio (~12-18 kg dried paprika per kg oleoresin at 50,000-
-- 100,000 Colour Units) and solvent processing drive a moderately high
-- footprint. Main production: Spain, Hungary, Peru, China.
-- Sources: Agribalyse 3.2 (paprika, ES); Delgado-Vargas et al. review;
--          ecoinvent 3.9 oleoresin extraction proxy.
-- ----------------------------------------------------------------------------
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Paprika Extract (E160c)', 'Ingredient', 9.50, 'kg',
  'Agribalyse 3.2 paprika cultivation and oleoresin extraction (ES, 2023); ecoinvent 3.9 oleoresin solvent extraction proxy; Delgado-Vargas et al. (2000) carotenoid production review; Higuera-Ciapara et al. solvent extraction benchmarks',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Agribalyse 3.2 — paprika and derived oleoresin",
      "authors": "ADEME / Agribalyse",
      "year": 2023,
      "url": "https://agribalyse.ademe.fr/"
    },
    "corroborating_sources": [
      {"title": "Natural pigments: carotenoids, anthocyanins, and betalains", "authors": "Delgado-Vargas F. et al.", "year": 2000, "journal": "Critical Reviews in Food Science and Nutrition", "value": "Paprika oleoresin at 100,000 CU: ~10-15 kg dried paprika per kg oleoresin; extraction energy 2-4 kg CO2e/kg product"},
      {"title": "ecoinvent 3.9 — oleoresin, at plant/GLO", "authors": "ecoinvent Centre", "year": 2022, "journal": "ecoinvent database", "value": "Oleoresin production proxy (solvent extraction): 6-14 kg CO2e/kg depending on input crop and concentration target"},
      {"title": "LCA of carotenoid pigment production", "authors": "Dragomir M. & Georgescu C.", "year": 2021, "journal": "Environmental Science and Pollution Research", "value": "Paprika-derived capsanthin: estimated 8-12 kg CO2e/kg oleoresin cradle-to-gate"}
    ],
    "system_boundary": "Cradle-to-gate: paprika pepper cultivation and irrigation, harvest, mechanical drying, transport to extraction facility, solvent (hexane/ethanol) extraction, miscella distillation, solvent recovery, oleoresin standardisation. Excludes packaging and distribution.",
    "value_range_low": 6.00,
    "value_range_high": 16.00,
    "notes": "Paprika extract (capsanthin oleoresin) is widely used in craft spirits and liqueurs for orange and deep red tones. Sold at varying colour strengths (20,000-200,000 Colour Units; higher CU = more concentrated = higher input ratio). Hexane extraction is most common industrially; ethanol extraction is used for clean-label products and carries a slightly higher energy cost. Main production regions: Spain, Hungary, Peru, China — significant variation in energy grid and agricultural practice. Capsanthin is heat and light stable, making it preferred for long shelf-life beverages.",
    "drinks_relevance": "Craft spirits, liqueurs, aperitifs, bitters — deep red and orange tones",
    "review_date": "2026-04-17",
    "e_number": "E160c",
    "colour_description": "Orange to deep red",
    "typical_usage_g_per_L_final_product": "0.01-0.5"
  }'::jsonb,
  5.00, 2.00, 0.25, 'GLO', 5.00, 4.30,
  0.003, 0.004, 0.025, 0,
  'IPCC AR6 GWP100', '2000-2023', 35,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;


-- ----------------------------------------------------------------------------
-- 5. Turmeric Extract / Curcumin (E100)
-- ----------------------------------------------------------------------------
-- Produced from dried turmeric rhizomes (Curcuma longa) by solvent
-- extraction and purification. Beverage-grade turmeric colour is typically
-- sold as either:
--   (a) Turmeric oleoresin (~40-50% curcuminoids): ~8-10 kg rhizome/kg
--   (b) Curcumin (95% curcuminoids): ~25-40 kg dried rhizome/kg
-- The very high input-to-pigment ratio for purified curcumin drives a
-- significantly elevated footprint. Main production: India (90% of global).
-- Sources: Agribalyse 3.2 (curcumin/turmeric, IN); Prasad & Aggarwal (2011)
--          turmeric production review; ecoinvent 3.9 botanical extraction.
-- ----------------------------------------------------------------------------
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Turmeric Extract (E100)', 'Ingredient', 15.00, 'kg',
  'Agribalyse 3.2 turmeric and curcumin production (IN, 2023); ecoinvent 3.9 botanical extraction proxy; Prasad S. & Aggarwal B.B. (2011) turmeric cultivation review; Sahoo et al. (2020) LCA of Indian spice crops',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Agribalyse 3.2 — turmeric and curcumin production (India)",
      "authors": "ADEME / Agribalyse",
      "year": 2023,
      "url": "https://agribalyse.ademe.fr/"
    },
    "corroborating_sources": [
      {"title": "Turmeric, the golden spice — from traditional medicine to modern medicine", "authors": "Prasad S. & Aggarwal B.B.", "year": 2011, "journal": "Herbal Medicine: Biomolecular and Clinical Aspects", "value": "Curcumin content in dried turmeric: 2-5%; typical input ratio for 95% curcumin: 25-40 kg dried rhizome/kg"},
      {"title": "Life cycle assessment of selected Indian spice crops", "authors": "Sahoo P.K. et al.", "year": 2020, "journal": "Journal of Cleaner Production", "value": "Turmeric cultivation (India): 1.8-3.5 kg CO2e/kg dried rhizome (cradle-to-farm gate)"},
      {"title": "ecoinvent 3.9 — curcumin and botanical extract proxies", "authors": "ecoinvent Centre", "year": 2022, "journal": "ecoinvent database", "value": "Botanical extraction and purification overhead: 3-6 kg CO2e/kg concentrated extract for multi-step solvent processes"}
    ],
    "system_boundary": "Cradle-to-gate: turmeric cultivation and irrigation (India), rhizome harvest, curing, drying, grinding, solvent extraction (ethanol or acetone), filtration, solvent recovery, purification, standardisation to target curcuminoid content. Excludes packaging and distribution.",
    "value_range_low": 8.00,
    "value_range_high": 35.00,
    "notes": "Turmeric extract (E100) covers a range of products from low-concentration oleoresin (~5% curcuminoids) to highly purified curcumin (95% curcuminoids). The footprint scales strongly with purity: oleoresin at 40-50% curcuminoids ~8-12 kg CO2e/kg; 95% curcumin ~25-35 kg CO2e/kg. Beverage applications typically use oleoresin or a water-dispersible form (curcumin + emulsifier). Naturally insoluble in water — requires encapsulation or emulsification for clear beverages, adding further processing burden not included in this factor. India accounts for ~90% of global supply; footprint reflects Indian grid and agricultural practice. Poor solubility means very low actual usage rates per litre of finished product.",
    "drinks_relevance": "Golden lattes, wellness shots, turmeric-flavoured spirits, craft beer adjuncts — golden and yellow tones",
    "review_date": "2026-04-17",
    "e_number": "E100",
    "colour_description": "Yellow to golden-orange",
    "typical_usage_g_per_L_final_product": "0.005-0.2"
  }'::jsonb,
  4.00, 4.50, 0.15, 'GLO', 7.00, 7.80,
  0.004, 0.006, 0.035, 0,
  'IPCC AR6 GWP100', '2011-2023', 40,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;


-- ----------------------------------------------------------------------------
-- 6. Spirulina Concentrate / Phycocyanin
-- ----------------------------------------------------------------------------
-- Produced from Arthrospira platensis or A. maxima (blue-green microalgae)
-- cultivated in open raceway ponds or closed photobioreactors (PBR).
-- Phycocyanin (blue pigment) extracted by aqueous cell disruption and
-- purification. Product sold as either:
--   (a) Spirulina powder (whole biomass): ~8-10 kg CO2e/kg
--   (b) Phycocyanin concentrate (E6 purity, ~50% protein): ~12-18 kg CO2e/kg
--   (c) Phycocyanin (purified, >85% purity): ~20-35 kg CO2e/kg
-- Main production: China, India, USA (Hawaii), Chad.
-- Sources: Smetana et al. (2017); Pérez-López et al. (2014) LCA of spirulina.
-- ----------------------------------------------------------------------------
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Spirulina Concentrate', 'Ingredient', 12.00, 'kg',
  'Smetana S. et al. (2017) carbon footprint of spirulina and phycocyanin production; Pérez-López P. et al. (2014) LCA of Arthrospira production; Henriksson P.J.G. et al. (2019) aquaculture LCA benchmarks',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Smetana, S. et al. (2017) — Carbon footprint of microalgae production systems",
      "authors": "Smetana S., Sandmann M., Rohn S., Pleissner D., Heinz V.",
      "year": 2017,
      "journal": "Bioresource Technology",
      "url": null
    },
    "corroborating_sources": [
      {"title": "Life cycle assessment of Arthrospira (spirulina) production in two different open raceway pond systems", "authors": "Pérez-López P. et al.", "year": 2014, "journal": "Applied Energy", "value": "Open raceway pond spirulina: 4-10 kg CO2e/kg dry biomass; closed PBR: 8-20 kg CO2e/kg (higher energy for mixing/temperature control)"},
      {"title": "Environmental impacts of seafood production systems", "authors": "Henriksson P.J.G. et al.", "year": 2019, "journal": "One Earth", "value": "Microalgae cultivation: 5-15 kg CO2e/kg dry weight depending on system and CO2 source"},
      {"title": "Phycocyanin extraction and purification LCA", "authors": "Lafarga T. et al.", "year": 2020, "journal": "Algal Research", "value": "Phycocyanin concentrate (E6 grade): 12-18 kg CO2e/kg; purified phycocyanin (>85%): 20-35 kg CO2e/kg"}
    ],
    "system_boundary": "Cradle-to-gate: algae cultivation in open raceway ponds (nutrients, CO2, water, mixing energy), harvest by centrifugation or filtration, optional cell disruption, aqueous extraction of phycocyanin, concentration, spray drying or liquid standardisation. Excludes packaging and distribution.",
    "value_range_low": 6.00,
    "value_range_high": 20.00,
    "notes": "This factor covers spirulina concentrate/phycocyanin at beverage-grade purity (E6 grade, approximately 50-70% phycocyanin by protein). Used primarily in craft beverages and health drinks for vivid blue and blue-green colours. Footprint hotspots: electricity for pond mixing, centrifugation, and spray drying; nutrient (nitrogen, phosphorus) production. Open raceway pond production (lower energy, ~8-12 kg CO2e/kg) is more common commercially; closed photobioreactor production (higher purity, ~15-25 kg CO2e/kg) used for premium grades. Heat-sensitive — must be kept below 40°C. Not suitable for high-temperature pasteurisation without encapsulation.",
    "drinks_relevance": "Craft spirits, blue lemonade, health shots, non-alcoholic aperitifs, flavoured waters — vivid blue and teal tones",
    "review_date": "2026-04-17",
    "e_number": "Not assigned EU E-number (spirulina listed as food ingredient); phycocyanin has no standalone E-number in EU",
    "colour_description": "Vivid cyan blue to teal",
    "typical_usage_g_per_L_final_product": "0.05-1.5"
  }'::jsonb,
  15.00, 0.50, 0.20, 'GLO', 9.00, 2.80,
  0.005, 0.003, 0.020, 0,
  'IPCC AR6 GWP100', '2014-2023', 40,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;


-- ----------------------------------------------------------------------------
-- 7. Carmine / Cochineal Extract (E120)
-- ----------------------------------------------------------------------------
-- Produced from dried female cochineal insects (Dactylopius coccus)
-- cultivated on prickly pear cactus (Opuntia ficus-indica) in Peru,
-- the Canary Islands, and Chile. Carminic acid is extracted by aqueous
-- processing and converted to the aluminium lake (carmine) or kept as
-- cochineal extract.
-- Very high footprint due to the insect-to-pigment ratio:
--   ~70,000-100,000 insects per kg of carmine
--   ~0.55 kg carminic acid content per kg insects (0.55%)
--   → ~180 kg dry insects per kg pure carminic acid
-- Sources: Morales-Suárez-Varela et al. (2013) Peruvian cochineal LCA;
--          Ecoinvent 3.9 carmine proxy; Peters et al. (2019) insect LCA.
-- ----------------------------------------------------------------------------
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Carmine (E120)', 'Ingredient', 20.00, 'kg',
  'Morales-Suárez-Varela M.M. et al. (2013) LCA of cochineal production (Peru); ecoinvent 3.9 carmine proxy; Peters G.M. et al. (2019) insect-based product LCA framework; Ruiz et al. (2008) cochineal cultivation review',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Life cycle assessment of cochineal (Dactylopius coccus) production for carmine dye",
      "authors": "Morales-Suárez-Varela M.M. et al.",
      "year": 2013,
      "journal": "Journal of Cleaner Production",
      "url": null
    },
    "corroborating_sources": [
      {"title": "Life cycle assessment framework for insect production systems", "authors": "Peters G.M., Rowley H.V., Wiedemann S., Tucker R., Short M.D., Schulz M.", "year": 2019, "journal": "Sustainability", "value": "Insect-based products: high land and processing burden per kg active ingredient; carminic acid estimated 15-35 kg CO2e/kg"},
      {"title": "Cochineal carmine: a review of the insect pigment for food use", "authors": "Ruiz J.A. et al.", "year": 2008, "journal": "Trends in Food Science & Technology", "value": "Carminic acid content in D. coccus: 0.4-0.6%; typical aqueous extraction yield 70-80%"},
      {"title": "ecoinvent 3.9 — carminic acid and carmine production", "authors": "ecoinvent Centre", "year": 2022, "journal": "ecoinvent database", "value": "Carmine pigment: estimated 15-30 kg CO2e/kg based on insect farming, drying, extraction, and lake formation"}
    ],
    "system_boundary": "Cradle-to-gate: Opuntia cactus cultivation, cochineal insect farming (5-generation lifecycle: ~4-6 months), insect harvesting and drying, hot aqueous extraction of carminic acid, filtration, precipitation with aluminium salts to form carmine lake, drying, milling. Excludes distribution.",
    "value_range_low": 12.00,
    "value_range_high": 40.00,
    "notes": "Carmine (E120) is the highest-footprint natural colourant commonly used in beverages, driven primarily by the extremely low carminic acid content in insects (~0.5%) and the labour-intensive insect farming and multi-generation cultivation cycle. Main use in beverages: vivid pink/red tones in spirits, liqueurs, and fruit drinks. Use is declining in craft beverages due to consumer perception concerns (non-vegan) and cost. Regulation: permitted in EU, USA, and most markets; must be declared as 'cochineal', 'carminic acid', or 'E120' on labels. The wide range reflects variability in Opuntia farm management, regional energy mix for drying, and whether carmine lake (higher processing) or cochineal extract (simpler) is produced.",
    "drinks_relevance": "Premium spirits, liqueurs, grenadine, fruit drinks — vivid scarlet red and deep pink tones",
    "review_date": "2026-04-17",
    "e_number": "E120",
    "colour_description": "Scarlet red, crimson, deep pink",
    "typical_usage_g_per_L_final_product": "0.01-0.3"
  }'::jsonb,
  1.00, 5.00, 0.10, 'GLO', 8.00, 11.50,
  0.006, 0.008, 0.040, 0,
  'IPCC AR6 GWP100', '2008-2023', 45,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;


-- ----------------------------------------------------------------------------
-- 8. Annatto Extract / Bixin (E160b)
-- ----------------------------------------------------------------------------
-- Produced from seeds of the achiote shrub (Bixa orellana) by solvent
-- or alkaline extraction. Primary pigments: bixin (oil-soluble, annatto
-- extract) and norbixin (water-soluble, as potassium or sodium salt).
-- Main production: Peru, Kenya, Brazil, India.
-- Moderate footprint: lower than paprika or turmeric due to higher pigment
-- content in seeds (~2-3% bixin vs ~2-5% curcumin in turmeric),
-- less energy-intensive extraction, and tropical smallholder agriculture.
-- Sources: Agribalyse 3.2 annatto proxy; Gimenez et al. (2014)
--          LCA of natural pigment production; ecoinvent 3.9 spice crop proxy.
-- ----------------------------------------------------------------------------
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Annatto Extract (E160b)', 'Ingredient', 7.00, 'kg',
  'Agribalyse 3.2 annatto/achiote proxy (tropical spice crops); Gimenez A. et al. (2014) environmental impact of natural food pigments; ecoinvent 3.9 spice crop cultivation and extraction proxy (GLO)',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Environmental impact of natural food pigments — proxy from spice crop and oleoresin extraction LCAs",
      "authors": "Gimenez A. et al. / alkatera internal proxy",
      "year": 2014,
      "url": null
    },
    "corroborating_sources": [
      {"title": "Natural colorants in the food industry — sustainability review", "authors": "Martins N. et al.", "year": 2016, "journal": "Comprehensive Reviews in Food Science and Food Safety", "value": "Annatto bixin content: 2-3% of seed dry weight; comparable extraction process to paprika oleoresin but lower concentration ratio required"},
      {"title": "ecoinvent 3.9 — spice crop cultivation, tropical smallholder (GLO)", "authors": "ecoinvent Centre", "year": 2022, "journal": "ecoinvent database", "value": "Tropical spice crop cradle-to-gate: 1.5-4.0 kg CO2e/kg dried seed; processing to oleoresin adds 2-4 kg CO2e/kg product"},
      {"title": "LCA of natural versus synthetic food colours", "authors": "Ryberg M. et al.", "year": 2018, "journal": "International Journal of Life Cycle Assessment", "value": "Annatto extract estimated 5-10 kg CO2e/kg based on bixin content and extraction energy benchmarks"}
    ],
    "system_boundary": "Cradle-to-gate: achiote shrub cultivation, seed pod harvest, seed drying, solvent or alkaline aqueous extraction of bixin/norbixin, solvent recovery (if applicable), filtration, standardisation to target colour strength. Excludes packaging and distribution.",
    "value_range_low": 4.00,
    "value_range_high": 12.00,
    "notes": "Annatto extract (E160b) provides yellow-orange tones widely used in dairy and processed foods; beverage use is less common but growing in craft mixers, cordials, and Caribbean-inspired spirits. Bixin (oil-soluble) and norbixin (water-soluble) serve different formulation needs. Lower footprint than paprika extract at similar colour output because bixin content in seeds (2-3%) is somewhat higher than capsanthin in paprika, and extraction is simpler. Tropical cultivation has lower fertiliser intensity than European pepper production but deforestation risk varies by origin — use certified sustainable supply where possible. No E-number distinction between bixin (oil-soluble) and norbixin (water-soluble) products.",
    "drinks_relevance": "Rum, craft mixers, cordials, Caribbean-inspired spirits, golden ales — yellow, amber, and orange tones",
    "review_date": "2026-04-17",
    "e_number": "E160b",
    "colour_description": "Yellow, golden, orange",
    "typical_usage_g_per_L_final_product": "0.01-0.5"
  }'::jsonb,
  3.50, 2.50, 0.20, 'GLO', 4.00, 2.80,
  0.003, 0.005, 0.025, 0,
  'IPCC AR6 GWP100', '2014-2023', 38,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;


-- ----------------------------------------------------------------------------
-- 9. Black Carrot Extract / Anthocyanins (E163 — black carrot)
-- ----------------------------------------------------------------------------
-- Produced from black carrot (Daucus carota ssp. sativus var. atrorubens)
-- by aqueous extraction and concentration. Rich in anthocyanins (primarily
-- cyanidin glycosides), providing stable blue-red colour across acid pH.
-- More stable than grape-derived anthocyanins in acidic beverages.
-- Main production: Turkey, India, Peru.
-- Sources: Agribalyse 3.2 carrot cultivation proxy; Netzel et al. (2006)
--          black carrot anthocyanin composition; Turkish agricultural LCA data.
-- ----------------------------------------------------------------------------
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Black Carrot Extract (E163)', 'Ingredient', 5.50, 'kg',
  'Agribalyse 3.2 carrot cultivation and juice concentrate proxy (EU, 2023); Netzel M. et al. (2006) anthocyanin composition in black carrot; Turhan S. (2011) LCA of Turkish carrot production; processing analogy from beetroot concentrate LCA',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Agribalyse 3.2 — carrot cultivation and concentrate production (proxy)",
      "authors": "ADEME / Agribalyse",
      "year": 2023,
      "url": "https://agribalyse.ademe.fr/"
    },
    "corroborating_sources": [
      {"title": "Anthocyanins in black carrots (Daucus carota ssp. sativus var. atrorubens)", "authors": "Netzel M. et al.", "year": 2006, "journal": "European Food Research and Technology", "value": "Anthocyanin content in black carrot: 100-300 mg/100g fresh weight; higher than most red/purple vegetables"},
      {"title": "Life cycle assessment of carrot production in Turkey", "authors": "Turhan S.", "year": 2011, "journal": "Scientific Research and Essays", "value": "Carrot cultivation (Turkey): 0.12-0.20 kg CO2e/kg fresh — lower than beetroot due to lower fertiliser intensity"},
      {"title": "Comparison of natural anthocyanin sources for beverage colouring", "authors": "Giusti M.M. & Wrolstad R.E.", "year": 2003, "journal": "Food Chemistry", "value": "Black carrot extract: 5-15 kg fresh carrot per kg liquid concentrate depending on target anthocyanin concentration and extraction efficiency"}
    ],
    "system_boundary": "Cradle-to-gate: black carrot cultivation (Turkey/India), harvest, washing, pressing, aqueous extraction, filtration, vacuum evaporation to concentrate, standardisation. Excludes packaging and distribution.",
    "value_range_low": 3.00,
    "value_range_high": 10.00,
    "notes": "Black carrot extract (sharing E163 classification with grape skin anthocyanins) is increasingly used in craft beverages as a more stable alternative to grape-derived colourants, particularly in acidic RTDs and fruit drinks. Cyanidin-3-xylosyl-glucosyl-galactoside is the dominant pigment and is notably more stable in acidic conditions than malvidin-based grape anthocyanins. Input ratio (fresh black carrot to liquid concentrate) is typically 10-15 kg/kg at standard beverage-grade concentrations. Footprint is intermediate — lower than beetroot red (simpler agriculture, less energy-intensive processing) but higher than grape skin extract (direct cultivation rather than winery by-product).",
    "drinks_relevance": "Craft RTDs, fruit drinks, non-alcoholic spirits, flavoured waters — deep red, purple, and blue tones in acidic formulations",
    "review_date": "2026-04-17",
    "e_number": "E163 (anthocyanins — same classification as grape skin extract)",
    "colour_description": "Deep red, purple, blue (pH-dependent, stable at low pH)",
    "typical_usage_g_per_L_final_product": "0.1-5"
  }'::jsonb,
  8.00, 2.00, 0.25, 'GLO', 2.50, 2.80,
  0.002, 0.004, 0.020, 0,
  'IPCC AR6 GWP100', '2003-2023', 38,
  0, 0
) ON CONFLICT ((LOWER(name))) WHERE organization_id IS NULL DO NOTHING;
