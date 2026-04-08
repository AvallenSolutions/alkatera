import { describe, it, expect } from 'vitest';
import { renderSustainabilityReportHtml } from '../render-sustainability-report-html';

// Minimal config and data to exercise the renderer without hitting the network
const minimalConfig = {
  reportName: 'Test Report',
  reportYear: 2025,
  reportingPeriodStart: '2025-01-01',
  reportingPeriodEnd: '2025-12-31',
  audience: 'investors',
  standards: ['csrd'],
  sections: ['executive-summary', 'scope-1-2-3', 'targets'],
  isMultiYear: false,
  reportYears: [2025],
  branding: { logo: null, primaryColor: '#ccff00', secondaryColor: '#10b981' },
};

const minimalData = {
  organization: { name: 'Acme Brewery', industry_sector: 'Brewing' },
  emissions: { scope1: 100, scope2: 50, scope3: 850, total: 1000, year: 2025 },
  emissionsTrends: [],
  products: [],
  facilities: [],
  standards: [],
  dataAvailability: {
    hasOrganization: true,
    hasEmissions: true,
    hasProducts: false,
    hasFacilities: false,
  },
};

describe('renderSustainabilityReportHtml — PDF mode (default)', () => {
  it('returns valid HTML', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Acme Brewery');
  });

  it('includes fixed A4 page dimensions', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any);
    expect(html).toContain('width: 794px');
    expect(html).toContain('height: 1123px');
  });

  it('includes page-break-after: always', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any);
    expect(html).toContain('page-break-after: always');
  });

  it('does NOT include screen-mode sticky nav', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any);
    expect(html).not.toContain('class="screen-nav"');
    expect(html).not.toContain('.screen-nav');
  });

  it('does NOT include max-width responsive layout', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any);
    // Should not have the screen-mode max-width override
    expect(html).not.toContain('max-width: 860px');
  });

  it('includes @page rule for A4', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any);
    expect(html).toContain('@page { size: A4; margin: 0; }');
  });

  it('includes report name in title tag', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any);
    expect(html).toContain('<title>Test Report');
  });

  it('uses the configured primary colour', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any);
    expect(html).toContain('#ccff00');
  });
});

describe('renderSustainabilityReportHtml — screen mode', () => {
  it('returns valid HTML', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: true });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Acme Brewery');
  });

  it('does NOT include fixed A4 height', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: true });
    expect(html).not.toContain('height: 1123px');
  });

  it('does NOT include page-break-after in .page CSS', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: true });
    // The .page CSS in screen mode should not have page-break-after: always
    // (it may appear in @media print but not in the screen mode .page rule)
    const styleBlock = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
    const pageRule = styleBlock.match(/\.page\s*\{([^}]+)\}/)?.[1] || '';
    expect(pageRule).not.toContain('page-break-after: always');
  });

  it('uses max-width responsive layout', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: true });
    expect(html).toContain('max-width: 860px');
  });

  it('includes sticky navigation bar', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: true });
    expect(html).toContain('class="screen-nav"');
  });

  it('sticky nav includes report name', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: true });
    expect(html).toContain('screen-nav-title');
    expect(html).toContain('Test Report');
  });

  it('sticky nav includes Overview link', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: true });
    expect(html).toContain('href="#section-overview"');
    expect(html).toContain('Overview');
  });

  it('sticky nav includes Emissions link when scope-1-2-3 is in sections', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: true });
    expect(html).toContain('href="#section-emissions"');
    expect(html).toContain('Emissions');
  });

  it('sticky nav omits People link when people-culture not in sections', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: true });
    expect(html).not.toContain('href="#section-people"');
  });

  it('sticky nav includes People link when people-culture is in sections', () => {
    const config = { ...minimalConfig, sections: [...minimalConfig.sections, 'people-culture'] };
    const html = renderSustainabilityReportHtml(config as any, minimalData as any, { screenMode: true });
    expect(html).toContain('href="#section-people"');
  });

  it('still includes the report content (cover page heading)', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: true });
    expect(html).toContain('Acme Brewery');
  });

  it('background is light grey for screen reading', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: true });
    expect(html).toContain('background: #f5f5f4');
  });
});

describe('renderSustainabilityReportHtml — options default behaviour', () => {
  it('defaults to PDF mode when no options are provided', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any);
    expect(html).toContain('height: 1123px');
    expect(html).not.toContain('class="screen-nav"');
  });

  it('defaults to PDF mode when screenMode is explicitly false', () => {
    const html = renderSustainabilityReportHtml(minimalConfig as any, minimalData as any, { screenMode: false });
    expect(html).toContain('height: 1123px');
    expect(html).not.toContain('class="screen-nav"');
  });
});
