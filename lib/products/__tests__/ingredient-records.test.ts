import { describe, it, expect, vi } from 'vitest';
import {
  escapeLikePattern,
  factsFromForm,
  inheritFactsIntoForm,
  findOrCreateIngredient,
  type IngredientFacts,
  type IngredientStore,
} from '../ingredient-records';

/**
 * The org-level ingredient record.
 *
 * The rule that matters most: an ingredient is shared by every product that
 * uses it, so saving one product must never retune a fact another product
 * depends on. The record accumulates what is known; it is not overwritten by
 * whichever SKU happened to be saved last.
 */

function makeStore(seed: Array<{ id: string; name: string } & IngredientFacts> = []) {
  const rows = [...seed];
  const store: IngredientStore = {
    findByName: vi.fn(async (_org, name) => {
      return (rows.find((r) => r.name.toLowerCase() === name.toLowerCase()) as any) ?? null;
    }),
    create: vi.fn(async (_org, name, facts) => {
      const row = { id: `ing-${rows.length + 1}`, name, ...facts };
      rows.push(row as any);
      return { id: row.id };
    }),
    update: vi.fn(async (id, facts) => {
      const row = rows.find((r) => r.id === id);
      Object.assign(row as any, facts);
    }),
  };
  return { store, rows };
}

describe('escapeLikePattern', () => {
  it('escapes the wildcards that would make a name match everything', () => {
    // "100% agave" as a raw ilike pattern matches any name starting with 100.
    expect(escapeLikePattern('100% agave')).toBe('100\\% agave');
    expect(escapeLikePattern('malt_extract')).toBe('malt\\_extract');
    expect(escapeLikePattern('Maris Otter')).toBe('Maris Otter');
  });
});

describe('factsFromForm', () => {
  it('takes the facts the form actually carries', () => {
    expect(
      factsFromForm({
        unit: 'kg',
        matched_source_name: 'Barley, organic',
        match_status: 'verified',
        carbon_intensity: 0.42,
        is_biogenic_carbon: true,
        supplier_product_id: 'sp-1',
      })
    ).toEqual({
      unit: 'kg',
      matched_source_name: 'Barley, organic',
      match_status: 'verified',
      cached_co2_factor: 0.42,
      is_biogenic_carbon: true,
      default_supplier_product_id: 'sp-1',
    });
  });

  it('ignores blanks so an empty form field contributes nothing', () => {
    expect(factsFromForm({ unit: '', matched_source_name: null, ef_source: undefined })).toEqual({});
  });

  it('keeps a false boolean, which is a real answer', () => {
    expect(factsFromForm({ is_organic_certified: false })).toEqual({
      is_organic_certified: false,
    });
  });

  it('clears all three farm links when self-grown is turned off', () => {
    // A stale vineyard_id would keep feeding the growing questionnaire.
    expect(
      factsFromForm({
        is_self_grown: false,
        vineyard_id: 'vin-1',
        orchard_id: 'orc-1',
        arable_field_id: 'arb-1',
      })
    ).toEqual({
      is_self_grown: false,
      vineyard_id: null,
      orchard_id: null,
      arable_field_id: null,
    });
  });

  it('keeps the farm links when self-grown is on', () => {
    expect(factsFromForm({ is_self_grown: true, vineyard_id: 'vin-1' })).toEqual({
      is_self_grown: true,
      vineyard_id: 'vin-1',
      orchard_id: null,
      arable_field_id: null,
    });
  });
});

describe('inheritFactsIntoForm', () => {
  const RECORD: IngredientFacts = {
    unit: 'kg',
    matched_source_name: 'Barley, organic',
    match_status: 'verified',
    cached_co2_factor: 0.42,
    is_biogenic_carbon: true,
    is_organic_certified: true,
    is_self_grown: true,
    vineyard_id: 'vin-1',
    default_supplier_product_id: 'sp-1',
  };

  it('fills a blank form row from the record', () => {
    const form = inheritFactsIntoForm({ name: 'Barley', amount: '500' }, RECORD);
    expect(form).toMatchObject({
      unit: 'kg',
      matched_source_name: 'Barley, organic',
      match_status: 'verified',
      carbon_intensity: 0.42,
      is_biogenic_carbon: true,
      is_organic_certified: true,
      is_self_grown: true,
      vineyard_id: 'vin-1',
      supplier_product_id: 'sp-1',
    });
  });

  it('never overwrites what the row already answers', () => {
    const form = inheritFactsIntoForm(
      { name: 'Barley', unit: 'g', match_status: 'needs_review', carbon_intensity: 9.9 },
      RECORD
    );
    expect(form.unit).toBe('g');
    expect(form.match_status).toBe('needs_review');
    expect(form.carbon_intensity).toBe(9.9);
  });

  it('does not inherit a false boolean', () => {
    // Inheriting false is indistinguishable from the form's own default and
    // would let one product's "not organic" quietly answer for another.
    const form = inheritFactsIntoForm({}, { is_organic_certified: false, is_biogenic_carbon: false });
    expect(form.is_organic_certified).toBeUndefined();
    expect(form.is_biogenic_carbon).toBeUndefined();
  });

  it('is a no-op without a record', () => {
    expect(inheritFactsIntoForm({ name: 'Barley' }, null)).toEqual({ name: 'Barley' });
  });
});

describe('findOrCreateIngredient', () => {
  it('creates the record on first use and returns its id', async () => {
    const { store, rows } = makeStore();
    const id = await findOrCreateIngredient(store, 'org-1', 'Maris Otter', { unit: 'kg' });
    expect(id).toBe('ing-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Maris Otter', unit: 'kg' });
  });

  it('reuses the existing record rather than creating a second', async () => {
    const { store, rows } = makeStore([{ id: 'ing-1', name: 'Maris Otter', unit: 'kg' }]);
    const id = await findOrCreateIngredient(store, 'org-1', 'Maris Otter', { unit: 'kg' });
    expect(id).toBe('ing-1');
    expect(store.create).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
  });

  it('matches case-insensitively, as the URL importer does', async () => {
    const { store } = makeStore([{ id: 'ing-1', name: 'Maris Otter' }]);
    expect(await findOrCreateIngredient(store, 'org-1', 'maris otter', {})).toBe('ing-1');
  });

  it('folds in facts the record does not yet know', async () => {
    const { store, rows } = makeStore([{ id: 'ing-1', name: 'Barley', unit: 'kg' }]);
    await findOrCreateIngredient(store, 'org-1', 'Barley', {
      matched_source_name: 'Barley, organic',
      cached_co2_factor: 0.42,
    });
    expect(store.update).toHaveBeenCalledWith('ing-1', {
      matched_source_name: 'Barley, organic',
      cached_co2_factor: 0.42,
    });
    expect(rows[0]).toMatchObject({ matched_source_name: 'Barley, organic' });
  });

  it('never overwrites a fact the record already holds', async () => {
    // The load-bearing rule: another product depends on this ingredient, so
    // saving this one must not silently retune it.
    const { store, rows } = makeStore([
      { id: 'ing-1', name: 'Barley', unit: 'kg', matched_source_name: 'Barley, organic' },
    ]);
    await findOrCreateIngredient(store, 'org-1', 'Barley', {
      unit: 'g',
      matched_source_name: 'Barley, conventional',
    });
    expect(store.update).not.toHaveBeenCalled();
    expect(rows[0].unit).toBe('kg');
    expect(rows[0].matched_source_name).toBe('Barley, organic');
  });

  it('ignores a blank name rather than creating an empty ingredient', async () => {
    const { store } = makeStore();
    expect(await findOrCreateIngredient(store, 'org-1', '   ', {})).toBeNull();
    expect(store.create).not.toHaveBeenCalled();
  });

  it('trims the name it stores', async () => {
    const { store, rows } = makeStore();
    await findOrCreateIngredient(store, 'org-1', '  Maris Otter  ', {});
    expect(rows[0].name).toBe('Maris Otter');
  });
});

describe('organic inherits through null, not false', () => {
  it('inherits onto a row that has never been asked', () => {
    // product_materials.is_organic_certified is nullable, so null genuinely
    // means "nobody has said" and can inherit. `|| false` in the write shaper
    // used to collapse that and pin every row as not-organic.
    const form = inheritFactsIntoForm({ is_organic_certified: null }, { is_organic_certified: true });
    expect(form.is_organic_certified).toBe(true);
  });

  it('respects a deliberate "not organic"', () => {
    const form = inheritFactsIntoForm({ is_organic_certified: false }, { is_organic_certified: true });
    expect(form.is_organic_certified).toBe(false);
  });

  it('does not inherit biogenic onto a row that carries false', () => {
    // is_biogenic_carbon is NOT NULL and so cannot express "unanswered".
    const form = inheritFactsIntoForm({ is_biogenic_carbon: false }, { is_biogenic_carbon: true });
    expect(form.is_biogenic_carbon).toBe(false);
  });
});
