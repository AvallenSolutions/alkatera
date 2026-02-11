import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenLCAClient, resolveServerConfig, createOpenLCAClientForDatabase, isAgribalyseConfigured } from '../openlca/client';

// ============================================================================
// resolveServerConfig()
// ============================================================================

describe('resolveServerConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('ecoinvent source', () => {
    it('returns null when OPENLCA_SERVER_URL is not set', () => {
      delete process.env.OPENLCA_SERVER_URL;
      expect(resolveServerConfig('ecoinvent')).toBeNull();
    });

    it('returns serverUrl and apiKey when configured', () => {
      process.env.OPENLCA_SERVER_URL = 'https://openlca.example.com';
      process.env.OPENLCA_API_KEY = 'my-api-key';
      const config = resolveServerConfig('ecoinvent');
      expect(config).toEqual({
        serverUrl: 'https://openlca.example.com',
        apiKey: 'my-api-key',
      });
    });

    it('returns serverUrl without apiKey when key is not set', () => {
      process.env.OPENLCA_SERVER_URL = 'https://openlca.example.com';
      delete process.env.OPENLCA_API_KEY;
      const config = resolveServerConfig('ecoinvent');
      expect(config).not.toBeNull();
      expect(config!.serverUrl).toBe('https://openlca.example.com');
    });
  });

  describe('agribalyse source', () => {
    it('returns null when OPENLCA_AGRIBALYSE_SERVER_URL is not set', () => {
      delete process.env.OPENLCA_AGRIBALYSE_SERVER_URL;
      expect(resolveServerConfig('agribalyse')).toBeNull();
    });

    it('returns agribalyse serverUrl and apiKey when configured', () => {
      process.env.OPENLCA_AGRIBALYSE_SERVER_URL = 'https://agribalyse.example.com';
      process.env.OPENLCA_AGRIBALYSE_API_KEY = 'agri-key';
      const config = resolveServerConfig('agribalyse');
      expect(config).toEqual({
        serverUrl: 'https://agribalyse.example.com',
        apiKey: 'agri-key',
      });
    });

    it('falls back to OPENLCA_API_KEY when OPENLCA_AGRIBALYSE_API_KEY is not set', () => {
      process.env.OPENLCA_AGRIBALYSE_SERVER_URL = 'https://agribalyse.example.com';
      delete process.env.OPENLCA_AGRIBALYSE_API_KEY;
      process.env.OPENLCA_API_KEY = 'shared-key';
      const config = resolveServerConfig('agribalyse');
      expect(config).not.toBeNull();
      expect(config!.apiKey).toBe('shared-key');
    });

    it('uses separate URLs for ecoinvent and agribalyse', () => {
      process.env.OPENLCA_SERVER_URL = 'https://ecoinvent.example.com';
      process.env.OPENLCA_AGRIBALYSE_SERVER_URL = 'https://agribalyse.example.com';
      const ecoinventConfig = resolveServerConfig('ecoinvent');
      const agribalyseConfig = resolveServerConfig('agribalyse');
      expect(ecoinventConfig!.serverUrl).not.toBe(agribalyseConfig!.serverUrl);
    });
  });
});

// ============================================================================
// createOpenLCAClientForDatabase()
// ============================================================================

describe('createOpenLCAClientForDatabase', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when ecoinvent server is not configured', () => {
    delete process.env.OPENLCA_SERVER_URL;
    expect(createOpenLCAClientForDatabase('ecoinvent')).toBeNull();
  });

  it('returns an OpenLCAClient for ecoinvent when configured', () => {
    process.env.OPENLCA_SERVER_URL = 'https://openlca.example.com';
    const client = createOpenLCAClientForDatabase('ecoinvent');
    expect(client).toBeInstanceOf(OpenLCAClient);
  });

  it('returns null when agribalyse server is not configured', () => {
    delete process.env.OPENLCA_AGRIBALYSE_SERVER_URL;
    expect(createOpenLCAClientForDatabase('agribalyse')).toBeNull();
  });

  it('returns an OpenLCAClient for agribalyse when configured', () => {
    process.env.OPENLCA_AGRIBALYSE_SERVER_URL = 'https://agribalyse.example.com';
    const client = createOpenLCAClientForDatabase('agribalyse');
    expect(client).toBeInstanceOf(OpenLCAClient);
  });

  it('creates separate client instances for each database', () => {
    process.env.OPENLCA_SERVER_URL = 'https://ecoinvent.example.com';
    process.env.OPENLCA_AGRIBALYSE_SERVER_URL = 'https://agribalyse.example.com';
    const ecoinventClient = createOpenLCAClientForDatabase('ecoinvent');
    const agribalyseClient = createOpenLCAClientForDatabase('agribalyse');
    expect(ecoinventClient).not.toBe(agribalyseClient);
  });
});

// ============================================================================
// isAgribalyseConfigured()
// ============================================================================

describe('isAgribalyseConfigured', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns false when OPENLCA_AGRIBALYSE_SERVER_URL is not set', () => {
    delete process.env.OPENLCA_AGRIBALYSE_SERVER_URL;
    expect(isAgribalyseConfigured()).toBe(false);
  });

  it('returns false when OPENLCA_AGRIBALYSE_SERVER_URL is empty string', () => {
    process.env.OPENLCA_AGRIBALYSE_SERVER_URL = '';
    expect(isAgribalyseConfigured()).toBe(false);
  });

  it('returns true when OPENLCA_AGRIBALYSE_SERVER_URL is set', () => {
    process.env.OPENLCA_AGRIBALYSE_SERVER_URL = 'https://agribalyse.example.com';
    expect(isAgribalyseConfigured()).toBe(true);
  });
});
