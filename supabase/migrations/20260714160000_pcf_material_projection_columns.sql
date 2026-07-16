-- Carry circularity/identity fields from product_materials onto the PCF material
-- projection so the aggregator's end-of-life loop and material classification can
-- read them (previously reuse amortisation applied to production but full mass was
-- disposed at EoL, and classification degraded to name-keyword inference).
-- source_material_id links each projected row back to the product_materials row it
-- was calculated from, giving the EoL wizard a stable key for pathway overrides.

alter table public.product_carbon_footprint_materials
  add column if not exists source_material_id uuid references public.product_materials(id) on delete set null,
  add column if not exists reuse_trips integer,
  add column if not exists recyclability_percent numeric(5,2),
  add column if not exists container_material text,
  add column if not exists matched_source_name text;

create index if not exists idx_pcf_materials_source_material_id
  on public.product_carbon_footprint_materials (source_material_id)
  where source_material_id is not null;

comment on column public.product_carbon_footprint_materials.source_material_id is
  'The product_materials row this projection was calculated from; stable key for EoL pathway overrides.';
comment on column public.product_carbon_footprint_materials.reuse_trips is
  'Copied from product_materials at calculation time so EoL disposal can amortise reusable containers.';
