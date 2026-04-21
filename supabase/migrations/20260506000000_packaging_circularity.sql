-- Packaging circularity: first-class reuse + end-of-life fields.
--
-- Motivation:
--   `importBrewwPackaging` used to divide container weight by `expected_trips`
--   at import time and record the fact in the notes field. That broke the
--   audit trail (you saw a 90 g firkin instead of 9000 g amortised over 100
--   trips) and prevented the UI from showing reuse as a first-class property.
--
-- After this migration:
--   * `quantity` stores the *actual* container weight
--   * `reuse_trips` stores how many times the container is reused
--   * LCA calc divides by `reuse_trips` at calculation time, same pattern as
--     `units_per_group` for shared packaging
--   * UI surfaces a Circularity section per packaging row

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS reuse_trips integer,
  ADD COLUMN IF NOT EXISTS end_of_life_pathway text,
  ADD COLUMN IF NOT EXISTS recyclability_percent numeric(5, 2),
  ADD COLUMN IF NOT EXISTS biobased_content_percentage numeric(5, 2);

-- Reuse count must be positive if set.
ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS product_materials_reuse_trips_check;
ALTER TABLE public.product_materials
  ADD CONSTRAINT product_materials_reuse_trips_check
  CHECK (reuse_trips IS NULL OR reuse_trips >= 1);

-- End-of-life taxonomy.
ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS product_materials_end_of_life_pathway_check;
ALTER TABLE public.product_materials
  ADD CONSTRAINT product_materials_end_of_life_pathway_check
  CHECK (
    end_of_life_pathway IS NULL OR end_of_life_pathway IN (
      'landfill',
      'incineration',
      'recycling',
      'composting',
      'reuse',
      'unknown'
    )
  );

-- Recyclability / bio-based are 0-100 percentages.
ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS product_materials_recyclability_percent_check;
ALTER TABLE public.product_materials
  ADD CONSTRAINT product_materials_recyclability_percent_check
  CHECK (recyclability_percent IS NULL OR (recyclability_percent >= 0 AND recyclability_percent <= 100));

ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS product_materials_biobased_content_percentage_check;
ALTER TABLE public.product_materials
  ADD CONSTRAINT product_materials_biobased_content_percentage_check
  CHECK (biobased_content_percentage IS NULL OR (biobased_content_percentage >= 0 AND biobased_content_percentage <= 100));

-- ─── Backfill reuse_trips from legacy Breww notes ────────────────────────────
-- Prior imports stored reuse as "Amortised across N trips (reusable)" in notes.
-- Parse that and lift it into reuse_trips, then restore the original weight by
-- multiplying the amortised value back up. Requires the source data to be
-- intact; only runs where reuse_trips is currently NULL.

UPDATE public.product_materials
SET
  reuse_trips = (regexp_match(notes, 'Amortised across ([0-9]+) trips'))[1]::int,
  quantity = quantity * (regexp_match(notes, 'Amortised across ([0-9]+) trips'))[1]::int,
  notes = regexp_replace(notes, '\s*·?\s*Amortised across [0-9]+ trips \(reusable\)', '', 'g')
WHERE reuse_trips IS NULL
  AND notes ~ 'Amortised across [0-9]+ trips';

-- ─── Drop legacy duplicate column ────────────────────────────────────────────
-- `recycled_content_percent` (DEFAULT 0) shipped before `recycled_content_percentage`
-- and has never been consumed by the calc. Copy any non-zero values forward,
-- then drop.

UPDATE public.product_materials
SET recycled_content_percentage = recycled_content_percent
WHERE recycled_content_percentage IS NULL
  AND recycled_content_percent IS NOT NULL
  AND recycled_content_percent > 0;

ALTER TABLE public.product_materials
  DROP COLUMN IF EXISTS recycled_content_percent;
