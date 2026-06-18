-- FLAG v1.2 compliance: Add LUC (land use change) fields to vineyards table
-- FLAG-C3 requires dLUC emissions using 20-year assessment period with linear discounting
-- These fields describe the land itself, not a vintage, so they live on the vineyard record

ALTER TABLE public.vineyards
  ADD COLUMN previous_land_use_type text
    CHECK (previous_land_use_type IS NULL OR previous_land_use_type IN (
      'permanent_vineyard', 'grassland', 'forest', 'arable',
      'wetland', 'settlement', 'other_land'
    )),
  ADD COLUMN land_conversion_year integer
    CHECK (land_conversion_year IS NULL OR (land_conversion_year >= 1900 AND land_conversion_year <= 2100));

COMMENT ON COLUMN public.vineyards.previous_land_use_type IS 'Land use before vineyard establishment, for FLAG dLUC calculation';
COMMENT ON COLUMN public.vineyards.land_conversion_year IS 'Year land was converted to vineyard, for 20-year LUC amortisation';
