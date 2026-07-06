import { describe, it, expect } from 'vitest';
import {
  PLATFORM_ROOMS,
  roomForPath,
  deskOrderForPersona,
  tabsForPersona,
  DESK_ORDER,
} from '../platform-rooms';

describe('roomForPath', () => {
  it('routes the daily surfaces to Today', () => {
    expect(roomForPath('/rosa/').key).toBe('today');
    expect(roomForPath('/pulse/financial/').key).toBe('today');
  });

  it('splits data capture (workbench) from footprints (cellar)', () => {
    expect(roomForPath('/company/facilities/').key).toBe('workbench');
    expect(roomForPath('/data/scope-1-2/').key).toBe('workbench');
    expect(roomForPath('/products/').key).toBe('cellar');
  });

  it('routes /reports/lcas to the cellar but /reports to the evidence', () => {
    // Order-sensitive: the more specific LCA prefix must win.
    expect(roomForPath('/reports/lcas/').key).toBe('cellar');
    expect(roomForPath('/reports/sustainability/').key).toBe('evidence');
    expect(roomForPath('/reports/').key).toBe('evidence');
  });

  it('keeps suppliers and messages in the network', () => {
    expect(roomForPath('/suppliers/').key).toBe('network');
    expect(roomForPath('/settings/messages/').key).toBe('network');
    expect(roomForPath('/settings/feedback/').key).toBe('network');
  });

  it('sends knowledge and wiki to the library', () => {
    expect(roomForPath('/knowledge-bank/').key).toBe('library');
    expect(roomForPath('/wiki/anything').key).toBe('library');
  });

  it('tucks compliance and settings into the wiring', () => {
    expect(roomForPath('/settings/').key).toBe('wiring');
    expect(roomForPath('/epr/').key).toBe('wiring');
    expect(roomForPath('/governance/').key).toBe('wiring');
    expect(roomForPath('/people-culture/').key).toBe('wiring');
  });

  it('defaults the desk and unknown paths to the wiring ink', () => {
    expect(roomForPath('/desk').key).toBe('desk');
    expect(roomForPath('/nowhere').key).toBe('wiring');
    expect(roomForPath(null).key).toBe('wiring');
  });
});

describe('deskOrderForPersona', () => {
  it('always ends with the wiring and covers every coloured room once', () => {
    for (const p of ['operator', 'finance', 'leadership', 'sustainability', 'unknown', null] as const) {
      const order = deskOrderForPersona(p);
      expect(order[order.length - 1]).toBe('wiring');
      expect(new Set(order).size).toBe(order.length); // no dupes
      expect(order).toHaveLength(7); // six colours + wiring
    }
  });

  it('leads the operator with the workbench and the sustainability lead with the cellar', () => {
    expect(deskOrderForPersona('operator')[1]).toBe('workbench');
    expect(deskOrderForPersona('sustainability')[1]).toBe('cellar');
  });

  it('leads finance and leadership with the evidence after Today', () => {
    expect(deskOrderForPersona('finance')[1]).toBe('evidence');
    expect(deskOrderForPersona('leadership')[1]).toBe('evidence');
  });
});

describe('tabsForPersona', () => {
  it('puts Financial first in Today for finance and leadership', () => {
    const today = PLATFORM_ROOMS.today;
    expect(tabsForPersona(today, 'finance')[0].href).toBe('/pulse/financial/');
    expect(tabsForPersona(today, 'leadership')[0].href).toBe('/pulse/financial/');
  });

  it('leaves Today unchanged for operators and unknown', () => {
    const today = PLATFORM_ROOMS.today;
    expect(tabsForPersona(today, 'operator')).toEqual(today.tabs);
    expect(tabsForPersona(today, 'unknown')).toEqual(today.tabs);
    expect(tabsForPersona(today, null)).toEqual(today.tabs);
  });

  it('never drops or duplicates a tab', () => {
    for (const room of Object.values(PLATFORM_ROOMS)) {
      for (const p of ['operator', 'finance', 'leadership', 'sustainability'] as const) {
        const out = tabsForPersona(room, p);
        expect(out).toHaveLength(room.tabs.length);
        expect(new Set(out.map((t) => t.href)).size).toBe(room.tabs.length);
      }
    }
  });
});

describe('DESK_ORDER', () => {
  it('is the six coloured rooms then the wiring', () => {
    expect(DESK_ORDER).toEqual([
      'today',
      'workbench',
      'cellar',
      'network',
      'evidence',
      'library',
      'wiring',
    ]);
  });
});
