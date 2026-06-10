// Shared packaging save logic for the product recipe page.
//
// The recipe page used to have two hand-rolled copies of this mapping (one in
// savePackaging, one in autoSavePackaging) that drifted apart: the manual
// save path silently dropped units_per_group, cached_co2_factor and all the
// circularity fields, so what reached the database depended on which save
// path happened to run last. Both paths now build rows through this module.

import type { PackagingFormData } from '@/components/products/PackagingFormCard';

/**
 * Packaging roles shared across several product units (a case, a pallet...).
 * Their impact must be divided by units_per_group; without it the calculator
 * over-counts by the pack size (10-100x), so these categories cannot be
 * saved until the user answers "how many products share this packaging?".
 */
export const SHARED_PACKAGING_CATEGORIES = ['secondary', 'shipment', 'tertiary'];

export function isSharedPackagingCategory(category?: string | null): boolean {
  return !!category && SHARED_PACKAGING_CATEGORIES.includes(category);
}

/**
 * Plain-language problems preventing this row from being saved.
 * Empty array means the row is saveable.
 */
export function packagingFormErrors(form: PackagingFormData): string[] {
  const errors: string[] = [];
  if (!form.packaging_category) errors.push('packaging type');
  if (!form.name) errors.push('material name');

  const hasWeight = Number(form.amount) > 0 || Number(form.net_weight_g) > 0;
  if (!hasWeight) {
    errors.push('net weight (must be greater than 0)');
  }

  if (isSharedPackagingCategory(form.packaging_category)) {
    const upg = Number(form.units_per_group);
    if (!upg || upg < 1 || isNaN(upg)) {
      errors.push('how many products share this packaging (Units Per Packaging)');
    }
  }
  return errors;
}

export function isPackagingFormSaveable(form: PackagingFormData): boolean {
  return packagingFormErrors(form).length === 0;
}

/**
 * Map a packaging form row to a product_materials row. Used by both the
 * manual Save button and autosave so the two can never diverge again.
 */
export function buildPackagingMaterialData(form: PackagingFormData, productId: string): Record<string, any> {
  // Derive quantity from amount, falling back to net_weight_g with unit conversion
  let quantity = Number(form.amount);
  if (!quantity || quantity <= 0 || isNaN(quantity)) {
    const weightG = Number(form.net_weight_g);
    quantity = isNaN(weightG) ? 0 : (form.unit === 'kg' ? weightG / 1000 : weightG);
  }

  const materialData: any = {
    product_id: parseInt(productId),
    material_name: form.name,
    matched_source_name: form.matched_source_name || null,
    quantity,
    unit: form.unit,
    material_type: 'packaging',
    packaging_category: form.packaging_category || null,
    origin_country: form.origin_country || null,
    net_weight_g: Number(form.net_weight_g) || null,
    recycled_content_percentage: form.recycled_content_percentage ? Number(form.recycled_content_percentage) : null,
    printing_process: form.printing_process || null,
  };

  // Only include data_source if it's a valid value with required fields
  if (form.data_source === 'openlca' && form.data_source_id) {
    materialData.data_source = 'openlca';
    materialData.data_source_id = form.data_source_id;
    if (form.openlca_database) {
      materialData.openlca_database = form.openlca_database;
    }
  } else if (form.data_source === 'supplier' && form.supplier_product_id) {
    materialData.data_source = 'supplier';
    materialData.supplier_product_id = form.supplier_product_id;
  }

  // Cache the emission factor value so the resolver always has a local
  // fallback even when the original data source is unreachable.
  if (form.carbon_intensity != null && !isNaN(Number(form.carbon_intensity))) {
    materialData.cached_co2_factor = Number(form.carbon_intensity);
  }

  // Transport data — prefer multi-leg JSONB; fall back to single mode/distance
  if (form.transport_legs && form.transport_legs.length > 0) {
    materialData.transport_legs = form.transport_legs;
    materialData.transport_mode = form.transport_legs[0].transportMode;
    materialData.distance_km = form.transport_legs[0].distanceKm;
  } else if (form.transport_mode && form.distance_km) {
    materialData.transport_mode = form.transport_mode;
    materialData.distance_km = Number(form.distance_km);
    materialData.transport_legs = null;
  }

  // Origin geolocation data if available
  if (form.origin_lat && form.origin_lng) {
    materialData.origin_lat = form.origin_lat;
    materialData.origin_lng = form.origin_lng;
    materialData.origin_address = form.origin_address || null;
    materialData.origin_country_code = form.origin_country_code || null;
  }

  // EPR compliance fields
  materialData.has_component_breakdown = form.has_component_breakdown || false;
  if (form.epr_packaging_level) materialData.epr_packaging_level = form.epr_packaging_level;
  if (form.epr_packaging_activity) materialData.epr_packaging_activity = form.epr_packaging_activity;
  materialData.epr_is_household = form.epr_is_household !== undefined ? form.epr_is_household : true;
  if (form.epr_ram_rating) materialData.epr_ram_rating = form.epr_ram_rating;
  if (form.epr_uk_nation) materialData.epr_uk_nation = form.epr_uk_nation;
  materialData.epr_is_drinks_container = form.epr_is_drinks_container || false;

  // Emission factor provenance (apply + flag). Null = unknown/legacy.
  materialData.match_status = form.match_status ?? null;

  // Structured identity from the guided wizard (null for manually-entered
  // rows). End-of-life resolution prefers container_material over name
  // inference, making material misclassification impossible for these rows.
  materialData.container_format = form.container_format || null;
  materialData.container_material = form.container_material || null;
  materialData.container_size_ml = form.container_size_ml || null;
  materialData.weight_source = form.weight_source || null;

  // Shared-packaging allocation. Validation (packagingFormErrors) guarantees
  // a real answer for shared categories; primary packaging is always 1:1.
  materialData.units_per_group = isSharedPackagingCategory(form.packaging_category)
    ? Number(form.units_per_group)
    : 1;

  // Circularity
  materialData.reuse_trips = form.reuse_trips && Number(form.reuse_trips) >= 1
    ? Number(form.reuse_trips)
    : null;
  materialData.recyclability_percent = form.recyclability_percent !== '' && form.recyclability_percent != null
    ? Number(form.recyclability_percent)
    : null;
  materialData.end_of_life_pathway = form.end_of_life_pathway || null;
  materialData.biobased_content_percentage = form.biobased_content_percentage !== '' && form.biobased_content_percentage != null
    ? Number(form.biobased_content_percentage)
    : null;

  return materialData;
}
