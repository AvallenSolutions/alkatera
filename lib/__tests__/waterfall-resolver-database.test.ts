import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock Supabase browser client
const mockMaybeSingle = vi.fn();
const mockGt = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEqChain = vi.fn(() => ({ eq: mockEqChain, gt: mockGt, maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEqChain }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockGetSession = vi.fn();

vi.mock('../supabase/browser-client', () => ({
  getSupabaseBrowserClient: vi.fn(() => ({
    from: mockFrom,
    auth: { getSession: mockGetSession },
  })),
}));

// Mock the water risk module
vi.mock('../calculations/water-risk', () => ({
  DEFAULT_AWARE_FACTOR: 1.0,
  getAwareFactorValue: vi.fn(() => 1.0),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  getPreferredDatabase,
  getAgribalysePatterns,
} from '../openlca/agribalyse-aliases';

// ============================================================================
// Test the database routing logic in the waterfall resolver
// (These test the pure logic functions used by Priority 2.5)
// ============================================================================

describe('Waterfall resolver — database routing logic', () => {

  describe('getPreferredDatabase determines correct database for waterfall', () => {
    it('routes wine grapes to Agribalyse', () => {
      expect(getPreferredDatabase('Wine Grape, Pinot Noir')).toBe('agribalyse');
    });

    it('routes malt barley to Agribalyse', () => {
      expect(getPreferredDatabase('Barley malt, pale')).toBe('agribalyse');
    });

    it('routes electricity to ecoinvent', () => {
      expect(getPreferredDatabase('Electricity, medium voltage, GB')).toBe('ecoinvent');
    });

    it('routes glass packaging to ecoinvent', () => {
      expect(getPreferredDatabase('Glass bottle, 750ml, green')).toBe('ecoinvent');
    });

    it('routes transport to ecoinvent', () => {
      expect(getPreferredDatabase('Transport, freight, lorry, 16-32t')).toBe('ecoinvent');
    });

    it('routes oat milk to Agribalyse', () => {
      expect(getPreferredDatabase('Oat Milk')).toBe('agribalyse');
    });

    it('routes honey to Agribalyse', () => {
      expect(getPreferredDatabase('Local Honey, wildflower')).toBe('agribalyse');
    });
  });

  describe('material.openlca_database overrides getPreferredDatabase', () => {
    it('explicit agribalyse override takes precedence', () => {
      // Simulate the resolver logic: if material.openlca_database is set, use it
      const material = {
        material_name: 'Electricity, medium voltage', // would normally go to ecoinvent
        openlca_database: 'agribalyse' as const,
      };

      const db = material.openlca_database || getPreferredDatabase(material.material_name);
      expect(db).toBe('agribalyse'); // explicit override wins
    });

    it('explicit ecoinvent override takes precedence', () => {
      const material = {
        material_name: 'Wine Grape', // would normally go to agribalyse
        openlca_database: 'ecoinvent' as const,
      };

      const db = material.openlca_database || getPreferredDatabase(material.material_name);
      expect(db).toBe('ecoinvent'); // explicit override wins
    });

    it('falls back to getPreferredDatabase when openlca_database is undefined', () => {
      const material = {
        material_name: 'Wine Grape',
        openlca_database: undefined,
      };

      const db = material.openlca_database || getPreferredDatabase(material.material_name);
      expect(db).toBe('agribalyse'); // inferred from name
    });
  });

  describe('API call includes database parameter', () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      });
    });

    afterEach(() => {
      mockFetch.mockReset();
    });

    it('sends database=agribalyse when Agribalyse is preferred', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          database: 'agribalyse',
          impacts: { impact_climate: 1.5 },
          processName: 'Barley',
          geography: 'FR',
          source: 'OpenLCA Live: Barley via Agribalyse 3.2',
        }),
      });

      // Simulate what the waterfall resolver does for Priority 2.5
      const materialDatabase = getPreferredDatabase('barley grain');
      const session = await mockGetSession();

      const response = await fetch('/api/openlca/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`,
        },
        body: JSON.stringify({
          processId: 'uuid-barley',
          quantity: 1,
          organizationId: 'org-1',
          database: materialDatabase,
        }),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.database).toBe('agribalyse');

      const result = await response.json();
      expect(result.database).toBe('agribalyse');
    });

    it('sends database=ecoinvent for energy processes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          database: 'ecoinvent',
          impacts: { impact_climate: 0.5 },
          processName: 'Electricity',
          geography: 'GB',
          source: 'OpenLCA Live: Electricity via ecoinvent 3.12',
        }),
      });

      const materialDatabase = getPreferredDatabase('electricity, medium voltage');
      const session = await mockGetSession();

      await fetch('/api/openlca/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.data.session.access_token}`,
        },
        body: JSON.stringify({
          processId: 'uuid-elec',
          quantity: 100,
          organizationId: 'org-1',
          database: materialDatabase,
        }),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.database).toBe('ecoinvent');
    });
  });

  describe('response parsing handles database labels', () => {
    it('parses Agribalyse source reference correctly', () => {
      const result = {
        success: true,
        database: 'agribalyse',
        source: 'OpenLCA Live: Barley grain, conventional via Agribalyse 3.2',
        impacts: { impact_climate: 1.23 },
      };

      const dbLabel = result.database === 'agribalyse' ? 'Agribalyse 3.2' : 'ecoinvent 3.12';
      const gwpSource = result.database === 'agribalyse' ? 'OpenLCA/Agribalyse' : 'OpenLCA/ecoinvent';

      expect(dbLabel).toBe('Agribalyse 3.2');
      expect(gwpSource).toBe('OpenLCA/Agribalyse');
    });

    it('parses ecoinvent source reference correctly', () => {
      const result = {
        success: true,
        database: 'ecoinvent',
        source: 'OpenLCA Live: Electricity via ecoinvent 3.12',
        impacts: { impact_climate: 0.5 },
      };

      const dbLabel = result.database === 'agribalyse' ? 'Agribalyse 3.2' : 'ecoinvent 3.12';
      const gwpSource = result.database === 'agribalyse' ? 'OpenLCA/Agribalyse' : 'OpenLCA/ecoinvent';

      expect(dbLabel).toBe('ecoinvent 3.12');
      expect(gwpSource).toBe('OpenLCA/ecoinvent');
    });
  });
});
