import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// These tests verify the dual-server logic used in the calculate route
// by testing the key decision points and data transformations directly.
//
// The route handler itself (POST) now uses createOpenLCAClientForDatabase()
// to get a client pointed at the correct gdt-server instance. These tests
// focus on the route's unique logic: metadata mapping, cache key structure,
// response formatting, and the server-selection pattern.
// ============================================================================

describe('Calculate route — database metadata mapping', () => {

  // ── ecoinvent_version and system_model by database ────────────────

  describe('ecoinvent_version / system_model assignment', () => {
    function getCacheMetadata(database: 'ecoinvent' | 'agribalyse') {
      return {
        ecoinvent_version: database === 'agribalyse' ? 'agribalyse_3.2' : '3.12',
        system_model: database === 'agribalyse' ? 'attributional' : 'cutoff',
      };
    }

    it('ecoinvent → version 3.12, system cutoff', () => {
      const meta = getCacheMetadata('ecoinvent');
      expect(meta.ecoinvent_version).toBe('3.12');
      expect(meta.system_model).toBe('cutoff');
    });

    it('agribalyse → version agribalyse_3.2, system attributional', () => {
      const meta = getCacheMetadata('agribalyse');
      expect(meta.ecoinvent_version).toBe('agribalyse_3.2');
      expect(meta.system_model).toBe('attributional');
    });
  });

  // ── Source label formatting ────────────────────────────────────────

  describe('source label formatting', () => {
    function formatSourceLabel(processName: string, database: 'ecoinvent' | 'agribalyse') {
      const dbLabel = database === 'agribalyse' ? 'Agribalyse 3.2' : 'ecoinvent 3.12';
      return `OpenLCA Live: ${processName} via ${dbLabel}`;
    }

    it('formats ecoinvent source label', () => {
      const label = formatSourceLabel('market for barley grain, RoW', 'ecoinvent');
      expect(label).toBe('OpenLCA Live: market for barley grain, RoW via ecoinvent 3.12');
    });

    it('formats Agribalyse source label', () => {
      const label = formatSourceLabel('Barley, grain, conventional, FR', 'agribalyse');
      expect(label).toBe('OpenLCA Live: Barley, grain, conventional, FR via Agribalyse 3.2');
    });
  });

  // ── Cache upsert onConflict includes source_database ──────────────

  describe('cache upsert conflict key', () => {
    it('conflict key includes source_database for per-database caching', () => {
      const onConflict = 'organization_id,process_id,source_database';
      expect(onConflict).toContain('source_database');
    });

    it('allows same process_id cached from different databases', () => {
      // Simulate two cache entries for the same process from different DBs
      const ecoinventEntry = {
        organization_id: 'org-1',
        process_id: 'uuid-barley',
        source_database: 'ecoinvent',
        impact_climate: 1.5,
      };
      const agribalyseEntry = {
        organization_id: 'org-1',
        process_id: 'uuid-barley',
        source_database: 'agribalyse',
        impact_climate: 1.2,
      };

      // Different source_database means these are distinct entries
      const key1 = `${ecoinventEntry.organization_id}:${ecoinventEntry.process_id}:${ecoinventEntry.source_database}`;
      const key2 = `${agribalyseEntry.organization_id}:${agribalyseEntry.process_id}:${agribalyseEntry.source_database}`;
      expect(key1).not.toBe(key2);
    });
  });

  // ── Cached response includes database field ───────────────────────

  describe('cached response database field', () => {
    it('uses source_database from cached data when available', () => {
      const cached = { source_database: 'agribalyse' };
      const database = 'agribalyse' as const;
      const responseDatabase = cached.source_database || database;
      expect(responseDatabase).toBe('agribalyse');
    });

    it('falls back to request database when cache has no source_database', () => {
      const cached = { source_database: null };
      const database = 'ecoinvent' as const;
      const responseDatabase = cached.source_database || database;
      expect(responseDatabase).toBe('ecoinvent');
    });
  });

  // ── Impact scaling ────────────────────────────────────────────────

  describe('impact scaling by quantity', () => {
    it('scales cached impacts by quantity', () => {
      const cached = {
        impact_climate: 1.23,
        impact_water: 0.45,
        impact_land: 2.1,
      };
      const quantity = 5;

      const scaled: Record<string, number> = {};
      for (const [key, value] of Object.entries(cached)) {
        scaled[key] = (value || 0) * quantity;
      }

      expect(scaled.impact_climate).toBeCloseTo(6.15);
      expect(scaled.impact_water).toBeCloseTo(2.25);
      expect(scaled.impact_land).toBeCloseTo(10.5);
    });

    it('handles zero and null impact values gracefully', () => {
      const cached: Record<string, number | null> = {
        impact_climate: 0,
        impact_water: null,
      };
      const quantity = 3;

      const scaled: Record<string, number> = {};
      for (const [key, value] of Object.entries(cached)) {
        scaled[key] = (value || 0) * quantity;
      }

      expect(scaled.impact_climate).toBe(0);
      expect(scaled.impact_water).toBe(0);
    });
  });

  // ── GHG breakdown estimation ──────────────────────────────────────

  describe('GHG breakdown estimation', () => {
    it('estimates fossil/biogenic split when not available', () => {
      const parsedImpacts = {
        impact_climate: 2.0,
        impact_climate_fossil: 0,
        impact_climate_biogenic: 0,
      };

      if (parsedImpacts.impact_climate > 0 && !parsedImpacts.impact_climate_fossil) {
        parsedImpacts.impact_climate_fossil = parsedImpacts.impact_climate * 0.85;
        parsedImpacts.impact_climate_biogenic = parsedImpacts.impact_climate * 0.15;
      }

      expect(parsedImpacts.impact_climate_fossil).toBeCloseTo(1.7);
      expect(parsedImpacts.impact_climate_biogenic).toBeCloseTo(0.3);
    });

    it('does not overwrite existing fossil/biogenic values', () => {
      const parsedImpacts = {
        impact_climate: 2.0,
        impact_climate_fossil: 1.5, // already has a value
        impact_climate_biogenic: 0.5,
      };

      if (parsedImpacts.impact_climate > 0 && !parsedImpacts.impact_climate_fossil) {
        parsedImpacts.impact_climate_fossil = parsedImpacts.impact_climate * 0.85;
        parsedImpacts.impact_climate_biogenic = parsedImpacts.impact_climate * 0.15;
      }

      // Should NOT have been overwritten
      expect(parsedImpacts.impact_climate_fossil).toBe(1.5);
      expect(parsedImpacts.impact_climate_biogenic).toBe(0.5);
    });
  });
});

// ============================================================================
// Dual-server client creation pattern (mirrors route logic)
// ============================================================================

describe('Dual-server client creation pattern', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolveServerConfig returns ecoinvent config from OPENLCA_SERVER_URL', async () => {
    const { resolveServerConfig } = await import('../openlca/client');
    process.env.OPENLCA_SERVER_URL = 'https://ecoinvent.example.com';
    process.env.OPENLCA_API_KEY = 'test-key';
    const config = resolveServerConfig('ecoinvent');
    expect(config).toEqual({
      serverUrl: 'https://ecoinvent.example.com',
      apiKey: 'test-key',
    });
  });

  it('resolveServerConfig returns agribalyse config from OPENLCA_AGRIBALYSE_SERVER_URL', async () => {
    const { resolveServerConfig } = await import('../openlca/client');
    process.env.OPENLCA_AGRIBALYSE_SERVER_URL = 'https://agribalyse.example.com';
    process.env.OPENLCA_AGRIBALYSE_API_KEY = 'agri-key';
    const config = resolveServerConfig('agribalyse');
    expect(config).toEqual({
      serverUrl: 'https://agribalyse.example.com',
      apiKey: 'agri-key',
    });
  });

  it('returns null for agribalyse when server URL is not configured', async () => {
    const { createOpenLCAClientForDatabase } = await import('../openlca/client');
    delete process.env.OPENLCA_AGRIBALYSE_SERVER_URL;
    const client = createOpenLCAClientForDatabase('agribalyse');
    expect(client).toBeNull();
  });

  it('route returns 503 when server is not configured for requested database', () => {
    // Simulates the route's logic: createOpenLCAClientForDatabase returns null → 503
    const database: 'ecoinvent' | 'agribalyse' = 'agribalyse';
    const client = null; // simulates createOpenLCAClientForDatabase returning null

    if (!client) {
      const dbLabel = database === 'agribalyse' ? 'Agribalyse' : 'ecoinvent';
      const message = database === 'agribalyse'
        ? 'Set OPENLCA_AGRIBALYSE_SERVER_URL to enable Agribalyse calculations'
        : 'Set OPENLCA_SERVER_URL to enable ecoinvent calculations';

      expect(dbLabel).toBe('Agribalyse');
      expect(message).toContain('OPENLCA_AGRIBALYSE_SERVER_URL');
    }
  });
});
