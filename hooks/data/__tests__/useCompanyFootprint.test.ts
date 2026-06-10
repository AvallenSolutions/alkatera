/**
 * Unit Tests for useCompanyFootprint Hook
 *
 * The corporate-emissions cascade now runs server-side in
 * /api/emissions/corporate (CODE_REVIEW_2026-06-10.md P1); the hook is a thin
 * fetch wrapper. Tests cover: loading state, request construction, success /
 * empty / error paths, and refetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCompanyFootprint } from '../useCompanyFootprint';

// Mock the organization context
const mockUseOrganization = vi.fn();
vi.mock('@/lib/organizationContext', () => ({
  useOrganization: () => mockUseOrganization(),
}));

const mockOrganization = {
  id: 'org-123',
  name: 'Test Organization',
  slug: 'test-org',
  created_at: '2024-01-01T00:00:00Z',
};

const operationalPayload = {
  year: 2024,
  total_emissions: 150500,
  breakdown: {
    scope1: 25000,
    scope2: 15000,
    scope3: { total: 110500, products: 50000 },
    total: 150500,
  },
  status: 'Draft',
  last_updated: '2026-06-10T00:00:00.000Z',
  has_data: true,
  source: 'operational',
};

const emptyPayload = {
  year: 2024,
  total_emissions: 0,
  breakdown: null,
  status: 'Draft',
  last_updated: null,
  has_data: false,
};

function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => payload,
  } as Response);
}

const realFetch = global.fetch;

describe('useCompanyFootprint', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    mockUseOrganization.mockReturnValue({ currentOrganization: mockOrganization });
  });

  afterEach(() => {
    global.fetch = realFetch;
    vi.clearAllMocks();
  });

  it('starts loading when an organization exists', () => {
    mockFetchOnce(operationalPayload);
    const { result } = renderHook(() => useCompanyFootprint(2024));
    expect(result.current.loading).toBe(true);
  });

  it('sets loading false and fetches nothing without an organization', async () => {
    mockUseOrganization.mockReturnValue({ currentOrganization: null });
    const { result } = renderHook(() => useCompanyFootprint(2024));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('requests the server route with year and organization id', async () => {
    mockFetchOnce(operationalPayload);
    const { result } = renderHook(() => useCompanyFootprint(2024));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/emissions/corporate?year=2024&organization_id=org-123',
    );
  });

  it('exposes the server payload as the footprint', async () => {
    mockFetchOnce(operationalPayload);
    const { result } = renderHook(() => useCompanyFootprint(2024));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.footprint).toEqual(operationalPayload);
    expect(result.current.error).toBeNull();
  });

  it('handles empty years (has_data false)', async () => {
    mockFetchOnce(emptyPayload);
    const { result } = renderHook(() => useCompanyFootprint(2024));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.footprint?.has_data).toBe(false);
    expect(result.current.footprint?.breakdown).toBeNull();
  });

  it('surfaces server errors', async () => {
    mockFetchOnce({ error: 'Failed to compute corporate footprint' }, false, 500);
    const { result } = renderHook(() => useCompanyFootprint(2024));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to compute corporate footprint');
    expect(result.current.footprint).toBeNull();
  });

  it('surfaces network errors', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useCompanyFootprint(2024));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('network down');
  });

  it('clears the error on a successful refetch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useCompanyFootprint(2024));
    await waitFor(() => expect(result.current.error).toBe('network down'));

    mockFetchOnce(operationalPayload);
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.footprint).toEqual(operationalPayload);
  });

  it('defaults to the current year when none is provided', async () => {
    mockFetchOnce({ ...operationalPayload, year: new Date().getFullYear() });
    const { result } = renderHook(() => useCompanyFootprint());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain(`year=${new Date().getFullYear()}`);
  });
});
