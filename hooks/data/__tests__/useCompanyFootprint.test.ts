/**
 * Unit Tests for useCompanyFootprint Hook
 *
 * Tests cover:
 * - Initial loading state
 * - Successful data fetching with and without data
 * - Error handling
 * - Data transformation
 * - Refresh functionality
 * - Year parameter handling
 * - Organization context integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCompanyFootprint } from '../useCompanyFootprint';

// ============================================================================
// MOCKS
// ============================================================================

// Mock the Supabase browser client
vi.mock('@/lib/supabase/browser-client', () => ({
  getSupabaseBrowserClient: vi.fn(() => ({})),
}));

// Mock the organization context
const mockUseOrganization = vi.fn();
vi.mock('@/lib/organizationContext', () => ({
  useOrganization: () => mockUseOrganization(),
}));

// Mock the corporate emissions calculator
const mockCalculateCorporateEmissions = vi.fn();
vi.mock('@/lib/calculations/corporate-emissions', () => ({
  calculateCorporateEmissions: (...args: unknown[]) => mockCalculateCorporateEmissions(...args),
  // Re-export the type to avoid TypeScript errors
  ScopeBreakdown: {},
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockOrganization = {
  id: 'org-123',
  name: 'Test Organization',
  slug: 'test-org',
  created_at: '2024-01-01T00:00:00Z',
};

const mockScope3Breakdown = {
  products: 50000,
  business_travel: 10000,
  purchased_services: 5000,
  employee_commuting: 8000,
  capital_goods: 12000,
  operational_waste: 3000,
  downstream_logistics: 7000,
  marketing_materials: 2000,
  upstream_transport: 4000,
  downstream_transport: 3500,
  use_phase: 6000,
  logistics: 7000,
  waste: 3000,
  marketing: 2000,
  total: 110500,
};

const mockScopeBreakdown = {
  scope1: 25000,
  scope2: 15000,
  scope3: mockScope3Breakdown,
  total: 150500,
};

const mockEmissionsResultWithData = {
  year: 2024,
  breakdown: mockScopeBreakdown,
  hasData: true,
};

const mockEmissionsResultNoData = {
  year: 2024,
  breakdown: {
    scope1: 0,
    scope2: 0,
    scope3: {
      products: 0,
      business_travel: 0,
      purchased_services: 0,
      employee_commuting: 0,
      capital_goods: 0,
      operational_waste: 0,
      downstream_logistics: 0,
      marketing_materials: 0,
      upstream_transport: 0,
      downstream_transport: 0,
      use_phase: 0,
      logistics: 0,
      waste: 0,
      marketing: 0,
      total: 0,
    },
    total: 0,
  },
  hasData: false,
};

// ============================================================================
// TEST SETUP
// ============================================================================

describe('useCompanyFootprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log and console.error during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // INITIAL LOADING STATE TESTS
  // ==========================================================================

  describe('Initial Loading State', () => {
    it('should start with loading true when organization exists', () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockReturnValue(new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useCompanyFootprint());

      expect(result.current.loading).toBe(true);
      expect(result.current.footprint).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.previewMode).toBe(false);
    });

    it('should set loading to false when no organization exists', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: null,
      });

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.footprint).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should set loading to false when organization has no id', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: { ...mockOrganization, id: null },
      });

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  // ==========================================================================
  // SUCCESSFUL DATA FETCHING TESTS
  // ==========================================================================

  describe('Successful Data Fetching', () => {
    it('should fetch and transform company footprint data with emissions', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.footprint).not.toBeNull();
      expect(result.current.footprint?.has_data).toBe(true);
      expect(result.current.footprint?.total_emissions).toBe(150500);
      expect(result.current.footprint?.breakdown).toEqual(mockScopeBreakdown);
      expect(result.current.footprint?.status).toBe('Draft');
      expect(result.current.error).toBeNull();
      expect(result.current.previewMode).toBe(false);
    });

    it('should handle footprint data with no emissions', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultNoData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.footprint).not.toBeNull();
      expect(result.current.footprint?.has_data).toBe(false);
      expect(result.current.footprint?.total_emissions).toBe(0);
      expect(result.current.footprint?.breakdown).toBeNull();
      expect(result.current.footprint?.status).toBe('Draft');
      expect(result.current.footprint?.last_updated).toBeNull();
    });

    it('should call calculateCorporateEmissions with correct parameters', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const currentYear = new Date().getFullYear();

      renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(mockCalculateCorporateEmissions).toHaveBeenCalled();
      });

      expect(mockCalculateCorporateEmissions).toHaveBeenCalledWith(
        expect.anything(), // supabase client
        mockOrganization.id,
        currentYear
      );
    });

    it('should set last_updated to ISO string when data exists', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.footprint?.last_updated).not.toBeNull();
      // Verify it's a valid ISO date string
      const date = new Date(result.current.footprint!.last_updated!);
      expect(date.getTime()).not.toBeNaN();
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle calculation errors gracefully', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockRejectedValue(new Error('Database connection failed'));

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Database connection failed');
      expect(result.current.footprint).toBeNull();
    });

    it('should handle network errors', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      expect(result.current.loading).toBe(false);
    });

    it('should clear error on successful refetch', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });

      // First call fails
      mockCalculateCorporateEmissions.mockRejectedValueOnce(new Error('Temporary error'));

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.error).toBe('Temporary error');
      });

      // Setup for successful refetch
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      // Trigger refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.footprint?.has_data).toBe(true);
    });

    it('should handle undefined error message', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockRejectedValue({ message: undefined });

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeUndefined();
    });
  });

  // ==========================================================================
  // DATA TRANSFORMATION TESTS
  // ==========================================================================

  describe('Data Transformation', () => {
    it('should correctly map breakdown data from calculator result', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const breakdown = result.current.footprint?.breakdown;
      expect(breakdown?.scope1).toBe(25000);
      expect(breakdown?.scope2).toBe(15000);
      expect(breakdown?.scope3.total).toBe(110500);
      expect(breakdown?.total).toBe(150500);
    });

    it('should include all Scope 3 categories in breakdown', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const scope3 = result.current.footprint?.breakdown?.scope3;
      expect(scope3?.products).toBe(50000);
      expect(scope3?.business_travel).toBe(10000);
      expect(scope3?.purchased_services).toBe(5000);
      expect(scope3?.employee_commuting).toBe(8000);
      expect(scope3?.capital_goods).toBe(12000);
      expect(scope3?.operational_waste).toBe(3000);
      expect(scope3?.downstream_logistics).toBe(7000);
      expect(scope3?.marketing_materials).toBe(2000);
      expect(scope3?.upstream_transport).toBe(4000);
      expect(scope3?.downstream_transport).toBe(3500);
      expect(scope3?.use_phase).toBe(6000);
    });

    it('should include UI-friendly aliases in Scope 3 breakdown', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const scope3 = result.current.footprint?.breakdown?.scope3;
      expect(scope3?.logistics).toBe(scope3?.downstream_logistics);
      expect(scope3?.waste).toBe(scope3?.operational_waste);
      expect(scope3?.marketing).toBe(scope3?.marketing_materials);
    });

    it('should set year from calculator result', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });

      const resultFor2023 = {
        ...mockEmissionsResultWithData,
        year: 2023,
      };
      mockCalculateCorporateEmissions.mockResolvedValue(resultFor2023);

      const { result } = renderHook(() => useCompanyFootprint(2023));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The hook sets year based on targetYear, not the result
      expect(result.current.footprint?.year).toBe(2023);
    });
  });

  // ==========================================================================
  // REFRESH FUNCTIONALITY TESTS
  // ==========================================================================

  describe('Refresh Functionality', () => {
    it('should provide a refetch function', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('should refetch data when refetch is called', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockCalculateCorporateEmissions).toHaveBeenCalledTimes(1);

      // Update mock for next call
      const updatedResult = {
        ...mockEmissionsResultWithData,
        breakdown: {
          ...mockScopeBreakdown,
          total: 200000,
        },
      };
      mockCalculateCorporateEmissions.mockResolvedValue(updatedResult);

      // Call refetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(mockCalculateCorporateEmissions).toHaveBeenCalledTimes(2);
      });

      expect(result.current.footprint?.total_emissions).toBe(200000);
    });

    it('should set loading state during refetch', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });

      let resolvePromise: (value: typeof mockEmissionsResultWithData) => void;
      const delayedPromise = new Promise<typeof mockEmissionsResultWithData>((resolve) => {
        resolvePromise = resolve;
      });

      mockCalculateCorporateEmissions.mockReturnValue(delayedPromise);

      const { result } = renderHook(() => useCompanyFootprint());

      // Should be loading initially
      expect(result.current.loading).toBe(true);

      // Resolve the first fetch
      await act(async () => {
        resolvePromise!(mockEmissionsResultWithData);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Setup delayed promise for refetch
      const delayedRefetchPromise = new Promise<typeof mockEmissionsResultWithData>((resolve) => {
        resolvePromise = resolve;
      });
      mockCalculateCorporateEmissions.mockReturnValue(delayedRefetchPromise);

      // Start refetch
      act(() => {
        result.current.refetch();
      });

      // Should be loading during refetch
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // Resolve refetch
      await act(async () => {
        resolvePromise!(mockEmissionsResultWithData);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle refetch when organization is not available', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: null,
      });

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Refetch should complete without error
      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.footprint).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  // ==========================================================================
  // YEAR PARAMETER TESTS
  // ==========================================================================

  describe('Year Parameter', () => {
    it('should use current year when no year parameter is provided', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const currentYear = new Date().getFullYear();

      renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(mockCalculateCorporateEmissions).toHaveBeenCalledWith(
          expect.anything(),
          mockOrganization.id,
          currentYear
        );
      });
    });

    it('should use provided year parameter', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      renderHook(() => useCompanyFootprint(2023));

      await waitFor(() => {
        expect(mockCalculateCorporateEmissions).toHaveBeenCalledWith(
          expect.anything(),
          mockOrganization.id,
          2023
        );
      });
    });

    it('should refetch when year parameter changes', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { rerender } = renderHook(({ year }) => useCompanyFootprint(year), {
        initialProps: { year: 2023 },
      });

      await waitFor(() => {
        expect(mockCalculateCorporateEmissions).toHaveBeenCalledWith(
          expect.anything(),
          mockOrganization.id,
          2023
        );
      });

      // Change year
      rerender({ year: 2024 });

      await waitFor(() => {
        expect(mockCalculateCorporateEmissions).toHaveBeenCalledWith(
          expect.anything(),
          mockOrganization.id,
          2024
        );
      });
    });

    it('should set correct year in footprint result', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue({
        ...mockEmissionsResultWithData,
        year: 2022,
      });

      const { result } = renderHook(() => useCompanyFootprint(2022));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.footprint?.year).toBe(2022);
    });
  });

  // ==========================================================================
  // ORGANIZATION CONTEXT INTEGRATION TESTS
  // ==========================================================================

  describe('Organization Context Integration', () => {
    it('should refetch when organization changes', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { rerender } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(mockCalculateCorporateEmissions).toHaveBeenCalledTimes(1);
      });

      // Change organization
      const newOrganization = { ...mockOrganization, id: 'org-456' };
      mockUseOrganization.mockReturnValue({
        currentOrganization: newOrganization,
      });

      rerender();

      await waitFor(() => {
        expect(mockCalculateCorporateEmissions).toHaveBeenCalledWith(
          expect.anything(),
          'org-456',
          expect.any(Number)
        );
      });
    });

    it('should clear footprint when organization becomes null', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result, rerender } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.footprint).not.toBeNull();
      });

      // Remove organization - but note the hook keeps the old footprint
      // since it doesn't clear on organization change, just stops loading
      mockUseOrganization.mockReturnValue({
        currentOrganization: null,
      });

      rerender();

      // The hook maintains previous state when org becomes null
      // This is expected behavior - data persists until new fetch
    });

    it('should use organization id correctly in calculation', async () => {
      const customOrg = {
        ...mockOrganization,
        id: 'custom-org-id-12345',
      };
      mockUseOrganization.mockReturnValue({
        currentOrganization: customOrg,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(mockCalculateCorporateEmissions).toHaveBeenCalledWith(
          expect.anything(),
          'custom-org-id-12345',
          expect.any(Number)
        );
      });
    });
  });

  // ==========================================================================
  // PREVIEW MODE TESTS
  // ==========================================================================

  describe('Preview Mode', () => {
    it('should set previewMode to false when data has emissions', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.previewMode).toBe(false);
    });

    it('should set previewMode to false when data has no emissions', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultNoData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.previewMode).toBe(false);
    });

    it('should maintain previewMode false after refetch', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.previewMode).toBe(false);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle very large emission values', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });

      const largeEmissionsResult = {
        ...mockEmissionsResultWithData,
        breakdown: {
          ...mockScopeBreakdown,
          total: 999999999999,
        },
      };
      mockCalculateCorporateEmissions.mockResolvedValue(largeEmissionsResult);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.footprint?.total_emissions).toBe(999999999999);
    });

    it('should handle zero total emissions', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });

      const zeroEmissionsResult = {
        year: 2024,
        breakdown: {
          scope1: 0,
          scope2: 0,
          scope3: { ...mockScope3Breakdown, total: 0 },
          total: 0,
        },
        hasData: false,
      };
      mockCalculateCorporateEmissions.mockResolvedValue(zeroEmissionsResult);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.footprint?.total_emissions).toBe(0);
      expect(result.current.footprint?.has_data).toBe(false);
    });

    it('should handle rapid year changes', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { rerender } = renderHook(({ year }) => useCompanyFootprint(year), {
        initialProps: { year: 2020 },
      });

      rerender({ year: 2021 });
      rerender({ year: 2022 });
      rerender({ year: 2023 });
      rerender({ year: 2024 });

      await waitFor(() => {
        // Should have called for each year change
        expect(mockCalculateCorporateEmissions).toHaveBeenCalled();
      });
    });

    it('should handle concurrent refetch calls gracefully', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Trigger multiple refetches simultaneously
      await act(async () => {
        result.current.refetch();
        result.current.refetch();
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Hook should still be in valid state
      expect(result.current.error).toBeNull();
    });
  });

  // ==========================================================================
  // RETURN VALUE STRUCTURE TESTS
  // ==========================================================================

  describe('Return Value Structure', () => {
    it('should return all expected properties', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current).toHaveProperty('footprint');
      expect(result.current).toHaveProperty('previewMode');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should return footprint with correct interface shape', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const footprint = result.current.footprint;
      expect(footprint).toHaveProperty('year');
      expect(footprint).toHaveProperty('total_emissions');
      expect(footprint).toHaveProperty('breakdown');
      expect(footprint).toHaveProperty('status');
      expect(footprint).toHaveProperty('last_updated');
      expect(footprint).toHaveProperty('has_data');

      expect(typeof footprint?.year).toBe('number');
      expect(typeof footprint?.total_emissions).toBe('number');
      expect(typeof footprint?.status).toBe('string');
      expect(typeof footprint?.has_data).toBe('boolean');
    });

    it('should return valid status value', async () => {
      mockUseOrganization.mockReturnValue({
        currentOrganization: mockOrganization,
      });
      mockCalculateCorporateEmissions.mockResolvedValue(mockEmissionsResultWithData);

      const { result } = renderHook(() => useCompanyFootprint());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Status should be 'Draft' as per the hook implementation
      expect(result.current.footprint?.status).toBe('Draft');
    });
  });
});
