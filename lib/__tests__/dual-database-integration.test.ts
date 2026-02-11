import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPreferredDatabase,
  getAgribalysePatterns,
  AGRIBALYSE_PREFERRED_ALIASES,
} from '../openlca/agribalyse-aliases';
import { resolveServerConfig, isAgribalyseConfigured } from '../openlca/client';
import {
  filterAgribalyseProcesses,
  searchAgribalyseWithAliases,
  searchBothDatabases,
} from '../openlca/drinks-process-filter';

// ============================================================================
// End-to-end integration tests for the dual-server flow
// These test the full chain: alias lookup → server selection → process
// filtering → search → response formatting
// ============================================================================

describe('Dual-server integration flow', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Set up both servers for integration tests
    process.env.OPENLCA_SERVER_URL = 'https://ecoinvent.example.com';
    process.env.OPENLCA_API_KEY = 'eco-key';
    process.env.OPENLCA_AGRIBALYSE_SERVER_URL = 'https://agribalyse.example.com';
    process.env.OPENLCA_AGRIBALYSE_API_KEY = 'agri-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── Scenario 1: Brewery ingredient (barley) ──────────────────────────

  describe('Scenario: Brewery calculates barley LCA', () => {
    it('routes barley through Agribalyse pipeline', () => {
      // Step 1: Determine preferred database
      const db = getPreferredDatabase('Barley malt, pale, conventional');
      expect(db).toBe('agribalyse');

      // Step 2: Get search patterns
      const patterns = getAgribalysePatterns('Barley malt, pale, conventional');
      expect(patterns).toEqual(['barley', 'orge']);

      // Step 3: Resolve server config for Agribalyse
      const config = resolveServerConfig('agribalyse');
      expect(config).not.toBeNull();
      expect(config!.serverUrl).toBe('https://agribalyse.example.com');

      // Step 4: Filter and search Agribalyse processes
      const agribalyseProcesses = [
        { name: 'Barley, grain, conventional, at farm, FR' },
        { name: 'Orge, grain, conventionnel, FR' },
        { name: 'Beef steak, raw, FR' },
        { name: 'Chicken, whole, FR' },
      ];
      const filtered = filterAgribalyseProcesses(agribalyseProcesses);
      expect(filtered.length).toBe(2); // only barley/orge, no meat

      const results = searchAgribalyseWithAliases('barley', filtered);
      expect(results.length).toBe(2);
    });
  });

  // ── Scenario 2: Winery ingredient (wine grape) ───────────────────────

  describe('Scenario: Winery calculates wine grape LCA', () => {
    it('routes wine grapes through Agribalyse with French name support', () => {
      const db = getPreferredDatabase('Wine Grape, Chardonnay');
      expect(db).toBe('agribalyse');

      const patterns = getAgribalysePatterns('Wine Grape');
      expect(patterns).toEqual(['grape', 'raisin', 'viticulture']);

      const processes = [
        { name: 'Grape, wine, conventional, at farm, FR' },
        { name: 'Raisin de cuve, conventionnel, FR' },
        { name: 'Grape, table, import, ES' },
      ];
      const filtered = filterAgribalyseProcesses(processes);
      expect(filtered.length).toBe(3); // all contain 'grape'/'raisin'

      const results = searchAgribalyseWithAliases('wine grape', filtered);
      expect(results.length).toBeGreaterThan(0);
      // The wine-specific grapes should be ranked higher
      expect(results[0].name).toMatch(/grape|raisin/i);
    });
  });

  // ── Scenario 3: Distillery with mixed ingredients ────────────────────

  describe('Scenario: Distillery with mixed ecoinvent/Agribalyse ingredients', () => {
    const ingredients = [
      { name: 'Barley malt', expectedDb: 'agribalyse' },
      { name: 'Wheat grain', expectedDb: 'agribalyse' },
      { name: 'Honey', expectedDb: 'agribalyse' },
      { name: 'Electricity, medium voltage, GB', expectedDb: 'ecoinvent' },
      { name: 'Natural gas, high pressure', expectedDb: 'ecoinvent' },
      { name: 'Glass bottle, 700ml', expectedDb: 'ecoinvent' },
      { name: 'Transport, freight, lorry', expectedDb: 'ecoinvent' },
    ];

    it.each(ingredients)(
      'routes "$name" to $expectedDb',
      ({ name, expectedDb }) => {
        expect(getPreferredDatabase(name)).toBe(expectedDb);
      }
    );

    it('splits ingredients correctly between databases', () => {
      const agribalyseCount = ingredients.filter(i =>
        getPreferredDatabase(i.name) === 'agribalyse'
      ).length;
      const ecoinventCount = ingredients.filter(i =>
        getPreferredDatabase(i.name) === 'ecoinvent'
      ).length;

      expect(agribalyseCount).toBe(3);
      expect(ecoinventCount).toBe(4);
    });

    it('resolves separate server configs for each database', () => {
      const ecoinventConfig = resolveServerConfig('ecoinvent');
      const agribalyseConfig = resolveServerConfig('agribalyse');

      expect(ecoinventConfig).not.toBeNull();
      expect(agribalyseConfig).not.toBeNull();
      expect(ecoinventConfig!.serverUrl).not.toBe(agribalyseConfig!.serverUrl);
    });
  });

  // ── Scenario 4: Craft drinks with niche ingredients ──────────────────

  describe('Scenario: Craft drinks with niche Agribalyse ingredients', () => {
    const nicheIngredients = [
      { name: 'Oat Milk', expectedDb: 'agribalyse', reason: 'no ecoinvent equivalent' },
      { name: 'Soy Milk', expectedDb: 'agribalyse', reason: 'no ecoinvent equivalent' },
      { name: 'Coconut Milk', expectedDb: 'agribalyse', reason: 'no ecoinvent equivalent' },
      { name: 'Ginger root', expectedDb: 'agribalyse', reason: 'no ecoinvent equivalent' },
      { name: 'Cinnamon', expectedDb: 'agribalyse', reason: 'no ecoinvent equivalent' },
      { name: 'Vanilla extract', expectedDb: 'agribalyse', reason: 'no ecoinvent equivalent' },
    ];

    it.each(nicheIngredients)(
      '$name → $expectedDb ($reason)',
      ({ name, expectedDb }) => {
        expect(getPreferredDatabase(name)).toBe(expectedDb);
      }
    );
  });

  // ── Scenario 5: Dual-database search comparison ──────────────────────

  describe('Scenario: Search returns results from both databases', () => {
    const ecoinventProcesses = [
      { name: 'market for barley grain, RoW' },
      { name: 'barley grain production, RER' },
    ];
    const agribalyseProcesses = [
      { name: 'Barley, grain, conventional, at farm, FR' },
      { name: 'Orge, grain, conventionnel, FR' },
    ];

    it('searchBothDatabases returns results from both with correct preference', () => {
      const result = searchBothDatabases('barley', ecoinventProcesses, agribalyseProcesses);

      expect(result.preferredDatabase).toBe('agribalyse');
      expect(result.preferred.length).toBeGreaterThan(0);
      expect(result.secondary.length).toBeGreaterThan(0);
    });

    it('provides fallback when preferred database has no results', () => {
      const result = searchBothDatabases(
        'sodium hydroxide', // ecoinvent-only chemical
        [{ name: 'market for sodium hydroxide' }],
        [] // no Agribalyse processes
      );

      expect(result.preferredDatabase).toBe('ecoinvent');
      expect(result.preferred.length).toBeGreaterThan(0);
      expect(result.secondary.length).toBe(0);
    });
  });

  // ── Scenario 6: Coverage completeness ────────────────────────────────

  describe('Coverage: all Agribalyse alias categories map to valid processes', () => {
    it('every alias has searchTerms that getPreferredDatabase can resolve', () => {
      for (const alias of AGRIBALYSE_PREFERRED_ALIASES) {
        for (const term of alias.searchTerms) {
          const db = getPreferredDatabase(term);
          expect(db).toBe('agribalyse');
        }
      }
    });

    it('every alias has patterns that getAgribalysePatterns returns', () => {
      for (const alias of AGRIBALYSE_PREFERRED_ALIASES) {
        const patterns = getAgribalysePatterns(alias.searchTerms[0]);
        expect(patterns).toEqual(alias.agribalysePatterns);
      }
    });
  });

  // ── Scenario 7: Agribalyse not configured (graceful fallback) ────────

  describe('Scenario: Agribalyse server not configured', () => {
    it('resolveServerConfig returns null for agribalyse', () => {
      delete process.env.OPENLCA_AGRIBALYSE_SERVER_URL;
      const config = resolveServerConfig('agribalyse');
      expect(config).toBeNull();
    });

    it('isAgribalyseConfigured returns false', () => {
      delete process.env.OPENLCA_AGRIBALYSE_SERVER_URL;
      expect(isAgribalyseConfigured()).toBe(false);
    });

    it('ecoinvent still works independently', () => {
      delete process.env.OPENLCA_AGRIBALYSE_SERVER_URL;
      const ecoinventConfig = resolveServerConfig('ecoinvent');
      expect(ecoinventConfig).not.toBeNull();
      expect(ecoinventConfig!.serverUrl).toBe('https://ecoinvent.example.com');
    });
  });
});
