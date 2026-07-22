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
  current: { is_organic_certified?: boolean }
): IngredientDeclaredFacts {
  const facts: IngredientDeclaredFacts = {};

  if (!current.is_organic_certified && certificationsImplyOrganic(product.certifications)) {
    facts.is_organic_certified = true;
  }

  return facts;
}
