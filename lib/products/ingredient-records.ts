/**
 * The org-level ingredient record: find-or-create, and the facts a material
 * row inherits from it.
 *
 * `ingredients` existed as a bare name record that the recipe editor never
 * wrote to, so it sat empty while every fact about an ingredient was copied
 * onto each `product_materials` row and retyped for every SKU. This module is
 * the write path that fills it, and the read path that lets a material row
 * inherit from it.
 *
 * `product_materials` keeps every column it has: the calculator reads those
 * rows and nothing about its contract changes. The ingredient record is the
 * authoring-layer source those rows are written from.
 */

/** The ingredient-level facts, as held on both the record and the form row. */
export interface IngredientFacts {
  unit?: string | null;
  matched_source_name?: string | null;
  match_status?: string | null;
  data_source?: string | null;
  data_source_id?: string | null;
  openlca_database?: string | null;
  cached_co2_factor?: number | null;
  ef_source?: string | null;
  ef_source_type?: string | null;
  ef_data_quality_grade?: string | null;
  ef_uncertainty_percent?: number | null;
  ef_reference_unit?: string | null;
  is_biogenic_carbon?: boolean | null;
  is_organic_certified?: boolean | null;
  is_self_grown?: boolean | null;
  vineyard_id?: string | null;
  orchard_id?: string | null;
  arable_field_id?: string | null;
  default_supplier_product_id?: string | null;
}

/**
 * The columns an ingredient record carries. Kept as a list so the select, the
 * insert and the inherit step cannot drift apart.
 */
export const INGREDIENT_FACT_COLUMNS = [
  'unit',
  'matched_source_name',
  'match_status',
  'data_source',
  'data_source_id',
  'openlca_database',
  'cached_co2_factor',
  'ef_source',
  'ef_source_type',
  'ef_data_quality_grade',
  'ef_uncertainty_percent',
  'ef_reference_unit',
  'is_biogenic_carbon',
  'is_organic_certified',
  'is_self_grown',
  'vineyard_id',
  'orchard_id',
  'arable_field_id',
  'default_supplier_product_id',
] as const;

export const INGREDIENT_SELECT = `id, name, ${INGREDIENT_FACT_COLUMNS.join(', ')}`;

/**
 * Escape the LIKE wildcards `%` and `_` so an ingredient called "100% agave"
 * matches itself rather than everything.
 *
 * Copied deliberately from the URL importer, which learned this the hard way
 * and left the comment explaining it.
 */
export function escapeLikePattern(name: string): string {
  return name.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * The facts a form row contributes back to its ingredient record.
 *
 * Only fields the row actually carries a value for. A blank on one product
 * must not wipe a fact another product established: the record accumulates
 * what is known rather than being overwritten by whichever SKU was saved last.
 */
export function factsFromForm(form: Record<string, unknown>): IngredientFacts {
  const facts: IngredientFacts = {};
  const take = <K extends keyof IngredientFacts>(key: K, value: unknown) => {
    if (value !== undefined && value !== null && value !== '') {
      facts[key] = value as IngredientFacts[K];
    }
  };

  take('unit', form.unit);
  take('matched_source_name', form.matched_source_name);
  take('match_status', form.match_status);
  take('data_source', form.data_source);
  take('data_source_id', form.data_source_id);
  take('openlca_database', form.openlca_database);
  take('cached_co2_factor', form.carbon_intensity);
  take('ef_source', form.ef_source);
  take('ef_source_type', form.ef_source_type);
  take('ef_data_quality_grade', form.ef_data_quality_grade);
  take('ef_uncertainty_percent', form.ef_uncertainty_percent);
  take('ef_reference_unit', form.ef_reference_unit);
  take('default_supplier_product_id', form.supplier_product_id);

  // Booleans are meaningful when false, so they bypass the blank check. They
  // are only contributed when the form explicitly holds a boolean.
  if (typeof form.is_biogenic_carbon === 'boolean') facts.is_biogenic_carbon = form.is_biogenic_carbon;
  if (typeof form.is_organic_certified === 'boolean') facts.is_organic_certified = form.is_organic_certified;

  // The farm links travel as a set: clearing self-grown clears all three, or a
  // stale vineyard would keep feeding the growing questionnaire.
  if (typeof form.is_self_grown === 'boolean') {
    facts.is_self_grown = form.is_self_grown;
    facts.vineyard_id = form.is_self_grown ? ((form.vineyard_id as string) ?? null) : null;
    facts.orchard_id = form.is_self_grown ? ((form.orchard_id as string) ?? null) : null;
    facts.arable_field_id = form.is_self_grown ? ((form.arable_field_id as string) ?? null) : null;
  }

  return facts;
}

/**
 * Fill a form row from its ingredient record, without overwriting anything the
 * row already answers.
 *
 * This is the inherit direction: a second product using the same ingredient
 * opens with the emission factor, biogenic flag, organic status and farm link
 * already filled in, rather than asking for them again.
 */
export function inheritFactsIntoForm<T extends Record<string, unknown>>(
  form: T,
  record: IngredientFacts | null | undefined
): T {
  if (!record) return form;
  const next: Record<string, unknown> = { ...form };

  const fill = (formKey: string, value: unknown) => {
    if (value === undefined || value === null) return;
    const current = next[formKey];
    if (current === undefined || current === null || current === '') {
      next[formKey] = value;
    }
  };

  fill('unit', record.unit);
  fill('matched_source_name', record.matched_source_name);
  fill('match_status', record.match_status);
  fill('data_source', record.data_source);
  fill('data_source_id', record.data_source_id);
  fill('openlca_database', record.openlca_database);
  fill('carbon_intensity', record.cached_co2_factor);
  fill('ef_source', record.ef_source);
  fill('ef_source_type', record.ef_source_type);
  fill('ef_data_quality_grade', record.ef_data_quality_grade);
  fill('ef_uncertainty_percent', record.ef_uncertainty_percent);
  fill('ef_reference_unit', record.ef_reference_unit);
  fill('supplier_product_id', record.default_supplier_product_id);

  // Booleans: only a true is worth inheriting. Inheriting false would be
  // indistinguishable from the form's own default and would let one product's
  // "not organic" quietly answer for another.
  if (record.is_biogenic_carbon && next.is_biogenic_carbon === undefined) {
    next.is_biogenic_carbon = true;
  }
  if (record.is_organic_certified && next.is_organic_certified === undefined) {
    next.is_organic_certified = true;
  }
  if (record.is_self_grown && next.is_self_grown === undefined) {
    next.is_self_grown = true;
    fill('vineyard_id', record.vineyard_id);
    fill('orchard_id', record.orchard_id);
    fill('arable_field_id', record.arable_field_id);
  }

  return next as T;
}

/**
 * Minimal client surface, so this module can be tested without a live
 * Supabase connection and used from either the browser or a route handler.
 */
export interface IngredientStore {
  findByName(organizationId: string, name: string): Promise<{ id: string } & IngredientFacts | null>;
  create(organizationId: string, name: string, facts: IngredientFacts): Promise<{ id: string } | null>;
  update(id: string, facts: IngredientFacts): Promise<void>;
}

/**
 * Find the organisation's ingredient by name, or create it, then fold in
 * whatever this form row knows. Returns the ingredient id for
 * `product_materials.material_id`, which the recipe editor has never set.
 *
 * Case-insensitive by name, matching the URL importer. There is no unique
 * constraint (see the migration for why), so a race can still produce a
 * duplicate; that is the same exposure the importer has always had and is
 * resolved by the propose-a-merge flow rather than by rewriting data.
 */
export async function findOrCreateIngredient(
  store: IngredientStore,
  organizationId: string,
  name: string,
  facts: IngredientFacts
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = await store.findByName(organizationId, trimmed);
  if (existing) {
    // Fold in anything the record does not yet know. A fact already on the
    // record wins, so saving a product cannot silently retune an ingredient
    // that other products depend on.
    const additions: IngredientFacts = {};
    for (const key of INGREDIENT_FACT_COLUMNS) {
      const incoming = facts[key as keyof IngredientFacts];
      const current = existing[key as keyof IngredientFacts];
      const currentIsBlank = current === undefined || current === null || current === '';
      if (incoming !== undefined && currentIsBlank) {
        (additions as Record<string, unknown>)[key] = incoming;
      }
    }
    if (Object.keys(additions).length > 0) {
      await store.update(existing.id, additions);
    }
    return existing.id;
  }

  const created = await store.create(organizationId, trimmed, facts);
  return created?.id ?? null;
}
