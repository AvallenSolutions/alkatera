-- ============================================================================
-- Maturation: ABV dilution + warehouse country
-- ============================================================================
-- Adds three new nullable columns that make per-bottle maturation allocation
-- accurate for aged spirits:
--
--   1. products.alcohol_content_abv         - bottled strength (e.g. 46.0)
--   2. maturation_profiles.cask_fill_abv_percent   - cask-fill strength (e.g. 63.5)
--   3. maturation_profiles.warehouse_country_code  - ISO2 for grid factor
--
-- Background: Spirits are typically cask-filled at ~63% ABV (Scotch, bourbon)
-- and diluted to ~40-46% at bottling. Water addition inflates the bottled
-- volume by (cask_abv / bottle_abv). Before this migration the calculator
-- divided cask-strength volume by bottle size, under-counting bottle yield
-- by 40-75% and over-stating per-bottle maturation CO2e by the same factor.
--
-- All columns are nullable. Runtime fallbacks:
--   - alcohol_content_abv  -> product_category default -> 40 percent
--   - cask_fill_abv_percent -> product_category default -> 63 percent
--   - warehouse_country_code -> primary facility country -> global grid average
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. products.alcohol_content_abv
-- ----------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS alcohol_content_abv numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_alcohol_content_abv_range'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_alcohol_content_abv_range
      CHECK (alcohol_content_abv IS NULL OR (alcohol_content_abv >= 0 AND alcohol_content_abv <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.products.alcohol_content_abv IS
  'Bottled alcohol strength as percent (e.g. 46.0). Drives per-bottle allocation of maturation impacts: water added at bottling inflates bottle count by (cask_abv / bottle_abv). NULL falls back to product-category default then 40%.';

-- ----------------------------------------------------------------------------
-- 2. maturation_profiles.cask_fill_abv_percent
-- ----------------------------------------------------------------------------
ALTER TABLE public.maturation_profiles
  ADD COLUMN IF NOT EXISTS cask_fill_abv_percent numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mp_cask_fill_abv_range'
  ) THEN
    ALTER TABLE public.maturation_profiles
      ADD CONSTRAINT mp_cask_fill_abv_range
      CHECK (cask_fill_abv_percent IS NULL OR (cask_fill_abv_percent >= 0 AND cask_fill_abv_percent <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.maturation_profiles.cask_fill_abv_percent IS
  'Alcohol strength at cask fill, before dilution at bottling. Typical values: Scotch 63.5, bourbon 62.5, cognac 70, rum 65. NULL falls back to product-category default then 63%.';

-- ----------------------------------------------------------------------------
-- 3. maturation_profiles.warehouse_country_code
-- ----------------------------------------------------------------------------
ALTER TABLE public.maturation_profiles
  ADD COLUMN IF NOT EXISTS warehouse_country_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mp_warehouse_country_iso2'
  ) THEN
    ALTER TABLE public.maturation_profiles
      ADD CONSTRAINT mp_warehouse_country_iso2
      CHECK (warehouse_country_code IS NULL OR char_length(warehouse_country_code) = 2);
  END IF;
END $$;

COMMENT ON COLUMN public.maturation_profiles.warehouse_country_code IS
  'ISO 3166-1 alpha-2 country code for the maturation warehouse. Drives the electricity grid emission factor for warehouse_energy. NULL falls back to primary facility country then global average.';
