/**
 * Generate PDF Route Test Suite
 *
 * Tests the POST /api/lca/[id]/generate-pdf API route:
 * - Authentication (401 for missing/invalid token)
 * - Data fetching (404 for missing PCF)
 * - Pipeline: transform → render HTML → PDFShift → return buffer
 * - Content-Type/Disposition headers
 * - AI narratives (optional, timeout, non-blocking)
 * - Usage counter (increment_report_count)
 * - Inline vs attachment mode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

const mockSupabaseConstructor = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => {
    mockSupabaseConstructor(...args);
    return {
      auth: { getUser: mockGetUser },
      from: mockFrom,
      rpc: mockRpc,
    };
  },
}));

const mockTransformLCADataForReport = vi.fn();
vi.mock('@/lib/utils/lca-report-transformer', () => ({
  transformLCADataForReport: (...args: unknown[]) => mockTransformLCADataForReport(...args),
}));

const mockRenderLcaReportHtml = vi.fn();
vi.mock('@/lib/pdf/render-lca-html', () => ({
  renderLcaReportHtml: (...args: unknown[]) => mockRenderLcaReportHtml(...args),
}));

const mockConvertHtmlToPdf = vi.fn();
vi.mock('@/lib/pdf/pdfshift-client', () => ({
  convertHtmlToPdf: (...args: unknown[]) => mockConvertHtmlToPdf(...args),
}));

const mockGenerateNarratives = vi.fn();
vi.mock('@/lib/claude/lca-assistant', () => ({
  generateNarratives: (...args: unknown[]) => mockGenerateNarratives(...args),
}));

import { POST } from '../generate-pdf/route';

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_PCF = {
  id: 'pcf-001',
  product_id: 'prod-001',
  organization_id: 'org-001',
  product_name: 'Test Pale Ale',
  system_boundary: 'cradle-to-gate',
  functional_unit: '1 × 330 mL can',
  aggregated_impacts: { climate_change_gwp100: 0.675 },
  product_image_url: null,
};

const MOCK_MATERIALS = [
  { material_name: 'Pale Malt', impact_climate: 0.450 },
  { material_name: 'Aluminium Can', impact_climate: 0.225 },
];

const MOCK_REPORT_DATA = {
  executiveSummary: { content: 'Test summary' },
  productName: 'Test Pale Ale',
};

const PDF_BUFFER = Buffer.from('fake-pdf-content');

// ============================================================================
// QUERY MOCK HELPER
// ============================================================================

function createChainMock(response: { data: unknown; error: unknown }) {
  const mock: Record<string, any> = {};
  const chainable = ['select', 'eq', 'neq', 'order', 'limit', 'in'];
  chainable.forEach(m => { mock[m] = vi.fn().mockReturnValue(mock); });
  mock.single = vi.fn().mockResolvedValue(response);
  mock.maybeSingle = vi.fn().mockResolvedValue(response);
  mock.then = (resolve: (r: typeof response) => void) => {
    resolve(response);
    return Promise.resolve(response);
  };
  return mock;
}

// ============================================================================
// REQUEST BUILDER
// ============================================================================

function createRequest(options: {
  token?: string;
  body?: Record<string, unknown>;
} = {}) {
  const headers: Record<string, string> = {};
  if (options.token !== undefined) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  return new NextRequest('http://localhost:3000/api/lca/pcf-001/generate-pdf', {
    method: 'POST',
    headers,
    body: JSON.stringify(options.body || {}),
  });
}

const PARAMS = Promise.resolve({ id: 'pcf-001' });

// ============================================================================
// SETUP
// ============================================================================

function setupDefaultMocks() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-001' } },
    error: null,
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'product_carbon_footprints') {
      return createChainMock({ data: MOCK_PCF, error: null });
    }
    if (table === 'product_carbon_footprint_materials') {
      return createChainMock({ data: MOCK_MATERIALS, error: null });
    }
    if (table === 'organizations') {
      return createChainMock({ data: { name: 'Test Org' }, error: null });
    }
    if (table === 'products') {
      return createChainMock({ data: { product_image_url: null, image_url: null }, error: null });
    }
    return createChainMock({ data: null, error: null });
  });

  mockTransformLCADataForReport.mockReturnValue(MOCK_REPORT_DATA);
  mockRenderLcaReportHtml.mockReturnValue('<html>Test Report</html>');
  mockConvertHtmlToPdf.mockResolvedValue({ buffer: PDF_BUFFER });
  mockRpc.mockResolvedValue({ data: null, error: null });
}

// ============================================================================
// TESTS
// ============================================================================

describe('POST /api/lca/[id]/generate-pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    // Set env vars for Supabase
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  // --------------------------------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------------------------------

  describe('Authentication', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/lca/pcf-001/generate-pdf', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await POST(req, { params: PARAMS });
      expect(res.status).toBe(401);
    });

    it('returns 401 when token format is invalid (no Bearer prefix)', async () => {
      const req = new NextRequest('http://localhost:3000/api/lca/pcf-001/generate-pdf', {
        method: 'POST',
        headers: { Authorization: 'Token abc123' },
        body: JSON.stringify({}),
      });

      const res = await POST(req, { params: PARAMS });
      expect(res.status).toBe(401);
    });

    it('returns 401 when user validation fails', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const req = createRequest({ token: 'invalid-token' });
      const res = await POST(req, { params: PARAMS });
      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------

  describe('Data fetching', () => {
    it('returns 404 when PCF record not found', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'product_carbon_footprints') {
          return createChainMock({ data: null, error: { message: 'Not found' } });
        }
        return createChainMock({ data: null, error: null });
      });

      const req = createRequest({ token: 'valid-token' });
      const res = await POST(req, { params: PARAMS });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('LCA record not found');
    });
  });

  // --------------------------------------------------------------------------
  // SUCCESSFUL PDF GENERATION
  // --------------------------------------------------------------------------

  describe('Successful generation', () => {
    it('returns 200 with PDF content type', async () => {
      const req = createRequest({ token: 'valid-token' });
      const res = await POST(req, { params: PARAMS });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
    });

    it('returns Content-Disposition attachment by default', async () => {
      const req = createRequest({ token: 'valid-token' });
      const res = await POST(req, { params: PARAMS });

      const disposition = res.headers.get('Content-Disposition');
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('LCA_Report_Test_Pale_Ale_');
      expect(disposition).toContain('.pdf');
    });

    it('returns Content-Disposition inline when inline=true', async () => {
      const req = createRequest({ token: 'valid-token', body: { inline: true } });
      const res = await POST(req, { params: PARAMS });

      const disposition = res.headers.get('Content-Disposition');
      expect(disposition).toContain('inline');
    });

    it('includes Content-Length header', async () => {
      const req = createRequest({ token: 'valid-token' });
      const res = await POST(req, { params: PARAMS });

      expect(res.headers.get('Content-Length')).toBe(String(PDF_BUFFER.length));
    });

    it('includes Cache-Control: private, no-cache', async () => {
      const req = createRequest({ token: 'valid-token' });
      const res = await POST(req, { params: PARAMS });

      expect(res.headers.get('Cache-Control')).toBe('private, no-cache');
    });
  });

  // --------------------------------------------------------------------------
  // PIPELINE CALLS
  // --------------------------------------------------------------------------

  describe('Pipeline', () => {
    it('calls transformLCADataForReport with PCF data', async () => {
      const req = createRequest({ token: 'valid-token' });
      await POST(req, { params: PARAMS });

      expect(mockTransformLCADataForReport).toHaveBeenCalledTimes(1);
      expect(mockTransformLCADataForReport).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pcf-001' }),
        null,
        expect.objectContaining({ name: 'Test Org' }),
      );
    });

    it('calls renderLcaReportHtml with transformed data', async () => {
      const req = createRequest({ token: 'valid-token' });
      await POST(req, { params: PARAMS });

      expect(mockRenderLcaReportHtml).toHaveBeenCalledTimes(1);
      expect(mockRenderLcaReportHtml).toHaveBeenCalledWith(MOCK_REPORT_DATA);
    });

    it('calls convertHtmlToPdf with HTML and A4 options', async () => {
      const req = createRequest({ token: 'valid-token' });
      await POST(req, { params: PARAMS });

      expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(1);
      expect(mockConvertHtmlToPdf).toHaveBeenCalledWith(
        '<html>Test Report</html>',
        expect.objectContaining({
          format: 'A4',
          landscape: false,
          removeBlank: true,
        }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // AI NARRATIVES
  // --------------------------------------------------------------------------

  describe('AI narratives', () => {
    it('does not call generateNarratives when includeNarratives is false', async () => {
      const req = createRequest({ token: 'valid-token', body: { includeNarratives: false } });
      await POST(req, { params: PARAMS });

      expect(mockGenerateNarratives).not.toHaveBeenCalled();
    });

    it('calls generateNarratives when includeNarratives is true', async () => {
      mockGenerateNarratives.mockResolvedValue({
        executiveSummary: 'AI-generated summary',
      });

      const req = createRequest({ token: 'valid-token', body: { includeNarratives: true } });
      await POST(req, { params: PARAMS });

      expect(mockGenerateNarratives).toHaveBeenCalledTimes(1);
    });

    it('PDF still generates when narrative generation fails', async () => {
      mockGenerateNarratives.mockRejectedValue(new Error('AI service down'));

      const req = createRequest({ token: 'valid-token', body: { includeNarratives: true } });
      const res = await POST(req, { params: PARAMS });

      // PDF should still succeed
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
    });
  });

  // --------------------------------------------------------------------------
  // USAGE COUNTER
  // --------------------------------------------------------------------------

  describe('Report count increment', () => {
    it('calls increment_report_count RPC after PDF generation', async () => {
      const req = createRequest({ token: 'valid-token' });
      await POST(req, { params: PARAMS });

      expect(mockRpc).toHaveBeenCalledWith(
        'increment_report_count',
        expect.objectContaining({
          p_organization_id: 'org-001',
          p_user_id: 'user-001',
        }),
      );
    });

    it('PDF delivery succeeds even when report count fails', async () => {
      mockRpc.mockRejectedValue(new Error('RPC failed'));

      const req = createRequest({ token: 'valid-token' });
      const res = await POST(req, { params: PARAMS });

      // Should still return the PDF
      expect(res.status).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // ERROR HANDLING
  // --------------------------------------------------------------------------

  describe('Error handling', () => {
    it('returns 500 with step=transform when transform fails', async () => {
      mockTransformLCADataForReport.mockImplementation(() => {
        throw new Error('Transform failed');
      });

      const req = createRequest({ token: 'valid-token' });
      const res = await POST(req, { params: PARAMS });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.step).toBe('transform');
      expect(json.error).toContain('transform');
    });

    it('returns 500 with step=render when HTML render fails', async () => {
      mockRenderLcaReportHtml.mockImplementation(() => {
        throw new Error('Render failed');
      });

      const req = createRequest({ token: 'valid-token' });
      const res = await POST(req, { params: PARAMS });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.step).toBe('render');
    });

    it('returns 500 with step=pdfshift when PDF conversion fails', async () => {
      mockConvertHtmlToPdf.mockRejectedValue(new Error('PDFShift error'));

      const req = createRequest({ token: 'valid-token' });
      const res = await POST(req, { params: PARAMS });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.step).toBe('pdfshift');
    });
  });
});
