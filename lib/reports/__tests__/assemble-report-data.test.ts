import { describe, it, expect } from 'vitest';
import {
  assembleReportData,
  buildReportConfig,
  deriveEmissionsTrends,
  normaliseTargets,
  normaliseImageSlots,
  normaliseSectionScopes,
} from '@/lib/reports/assemble-report-data';

describe('buildReportConfig', () => {
  const baseRow = {
    report_name: 'Test Report',
    report_year: 2026,
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-12-31',
    audience: 'customers',
    standards: ['iso-14067'],
    sections: ['executive-summary'],
    is_multi_year: false,
    report_years: [2026],
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    config: {},
  };

  it('reads style, template and toneOverride from the config jsonb', () => {
    const config = buildReportConfig({
      ...baseRow,
      config: { style: 'marketing', template: 'narrative', toneOverride: 'measured' },
    });
    expect(config.style).toBe('marketing');
    expect(config.template).toBe('narrative');
    expect(config.toneOverride).toBe('measured');
  });

  it('leaves toneOverride undefined when absent or malformed', () => {
    expect(buildReportConfig(baseRow).toneOverride).toBeUndefined();
    expect(buildReportConfig({ ...baseRow, config: { toneOverride: 7 } }).toneOverride).toBeUndefined();
  });

  it('reads sectionOrder, sectionScopes and image slots from the jsonb', () => {
    const config = buildReportConfig({
      ...baseRow,
      config: {
        sectionOrder: ['targets', 'scope-1-2-3', 42, null],
        sectionScopes: { products: { pcfIds: ['a', 'b'] }, trends: { fromYear: 2022, toYear: 2026 } },
        branding: { images: { cover: 'https://img/c.jpg', bogus: 'x', people: '' } },
      },
    });
    expect(config.sectionOrder).toEqual(['targets', 'scope-1-2-3']);
    expect(config.sectionScopes).toEqual({ products: { pcfIds: ['a', 'b'] }, trends: { fromYear: 2022, toYear: 2026 } });
    expect(config.branding.images).toEqual({ cover: 'https://img/c.jpg' });
  });
});

describe('normaliseImageSlots', () => {
  it('keeps only known string slots and collapses empties to undefined', () => {
    expect(normaliseImageSlots({ cover: 'u', divider1: 1, unknown: 'x' })).toEqual({ cover: 'u' });
    expect(normaliseImageSlots({})).toBeUndefined();
    expect(normaliseImageSlots(null)).toBeUndefined();
    expect(normaliseImageSlots('nope')).toBeUndefined();
  });
});

describe('normaliseSectionScopes', () => {
  it('accepts well-formed scopes', () => {
    expect(normaliseSectionScopes({ products: { pcfIds: ['x'] } })).toEqual({ products: { pcfIds: ['x'] } });
    expect(normaliseSectionScopes({ trends: { fromYear: 2020, toYear: 2020 } })).toEqual({ trends: { fromYear: 2020, toYear: 2020 } });
  });

  it('rejects empty id lists, inverted ranges and junk', () => {
    expect(normaliseSectionScopes({ products: { pcfIds: [] } })).toBeUndefined();
    expect(normaliseSectionScopes({ products: { pcfIds: [7, ''] } })).toBeUndefined();
    expect(normaliseSectionScopes({ trends: { fromYear: 2026, toYear: 2020 } })).toBeUndefined();
    expect(normaliseSectionScopes({ trends: { fromYear: 'a', toYear: 2020 } })).toBeUndefined();
    expect(normaliseSectionScopes(undefined)).toBeUndefined();
  });
});

describe('deriveEmissionsTrends', () => {
  const rows = [
    { year: 2022, total_emissions: 800, breakdown_json: { total: 800, scope1: 100, scope2: 200, scope3: 500 } },
    { year: 2023, total_emissions: 1000, breakdown_json: { total: 1000, scope1: 120, scope2: 230, scope3: 650 } },
    { year: 2024, total_emissions: 900, breakdown_json: { total: 900, scope1: 110, scope2: 190, scope3: { total: 600 } } },
    { year: 2025, total_emissions: 0, breakdown_json: null },
    { year: 2026, total_emissions: 850, breakdown_json: { total: 850, scope1: 100, scope2: 150, scope3: 600 } },
  ];

  it('computes year-on-year percentage change between consecutive listed years', () => {
    const trends = deriveEmissionsTrends(rows, { reportYear: 2026, isMultiYear: false, reportYears: [] });
    // 2025 is excluded (zero total), so the chain is 2022 -> 2023 -> 2024 -> 2026
    expect(trends.map(t => t.year)).toEqual([2022, 2023, 2024, 2026]);
    expect(trends[0].yoyChange).toBeNull();
    expect(trends[1].yoyChange).toBe(25);      // 800 -> 1000
    expect(trends[2].yoyChange).toBe(-10);     // 1000 -> 900
    expect(trends[3].yoyChange).toBe(-5.6);    // 900 -> 850, 1dp
  });

  it('unwraps object-shaped scope3 breakdowns', () => {
    const trends = deriveEmissionsTrends(rows, { reportYear: 2026, isMultiYear: false, reportYears: [] });
    expect(trends.find(t => t.year === 2024)?.scope3).toBe(600);
  });

  it('filters to reportYears for multi-year reports', () => {
    const trends = deriveEmissionsTrends(rows, { reportYear: 2026, isMultiYear: true, reportYears: [2026, 2023] });
    expect(trends.map(t => t.year)).toEqual([2023, 2026]);
    expect(trends[1].yoyChange).toBe(-15);     // 1000 -> 850
  });

  it('lets an explicit trends scope beat both reportYears and the fallback window', () => {
    const scoped = deriveEmissionsTrends(rows, {
      reportYear: 2026,
      isMultiYear: true,
      reportYears: [2026, 2023],
      sectionScopes: { trends: { fromYear: 2022, toYear: 2024 } },
    });
    expect(scoped.map(t => t.year)).toEqual([2022, 2023, 2024]);
  });

  it('caps the single-year window at five trailing years', () => {
    const longRows = Array.from({ length: 10 }, (_, i) => ({
      year: 2017 + i,
      total_emissions: 100 + i,
      breakdown_json: { total: 100 + i },
    }));
    const trends = deriveEmissionsTrends(longRows, { reportYear: 2026, isMultiYear: false, reportYears: [] });
    expect(trends.map(t => t.year)).toEqual([2022, 2023, 2024, 2025, 2026]);
  });

  it('never includes years after the reporting year', () => {
    const trends = deriveEmissionsTrends(
      [...rows, { year: 2027, total_emissions: 500, breakdown_json: { total: 500 } }],
      { reportYear: 2026, isMultiYear: false, reportYears: [] }
    );
    expect(trends.map(t => t.year)).not.toContain(2027);
  });
});

describe('normaliseTargets', () => {
  it('unions transition-plan targets and sustainability_targets rows', () => {
    const targets = normaliseTargets(
      [{ scope: 'scope1', reductionPct: 42, targetYear: 2030 }],
      [{ metric_key: 'water_use', baseline_value: 10, target_value: 6, target_date: '2028-12-31', scope: 'scope3', status: 'on_track' }]
    );
    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatchObject({ source: 'transition_plan', scope: 'scope1', reductionPct: 42, targetYear: 2030 });
    expect(targets[0].label).toContain('42%');
    expect(targets[0].label).toContain('2030');
    expect(targets[1]).toMatchObject({ source: 'sustainability_targets', targetYear: 2028, status: 'on_track' });
    expect(targets[1].label).toContain('water use');
  });

  it('handles null and empty inputs', () => {
    expect(normaliseTargets(null, null)).toEqual([]);
    expect(normaliseTargets([], [])).toEqual([]);
    expect(normaliseTargets([null as any], [undefined as any])).toEqual([]);
  });
});

describe('assembleReportData section gating', () => {
  // A chainable client that records every table touched and resolves every
  // query empty. What matters here is WHICH tables get queried, not what
  // they return: an unselected section must issue no queries at all.
  function makeCountingClient() {
    const tables: string[] = [];
    const makeQuery = () => {
      const q: any = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'is', 'not', 'order', 'limit', 'gte', 'lte', 'filter', 'or']) {
        q[m] = () => q;
      }
      q.maybeSingle = async () => ({ data: null, error: null });
      q.single = async () => ({ data: null, error: null });
      q.then = (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve);
      return q;
    };
    const client = { from: (table: string) => { tables.push(table); return makeQuery(); } } as any;
    return { client, tables };
  }

  const reportRow = (sections: string[]) => ({
    organization_id: 'org-1',
    report_name: 'Gating Test',
    report_year: 2026,
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-12-31',
    audience: 'customers',
    standards: [],
    sections,
    is_multi_year: false,
    report_years: [2026],
    config: {},
  });

  const SOCIAL_TABLES = /^(people_|governance_|community_|organization_suppliers|supplier_data_submissions|facilities$|facility_)/;

  it('issues no social/value-chain queries when those sections are unselected', async () => {
    const { client, tables } = makeCountingClient();
    await assembleReportData(client, reportRow(['executive-summary', 'scope-1-2-3']), { skipKeyFindings: true });
    expect(tables.filter(t => SOCIAL_TABLES.test(t))).toEqual([]);
  });

  it('fetches people tables when people-culture is selected, and attaches the completeness oracle', async () => {
    const { client, tables } = makeCountingClient();
    const { reportData } = await assembleReportData(
      client,
      reportRow(['executive-summary', 'people-culture']),
      { skipKeyFindings: true },
    );
    expect(tables.some(t => t.startsWith('people_'))).toBe(true);
    expect(tables.some(t => t.startsWith('governance_'))).toBe(false);
    expect(reportData.peopleCulture).toBeDefined();
    expect(reportData.dataAvailability.hasPeopleCulture).toBe(false); // empty org: reporting flag stays honest
    expect(reportData.sectionCompleteness['people-culture'].totalCount).toBe(13);
    expect(reportData.sectionCompleteness['people-culture'].presentCount).toBe(0);
  });

  it('targets without governance runs the mission-only fast path, not the full gather', async () => {
    const { client, tables } = makeCountingClient();
    await assembleReportData(client, reportRow(['executive-summary', 'targets']), { skipKeyFindings: true });
    expect(tables).toContain('governance_mission');
    expect(tables).not.toContain('governance_board_members');
  });

  it('governance selected runs the full gather', async () => {
    const { client, tables } = makeCountingClient();
    await assembleReportData(client, reportRow(['executive-summary', 'governance']), { skipKeyFindings: true });
    expect(tables).toContain('governance_board_members');
    expect(tables).toContain('governance_policies');
  });

  it('facilities selected fetches facilities and attaches its completeness', async () => {
    const { client, tables } = makeCountingClient();
    const { reportData } = await assembleReportData(
      client,
      reportRow(['executive-summary', 'facilities']),
      { skipKeyFindings: true },
    );
    expect(tables.some(t => t === 'facilities' || t.startsWith('facility_'))).toBe(true);
    expect(reportData.sectionCompleteness['facilities'].totalCount).toBe(4);
  });
});
