import { describe, it, expect } from 'vitest';
import { activeHref } from '../mono-tabs';
import { PLATFORM_ROOMS } from '../platform-rooms';

/**
 * Which tab lights up.
 *
 * This had no test, and was broken for every tab in every room: the registry
 * writes hrefs with a trailing slash ('/products/') while usePathname()
 * returns none ('/products'), so the literal comparison matched nothing and
 * no tab ever carried its 3px rule. Nobody noticed because the band still
 * looked fine, just uniformly dim.
 */

const CELLAR = PLATFORM_ROOMS.cellar.tabs;

describe('activeHref', () => {
  it('lights the tab for its own surface', () => {
    // The bug: pathname has no trailing slash, every href does.
    expect(activeHref('/products', CELLAR)).toBe('/products/');
    expect(activeHref('/reports/lcas', CELLAR)).toBe('/reports/lcas/');
  });

  it('tolerates a trailing slash on the pathname', () => {
    expect(activeHref('/products/', CELLAR)).toBe('/products/');
  });

  it('lights the nested surface, not its parent', () => {
    // /products/liquids matches both /products/ and /products/liquids/;
    // the longest prefix has to win or the liquid shelf would read as
    // "Products".
    expect(activeHref('/products/liquids', CELLAR)).toBe('/products/liquids/');
    expect(activeHref('/products/ingredients', CELLAR)).toBe('/products/ingredients/');
  });

  it('keeps a product detail page under Products', () => {
    expect(activeHref('/products/12/recipe', CELLAR)).toBe('/products/');
  });

  it('does not light a tab whose href merely shares a name prefix', () => {
    // '/productsomething' is not inside '/products'.
    expect(activeHref('/productsomething', CELLAR)).toBeUndefined();
  });

  it('lights nothing for a path outside the room', () => {
    expect(activeHref('/settings', CELLAR)).toBeUndefined();
  });

  it('prefers the plain tab over a query-string sibling', () => {
    // The wiring holds both '/settings/' and '/settings?tab=billing'. A
    // pathname never carries a query, so the two are indistinguishable by
    // path and the plain one has to win: landing on /settings should light
    // Settings, not Billing. Highlighting Billing by tab is a query-aware
    // concern the band does not have the information to answer.
    const wiring = PLATFORM_ROOMS.wiring.tabs;
    expect(activeHref('/settings', wiring)).toBe('/settings/');
  });

  it('lights exactly one tab for every tab in every room', () => {
    // A whole-registry guard: navigating to a tab's own href must light that
    // tab, in every room, or the band is lying about where you are.
    for (const room of Object.values(PLATFORM_ROOMS)) {
      for (const tab of room.tabs) {
        const path = tab.href.split('?')[0].replace(/\/+$/, '') || '/';
        const active = activeHref(path, room.tabs);
        expect(active, `${room.key} → ${tab.href}`).toBeDefined();
      }
    }
  });
});
