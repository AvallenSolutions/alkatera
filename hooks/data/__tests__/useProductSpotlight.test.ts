/**
 * Unit Tests for useProductSpotlight Hook
 *
 * Tests cover:
 * - Initial loading state
 * - Empty / missing organisation handling
 * - Product-to-PCF mapping (status, CO2e, declared unit)
 * - CO2e summation across 6 GHG phase columns
 * - Rounding to 2 decimal places
 * - PCF deduplication (latest updated_at wins)
 * - Graceful degradation when PCF query fails
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ============================================================================
// MOCKS
// ============================================================================

// Mutable mock state — reset in beforeEach
let mockOrgReturn: { currentOrganization: any } = {
  currentOrganization: null,
};

// Per-table Supabase response data
let mockProductsData: any[] | null = [];
let mockProductsError: any = null;
let mockPcfData: any[] | null = [];
let mockPcfError: any = null;

/**
 * Creates a Proxy-based chainable query builder.
 * Every method call (select, eq, in, order, limit, ...) returns the chain.
 * When awaited the chain resolves with { data, error }.
 */
function createQueryChain(data: any, error: any) {
  const resolved = { data, error };
  const chain: any = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'then') return (cb: Function) => cb(resolved);
        return vi.fn().mockReturnValue(chain);
      },
    }
  );
  return chain;
}

const mockFrom = vi.fn((table: string) => {
  if (table === 'products')
    return createQueryChain(mockProductsData, mockProductsError);
  if (table === 'product_carbon_footprints')
    return createQueryChain(mockPcfData, mockPcfError);
  return createQueryChain(null, { message: 'Unknown table' });
});

vi.mock('@/lib/supabase/browser-client', () => ({
  getSupabaseBrowserClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/organizationContext', () => ({
  useOrganization: () => mockOrgReturn,
}));

// Import under test — AFTER mocks are registered
import { useProductSpotlight } from '../useProductSpotlight';

// ============================================================================
// TEST DATA
// ============================================================================

const mockOrganization = {
  id: 'org-123',
  name: 'Test Organisation',
  slug: 'test-org',
  created_at: '2024-01-01T00:00:00Z',
};

/** Helper to build a product row as returned by Supabase */
function makeProduct(
  id: string,
  name: string,
  imageUrl: string | null = null
) {
  return {
    id,
    name,
    product_image_url: imageUrl,
    updated_at: '2025-06-01T00:00:00Z',
  };
}

/** Helper to build a PCF row as returned by Supabase */
function makePcf(
  overrides: Partial<{
    id: string;
    product_id: string;
    functional_unit: string | null;
    status: string;
    updated_at: string;
    total_ghg_raw_materials: number | null;
    total_ghg_processing: number | null;
    total_ghg_packaging: number | null;
    total_ghg_transport: number | null;
    total_ghg_use: number | null;
    total_ghg_end_of_life: number | null;
  }> = {}
) {
  return {
    id: 'pcf-1',
    product_id: 'prod-1',
    functional_unit: '1 litre',
    status: 'completed',
    updated_at: '2025-06-01T00:00:00Z',
    total_ghg_raw_materials: 0,
    total_ghg_processing: 0,
    total_ghg_packaging: 0,
    total_ghg_transport: 0,
    total_ghg_use: 0,
    total_ghg_end_of_life: 0,
    ...overrides,
  };
}

// ============================================================================
// TEST SETUP
// ============================================================================

describe('useProductSpotlight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutable mock state
    mockOrgReturn = { currentOrganization: mockOrganization };
    mockProductsData = [];
    mockProductsError = null;
    mockPcfData = [];
    mockPcfError = null;
    // Suppress console.error during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // INITIAL / LOADING STATE
  // ==========================================================================

  it('starts in loading state', () => {
    const { result } = renderHook(() => useProductSpotlight());

    expect(result.current.loading).toBe(true);
    expect(result.current.products).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  // ==========================================================================
  // EMPTY / MISSING ORGANISATION
  // ==========================================================================

  it('returns empty products when no organisation', async () => {
    mockOrgReturn = { currentOrganization: null };

    const { result } = renderHook(() => useProductSpotlight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns empty products when product query returns no rows', async () => {
    mockProductsData = [];

    const { result } = renderHook(() => useProductSpotlight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  // ==========================================================================
  // PRODUCT-TO-PCF MAPPING
  // ==========================================================================

  it('maps products without PCFs as draft with null co2e', async () => {
    mockProductsData = [makeProduct('prod-1', 'Pale Ale', 'https://img.test/ale.png')];
    mockPcfData = [];

    const { result } = renderHook(() => useProductSpotlight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products).toHaveLength(1);
    const item = result.current.products[0];
    expect(item.id).toBe('prod-1');
    expect(item.name).toBe('Pale Ale');
    expect(item.image_url).toBe('https://img.test/ale.png');
    expect(item.lca_status).toBe('draft');
    expect(item.co2e_per_unit).toBeNull();
    expect(item.declared_unit).toBeNull();
  });

  it('maps PCF status "completed" to lca_status "completed"', async () => {
    mockProductsData = [makeProduct('prod-1', 'Lager')];
    mockPcfData = [
      makePcf({
        product_id: 'prod-1',
        status: 'completed',
        total_ghg_raw_materials: 1.5,
      }),
    ];

    const { result } = renderHook(() => useProductSpotlight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products[0].lca_status).toBe('completed');
  });

  it('maps PCF status "pending" to lca_status "in_progress"', async () => {
    mockProductsData = [makeProduct('prod-1', 'Stout')];
    mockPcfData = [
      makePcf({
        product_id: 'prod-1',
        status: 'pending',
        total_ghg_raw_materials: 2.0,
      }),
    ];

    const { result } = renderHook(() => useProductSpotlight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products[0].lca_status).toBe('in_progress');
  });

  it('maps unknown PCF status to lca_status "draft"', async () => {
    mockProductsData = [makeProduct('prod-1', 'Porter')];
    mockPcfData = [
      makePcf({
        product_id: 'prod-1',
        status: 'some_other_status',
      }),
    ];

    const { result } = renderHook(() => useProductSpotlight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products[0].lca_status).toBe('draft');
  });

  // ==========================================================================
  // CO2e SUMMATION & ROUNDING
  // ==========================================================================

  it('sums 6 total_ghg_* phase columns for co2e_per_unit', async () => {
    mockProductsData = [makeProduct('prod-1', 'IPA')];
    mockPcfData = [
      makePcf({
        product_id: 'prod-1',
        status: 'completed',
        total_ghg_raw_materials: 1.0,
        total_ghg_processing: 2.0,
        total_ghg_packaging: 3.0,
        total_ghg_transport: 4.0,
        total_ghg_use: 5.0,
        total_ghg_end_of_life: 6.0,
      }),
    ];

    const { result } = renderHook(() => useProductSpotlight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 1 + 2 + 3 + 4 + 5 + 6 = 21
    expect(result.current.products[0].co2e_per_unit).toBe(21);
  });

  it('rounds co2e_per_unit to 2 decimal places', async () => {
    mockProductsData = [makeProduct('prod-1', 'Wheat Beer')];
    mockPcfData = [
      makePcf({
        product_id: 'prod-1',
        status: 'completed',
        total_ghg_raw_materials: 1.111,
        total_ghg_processing: 2.222,
        total_ghg_packaging: 0,
        total_ghg_transport: 0,
        total_ghg_use: 0,
        total_ghg_end_of_life: 0,
      }),
    ];

    const { result } = renderHook(() => useProductSpotlight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 1.111 + 2.222 = 3.333 -> rounded to 3.33
    expect(result.current.products[0].co2e_per_unit).toBe(3.33);
  });

  it('returns null co2e for non-completed PCFs', async () => {
    mockProductsData = [makeProduct('prod-1', 'Saison')];
    mockPcfData = [
      makePcf({
        product_id: 'prod-1',
        status: 'pending',
        total_ghg_raw_materials: 10,
        total_ghg_processing: 5,
      }),
    ];

    const { result } = renderHook(() => useProductSpotlight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.products[0].lca_status).toBe('in_progress');
    expect(result.current.products[0].co2e_per_unit).toBeNull();
  });

  // ==========================================================================
  // DEDUPLICATION
  // ==========================================================================

  it('deduplicates multiple PCFs per product keeping latest updated_at', async () => {
    mockProductsData = [makeProduct('prod-1', 'Pilsner')];
    mockPcfData = [
      makePcf({
        id: 'pcf-old',
        product_id: 'prod-1',
        status: 'completed',
        updated_at: '2025-01-01T00:00:00Z',
        total_ghg_raw_materials: 99,
      }),
      makePcf({
        id: 'pcf-latest',
        product_id: 'prod-1',
        status: 'completed',
        updated_at: '2025-06-01T00:00:00Z',
        total_ghg_raw_materials: 7.5,
        functional_unit: '1 bottle',
      }),
    ];

    const { result } = renderHook(() => useProductSpotlight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should use the latest PCF (7.5 not 99)
    expect(result.current.products[0].co2e_per_unit).toBe(7.5);
    expect(result.current.products[0].declared_unit).toBe('1 bottle');
  });

  // ==========================================================================
  // GRACEFUL DEGRADATION
  // ==========================================================================

  it('continues without error when PCF query fails', async () => {
    mockProductsData = [
      makeProduct('prod-1', 'Amber Ale'),
      makeProduct('prod-2', 'Dark Lager'),
    ];
    // Simulate a PCF query that returns an error
    mockPcfError = { message: 'permission denied' };

    const { result } = renderHook(() => useProductSpotlight());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Products should still be returned, all as draft with null co2e
    expect(result.current.products).toHaveLength(2);
    expect(result.current.error).toBeNull();
    expect(result.current.products[0].lca_status).toBe('draft');
    expect(result.current.products[0].co2e_per_unit).toBeNull();
    expect(result.current.products[1].lca_status).toBe('draft');
    expect(result.current.products[1].co2e_per_unit).toBeNull();
  });
});
