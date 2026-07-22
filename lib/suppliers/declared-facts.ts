/**
 * What a supplier has already told us, propagated onto the material row that
 * links to their product.
 *
 * The link handlers in `IngredientFormCard` and `PackagingFormCard` were
 * near-identical copies that each pulled about a dozen fields and dropped the
 * rest, including three the material row has a home for: recyclability,
 * end-of-life pathway and organic certification. A supplier declaring "51%
 * PCR, widely recycled, organic certified" got the recycled content across and
 * silently lost the other two, so the user was asked again for facts the
 * platform already held. That is root cause F1 from
 * tasks/product-data-duplication-plan.md at the supplier boundary.
 *
 * Extracted here so the rule exists once and can be tested; neither handler
 * had any test.
 */

import type { DistributionLeg } from '@/lib/distribution-factors';

/** The shape both cards receive from /api/suppliers/linked-products. */
export interface SupplierProductRow {
  recyclability_pct?: number | null;
  end_of_life_pathway?: string | null;
  certifications?: string[] | null;
  primary_material?: string | null;
  unit_measurement?: number | null;
  unit_measurement_type?: string | null;
  [key: string]: unknown;
}

/**
 * The packaging form's end-of-life vocabulary is narrower than the supplier
 * table's: `supplier_products.end_of_life_pathway` also allows
 * 'anaerobic_digestion' and 'mixed', which the form has no option for. Copying
 * one of those across would put a value in the field that the user cannot see
 * or change, so unmappable pathways are left for them to answer.
 */
const FORM_EOL_PATHWAYS = new Set([
  'landfill',
  'incineration',
  'recycling',
  'composting',
  'reuse',
  'unknown',
]);

export type FormEoLPathway =
  | 'landfill'
  | 'incineration'
  | 'recycling'
  | 'composting'
  | 'reuse'
  | 'unknown';

export function mapSupplierEoLPathway(pathway: string | null | undefined): FormEoLPathway | null {
  if (!pathway) return null;
  return FORM_EOL_PATHWAYS.has(pathway) ? (pathway as FormEoLPathway) : null;
}

/**
 * Whether a supplier's certification list amounts to an organic claim.
 *
 * Deliberately conservative: it matches the word "organic" and the two
 * certifier names that mean it outright. Anything else is left alone, because
 * ticking an organic box the supplier did not claim is a compliance problem,
 * not a convenience.
 */
export function certificationsImplyOrganic(certifications: string[] | null | undefined): boolean {
  if (!certifications?.length) return false;
  return certifications.some((cert) => {
    const c = cert.toLowerCase();
    return c.includes('organic') || c.includes('soil association') || c.includes('ecocert');
  });
}

/** True for a form value the user has not filled in. */
function isUnset(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export interface PackagingDeclaredFacts {
  recyclability_percent?: number;
  end_of_life_pathway?: FormEoLPathway;
  container_material?: string;
}

/**
 * The packaging facts a supplier has declared that were previously dropped.
 *
 * Only fills fields the user has left blank, so linking a supplier product
 * never overwrites an answer somebody already gave. `current` is the form row
 * as it stands.
 */
export function packagingDeclaredFacts(
  product: SupplierProductRow,
  current: {
    recyclability_percent?: number | string | null;
    end_of_life_pathway?: string | null;
    container_material?: string | null;
  }
): PackagingDeclaredFacts {
  const facts: PackagingDeclaredFacts = {};

  if (product.recyclability_pct != null && isUnset(current.recyclability_percent)) {
    facts.recyclability_percent = product.recyclability_pct;
  }

  const eol = mapSupplierEoLPathway(product.end_of_life_pathway);
  if (eol && isUnset(current.end_of_life_pathway)) {
    facts.end_of_life_pathway = eol;
  }

  if (product.primary_material && isUnset(current.container_material)) {
    facts.container_material = product.primary_material;
  }

  return facts;
}

export interface SupplierDeliveryDefaults {
  origin_address?: string;
  origin_lat?: number;
  origin_lng?: number;
  origin_country_code?: string;
  origin_country?: string;
  transport_legs?: DistributionLeg[];
  inbound_container_type?: string;
  inbound_container_volume_l?: number;
  inbound_container_tare_kg?: number;
  inbound_container_reuse_cycles?: number;
  inbound_container_ef?: number;
  inbound_container_material?: string;
}

/**
 * Where a supplier product comes from and how it arrives.
 *
 * The origin half was already copied by both link handlers, with a fallback to
 * the supplier's own profile address. The route from that origin and the
 * container it arrives in had no supplier-level home at all until the delivery
 * defaults migration, so they were retyped on every material row that used the
 * same supplier.
 *
 * As everywhere in this layer, only blanks are filled.
 */
export function supplierDeliveryDefaults(
  product: SupplierProductRow & {
    origin_address?: string | null;
    origin_lat?: number | null;
    origin_lng?: number | null;
    origin_country_code?: string | null;
    supplier_address?: string | null;
    supplier_city?: string | null;
    supplier_country?: string | null;
    supplier_lat?: number | null;
    supplier_lng?: number | null;
    supplier_country_code?: string | null;
  },
  current: Record<string, unknown>
): SupplierDeliveryDefaults {
  const defaults: SupplierDeliveryDefaults = {};

  // Origin: the product's own origin wins, then the supplier's profile
  // address. A supplier with one site is the common case and should not have
  // to restate it per product.
  const address =
    product.origin_address ||
    product.supplier_address ||
    [product.supplier_city, product.supplier_country].filter(Boolean).join(', ') ||
    null;
  const lat = product.origin_lat ?? product.supplier_lat ?? null;
  const lng = product.origin_lng ?? product.supplier_lng ?? null;
  const countryCode = product.origin_country_code ?? product.supplier_country_code ?? null;

  if (address && isUnset(current.origin_address)) defaults.origin_address = address;
  // Latitude and longitude travel together: product_materials has an
  // origin_coordinates_completeness CHECK, and half a coordinate pair is
  // rejected by the database rather than merely being useless.
  if (lat != null && lng != null && isUnset(current.origin_lat) && isUnset(current.origin_lng)) {
    defaults.origin_lat = lat;
    defaults.origin_lng = lng;
  }
  if (countryCode && isUnset(current.origin_country_code)) {
    defaults.origin_country_code = countryCode;
    defaults.origin_country = countryCode;
  }

  if (Array.isArray(product.transport_legs) && product.transport_legs.length > 0) {
    const currentLegs = current.transport_legs;
    if (!Array.isArray(currentLegs) || currentLegs.length === 0) {
      defaults.transport_legs = product.transport_legs as DistributionLeg[];
    }
  }

  if (product.inbound_container_type && isUnset(current.inbound_container_type)) {
    defaults.inbound_container_type = product.inbound_container_type as string;
    // The container's dimensions only mean anything alongside its type, so
    // they travel as one set rather than leaving a tare weight attached to no
    // container.
    if (product.inbound_container_volume_l != null) {
      defaults.inbound_container_volume_l = product.inbound_container_volume_l as number;
    }
    if (product.inbound_container_tare_kg != null) {
      defaults.inbound_container_tare_kg = product.inbound_container_tare_kg as number;
    }
    if (product.inbound_container_reuse_cycles != null) {
      defaults.inbound_container_reuse_cycles = product.inbound_container_reuse_cycles as number;
    }
    if (product.inbound_container_ef != null) {
      defaults.inbound_container_ef = product.inbound_container_ef as number;
    }
    if (product.inbound_container_material) {
      defaults.inbound_container_material = product.inbound_container_material as string;
    }
  }

  return defaults;
}

export interface IngredientDeclaredFacts {
  is_organic_certified?: boolean;
}

/**
 * The ingredient facts a supplier has declared that were previously dropped.
 *
 * Only ever sets the organic flag to true. A supplier list that says nothing
 * about organic certification is not evidence that the ingredient is
 * conventional, so it must not clear a flag the user set themselves.
 */
export function ingredientDeclaredFacts(
  product: SupplierProductRow,
  current: { is_organic_certified?: boolean | null }
): IngredientDeclaredFacts {
  const facts: IngredientDeclaredFacts = {};

  if (!current.is_organic_certified && certificationsImplyOrganic(product.certifications)) {
    facts.is_organic_certified = true;
  }

  return facts;
}
