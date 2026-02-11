import { describe, it, expect } from 'vitest';
import {
  filterAgribalyseProcesses,
  searchAgribalyseWithAliases,
  searchBothDatabases,
} from '../openlca/drinks-process-filter';

// ============================================================================
// Helper: create mock process objects
// ============================================================================

function makeProcess(name: string, id?: string) {
  return { name, '@id': id || `uuid-${name.replace(/\s/g, '-').toLowerCase()}` };
}

// ============================================================================
// filterAgribalyseProcesses()
// ============================================================================

describe('filterAgribalyseProcesses', () => {
  it('keeps drinks-relevant processes', () => {
    const processes = [
      makeProcess('Wine, red, conventional, at farm'),
      makeProcess('Beer, pale ale, conventional'),
      makeProcess('Coffee, roasted, conventional'),
      makeProcess('Milk, whole, pasteurised, conventional'),
      makeProcess('Barley, grain, conventional'),
      makeProcess('Sugar beet, conventional'),
      makeProcess('Honey, liquid, at apiary'),
      makeProcess('Orange juice, from concentrate'),
    ];

    const filtered = filterAgribalyseProcesses(processes);
    expect(filtered.length).toBe(processes.length);
  });

  it('excludes non-drinks food items', () => {
    const processes = [
      makeProcess('Beef steak, raw, conventional'),
      makeProcess('Chicken breast, grilled'),
      makeProcess('Pork sausage, cooked'),
      makeProcess('Fish fillet, cod, frozen'),
      makeProcess('Bread, white, sliced'),
      makeProcess('Pasta, dry, wheat'),
      makeProcess('Pizza, margherita, frozen'),
    ];

    const filtered = filterAgribalyseProcesses(processes);
    expect(filtered.length).toBe(0);
  });

  it('excludes non-food items', () => {
    const processes = [
      makeProcess('Cosmetic cream, moisturiser'),
      makeProcess('Detergent, liquid, household'),
      makeProcess('Textile, cotton, woven'),
    ];

    const filtered = filterAgribalyseProcesses(processes);
    expect(filtered.length).toBe(0);
  });

  it('keeps packaging processes relevant to drinks', () => {
    const processes = [
      makeProcess('Glass bottle, 750ml, production'),
      makeProcess('Aluminium can, 330ml'),
      makeProcess('PET bottle, 500ml'),
      makeProcess('Cardboard box, 6-pack'),
    ];

    const filtered = filterAgribalyseProcesses(processes);
    expect(filtered.length).toBe(processes.length);
  });

  it('keeps botanical and spice processes', () => {
    const processes = [
      makeProcess('Ginger root, conventional'),
      makeProcess('Cinnamon bark, ground'),
      makeProcess('Vanilla extract, liquid'),
      makeProcess('Mint leaves, dried'),
    ];

    const filtered = filterAgribalyseProcesses(processes);
    expect(filtered.length).toBe(processes.length);
  });

  it('keeps grain and cereal processes', () => {
    const processes = [
      makeProcess('Barley, winter, conventional'),
      makeProcess('Wheat grain, soft, conventional'),
      makeProcess('Oat, conventional'),
      makeProcess('Rye grain, conventional'),
      makeProcess('Malt, pale, conventional'),
    ];

    const filtered = filterAgribalyseProcesses(processes);
    expect(filtered.length).toBe(processes.length);
  });

  it('handles empty input', () => {
    expect(filterAgribalyseProcesses([])).toEqual([]);
  });

  it('handles processes with missing names', () => {
    const processes = [
      { '@id': 'uuid-1' },
      { '@id': 'uuid-2', name: null },
      { '@id': 'uuid-3', name: undefined },
    ];

    // Should not crash
    const filtered = filterAgribalyseProcesses(processes);
    expect(filtered.length).toBe(0);
  });

  it('excludes meat even when combined with drinks terms', () => {
    const processes = [
      makeProcess('Beef stew with beer sauce'),
      makeProcess('Chicken with cream sauce'),
    ];

    const filtered = filterAgribalyseProcesses(processes);
    expect(filtered.length).toBe(0);
  });
});

// ============================================================================
// searchAgribalyseWithAliases()
// ============================================================================

describe('searchAgribalyseWithAliases', () => {
  const agribalyseProcesses = [
    makeProcess('Grape, wine, conventional, at farm, FR'),
    makeProcess('Raisin de cuve, conventionnel, au vignoble, FR'),
    makeProcess('Grape, table, conventional'),
    makeProcess('Barley, grain, conventional, at farm, FR'),
    makeProcess('Orge, grain, conventionnel'),
    makeProcess('Coffee, roasted, arabica, conventional'),
    makeProcess('Honey, liquid, at apiary, conventional'),
    makeProcess('Milk, whole, pasteurised, conventional, FR'),
    makeProcess('Lait entier, pasteurisé, conventionnel, FR'),
    makeProcess('Oat milk, conventional, at factory'),
    makeProcess('Boisson avoine, conventionnel'),
    makeProcess('Ginger root, conventional'),
    makeProcess('Gingembre, frais, conventionnel'),
    makeProcess('Almond, shelled, conventional'),
  ];

  it('boosts Agribalyse alias matches for wine grape', () => {
    const results = searchAgribalyseWithAliases('wine grape', agribalyseProcesses);
    expect(results.length).toBeGreaterThan(0);
    // The grape/raisin/viticulture patterns should be boosted
    expect(results[0].name).toMatch(/grape|raisin/i);
  });

  it('matches French terms via alias patterns', () => {
    const results = searchAgribalyseWithAliases('barley', agribalyseProcesses);
    expect(results.length).toBeGreaterThan(0);
    // Should find both English and French processes
    const names = results.map((p: any) => p.name);
    expect(names.some((n: string) => n.toLowerCase().includes('barley'))).toBe(true);
    expect(names.some((n: string) => n.toLowerCase().includes('orge'))).toBe(true);
  });

  it('finds plant milks', () => {
    const results = searchAgribalyseWithAliases('oat milk', agribalyseProcesses);
    expect(results.length).toBeGreaterThan(0);
    const names = results.map((p: any) => p.name);
    expect(names.some((n: string) => n.toLowerCase().includes('oat milk') || n.toLowerCase().includes('boisson avoine'))).toBe(true);
  });

  it('finds ginger including French names', () => {
    const results = searchAgribalyseWithAliases('ginger', agribalyseProcesses);
    expect(results.length).toBeGreaterThan(0);
    const names = results.map((p: any) => p.name);
    expect(names.some((n: string) => n.toLowerCase().includes('ginger'))).toBe(true);
    expect(names.some((n: string) => n.toLowerCase().includes('gingembre'))).toBe(true);
  });

  it('returns empty array for empty query', () => {
    expect(searchAgribalyseWithAliases('', agribalyseProcesses)).toEqual([]);
    expect(searchAgribalyseWithAliases('   ', agribalyseProcesses)).toEqual([]);
  });

  it('returns empty array for unmatched query', () => {
    const results = searchAgribalyseWithAliases('plutonium', agribalyseProcesses);
    expect(results.length).toBe(0);
  });
});

// ============================================================================
// searchBothDatabases()
// ============================================================================

describe('searchBothDatabases', () => {
  const ecoinventProcesses = [
    makeProcess('market for barley grain, RoW'),
    makeProcess('barley grain production, RoW'),
    makeProcess('electricity, high voltage, GB'),
    makeProcess('glass production, flat, uncoated'),
  ];

  const agribalyseProcesses = [
    makeProcess('Barley, grain, conventional, at farm, FR'),
    makeProcess('Orge, grain, conventionnel, FR'),
    makeProcess('Honey, liquid, at apiary'),
    makeProcess('Wine, red, conventional, FR'),
  ];

  it('prefers Agribalyse for barley', () => {
    const result = searchBothDatabases('barley', ecoinventProcesses, agribalyseProcesses);
    expect(result.preferredDatabase).toBe('agribalyse');
    expect(result.preferred.length).toBeGreaterThan(0);
    // Secondary should have ecoinvent barley results
    expect(result.secondary.length).toBeGreaterThan(0);
  });

  it('prefers ecoinvent for electricity', () => {
    const result = searchBothDatabases('electricity', ecoinventProcesses, agribalyseProcesses);
    expect(result.preferredDatabase).toBe('ecoinvent');
    expect(result.preferred.length).toBeGreaterThan(0);
  });

  it('prefers ecoinvent for glass', () => {
    const result = searchBothDatabases('glass', ecoinventProcesses, agribalyseProcesses);
    expect(result.preferredDatabase).toBe('ecoinvent');
  });

  it('prefers Agribalyse for honey (no ecoinvent equivalent)', () => {
    const result = searchBothDatabases('honey', ecoinventProcesses, agribalyseProcesses);
    expect(result.preferredDatabase).toBe('agribalyse');
    expect(result.preferred.length).toBeGreaterThan(0);
    expect(result.secondary.length).toBe(0); // no ecoinvent honey
  });

  it('returns both preferred and secondary results', () => {
    const result = searchBothDatabases('barley', ecoinventProcesses, agribalyseProcesses);
    expect(result).toHaveProperty('preferred');
    expect(result).toHaveProperty('secondary');
    expect(result).toHaveProperty('preferredDatabase');
  });
});
