import { describe, it, expect } from 'vitest';
import {
  normaliseIngredientName,
  findDuplicateIngredients,
  suggestSurvivor,
} from '../ingredient-duplicates';

/**
 * Duplicate detection is propose-only, so its failure modes are asymmetric.
 * Missing a duplicate costs the user a merge they can still do by hand;
 * proposing a wrong one invites them to destroy a distinction that mattered.
 * These tests weight the false-positive side accordingly.
 */

describe('normaliseIngredientName', () => {
  it('collapses case, punctuation and spacing', () => {
    const k = normaliseIngredientName('Juniper Berries');
    expect(normaliseIngredientName('juniper berries')).toBe(k);
    expect(normaliseIngredientName('Juniper-Berries')).toBe(k);
    expect(normaliseIngredientName('  JUNIPER   BERRIES  ')).toBe(k);
  });

  it('collapses a trailing plural', () => {
    expect(normaliseIngredientName('Juniper berry')).toBe(normaliseIngredientName('Juniper berries'));
    expect(normaliseIngredientName('Coriander seed')).toBe(normaliseIngredientName('Coriander seeds'));
  });

  it('does not strip an s that belongs to the word', () => {
    // "molasses" must not become "molasse", nor "grass" become "gras".
    expect(normaliseIngredientName('Molasses')).toBe('molasses');
    expect(normaliseIngredientName('Lemongrass')).toBe('lemongrass');
  });

  it('keeps genuinely different ingredients apart', () => {
    expect(normaliseIngredientName('Bitter orange peel')).not.toBe(
      normaliseIngredientName('Sweet orange peel')
    );
    expect(normaliseIngredientName('Angelica root')).not.toBe(
      normaliseIngredientName('Orris root')
    );
    expect(normaliseIngredientName('Neutral grain spirit')).not.toBe(
      normaliseIngredientName('Neutral grape spirit')
    );
  });
});

describe('findDuplicateIngredients', () => {
  it('returns nothing when every ingredient is distinct', () => {
    expect(
      findDuplicateIngredients([
        { id: '1', name: 'Juniper berries' },
        { id: '2', name: 'Coriander seed' },
        { id: '3', name: 'Angelica root' },
      ])
    ).toEqual([]);
  });

  it('groups exact repeats and says so', () => {
    const groups = findDuplicateIngredients([
      { id: '1', name: 'Juniper berries' },
      { id: '2', name: 'Juniper berries' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.id)).toEqual(['1', '2']);
    expect(groups[0].reason).toBe('Entered more than once under exactly the same name.');
  });

  it('groups spelling variants and says so differently', () => {
    const groups = findDuplicateIngredients([
      { id: '1', name: 'Juniper Berries' },
      { id: '2', name: 'juniper berry' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe('The same name written differently.');
  });

  it('puts the biggest group first', () => {
    const groups = findDuplicateIngredients([
      { id: '1', name: 'Water' },
      { id: '2', name: 'water' },
      { id: '3', name: 'Juniper' },
      { id: '4', name: 'juniper' },
      { id: '5', name: 'Juniper ' },
    ]);
    expect(groups[0].members).toHaveLength(3);
    expect(groups[1].members).toHaveLength(2);
  });

  it('ignores a blank name rather than grouping every blank together', () => {
    expect(findDuplicateIngredients([
      { id: '1', name: '  ' },
      { id: '2', name: '!!' },
    ])).toEqual([]);
  });
});

describe('suggestSurvivor', () => {
  it('keeps the record that knows the most', () => {
    const group = findDuplicateIngredients([
      { id: 'bare', name: 'Juniper berries' },
      { id: 'rich', name: 'Juniper berries', matched_source_name: 'Juniper, dried', unit: 'kg' },
    ])[0];
    expect(suggestSurvivor(group).id).toBe('rich');
  });

  it('prefers a matched factor over a unit alone', () => {
    const group = findDuplicateIngredients([
      { id: 'unit-only', name: 'Juniper', unit: 'kg' },
      { id: 'factor', name: 'Juniper', matched_source_name: 'Juniper, dried' },
    ])[0];
    expect(suggestSurvivor(group).id).toBe('factor');
  });
});
