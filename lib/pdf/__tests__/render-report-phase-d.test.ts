import { describe, it, expect } from 'vitest';
import { renderSustainabilityReportHtml } from '../render-sustainability-report-html';

// Customers style -> modern theme: narratives on, leadership on, dividers off.
// Marketing style -> narrative theme: everything on (dividers included).
const baseConfig = {
  reportName: 'Phase D Report',
  reportYear: 2026,
  reportingPeriodStart: '2026-01-01',
  reportingPeriodEnd: '2026-12-31',
  audience: 'customers',
  style: 'customers',
  standards: ['iso-14067'],
  sections: ['executive-summary', 'scope-1-2-3', 'targets', 'people-culture'],
  isMultiYear: false,
  reportYears: [2026],
  branding: { logo: null, primaryColor: '#205E40', secondaryColor: '#047857' },
};

const baseData = {
  organization: { name: 'Acme Brewery', industry_sector: 'Brewing' },
  emissions: { scope1: 100, scope2: 50, scope3: 850, total: 1000, year: 2026 },
  emissionsTrends: [],
  products: [],
  facilities: [],
  standards: [],
  peopleCulture: {
    overallScore: 72,
    dataCompleteness: 80,
    fairWorkScore: 70,
    diversityScore: 68,
    wellbeingScore: 75,
    trainingScore: 74,
    totalEmployees: 24,
    femalePercentage: 46,
    livingWageCompliance: 100,
    genderPayGapMean: 4.2,
    trainingHoursPerEmployee: 12,
    turnoverRate: 8.5,
    newHires: 5,
    departures: 2,
  },
  transitionPlan: {
    targets: [{ id: 't1', scope: 'scope1', reductionPct: 42, targetYear: 2030 }],
    milestones: [],
    risks_and_opportunities: [],
  },
  dataAvailability: {
    hasOrganization: true,
    hasEmissions: true,
    hasProducts: false,
    hasFacilities: false,
    hasPeopleCulture: true,
  },
};

function sectionHeaderOrder(html: string): number[] {
  // Section headers carry their title text (ampersands HTML-escaped);
  // use index positions to compare order.
  return ['Executive Summary', 'Targets', 'People &amp; Culture'].map(t => html.indexOf(t));
}

describe('Phase D renderer: section order override', () => {
  it('reorders sections by config.sectionOrder and renumbers sequentially', () => {
    const styled = renderSustainabilityReportHtml(baseConfig as any, baseData as any);
    const reordered = renderSustainabilityReportHtml(
      { ...baseConfig, sectionOrder: ['people-culture', 'targets', 'executive-summary', 'scope-1-2-3'] } as any,
      baseData as any
    );
    // Styled order: exec before people; reordered: people before exec.
    const styledIdx = sectionHeaderOrder(styled);
    const reorderedIdx = sectionHeaderOrder(reordered);
    expect(styledIdx[0]).toBeLessThan(styledIdx[2]);
    expect(reorderedIdx[2]).toBeLessThan(reorderedIdx[0]);
    // Renumbering stays sequential from 01 regardless of order.
    expect(reordered).toContain('01');
    expect(reordered).not.toContain('__SECTION_NUM__');
  });
});

describe('Phase D renderer: named image slots with legacy fallback', () => {
  it('uses images.cover, falling back to heroImages[0]', () => {
    // Marketing style: the narrative theme's hero-photo cover shows the image
    // (the customers style's minimal cover never carries one, by design).
    const marketingConfig = { ...baseConfig, style: 'marketing' };
    const slots = renderSustainabilityReportHtml(
      { ...marketingConfig, branding: { ...baseConfig.branding, images: { cover: 'https://img/cover-slot.jpg' }, heroImages: ['https://img/legacy0.jpg'] } } as any,
      baseData as any
    );
    expect(slots).toContain('cover-slot.jpg');
    expect(slots).not.toContain('legacy0.jpg');

    const legacy = renderSustainabilityReportHtml(
      { ...marketingConfig, branding: { ...baseConfig.branding, heroImages: ['https://img/legacy0.jpg'] } } as any,
      baseData as any
    );
    expect(legacy).toContain('legacy0.jpg');
  });

  it('puts divider2 (or legacy heroImages[2]) on the commitments divider for marketing', () => {
    const marketing = {
      ...baseConfig,
      audience: 'customers',
      style: 'marketing',
      branding: {
        ...baseConfig.branding,
        images: { divider1: 'https://img/div1.jpg', divider2: 'https://img/div2.jpg' },
      },
    };
    const html = renderSustainabilityReportHtml(marketing as any, baseData as any);
    expect(html).toContain('div1.jpg');
    expect(html).toContain('div2.jpg');

    const legacy = renderSustainabilityReportHtml(
      { ...marketing, branding: { ...baseConfig.branding, heroImages: ['a.jpg', 'https://img/l1.jpg', 'https://img/l2.jpg'] } } as any,
      baseData as any
    );
    expect(legacy).toContain('l1.jpg');
    expect(legacy).toContain('l2.jpg');
  });

  it('renders the people photo band only with images.people and an imagery theme', () => {
    const withBand = renderSustainabilityReportHtml(
      { ...baseConfig, branding: { ...baseConfig.branding, images: { people: 'https://img/people.jpg' } } } as any,
      baseData as any
    );
    expect(withBand).toContain('people.jpg');

    // Investors style (executive theme, showHeroImages false) suppresses it.
    const investors = renderSustainabilityReportHtml(
      { ...baseConfig, audience: 'investors', style: 'investors', branding: { ...baseConfig.branding, images: { people: 'https://img/people.jpg' } } } as any,
      baseData as any
    );
    expect(investors).not.toContain('people.jpg');
  });
});

describe('Phase D renderer: leadership page ungated from tier', () => {
  const leadership = { name: 'Jane Doe', title: 'CEO', message: 'Our honest year, told plainly.' };

  it('prints the leadership page for the customers style (modern theme)', () => {
    const html = renderSustainabilityReportHtml(
      { ...baseConfig, branding: { ...baseConfig.branding, leadership } } as any,
      baseData as any
    );
    expect(html).toContain('A MESSAGE FROM OUR LEADERSHIP');
    expect(html).toContain('Our honest year, told plainly.');
  });

  it('never prints it for investors (executive theme keeps the page off)', () => {
    const html = renderSustainabilityReportHtml(
      { ...baseConfig, audience: 'investors', style: 'investors', branding: { ...baseConfig.branding, leadership } } as any,
      baseData as any
    );
    expect(html).not.toContain('A MESSAGE FROM OUR LEADERSHIP');
  });

  it('never prints it without a message', () => {
    const html = renderSustainabilityReportHtml(baseConfig as any, baseData as any);
    expect(html).not.toContain('A MESSAGE FROM OUR LEADERSHIP');
  });
});
