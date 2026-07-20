import { describe, it, expect } from 'vitest';
import { defaultBoundaryForCategory } from '@/lib/lca/first-footprint';

describe('defaultBoundaryForCategory', () => {
  it('follows a drink all the way, because most of its footprint is after the gate', () => {
    // A finished drink is sold, carried, chilled and thrown away. Stopping at
    // the factory gate hides most of that and flatters the number.
    for (const category of ['Gin', 'Whisky', 'Wine', 'Beer & Cider', 'Non-Alcoholic']) {
      expect(defaultBoundaryForCategory(category)).toBe('cradle-to-grave');
    }
  });

  it('stops at the gate for anything whose downstream we cannot honestly guess', () => {
    expect(defaultBoundaryForCategory('Accommodation')).toBe('cradle-to-gate');
    expect(defaultBoundaryForCategory('Food')).toBe('cradle-to-gate');
  });

  it('stops at the gate when the category is unknown or missing', () => {
    // Guessing wide on something we cannot classify would invent stages
    // rather than estimate them.
    expect(defaultBoundaryForCategory(null)).toBe('cradle-to-gate');
    expect(defaultBoundaryForCategory(undefined)).toBe('cradle-to-gate');
    expect(defaultBoundaryForCategory('Something we have never seen')).toBe('cradle-to-gate');
  });

  it('resolves a specific category through to its group', () => {
    // 'Gin' is a category whose group is 'Spirits'; both must reach the same
    // answer, or two products of the same kind would get different defaults.
    expect(defaultBoundaryForCategory('Gin')).toBe(defaultBoundaryForCategory('Spirits'));
  });
});
