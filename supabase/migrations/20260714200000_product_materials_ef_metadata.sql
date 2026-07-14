-- Persist the emission-factor quality metadata the ingredient form already
-- carries (ef_source, ef_data_quality_grade, ef_uncertainty_percent,
-- ef_reference_unit). Only ef_source_type existed, so on reload the factor
-- quality tooltip emptied and the mass-vs-count unit-mismatch check disarmed.

alter table public.product_materials
  add column if not exists ef_source text,
  add column if not exists ef_data_quality_grade text,
  add column if not exists ef_uncertainty_percent numeric,
  add column if not exists ef_reference_unit text;

comment on column public.product_materials.ef_reference_unit is
  'The matched emission factor''s reference unit (e.g. kg, item); used to warn on count-vs-mass mismatches.';
