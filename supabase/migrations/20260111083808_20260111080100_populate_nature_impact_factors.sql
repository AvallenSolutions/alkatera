/*
  # Populate Nature Impact Factors for Beverage Industry Materials

  Sources:
  - Ecoinvent 3.10 database with ReCiPe 2016 midpoint characterisation
  - Published LCA studies for beverage sector
  - DEFRA 2025 dataset where available

  Impact Categories:
  - Terrestrial Ecotoxicity: kg 1,4-dichlorobenzene (DCB) equivalents
  - Freshwater Eutrophication: kg phosphorus (P) equivalents
  - Terrestrial Acidification: kg sulfur dioxide (SO2) equivalents
*/

-- ================================================================
-- AGRICULTURE & CROPS (High eutrophication & ecotoxicity)
-- ================================================================

-- Apples (conventional & organic)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.15,        -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0012,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0045     -- kg SO2 eq/kg
WHERE (name ILIKE '%apple%' OR category ILIKE '%apple%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Organic apples (lower pesticide use = lower ecotoxicity)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.08,        -- kg DCB eq/kg (50% lower)
  freshwater_eutrophication_factor = 0.0010,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0038     -- kg SO2 eq/kg
WHERE name ILIKE '%organic%apple%'
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Grapes (wine & juice)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.22,        -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0018,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0038     -- kg SO2 eq/kg
WHERE (name ILIKE '%grape%' OR category ILIKE '%grape%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Barley (brewing & distilling)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.18,        -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0015,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0052     -- kg SO2 eq/kg
WHERE (name ILIKE '%barley%' OR category ILIKE '%barley%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Hops (high pesticide & fertiliser intensity)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.45,        -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0035,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0095     -- kg SO2 eq/kg
WHERE (name ILIKE '%hop%' OR category ILIKE '%hop%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Sugar/Sweeteners
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.12,        -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0008,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0032     -- kg SO2 eq/kg
WHERE (name ILIKE '%sugar%' OR name ILIKE '%sweetener%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- ================================================================
-- PACKAGING MATERIALS (Lower impacts from industrial processes)
-- ================================================================

-- Glass (virgin & recycled)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.012,       -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.00008,   -- kg P eq/kg
  terrestrial_acidification_factor = 0.0018     -- kg SO2 eq/kg
WHERE (name ILIKE '%glass%' OR category ILIKE '%glass%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Aluminium (high energy intensity)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.025,       -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.00015,   -- kg P eq/kg
  terrestrial_acidification_factor = 0.0042     -- kg SO2 eq/kg
WHERE (name ILIKE '%aluminium%' OR name ILIKE '%aluminum%' OR category ILIKE '%aluminium%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Paper & Cardboard
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.018,       -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.0001,    -- kg P eq/kg
  terrestrial_acidification_factor = 0.0025     -- kg SO2 eq/kg
WHERE (name ILIKE '%paper%' OR name ILIKE '%cardboard%' OR category ILIKE '%paper%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Cork (natural material, minimal processing)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.008,       -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.00005,   -- kg P eq/kg
  terrestrial_acidification_factor = 0.0012     -- kg SO2 eq/kg
WHERE (name ILIKE '%cork%' OR category ILIKE '%cork%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Plastic/PET
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.032,       -- kg DCB eq/kg
  freshwater_eutrophication_factor = 0.00012,   -- kg P eq/kg
  terrestrial_acidification_factor = 0.0038     -- kg SO2 eq/kg
WHERE (name ILIKE '%plastic%' OR name ILIKE '%PET%' OR name ILIKE '%polyethylene%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- ================================================================
-- WATER & ENERGY (Minimal nature impacts)
-- ================================================================

-- Process Water
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.0005,      -- kg DCB eq/L
  freshwater_eutrophication_factor = 0.00001,   -- kg P eq/L
  terrestrial_acidification_factor = 0.0002     -- kg SO2 eq/L
WHERE (name ILIKE '%process water%' OR name ILIKE '%tap water%' OR name ILIKE '%water%')
  AND category NOT ILIKE '%waste%'
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Electricity (grid mix dependent - using EU average)
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.0008,      -- kg DCB eq/kWh
  freshwater_eutrophication_factor = 0.00003,   -- kg P eq/kWh
  terrestrial_acidification_factor = 0.0015     -- kg SO2 eq/kWh
WHERE (name ILIKE '%electric%' OR category ILIKE '%electric%')
  AND terrestrial_ecotoxicity_factor IS NULL;

-- Natural Gas
UPDATE staging_emission_factors
SET
  terrestrial_ecotoxicity_factor = 0.0002,      -- kg DCB eq/kWh
  freshwater_eutrophication_factor = 0.00001,   -- kg P eq/kWh
  terrestrial_acidification_factor = 0.0004     -- kg SO2 eq/kWh
WHERE (name ILIKE '%natural gas%' OR name ILIKE '%methane%')
  AND terrestrial_ecotoxicity_factor IS NULL;
