import { describe, it, expect } from 'vitest';
import {
  PLATFORM_ROOMS,
  roomForPath,
  roomWithModules,
  roomHref,
  roomShortName,
  otherRoomLinks,
  deskOrderForPersona,
  tabsForPersona,
  DESK_ORDER,
} from '../platform-rooms';

describe('roomForPath', () => {
  it('routes the daily surfaces to Today', () => {
    expect(roomForPath('/rosa/').key).toBe('today');
    expect(roomForPath('/pulse/financial/').key).toBe('today');
  });

  it('splits data capture (workbench) from composition (cellar)', () => {
    expect(roomForPath('/company/facilities/').key).toBe('workbench');
    expect(roomForPath('/data/spend-data/').key).toBe('workbench');
    expect(roomForPath('/products/').key).toBe('cellar');
    expect(roomForPath('/products/liquids/').key).toBe('cellar');
    expect(roomForPath('/products/packs/').key).toBe('cellar');
  });

  it('routes the whole /reports tree, LCAs included, to the evidence', () => {
    expect(roomForPath('/reports/lcas/').key).toBe('evidence');
    expect(roomForPath('/reports/sustainability/').key).toBe('evidence');
    expect(roomForPath('/reports/').key).toBe('evidence');
  });

  it('gives the evidence the outcome surfaces that moved in', () => {
    // Emissions came up from the workbench; the /data catch-all must not
    // reclaim it, so the specific prefix has to be checked first.
    expect(roomForPath('/data/scope-1-2/').key).toBe('evidence');
    expect(roomForPath('/data/quality/').key).toBe('workbench');
    // Vitality and the nature assessment came across from the cellar.
    expect(roomForPath('/performance/').key).toBe('evidence');
    expect(roomForPath('/nature-assessment/').key).toBe('evidence');
  });

  it('gives the library the two surfaces that moved in', () => {
    // /evidence-library must beat the /evidence prefix, or it wears brick.
    expect(roomForPath('/evidence-library/').key).toBe('library');
    expect(roomForPath('/evidence-library/abc123').key).toBe('library');
    expect(roomForPath('/evidence/').key).toBe('evidence');
    expect(roomForPath('/uploads/').key).toBe('library');
  });

  it('keeps Pulse in Today but routes Targets to the evidence room', () => {
    // Targets is a "prove & steer" surface, so it wears the evidence band
    // even though it sits under /pulse. The specific prefix must win.
    expect(roomForPath('/pulse/').key).toBe('today');
    expect(roomForPath('/pulse/financial/').key).toBe('today');
    expect(roomForPath('/pulse/targets/').key).toBe('evidence');
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

  it('keeps the four modules in the workbench', () => {
    expect(roomForPath('/vineyards/').key).toBe('workbench');
    expect(roomForPath('/orchards/').key).toBe('workbench');
    expect(roomForPath('/arable-fields/').key).toBe('workbench');
    expect(roomForPath('/hospitality/').key).toBe('workbench');
  });

  it('tucks compliance and settings into the wiring', () => {
    expect(roomForPath('/settings/').key).toBe('wiring');
    expect(roomForPath('/epr/').key).toBe('wiring');
    expect(roomForPath('/byproducts/').key).toBe('wiring');
  });

  it('gives the social surfaces to the people room, not the wiring', () => {
    // These three used to sit in the wiring's "More…" overflow, under no
    // shared name, which is why nobody could find "Social Impact" after the
    // move to rooms. They are a room now.
    expect(roomForPath('/people-culture/').key).toBe('people');
    expect(roomForPath('/people-culture/fair-work/').key).toBe('people');
    expect(roomForPath('/community-impact/').key).toBe('people');
    expect(roomForPath('/governance/').key).toBe('people');
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
      expect(order).toHaveLength(8); // seven colours + wiring
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

describe('roomWithModules', () => {
  const declaredHrefs = (modules: Parameters<typeof roomWithModules>[1]) =>
    (roomWithModules(PLATFORM_ROOMS.workbench, modules).more ?? []).map((t) => t.href);

  it('never leaks a module the org has not declared', () => {
    // The whole point: an org that grows nothing never sees the words.
    for (const modules of [null, undefined, []] as const) {
      const more = declaredHrefs(modules);
      expect(more).toEqual(['/data/inventory-ledger/']);
    }
  });

  it('appends only the declared modules, after the room’s own overflow', () => {
    expect(declaredHrefs(['hospitality'])).toEqual([
      '/data/inventory-ledger/',
      '/hospitality/',
    ]);
  });

  it('orders modules canonically, not in the order they were clicked', () => {
    expect(declaredHrefs(['hospitality', 'viticulture'])).toEqual([
      '/data/inventory-ledger/',
      '/vineyards/',
      '/hospitality/',
    ]);
  });

  it('leaves every other room untouched, declarations or not', () => {
    for (const key of ['today', 'cellar', 'network', 'evidence', 'library', 'wiring'] as const) {
      const room = PLATFORM_ROOMS[key];
      expect(roomWithModules(room, ['viticulture', 'hospitality'])).toBe(room);
    }
  });

  it('does not mutate the registry', () => {
    const before = PLATFORM_ROOMS.workbench.more?.length ?? 0;
    roomWithModules(PLATFORM_ROOMS.workbench, ['viticulture', 'orchards']);
    expect(PLATFORM_ROOMS.workbench.more?.length ?? 0).toBe(before);
  });
});

describe('the reorganised tabs', () => {
  const hrefs = (key: keyof typeof PLATFORM_ROOMS) =>
    PLATFORM_ROOMS[key].tabs.map((t) => t.href);

  it('narrows the cellar to composition alone', () => {
    expect(hrefs('cellar')).toEqual([
      '/products/',
      '/products/liquids/',
      '/products/packs/',
      '/products/ingredients/',
    ]);
  });

  it('gives the evidence its four proof surfaces', () => {
    expect(hrefs('evidence')).toEqual([
      '/reports/sustainability/',
      '/reports/lcas/',
      '/performance/',
      '/data/scope-1-2/',
    ]);
  });

  it('puts your own documents first on the library shelf', () => {
    expect(hrefs('library')).toEqual([
      '/evidence-library/',
      '/knowledge-bank/',
      '/wiki/',
      '/uploads/',
    ]);
  });

  it('never repeats a room\u2019s landing as one of its own tabs', () => {
    // "People" pointed at /people-culture/, which was also the room's landing
    // \u2014 so the band read "Our people." and then "PEOPLE" straight after it,
    // two words for one page. You reach a room's landing by clicking its name.
    for (const [key, room] of Object.entries(PLATFORM_ROOMS)) {
      if (!room.landing) continue;
      const dupes = [...room.tabs, ...(room.more ?? [])]
        .filter((t) => t.href === room.landing)
        .map((t) => t.label);
      expect(`${key}: ${dupes.join(', ')}`).toBe(`${key}: `);
    }
  });

  it('gives the people room three tabs and calls it Our people', () => {
    expect(PLATFORM_ROOMS.people.name).toBe('Our people.');
    expect(roomShortName(PLATFORM_ROOMS.people)).toBe('Our people');
    expect(hrefs('people')).toEqual([
      '/community-impact/',
      '/governance/',
      '/people-culture/fair-work/',
    ]);
  });

  it('every tab and overflow entry resolves back to its own room', () => {
    // A tab that routes elsewhere flips the band colour mid-navigation.
    // Deliberate exceptions. The two settings-tab deep links (the Billing
    // precedent) because the query string cannot be seen by roomForPath; and
    // Vitality weights, which configures the vitality score (a wiring job)
    // but lives on a /governance path, so the people room owns its colour.
    const crossRoom = new Set([
      '/settings?tab=integrations',
      '/settings?tab=billing',
      '/governance/vitality-weights/',
    ]);
    for (const [key, room] of Object.entries(PLATFORM_ROOMS)) {
      if (key === 'desk') continue;
      for (const tab of [...room.tabs, ...(room.more ?? [])]) {
        if (crossRoom.has(tab.href)) continue;
        expect(`${key}:${tab.href}:${roomForPath(tab.href).key}`).toBe(`${key}:${tab.href}:${key}`);
      }
    }
  });
});

describe('otherRoomLinks', () => {
  it('never offers the room you are standing in', () => {
    for (const key of DESK_ORDER) {
      const hrefs = otherRoomLinks(key).map((t) => t.href);
      expect(hrefs).not.toContain(roomHref(key));
    }
  });

  it('offers every other room, and never the desk', () => {
    // Seven rooms, minus the one you are in. The desk is the hall and is
    // already one click away from the band's top-left grid mark.
    const links = otherRoomLinks('cellar');
    expect(links).toHaveLength(DESK_ORDER.length - 1);
    expect(links.map((t) => t.label)).not.toContain('Desk');
  });

  it('is the way OUT, not a repeat of the room band', () => {
    // The bug this fixes: the ink band used to render the room's own tabs,
    // the same words already sitting in the band at the top of the page.
    const cellarSurfaces = PLATFORM_ROOMS.cellar.tabs.map((t) => t.href);
    for (const link of otherRoomLinks('cellar')) {
      expect(cellarSurfaces).not.toContain(link.href);
    }
  });

  it('follows the persona ordering the desk uses', () => {
    // Finance leads with the evidence, so it leads the band too.
    expect(otherRoomLinks('today', 'finance')[0].label).toBe('Evidence');
    expect(otherRoomLinks('today', 'operator')[0].label).toBe('Workbench');
  });

  it('every link lands in the room it names', () => {
    for (const key of DESK_ORDER) {
      for (const link of otherRoomLinks(key)) {
        expect(`${link.label} → ${roomForPath(link.href).key}`).toBe(
          `${link.label} → ${DESK_ORDER.find((k) => roomShortName(PLATFORM_ROOMS[k]) === link.label)}`,
        );
      }
    }
  });
});

describe('roomShortName and roomHref', () => {
  it('drops the article and the full stop', () => {
    expect(roomShortName(PLATFORM_ROOMS.cellar)).toBe('Cellar');
    expect(roomShortName(PLATFORM_ROOMS.today)).toBe('Today');
    expect(roomShortName(PLATFORM_ROOMS.wiring)).toBe('Wiring');
  });

  it('opens a room on its landing, or its first surface when it has none', () => {
    expect(roomHref('cellar')).toBe('/cellar/');
    // Today has no landing of its own: it opens on the brief.
    expect(PLATFORM_ROOMS.today.landing).toBeUndefined();
    expect(roomHref('today')).toBe('/rosa/');
  });

  it('gives every room a real destination', () => {
    for (const key of DESK_ORDER) {
      expect(roomHref(key)).toMatch(/^\//);
    }
  });
});

describe('DESK_ORDER', () => {
  it('is the seven coloured rooms then the wiring', () => {
    expect(DESK_ORDER).toEqual([
      'today',
      'workbench',
      'cellar',
      'network',
      'evidence',
      'people',
      'library',
      'wiring',
    ]);
  });
});
