import { describe, it, expect } from 'vitest';
import { renderInvestorSummaryHtml, type InvestorSummaryData } from '../render-investor-summary-html';

const baseData: InvestorSummaryData = {
  organisationName: 'Acme Brewery',
  reportYear: 2025,
  reportingPeriodStart: '2025-01-01',
  reportingPeriodEnd: '2025-12-31',
  sector: 'Brewing',
  emissions: { scope1: 100, scope2: 50, scope3: 850, total: 1000 },
  branding: { logo: null, primaryColor: '#ccff00' },
};

describe('renderInvestorSummaryHtml', () => {
  it('returns a non-empty HTML string', () => {
    const html = renderInvestorSummaryHtml(baseData);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('includes the organisation name', () => {
    const html = renderInvestorSummaryHtml(baseData);
    expect(html).toContain('Acme Brewery');
  });

  it('includes the report year', () => {
    const html = renderInvestorSummaryHtml(baseData);
    expect(html).toContain('2025');
  });

  it('displays the total emissions figure', () => {
    const html = renderInvestorSummaryHtml(baseData);
    // 1000 formatted as en-GB with 0 decimals
    expect(html).toContain('1,000');
  });

  it('displays scope percentages', () => {
    const html = renderInvestorSummaryHtml(baseData);
    // Scope 3 = 85% of 1000
    expect(html).toContain('85%');
    // Scope 1 = 10%
    expect(html).toContain('10%');
    // Scope 2 = 5%
    expect(html).toContain('5%');
  });

  it('shows YoY change when provided', () => {
    const html = renderInvestorSummaryHtml({ ...baseData, yoyChangePct: '-12.4%' });
    expect(html).toContain('-12.4%');
    expect(html).toContain('YoY Change');
  });

  it('omits YoY section when not provided', () => {
    const html = renderInvestorSummaryHtml({ ...baseData, yoyChangePct: undefined });
    expect(html).not.toContain('YoY Change');
  });

  it('shows SBTi badge when sbtiAligned is true', () => {
    const html = renderInvestorSummaryHtml({ ...baseData, sbtiAligned: true });
    expect(html).toContain('SBTi Aligned');
  });

  it('omits SBTi badge when sbtiAligned is false', () => {
    const html = renderInvestorSummaryHtml({ ...baseData, sbtiAligned: false });
    expect(html).not.toContain('SBTi Aligned');
  });

  it('shows primary message when provided', () => {
    const html = renderInvestorSummaryHtml({
      ...baseData,
      primaryMessage: 'Growth is now decoupled from carbon.',
    });
    expect(html).toContain('Growth is now decoupled from carbon.');
    expect(html).toContain('Key Message');
  });

  it('omits primary message section when not provided', () => {
    const html = renderInvestorSummaryHtml({ ...baseData, primaryMessage: undefined });
    expect(html).not.toContain('Key Message');
  });

  it('renders reduction targets when provided', () => {
    const data: InvestorSummaryData = {
      ...baseData,
      targets: [{ scope: 'scope3', targetYear: 2030, reductionPct: 50 }],
    };
    const html = renderInvestorSummaryHtml(data);
    expect(html).toContain('50% reduction');
    expect(html).toContain('2030');
    expect(html).toContain('Reduction Targets');
  });

  it('renders climate risks when provided', () => {
    const data: InvestorSummaryData = {
      ...baseData,
      risks: [{ title: 'Water scarcity', type: 'risk', likelihood: 'high', impact: 'high' }],
    };
    const html = renderInvestorSummaryHtml(data);
    expect(html).toContain('Water scarcity');
    expect(html).toContain('high likelihood');
  });

  it('renders opportunities separately from risks', () => {
    const data: InvestorSummaryData = {
      ...baseData,
      risks: [
        { title: 'Regulatory fine', type: 'risk', likelihood: 'medium', impact: 'high' },
        { title: 'Green premium pricing', type: 'opportunity', likelihood: 'high', impact: 'medium' },
      ],
    };
    const html = renderInvestorSummaryHtml(data);
    expect(html).toContain('Regulatory fine');
    expect(html).toContain('Green premium pricing');
  });

  it('renders a placeholder when no risks are provided', () => {
    const html = renderInvestorSummaryHtml({ ...baseData, risks: [] });
    expect(html).toContain('No climate risks and opportunities have been recorded yet');
  });

  it('includes two pages (two .page divs)', () => {
    const html = renderInvestorSummaryHtml(baseData);
    const pageMatches = html.match(/class="page"/g) || [];
    expect(pageMatches.length).toBe(2);
  });

  it('escapes special HTML characters in org name', () => {
    const html = renderInvestorSummaryHtml({
      ...baseData,
      organisationName: '<Script> & "Brewery"',
    });
    expect(html).not.toContain('<Script>');
    expect(html).toContain('&lt;Script&gt;');
    expect(html).toContain('&amp;');
  });

  it('handles zero total emissions without division errors', () => {
    const data: InvestorSummaryData = {
      ...baseData,
      emissions: { scope1: 0, scope2: 0, scope3: 0, total: 0 },
    };
    expect(() => renderInvestorSummaryHtml(data)).not.toThrow();
    const html = renderInvestorSummaryHtml(data);
    expect(html).toContain('0%');
  });

  it('uses the branding primary colour', () => {
    const html = renderInvestorSummaryHtml({
      ...baseData,
      branding: { logo: null, primaryColor: '#ff0000' },
    });
    expect(html).toContain('#ff0000');
  });

  it('uses provided logo URL when set', () => {
    const html = renderInvestorSummaryHtml({
      ...baseData,
      branding: { logo: 'https://example.com/logo.png', primaryColor: '#ccff00' },
    });
    expect(html).toContain('https://example.com/logo.png');
  });
});
