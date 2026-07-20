import { describe, it, expect } from 'vitest';
import { renderSustainabilityReportHtml } from '../render-sustainability-report-html';
import { EMPTY_GOVERNANCE } from '@/lib/reports/sections/types';

// Pins the step-6/7 behaviour change: a SELECTED section always renders, as an
// honest "not yet measured" skeleton when its data is missing. dataAvailability
// is reporting metadata only and never gates a page; 'N/A' never appears on
// the social and value-chain pages.

const baseConfig = {
  reportName: 'Sections Report',
  reportYear: 2026,
  reportingPeriodStart: '2026-01-01',
  reportingPeriodEnd: '2026-12-31',
  audience: 'customers',
  style: 'customers',
  standards: ['iso-14067'],
  sections: ['executive-summary', 'scope-1-2-3'],
  branding: { logo: null, primaryColor: '#205E40', secondaryColor: '#047857' },
};

const baseData = {
  organization: { name: 'Acme Brewery', industry_sector: 'Brewing' },
  emissions: { scope1: 100, scope2: 50, scope3: 850, total: 1000, year: 2026 },
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

function render(config: object, data: object): string {
  return renderSustainabilityReportHtml(config as any, data as any);
}

describe('selected sections render without data (de-gated from dataAvailability)', () => {
  it('renders a People & Culture skeleton page when peopleCulture is undefined', () => {
    const html = render(
      { ...baseConfig, sections: [...baseConfig.sections, 'people-culture'] },
      baseData, // no peopleCulture payload, no hasPeopleCulture flag
    );
    expect(html).toContain('People &amp; Culture');
    expect(html).toContain('none of its measures have been recorded for 2026 yet');
    expect(html).toContain('Not yet measured');
  });

  it('renders the page even when dataAvailability.hasPeopleCulture is explicitly false', () => {
    const html = render(
      { ...baseConfig, sections: [...baseConfig.sections, 'people-culture'] },
      { ...baseData, dataAvailability: { ...baseData.dataAvailability, hasPeopleCulture: false } },
    );
    expect(html).toContain('People &amp; Culture');
  });

  it('never prints N/A anywhere in the document', () => {
    const html = render(
      {
        ...baseConfig,
        sections: [
          ...baseConfig.sections,
          'people-culture', 'governance', 'community-impact', 'supply-chain', 'facilities', 'targets',
        ],
      },
      baseData,
    );
    expect(html).not.toContain('>N/A<');
  });

  it('renders the governance page for an EMPTY_GOVERNANCE payload rather than dropping it', () => {
    const html = render(
      { ...baseConfig, sections: [...baseConfig.sections, 'governance'] },
      { ...baseData, governance: EMPTY_GOVERNANCE },
    );
    expect(html).toContain('Board Composition');
    expect(html).toContain('Mission Statement'); // the notMeasuredBlock stand-in
    expect(html).toContain('none of its measures have been recorded for 2026 yet');
  });

  it('omits the governance page when the section is not selected', () => {
    const html = render(baseConfig, { ...baseData, governance: EMPTY_GOVERNANCE });
    expect(html).not.toContain('Board Composition');
  });
});

describe('mixed state: measured numbers beside not-yet-measured tiles', () => {
  const partialPeople = {
    overallScore: 62,
    fairWorkScore: 60,
    diversityScore: 64,
    wellbeingScore: 58,
    trainingScore: 66,
    dataCompleteness: 40,
    totalEmployees: 24,
    femalePercentage: 46,
    newHires: 5,
    departures: 2,
    turnoverRate: 8.5,
    livingWageCompliance: null,
    genderPayGapMean: null,
    trainingHoursPerEmployee: null,
  };

  it('renders a Living Wage tile when livingWageCompliance is null, instead of dropping it', () => {
    const html = render(
      { ...baseConfig, sections: [...baseConfig.sections, 'people-culture'] },
      { ...baseData, peopleCulture: partialPeople },
    );
    const idx = html.indexOf('Living Wage');
    expect(idx).toBeGreaterThan(-1);
    expect(html.slice(idx, idx + 500)).toContain('Not yet measured');
    // Mixed state is not "nothing recorded": no skeleton lead-in.
    expect(html).not.toContain('none of its measures have been recorded');
    // The measured numbers still print.
    expect(html).toContain('24');
    expect(html).toContain('8.5%');
  });

  it('renders the three orphan measures (pay ratio, engagement, DEI) as tiles', () => {
    const measured = render(
      { ...baseConfig, sections: [...baseConfig.sections, 'people-culture'] },
      {
        ...baseData,
        peopleCulture: {
          ...partialPeople,
          ceoWorkerPayRatio: 4.2,
          engagementScore: 78,
          deiActionsTotal: 6,
          deiActionsCompleted: 4,
        },
      },
    );
    expect(measured).toContain('CEO Pay Ratio');
    expect(measured).toContain('4.2:1');
    expect(measured).toContain('Engagement');
    expect(measured).toContain('78%');
    expect(measured).toContain('DEI Actions');
    expect(measured).toContain('4 of 6');

    // Null renders the tile as not-yet-measured rather than dropping it.
    const unmeasured = render(
      { ...baseConfig, sections: [...baseConfig.sections, 'people-culture'] },
      { ...baseData, peopleCulture: partialPeople },
    );
    const ratioIdx = unmeasured.indexOf('CEO Pay Ratio');
    expect(ratioIdx).toBeGreaterThan(-1);
    expect(unmeasured.slice(ratioIdx, ratioIdx + 500)).toContain('Not yet measured');
  });
});

describe('facilities page (step 7)', () => {
  const facilities = [
    { name: 'Main Distillery', type: 'production', location: 'Bristol, UK', totalEmissions: 12.5, unitsProduced: 100000, hasData: true },
    { name: 'Warehouse East', type: 'warehouse', location: 'Leeds, UK', totalEmissions: null, unitsProduced: null, hasData: false },
  ];
  const facilitiesConfig = { ...baseConfig, sections: [...baseConfig.sections, 'facilities'] };

  it('renders when selected and not when deselected', () => {
    const selected = render(facilitiesConfig, { ...baseData, facilities });
    expect(selected).toContain('do not sum to the whole-company');
    expect(selected).toContain('1 of 2 sites measured');

    const deselected = render(baseConfig, { ...baseData, facilities });
    expect(deselected).not.toContain('do not sum to the whole-company');
  });

  it('prints tonnes for a measured site and never a bare 0 for an unmeasured one', () => {
    const html = render(facilitiesConfig, { ...baseData, facilities });
    // totalEmissions is already tonnes at this layer: 12.5 prints as 12.5.
    expect(html).toContain('12.5');
    // Intensity: 12.5 t * 1000 / 100,000 units = 0.125 kg CO2e per unit.
    expect(html).toContain('0.125');

    const rowStart = html.indexOf('Warehouse East');
    expect(rowStart).toBeGreaterThan(-1);
    const row = html.slice(rowStart, html.indexOf('</tr>', rowStart));
    expect(row).toContain('Not yet measured');
    expect(row).not.toContain('>0<');
  });

  it('renders a skeleton page when no facilities are recorded', () => {
    const html = render(facilitiesConfig, { ...baseData, facilities: [] });
    expect(html).toContain('none of its measures have been recorded for 2026 yet');
    expect(html).toContain('0 of 0 sites measured');
    expect(html).not.toContain('>N/A<');
  });
});
