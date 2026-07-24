import { describe, expect, it } from 'vitest';
import {
  RESTRICTABLE_SECTIONS,
  SECTION_KEYS,
  canReachPath,
  sectionForApi,
  sectionForPath,
  sectionsForPath,
  withheldRosaTools,
} from '../sections';
import { SAFE_SQL_ALLOWED_TABLES } from '@/lib/rosa/safe-sql';

describe('sectionForPath', () => {
  it('resolves each section from its own path', () => {
    expect(sectionForPath('/pulse')).toBe('pulse');
    expect(sectionForPath('/pulse/')).toBe('pulse');
    expect(sectionForPath('/data/spend-data/')).toBe('financial');
    expect(sectionForPath('/people-culture/fair-work/')).toBe('compensation');
  });

  it('gives a nested path to the MOST SPECIFIC section, not the ancestor', () => {
    // The trap: '/pulse/financial' starts with '/pulse'. If the ancestor won,
    // the Financial toggle would be dead on its own.
    expect(sectionForPath('/pulse/financial/')).toBe('financial');
    expect(sectionForPath('/pulse/financial/board-pack')).toBe('financial');
  });

  it('leaves unrestricted paths alone', () => {
    expect(sectionForPath('/products/')).toBeNull();
    expect(sectionForPath('/desk/')).toBeNull();
    expect(sectionForPath('/people-culture/')).toBeNull();
    expect(sectionForPath(null)).toBeNull();
  });

  it('does not match a prefix that is only a string prefix', () => {
    // '/pulsewidget' must not be captured by the '/pulse' entry.
    expect(sectionForPath('/pulsewidget')).toBeNull();
    expect(sectionForPath('/data/spend-data-archive')).toBeNull();
  });
});

describe('sectionsForPath', () => {
  it('returns every section standing between the user and the page', () => {
    expect(sectionsForPath('/pulse/financial/').sort()).toEqual(['financial', 'pulse']);
  });

  it('returns only the owning section when there is no nesting', () => {
    expect(sectionsForPath('/pulse/')).toEqual(['pulse']);
    expect(sectionsForPath('/data/spend-data/')).toEqual(['financial']);
  });
});

describe('canReachPath', () => {
  it('is open by default when nothing is denied', () => {
    expect(canReachPath('/pulse/financial/', {})).toBe(true);
    expect(canReachPath('/people-culture/fair-work/', {})).toBe(true);
  });

  it('denying pulse closes pulse AND the financial page nested inside it', () => {
    const access = { pulse: false };
    expect(canReachPath('/pulse/', access)).toBe(false);
    expect(canReachPath('/pulse/financial/', access)).toBe(false);
  });

  it('denying financial closes the financial page but leaves pulse open', () => {
    const access = { financial: false };
    expect(canReachPath('/pulse/', access)).toBe(true);
    expect(canReachPath('/pulse/financial/', access)).toBe(false);
    expect(canReachPath('/data/spend-data/', access)).toBe(false);
  });

  it('never closes an unrestricted path', () => {
    const access = { pulse: false, financial: false, compensation: false };
    expect(canReachPath('/products/', access)).toBe(true);
    expect(canReachPath('/desk/', access)).toBe(true);
  });
});

describe('sectionForApi', () => {
  it('resolves the pulse catch-all', () => {
    expect(sectionForApi('/api/pulse/waterfall')).toBe('pulse');
    expect(sectionForApi('/api/pulse/targets')).toBe('pulse');
  });

  it('gives the money routes under /api/pulse to financial, not pulse', () => {
    expect(sectionForApi('/api/pulse/cost-drivers')).toBe('financial');
    expect(sectionForApi('/api/pulse/board-pack')).toBe('financial');
    expect(sectionForApi('/api/pulse/expanded/financial-footprint')).toBe('financial');
  });

  it('resolves compensation and the standalone financial routes', () => {
    expect(sectionForApi('/api/people-culture/compensation')).toBe('compensation');
    expect(sectionForApi('/api/spend/invoice')).toBe('financial');
    expect(sectionForApi('/api/impact-valuation/calculate')).toBe('financial');
  });

  it('leaves unrestricted routes alone', () => {
    expect(sectionForApi('/api/people-culture/training')).toBeNull();
    expect(sectionForApi('/api/products')).toBeNull();
  });
});

describe('withheldRosaTools', () => {
  it('withholds nothing by default', () => {
    expect(withheldRosaTools({})).toEqual([]);
  });

  it('withholds the pulse tools when pulse is denied', () => {
    expect(withheldRosaTools({ pulse: false }).sort()).toEqual([
      'list_insights',
      'list_recent_anomalies',
      'query_pulse_metrics',
    ]);
  });
});

describe('registry integrity', () => {
  it('keys every entry by its own key', () => {
    for (const key of SECTION_KEYS) {
      expect(RESTRICTABLE_SECTIONS[key].key).toBe(key);
    }
  });

  it('keeps compensation out of Rosa reach entirely', () => {
    // Rosa has no compensation tool and cannot reach the table through
    // run_safe_sql. This test fails the moment anyone adds it to the
    // whitelist, which would route around the gate above.
    expect(SAFE_SQL_ALLOWED_TABLES).not.toContain('people_employee_compensation');
    expect(RESTRICTABLE_SECTIONS.compensation.rosaTools).toEqual([]);
  });
});
