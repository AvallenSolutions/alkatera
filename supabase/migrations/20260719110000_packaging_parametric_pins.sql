-- Parametric packaging: pin columns + data_source vocabulary extension.
--
-- product_carbon_footprint_materials gains the calculation-time pin: which
-- endpoint row and library version produced the factor, the allocation method
-- used at end-of-life, and a self-contained factor_derivation JSON so reports
-- can show the full derivation with zero extra fetches and stay stable even if
-- the endpoint library is later updated.
--
-- product_materials (the editable BOM) gains only the material identity
-- (class + variant): the BOM expresses what the material IS; the calculator
-- resolves against the active library at calc time and pins on the snapshot.
--
-- Both tables' data_source CHECK constraints are extended with 'parametric'.

-- ---------------------------------------------------------------------------
-- Snapshot table: product_carbon_footprint_materials
-- ---------------------------------------------------------------------------

alter table public.product_carbon_footprint_materials
  add column if not exists packaging_material_class text,
  add column if not exists packaging_material_variant text,
  add column if not exists packaging_endpoint_id uuid references public.packaging_factor_endpoints(id),
  add column if not exists packaging_library_version integer,
  add column if not exists eol_allocation_method text,
  add column if not exists factor_derivation jsonb;

alter table public.product_carbon_footprint_materials
  drop constraint if exists pcf_materials_eol_allocation_method_check;
alter table public.product_carbon_footprint_materials
  add constraint pcf_materials_eol_allocation_method_check
  check (eol_allocation_method is null or eol_allocation_method in ('cut-off', 'avoided-burden', '50:50'));

comment on column public.product_carbon_footprint_materials.packaging_material_class is
  'Controlled packaging material class (lib/constants/packaging-material-classes.ts) pinned at calculation time.';
comment on column public.product_carbon_footprint_materials.packaging_endpoint_id is
  'The packaging_factor_endpoints row the factor was derived from. With packaging_library_version, makes the calculation reproducible after library updates.';
comment on column public.product_carbon_footprint_materials.eol_allocation_method is
  'End-of-life allocation applied to this row: cut-off (no recycling credit; default) or avoided-burden (legacy opt-in).';
comment on column public.product_carbon_footprint_materials.factor_derivation is
  'Self-contained derivation record: {virgin_climate, recycled_climate, r, derived_ef_climate, dataset, dataset_version, system_model, region, library_version}. Rendered verbatim in reports.';

-- Extend data_source vocabulary with 'parametric'.
alter table public.product_carbon_footprint_materials
  drop constraint if exists valid_data_source;
alter table public.product_carbon_footprint_materials
  add constraint valid_data_source
  check (data_source is null or data_source = any (array[
    'openlca'::text, 'supplier'::text, 'breww_recipe_avg'::text,
    'breww_sku_container'::text, 'unleashed_bom'::text, 'parametric'::text
  ]));

alter table public.product_carbon_footprint_materials
  drop constraint if exists data_source_integrity;
alter table public.product_carbon_footprint_materials
  add constraint data_source_integrity
  check (
    ((data_source = 'openlca'::text) and (data_source_id is not null))
    or ((data_source = 'supplier'::text) and (supplier_product_id is not null))
    or ((data_source = 'breww_recipe_avg'::text) and (data_source_id is not null))
    or (data_source = 'breww_sku_container'::text)
    or ((data_source = 'unleashed_bom'::text) and (data_source_id is not null))
    or ((data_source = 'parametric'::text) and (packaging_endpoint_id is not null))
    or (data_source is null)
  );

-- ---------------------------------------------------------------------------
-- Editable BOM: product_materials
-- ---------------------------------------------------------------------------

alter table public.product_materials
  add column if not exists packaging_material_class text,
  add column if not exists packaging_material_variant text;

comment on column public.product_materials.packaging_material_class is
  'Controlled packaging material class chosen by the user (or Phase 3 mapping). Parametric factor derivation replaces factor search when set.';
comment on column public.product_materials.packaging_material_variant is
  'Material variant where it moves the factor (e.g. glass colour flint/green/amber).';

alter table public.product_materials
  drop constraint if exists valid_data_source;
alter table public.product_materials
  add constraint valid_data_source
  check (data_source is null or data_source = any (array[
    'openlca'::text, 'supplier'::text, 'breww_recipe_avg'::text,
    'breww_sku_container'::text, 'unleashed_bom'::text, 'parametric'::text
  ]));

alter table public.product_materials
  drop constraint if exists data_source_integrity;
alter table public.product_materials
  add constraint data_source_integrity
  check (
    ((data_source = 'openlca'::text) and (data_source_id is not null))
    or ((data_source = 'supplier'::text) and (supplier_product_id is not null))
    or ((data_source = 'breww_recipe_avg'::text) and (data_source_id is not null))
    or (data_source = 'breww_sku_container'::text)
    or ((data_source = 'unleashed_bom'::text) and (data_source_id is not null))
    or ((data_source = 'parametric'::text) and (packaging_material_class is not null))
    or (data_source is null)
  );
