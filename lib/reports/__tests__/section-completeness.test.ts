import { describe, it, expect } from 'vitest';
import {
  computeSectionCompleteness,
  computeAllSectionCompleteness,
  isCompletenessSection,
  normaliseSectionId,
  type SectionReportData,
} from '../section-completeness';
import {
  EMPTY_PEOPLE_CULTURE,
  EMPTY_GOVERNANCE,
  EMPTY_COMMUNITY_IMPACT,
} from '../sections/types';

const EMPTY_DATA: SectionReportData = {
  peopleCulture: EMPTY_PEOPLE_CULTURE,
  governance: EMPTY_GOVERNANCE,
  communityImpact: EMPTY_COMMUNITY_IMPACT,
  suppliers: [],
  facilities: [],
};

describe('computeSectionCompleteness', () => {
  it('pins the block catalogue ids per section (stable API for the funnel)', () => {
    const ids = (s: string) => computeSectionCompleteness(s, EMPTY_DATA).blocks.map(b => b.id);
    expect(ids('people-culture')).toEqual([
      'score', 'pillars', 'headcount', 'gender-diversity', 'hires-departures',
      'turnover', 'living-wage', 'training', 'pay-gap', 'pay-ratio',
      'engagement', 'dei-actions', 'benefits',
    ]);
    expect(ids('governance')).toEqual([
      'board-composition', 'board-diversity', 'board-independence', 'board-attendance',
      'policies', 'policy-score', 'mission', 'sdg-commitments', 'climate-commitments', 'ethics',
    ]);
    expect(ids('community-impact')).toEqual([
      'score', 'pillars', 'donations', 'volunteering',
      'local-employment', 'local-sourcing', 'impact-stories',
    ]);
    expect(ids('supply-chain')).toEqual(['roster', 'categories', 'data-shared']);
    expect(ids('facilities')).toEqual(['inventory', 'emissions', 'production', 'intensity']);
  });

  it('scores an entirely empty payload as zero present, full total', () => {
    for (const section of ['people-culture', 'governance', 'community-impact', 'supply-chain', 'facilities']) {
      const result = computeSectionCompleteness(section, EMPTY_DATA);
      expect(result.presentCount).toBe(0);
      expect(result.totalCount).toBe(result.blocks.length);
      expect(result.totalCount).toBeGreaterThan(0);
    }
  });

  it('a missing payload object behaves exactly like the EMPTY constant', () => {
    const withNothing = computeSectionCompleteness('people-culture', {});
    const withEmpty = computeSectionCompleteness('people-culture', EMPTY_DATA);
    expect(withNothing).toEqual(withEmpty);
  });

  it('flips individual blocks present without dragging neighbours along', () => {
    const data: SectionReportData = {
      peopleCulture: {
        ...EMPTY_PEOPLE_CULTURE,
        dataCompleteness: 40,
        totalEmployees: 12,
        femalePercentage: 42,
      },
    };
    const result = computeSectionCompleteness('people-culture', data);
    const byId = Object.fromEntries(result.blocks.map(b => [b.id, b.present]));
    expect(byId['score']).toBe(true);
    expect(byId['headcount']).toBe(true);
    expect(byId['gender-diversity']).toBe(true);
    // The mixed state Tim described: measured things present, the rest honest.
    expect(byId['living-wage']).toBe(false);
    expect(byId['pay-gap']).toBe(false);
    expect(byId['training']).toBe(false);
    expect(result.presentCount).toBe(4); // score, pillars, headcount, gender-diversity
  });

  it('treats zero as measured: a recorded 0 is a claim, only null is absent', () => {
    const data: SectionReportData = {
      peopleCulture: { ...EMPTY_PEOPLE_CULTURE, genderPayGapMean: 0, turnoverRate: 0 },
    };
    const byId = Object.fromEntries(
      computeSectionCompleteness('people-culture', data).blocks.map(b => [b.id, b.present]),
    );
    expect(byId['pay-gap']).toBe(true);
    expect(byId['turnover']).toBe(true);
  });

  it('facilities intensity needs BOTH emissions and non-zero production on one site', () => {
    const site = { name: 'A', type: 'brewery', location: 'UK', hasData: true };
    const emissionsOnly: SectionReportData = {
      facilities: [{ ...site, totalEmissions: 12.5, unitsProduced: null }],
    };
    const both: SectionReportData = {
      facilities: [{ ...site, totalEmissions: 12.5, unitsProduced: 90000 }],
    };
    const pick = (d: SectionReportData) =>
      Object.fromEntries(computeSectionCompleteness('facilities', d).blocks.map(b => [b.id, b.present]));
    expect(pick(emissionsOnly)).toEqual({ inventory: true, emissions: true, production: false, intensity: false });
    expect(pick(both)).toEqual({ inventory: true, emissions: true, production: true, intensity: true });
  });

  it('supply-chain data-shared requires a non-empty emissionsData object', () => {
    const data: SectionReportData = {
      suppliers: [
        { name: 'Glass Co', category: 'Packaging', emissionsData: {} },
        { name: 'Malt Co', category: '', emissionsData: { scope3: 1.2 } },
      ],
    };
    const byId = Object.fromEntries(
      computeSectionCompleteness('supply-chain', data).blocks.map(b => [b.id, b.present]),
    );
    expect(byId).toEqual({ roster: true, categories: true, 'data-shared': true });
  });

  it('normalises legacy section aliases', () => {
    expect(normaliseSectionId('people')).toBe('people-culture');
    expect(normaliseSectionId('community')).toBe('community-impact');
    expect(normaliseSectionId('suppliers')).toBe('supply-chain');
    expect(computeSectionCompleteness('people', EMPTY_DATA).sectionId).toBe('people-culture');
  });

  it('answers unknown sections with an empty result rather than throwing', () => {
    const result = computeSectionCompleteness('emissions', EMPTY_DATA);
    expect(result).toEqual({ sectionId: 'emissions', blocks: [], presentCount: 0, totalCount: 0 });
    expect(isCompletenessSection('emissions')).toBe(false);
    expect(isCompletenessSection('people')).toBe(true);
  });

  it('computeAllSectionCompleteness covers only known sections, deduplicating aliases', () => {
    const all = computeAllSectionCompleteness(
      ['emissions', 'people-culture', 'people', 'governance'],
      EMPTY_DATA,
    );
    expect(Object.keys(all).sort()).toEqual(['governance', 'people-culture']);
  });

  it('every deep link points at an in-app path', () => {
    for (const section of ['people-culture', 'governance', 'community-impact', 'supply-chain', 'facilities']) {
      for (const block of computeSectionCompleteness(section, EMPTY_DATA).blocks) {
        expect(block.deepLink).toMatch(/^\//);
      }
    }
  });
});
