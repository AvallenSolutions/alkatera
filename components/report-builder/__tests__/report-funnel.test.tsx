import { describe, it, expect } from 'vitest';
import {
  REPORT_STYLES,
  REPORT_STYLE_LIST,
  resolveReportStyle,
} from '@/lib/pdf/templates/report-styles';
import {
  sectionHasData,
  type ReportDataAvailability,
} from '@/hooks/useReportDataAvailability';
import { AVAILABLE_SECTIONS } from '@/types/report-builder';

// ============================================================================
// Style registry — the funnel's single source of truth
// ============================================================================

describe('report style registry', () => {
  it('has five styles, each fully specified for the funnel', () => {
    expect(REPORT_STYLE_LIST).toHaveLength(5);
    for (const style of REPORT_STYLE_LIST) {
      expect(style.defaultSections.length).toBeGreaterThan(0);
      expect(style.defaultStandards.length).toBeGreaterThan(0);
      expect(style.cues).toHaveLength(3);
      expect(style.defaultSections).toContain('executive-summary');
    }
  });

  it('only references real section ids in defaults and narrative order', () => {
    const known = new Set(AVAILABLE_SECTIONS.map(s => s.id));
    for (const style of REPORT_STYLE_LIST) {
      for (const id of [...style.defaultSections, ...style.sectionOrder]) {
        expect(known.has(id), `${style.id} references unknown section ${id}`).toBe(true);
      }
    }
  });

  it('maps every legacy audience to a style', () => {
    expect(resolveReportStyle(null, 'investors').id).toBe('investors');
    expect(resolveReportStyle(null, 'internal').id).toBe('investors');
    expect(resolveReportStyle(null, 'customers').id).toBe('customers');
    expect(resolveReportStyle(null, 'supply-chain').id).toBe('supply-chain');
    expect(resolveReportStyle(null, 'regulators').id).toBe('compliance');
    expect(resolveReportStyle(null, 'technical').id).toBe('compliance');
    expect(resolveReportStyle('marketing', 'regulators').id).toBe('marketing');
  });
});

// ============================================================================
// sectionHasData — honest defaults against the org's data
// ============================================================================

const NOTHING: ReportDataAvailability = {
  loading: false,
  hasCorporate: false,
  corporateYearCount: 0,
  productCount: 0,
  supplierCount: 0,
  facilityCount: 0,
  hasTransitionPlan: false,
  hasMaterialityComplete: false,
  hasImpactValuation: false,
  hasPeopleData: false,
  hasGovernanceData: false,
  hasCommunityData: false,
};

describe('sectionHasData', () => {
  it('always allows the sections that need no specific dataset', () => {
    for (const id of ['executive-summary', 'company-overview', 'targets', 'methodology', 'regulatory', 'appendix']) {
      expect(sectionHasData(id, NOTHING), id).toBe(true);
    }
  });

  it('gates data-dependent sections off when nothing exists', () => {
    for (const id of [
      'scope-1-2-3', 'ghg-inventory', 'trends', 'key-findings', 'product-footprints',
      'supply-chain', 'facilities', 'transition-roadmap', 'risks-and-opportunities',
      'impact-valuation', 'people-culture', 'governance', 'community-impact',
    ]) {
      expect(sectionHasData(id, NOTHING), id).toBe(false);
    }
  });

  it('needs two corporate years for trends and key findings', () => {
    const oneYear = { ...NOTHING, hasCorporate: true, corporateYearCount: 1 };
    expect(sectionHasData('scope-1-2-3', oneYear)).toBe(true);
    expect(sectionHasData('trends', oneYear)).toBe(false);
    expect(sectionHasData('key-findings', oneYear)).toBe(false);
    const twoYears = { ...oneYear, corporateYearCount: 2 };
    expect(sectionHasData('trends', twoYears)).toBe(true);
    expect(sectionHasData('key-findings', twoYears)).toBe(true);
  });

  it('opens product-led sections with a single completed LCA', () => {
    const withProduct = { ...NOTHING, productCount: 1 };
    expect(sectionHasData('product-footprints', withProduct)).toBe(true);
    expect(sectionHasData('carbon-origin', withProduct)).toBe(true);
    expect(sectionHasData('multi-capital', withProduct)).toBe(true);
  });

  it('filters every style default to a non-empty, exec-summary-led list even with no data', () => {
    for (const style of REPORT_STYLE_LIST) {
      const filtered = style.defaultSections.filter(id => sectionHasData(id, NOTHING));
      expect(filtered).toContain('executive-summary');
    }
  });

  it('keeps all style defaults when every dataset exists', () => {
    const everything: ReportDataAvailability = {
      loading: false,
      hasCorporate: true,
      corporateYearCount: 3,
      productCount: 5,
      supplierCount: 12,
      facilityCount: 2,
      hasTransitionPlan: true,
      hasMaterialityComplete: true,
      hasImpactValuation: true,
      hasPeopleData: true,
      hasGovernanceData: true,
      hasCommunityData: true,
    };
    for (const style of Object.values(REPORT_STYLES)) {
      const filtered = style.defaultSections.filter(id => sectionHasData(id, everything));
      expect(filtered).toEqual(style.defaultSections);
    }
  });
});
