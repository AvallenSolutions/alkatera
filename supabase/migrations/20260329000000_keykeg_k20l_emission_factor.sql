-- Add emission factor for KeyKeg K* 20L one-way PET keg
-- Used as a packaging proxy for customers using KeyKeg containers
--
-- KeyKeg K* 20L specifications:
--   Tare weight: 0.96 kg (960g)
--   Material: PET outer shell (~80%), recycled PP grip rings & basecup (~15%), laminated inner bag (~5%)
--   Recycled content: up to 57% rPET (OnePET blend), 100% recycled PP for grip/basecup
--   Recyclability: 86% per ISO 18604
--   Technology: Double-Wall™, Bag-in-Keg™ (one-way/single-use)
--   Manufacturer: OneCircle (formerly Lightweight Containers), Netherlands
--
-- Emission factor derivation:
--   PET body (~80% of mass): blended virgin/rPET at ~50% recycled content
--     Virgin PET: 2.15 kg CO2e/kg (NAPCOR 2023, ecoinvent 3.12)
--     rPET: 0.45 kg CO2e/kg (PET Recycling Team/ALPLA 2023)
--     Blended: ~1.30 kg CO2e/kg + ~0.20 for blow moulding = ~1.50 kg CO2e/kg
--   PP grip/basecup (~15%): 100% recycled PP ~0.60 kg CO2e/kg
--   Inner bag film (~5%): multi-layer laminate ~2.75 kg CO2e/kg
--   Weighted average: (0.80 × 1.50) + (0.15 × 0.60) + (0.05 × 2.75) = ~1.43 kg CO2e/kg
--   Rounded to 1.45 kg CO2e/kg (conservative, includes assembly)
--
-- Sources:
--   KeyKeg technical specification sheet (keykeg.com)
--   KeyKeg sustainability data (keykeg.com/benefits/sustainable-kegs/)
--   ecoinvent 3.12 (PET granulate production, blow moulding)
--   NAPCOR PET LCA Report 2023
--   PET Recycling Team/ALPLA CO2 balance data 2023
--   ACC Cradle-to-Gate LCA of PP Resin
-- ================================================

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
  'KeyKeg K* 20L (PET, ~50% recycled)',
  'Packaging',
  1.45,
  'kg',
  'KeyKeg technical specs; ecoinvent 3.12 (PET granulate, blow moulding); NAPCOR PET LCA 2023; PET Recycling Team/ALPLA 2023; ACC PP Resin LCA',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "PET granulate production, amorphous, recycled content blend",
      "authors": "ecoinvent Centre; NAPCOR; PET Recycling Team",
      "year": 2024,
      "database": "ecoinvent 3.12 + literature composite"
    },
    "corroborating_sources": [
      {"title": "PET Life Cycle Assessment Report", "authors": "NAPCOR (National Association for PET Container Resources)", "year": 2023},
      {"title": "Excellent CO2 Balance — rPET vs virgin PET", "authors": "PET Recycling Team / ALPLA Group", "year": 2023},
      {"title": "Cradle-to-Gate Life Cycle Analysis of Polypropylene Resin", "authors": "American Chemistry Council (ACC)", "year": 2021},
      {"title": "Identifying the most sustainable beer packaging through a Life Cycle Assessment", "authors": "ScienceDirect", "year": 2024}
    ],
    "system_boundary": "Cradle-to-gate: PET resin production (virgin + rPET blend), PP recycled resin, multi-layer film laminate, blow moulding, assembly of bag-in-keg system",
    "value_range_low": 1.20,
    "value_range_high": 1.75,
    "drinks_relevance": "One-way 20L PET keg for draught beer, cider, wine, cocktails. KeyKeg K* uses Bag-in-Keg technology — beverage in inner bag, pressurised gas in outer shell. Tare weight 0.96 kg. Single-use but 86% recyclable (ISO 18604). Replaces traditional steel kegs for small/medium producers without return logistics.",
    "notes": "Composite emission factor for full keg assembly: ~80% PET (OnePET blend with up to 57% rPET, conservatively modelled at 50%), ~15% recycled PP (grip rings, basecup), ~5% multi-layer laminate inner bag. Factor assumes European manufacturing (Netherlands). KeyKeg global collection network recovers kegs for recycling into new kegs. Users should set packaging_category=container, net_weight_g=960, recycled_content_percentage=50.",
    "product_specs": {
      "manufacturer": "OneCircle (KeyKeg)",
      "product": "KeyKeg K* 20L",
      "tare_weight_g": 960,
      "capacity_l": 20,
      "materials": ["PET (outer shell)", "rPP (grip rings, basecup)", "laminated film (inner bag)"],
      "recyclability_percent": 86,
      "recycled_content_percent": 50,
      "technology": "Double-Wall, Bag-in-Keg",
      "one_way": true,
      "pressure_rating_bar": 7
    }
  }'::jsonb,
  0.025, 0.003, 0.08,
  1.38, 0.07,
  0.05, 0.0008, 0.012, 0.035, 0.045, 0.00005,
  'EU', 'IPCC AR6 GWP100', 55
)
ON CONFLICT DO NOTHING;

-- ================================================
-- SUMMARY:
-- KeyKeg K* 20L (PET, ~50% recycled) — 1.45 kg CO2e/kg
--   Tare weight: 0.96 kg → ~1.39 kg CO2e per keg
--   Packaging category: container
--   One-way PET keg with Bag-in-Keg technology
--   86% recyclable, ~50% recycled content
--   Confidence: 55 (composite literature estimate, no product-specific EPD)
-- ================================================
