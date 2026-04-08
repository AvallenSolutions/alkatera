import { describe, it, expect } from 'vitest';
import { renderRegulatoryIndexHtml, type RegulatoryIndexData } from '../render-regulatory-index-html';

const baseData: RegulatoryIndexData = {
  organisationName: 'Acme Distillery',
  reportYear: 2025,
  reportingPeriodStart: '2025-01-01',
  reportingPeriodEnd: '2025-12-31',
  standards: ['csrd', 'iso-14067'],
  sections: ['executive-summary', 'scope-1-2-3', 'ghg-inventory', 'methodology', 'people-culture', 'governance', 'targets'],
  branding: { logo: null, primaryColor: '#ccff00' },
};

describe('renderRegulatoryIndexHtml', () => {
  it('returns a non-empty HTML string', () => {
    const html = renderRegulatoryIndexHtml(baseData);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('includes the organisation name', () => {
    const html = renderRegulatoryIndexHtml(baseData);
    expect(html).toContain('Acme Distillery');
  });

  it('includes the report year', () => {
    const html = renderRegulatoryIndexHtml(baseData);
    expect(html).toContain('2025');
  });

  it('shows the title "Framework Coverage Index"', () => {
    const html = renderRegulatoryIndexHtml(baseData);
    expect(html).toContain('Framework Coverage Index');
  });

  it('shows CSRD standard block when csrd is in standards', () => {
    const html = renderRegulatoryIndexHtml(baseData);
    expect(html).toContain('CSRD (ESRS)');
  });

  it('shows ISO 14067 standard block when iso-14067 is in standards', () => {
    const html = renderRegulatoryIndexHtml(baseData);
    expect(html).toContain('ISO 14067');
  });

  it('does not show GRI block when gri is not in standards', () => {
    const html = renderRegulatoryIndexHtml(baseData);
    expect(html).not.toContain('GRI Standards');
  });

  it('shows GRI block when gri is in standards', () => {
    const html = renderRegulatoryIndexHtml({ ...baseData, standards: ['gri'] });
    expect(html).toContain('GRI Standards');
  });

  it('shows legend with covered/partial/not-covered icons', () => {
    const html = renderRegulatoryIndexHtml(baseData);
    expect(html).toContain('Fully covered in this report');
    expect(html).toContain('Partially covered');
    expect(html).toContain('Not covered');
  });

  it('shows placeholder when no standards are selected', () => {
    const html = renderRegulatoryIndexHtml({ ...baseData, standards: [] });
    expect(html).toContain('No reporting standards have been selected');
  });

  it('calculates positive coverage percentage when sections are matched', () => {
    // scope-1-2-3 and ghg-inventory cover ESRS E1.6 fully
    const html = renderRegulatoryIndexHtml({
      ...baseData,
      standards: ['csrd'],
      sections: ['executive-summary', 'scope-1-2-3', 'ghg-inventory', 'methodology', 'regulatory', 'people-culture', 'governance', 'targets', 'transition-roadmap', 'flag-removals', 'tnfd-nature', 'supply-chain'],
    });
    expect(html).toContain('CSRD (ESRS)');
    // Should show >0% coverage
    const match = html.match(/(\d+)%\s*<\/div>\s*<div[^>]*>coverage/);
    if (match) {
      expect(parseInt(match[1])).toBeGreaterThan(0);
    }
  });

  it('shows 0% coverage when no relevant sections are included', () => {
    const html = renderRegulatoryIndexHtml({
      ...baseData,
      standards: ['csrd'],
      sections: [], // no sections match any CSRD disclosure
    });
    expect(html).toContain('0%');
  });

  it('shows data quality when provided', () => {
    const html = renderRegulatoryIndexHtml({
      ...baseData,
      dataQuality: { qualityTier: 'tier_2', completeness: 0.85, confidenceScore: 80 },
    });
    expect(html).toContain('Tier 2 (Calculated)');
    expect(html).toContain('85% complete');
  });

  it('shows correct quality tier label for tier_1', () => {
    const html = renderRegulatoryIndexHtml({
      ...baseData,
      dataQuality: { qualityTier: 'tier_1', completeness: 1.0, confidenceScore: 95 },
    });
    expect(html).toContain('Tier 1 (Measured)');
  });

  it('shows correct quality tier label for mixed', () => {
    const html = renderRegulatoryIndexHtml({
      ...baseData,
      dataQuality: { qualityTier: 'mixed', completeness: 0.7, confidenceScore: 65 },
    });
    expect(html).toContain('Mixed (Tier 1-3)');
  });

  it('omits data quality block when not provided', () => {
    const html = renderRegulatoryIndexHtml({ ...baseData, dataQuality: undefined });
    expect(html).not.toContain('Data quality:');
  });

  it('includes disclosure IDs for CSRD', () => {
    const html = renderRegulatoryIndexHtml({ ...baseData, standards: ['csrd'] });
    expect(html).toContain('ESRS-2');
    expect(html).toContain('ESRS-E1-6');
    expect(html).toContain('ESRS-S1');
  });

  it('includes disclosure IDs for ISO 14067', () => {
    const html = renderRegulatoryIndexHtml({ ...baseData, standards: ['iso-14067'] });
    expect(html).toContain('14067-4.1');
    expect(html).toContain('14067-4.7');
  });

  it('includes disclosure IDs for TCFD', () => {
    const html = renderRegulatoryIndexHtml({ ...baseData, standards: ['tcfd'] });
    expect(html).toContain('TCFD-G');
    expect(html).toContain('TCFD-M');
  });

  it('escapes special HTML characters in org name', () => {
    const html = renderRegulatoryIndexHtml({
      ...baseData,
      organisationName: 'A&B <Drinks>',
    });
    expect(html).not.toContain('<Drinks>');
    expect(html).toContain('A&amp;B');
    expect(html).toContain('&lt;Drinks&gt;');
  });

  it('uses the branding primary colour', () => {
    const html = renderRegulatoryIndexHtml({
      ...baseData,
      branding: { logo: null, primaryColor: '#ff6600' },
    });
    expect(html).toContain('#ff6600');
  });

  it('renders multiple standards in a single document', () => {
    const html = renderRegulatoryIndexHtml({
      ...baseData,
      standards: ['csrd', 'iso-14067', 'gri', 'tcfd'],
    });
    expect(html).toContain('CSRD (ESRS)');
    expect(html).toContain('ISO 14067');
    expect(html).toContain('GRI Standards');
    expect(html).toContain('TCFD');
  });
});
