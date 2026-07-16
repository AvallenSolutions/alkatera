// Shared ingredient save logic for the product recipe page.
//
// Mirrors lib/products/packaging-material-data.ts. The recipe page had two
// hand-rolled ingredient row builders — one in saveIngredients (delete+insert),
// one in autoSaveIngredients (update) — that drifted apart: the manual path
// never wrote transport_legs, stage_id diverged, and NEITHER path wrote the
// self-grown farm links, the biogenic-carbon flag, or the reusable
// inbound-container fields. So ticking "grown on our own vineyard", flagging
// biogenic carbon, or setting an inbound container was silently discarded on
// save even though the LCA calculator reads all of those columns. Both paths
// now build rows through this one module so they can never diverge again.

import type { IngredientFormData } from '@/components/products/IngredientFormCard';

/**
 * Map an ingredient form row to a product_materials row. Conditional columns
 * get explicit null defaults so an UPDATE clears stale values exactly like the
 * old delete-and-reinsert did; an INSERT with explicit nulls is equivalent to
 * relying on column defaults.
 */
export function buildIngredientMaterialData(
  form: IngredientFormData,
  productId: string,
): Record<string, any> {
  const materialData: any = {
    product_id: parseInt(productId),
    material_name: form.name,
    matched_source_name: form.matched_source_name || null,
    quantity: Number(form.amount),
    unit: form.unit,
    material_type: 'ingredient',
    match_status: form.match_status ?? null,
    origin_country: form.origin_country || null,
    is_organic_certified: form.is_organic_certified || false,
    stage_id: form.stage_id || null,

    // Emission-factor quality metadata (drives the quality tooltip and the
    // count-vs-mass unit-mismatch check). Previously unpersisted, so both
    // emptied/disarmed on reload.
    ef_source: (form as any).ef_source || null,
    ef_source_type: (form as any).ef_source_type || null,
    ef_data_quality_grade: (form as any).ef_data_quality_grade || null,
    ef_uncertainty_percent: (form as any).ef_uncertainty_percent ?? null,
    ef_reference_unit: (form as any).ef_reference_unit || null,

    // Emission-factor source (set below when valid).
    data_source: null,
    data_source_id: null,
    openlca_database: null,
    supplier_product_id: null,
    cached_co2_factor: null,

    // Transport (set below; multi-leg JSONB preferred).
    transport_mode: null,
    distance_km: null,
    transport_legs: null,

    // Origin geolocation (set below when present).
    origin_lat: null,
    origin_lng: null,
    origin_address: null,
    origin_country_code: null,

    // Self-grown farm links — drive the viticulture / arable / orchard LCA
    // path (calculator filters `.eq('is_self_grown', true)`). Cleared when the
    // ingredient is no longer marked self-grown.
    is_self_grown: form.is_self_grown || false,
    vineyard_id: form.is_self_grown ? (form.vineyard_id || null) : null,
    arable_field_id: form.is_self_grown ? (form.arable_field_id || null) : null,
    orchard_id: form.is_self_grown ? (form.orchard_id || null) : null,

    // ISO 14067 biogenic-carbon split.
    is_biogenic_carbon: form.is_biogenic_carbon || false,

    // Reusable inbound-container impact. reuse_cycles has a `>= 1 OR NULL`
    // CHECK constraint, so coerce sub-1 values to null.
    inbound_container_type: form.inbound_container_type || null,
    inbound_container_volume_l: form.inbound_container_volume_l ?? null,
    inbound_container_tare_kg: form.inbound_container_tare_kg ?? null,
    inbound_container_reuse_cycles:
      form.inbound_container_reuse_cycles != null && Number(form.inbound_container_reuse_cycles) >= 1
        ? Number(form.inbound_container_reuse_cycles)
        : null,
    inbound_container_ef: form.inbound_container_ef ?? null,
    inbound_container_material: form.inbound_container_material || null,
  };

  if (form.data_source === 'openlca' && form.data_source_id) {
    materialData.data_source = 'openlca';
    materialData.data_source_id = form.data_source_id;
    if (form.openlca_database) materialData.openlca_database = form.openlca_database;
  } else if (form.data_source === 'supplier' && form.supplier_product_id) {
    materialData.data_source = 'supplier';
    materialData.supplier_product_id = form.supplier_product_id;
  }

  // Transport — prefer the multi-leg JSONB, falling back to legacy single
  // mode/distance. The calculator prefers transport_legs over transport_mode,
  // so omitting legs (as the manual save did) left it reading a stale leg.
  if (form.transport_legs && form.transport_legs.length > 0) {
    materialData.transport_legs = form.transport_legs;
    materialData.transport_mode = form.transport_legs[0].transportMode;
    materialData.distance_km = form.transport_legs[0].distanceKm;
  } else if (form.transport_mode && form.distance_km) {
    materialData.transport_mode = form.transport_mode;
    materialData.distance_km = Number(form.distance_km);
  }

  // Cache the emission factor so the resolver has a local fallback when the
  // original data source (e.g. the OpenLCA API) is unreachable at calc time.
  if (form.carbon_intensity != null && Number(form.carbon_intensity) > 0) {
    materialData.cached_co2_factor = Number(form.carbon_intensity);
  }

  if (form.origin_lat && form.origin_lng) {
    materialData.origin_lat = form.origin_lat;
    materialData.origin_lng = form.origin_lng;
    materialData.origin_address = form.origin_address || null;
    materialData.origin_country_code = form.origin_country_code || null;
  }

  return materialData;
}
