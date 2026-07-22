/**
 * The platform's house of rooms.
 *
 * Seven rooms, one house, ordered by how often you reach for them:
 *   Today (forest)      · daily: the brief, the pulse
 *   The workbench (cobalt) · weekly: the data going in
 *   The cellar (plum)   · weekly: the product footprints being made
 *   The network (ochre) · the people you talk to
 *   The evidence (brick)· the outputs you show
 *   The library (teal)  · the reference you reach for now and then
 *   The wiring (ink)    · settings, compliance, the rare and the seasonal
 *
 * The desk (/desk) is the hall; every room keeps it one click away, top
 * left. Frequency defines the rooms (one set for everyone); the persona
 * only re-weights the desk order and each room's tab order. Room mapping
 * approved by Tim (6 July 2026).
 */

import { ON_COLOUR_RGB, STUDIO, type RoomConfig } from './theme';

export type PlatformRoomKey =
  | 'desk'
  | 'today'
  | 'workbench'
  | 'cellar'
  | 'network'
  | 'evidence'
  | 'library'
  | 'wiring';

/** Rosa's coarse persona (see lib/rosa/useUserRole.ts). */
export type Persona = 'operator' | 'finance' | 'leadership' | 'sustainability' | 'unknown';

export const PLATFORM_ROOMS: Record<PlatformRoomKey, RoomConfig> = {
  desk: {
    key: 'desk',
    name: 'The desk.',
    colour: STUDIO.ink,
    rgb: '26 27 29',
    accentOnPaper: STUDIO.ink,
    accentRgb: '26 27 29',
    onColour: 'cream',
    onRgb: ON_COLOUR_RGB.cream,
    mark: 'ring',
    tabs: [],
  },
  today: {
    key: 'today',
    name: 'Today.',
    colour: STUDIO.forest,
    rgb: '32 94 64',
    accentOnPaper: STUDIO.forest,
    accentRgb: '32 94 64',
    onColour: 'cream',
    onRgb: ON_COLOUR_RGB.cream,
    mark: 'circle', // the sun on the day
    tabs: [
      { label: 'Brief', href: '/rosa/' },
      { label: 'Pulse', href: '/pulse/' },
      { label: 'Financial', href: '/pulse/financial/' },
    ],
  },
  workbench: {
    key: 'workbench',
    name: 'The workbench.',
    colour: STUDIO.cobalt,
    rgb: '43 70 192',
    accentOnPaper: STUDIO.cobalt,
    accentRgb: '43 70 192',
    onColour: 'cream',
    onRgb: ON_COLOUR_RGB.cream,
    mark: 'triangle', // the climb
    landing: '/workbench/',
    tabs: [
      { label: 'Facilities', href: '/company/facilities/' },
      { label: 'Emissions', href: '/data/scope-1-2/' },
      { label: 'Spend', href: '/data/spend-data/' },
      { label: 'Quality', href: '/data/quality/' },
    ],
    more: [
      { label: 'Sources', href: '/data/sources/' },
      { label: 'Inventory', href: '/data/inventory-ledger/' },
      { label: 'Fleet', href: '/company/fleet/' },
      { label: 'Vineyards', href: '/vineyards/' },
      { label: 'Orchards', href: '/orchards/' },
      { label: 'Arable fields', href: '/arable-fields/' },
      { label: 'Hospitality', href: '/hospitality/' },
      { label: 'Uploads', href: '/uploads/' },
    ],
  },
  cellar: {
    key: 'cellar',
    name: 'The cellar.',
    colour: STUDIO.plum,
    rgb: '109 58 93',
    accentOnPaper: STUDIO.plum,
    accentRgb: '109 58 93',
    onColour: 'cream',
    onRgb: ON_COLOUR_RGB.cream,
    mark: 'diamond', // the bottled facet
    landing: '/cellar/',
    tabs: [
      { label: 'Products', href: '/products/' },
      // What a product is made of, one level up from the product itself: the
      // liquid you make and the ingredients you buy, each owned once.
      { label: 'Liquids', href: '/products/liquids/' },
      { label: 'Ingredients', href: '/products/ingredients/' },
      { label: 'LCAs', href: '/reports/lcas/' },
      { label: 'Vitality', href: '/performance/' },
      { label: 'Nature', href: '/nature-assessment/' },
    ],
  },
  network: {
    key: 'network',
    name: 'The network.',
    colour: STUDIO.ochre,
    rgb: '223 163 43',
    accentOnPaper: STUDIO.ochreInk,
    accentRgb: '169 124 20',
    onColour: 'ink', // ochre always takes ink text
    onRgb: ON_COLOUR_RGB.ink,
    mark: 'square', // the envelope, tilted
    landing: '/network/',
    // Five flat tabs; the band fits them, so no "More…" overflow (the cellar
    // precedent). Experts and Responsibility come up from the old overflow.
    tabs: [
      { label: 'Suppliers', href: '/suppliers/' },
      { label: 'Messages', href: '/settings/messages/' },
      { label: 'Support', href: '/settings/feedback/' },
      { label: 'Experts', href: '/expert-partners/' },
      { label: 'Sourcing', href: '/supplier-responsibility/' },
    ],
  },
  evidence: {
    key: 'evidence',
    name: 'The evidence.',
    colour: STUDIO.brick,
    rgb: '191 75 42',
    accentOnPaper: STUDIO.brick,
    accentRgb: '191 75 42',
    onColour: 'cream',
    onRgb: ON_COLOUR_RGB.cream,
    mark: 'quarter', // the atelier window
    landing: '/evidence/',
    // Five flat tabs; the band fits them, so no "More…" overflow (the network
    // precedent). Reports points straight at the real hub (the old /reports/
    // front door now redirects there). Materiality + Transition plan were tabs
    // of the hub, not destinations; Footprint + Historical live on the landing.
    tabs: [
      { label: 'Reports', href: '/reports/sustainability/' },
      { label: 'Certifications', href: '/certifications/' },
      { label: 'Guardian', href: '/greenwash-guardian/' },
      { label: 'Targets', href: '/pulse/targets/' },
      { label: 'Library', href: '/evidence-library/' },
    ],
  },
  library: {
    key: 'library',
    name: 'The library.',
    colour: STUDIO.teal,
    rgb: '30 95 91',
    accentOnPaper: STUDIO.teal,
    accentRgb: '30 95 91',
    onColour: 'cream',
    onRgb: ON_COLOUR_RGB.cream,
    mark: 'arch', // the doorway
    landing: '/library/',
    tabs: [
      { label: 'Knowledge', href: '/knowledge-bank/' },
      { label: 'Wiki', href: '/wiki/' },
    ],
  },
  wiring: {
    key: 'wiring',
    name: 'The wiring.',
    colour: STUDIO.ink,
    rgb: '26 27 29',
    accentOnPaper: STUDIO.ink,
    accentRgb: '26 27 29',
    onColour: 'cream',
    onRgb: ON_COLOUR_RGB.cream,
    mark: 'ring', // the quiet listener
    landing: '/wiring/',
    tabs: [
      { label: 'Settings', href: '/settings/' },
      // Straight to the tab: the /settings/billing stub stays only as an alias.
      { label: 'Billing', href: '/settings?tab=billing' },
    ],
    more: [
      { label: 'EPR', href: '/epr/' },
      { label: 'People', href: '/people-culture/' },
      { label: 'Governance', href: '/governance/' },
      { label: 'Community', href: '/community-impact/' },
      { label: 'Byproducts', href: '/byproducts/' },
      { label: 'Nature actions', href: '/nature-actions/' },
      { label: 'Vitality weights', href: '/governance/vitality-weights/' },
      { label: 'Dependencies', href: '/dependencies/' },
    ],
  },
};

/**
 * Path-prefix → room resolution. Order matters: specific prefixes are
 * checked before catch-alls (messages/support live under /settings/ but
 * belong to the network, so they precede the wiring's /settings).
 */
const ROOM_PREFIXES: Array<[prefix: string, room: PlatformRoomKey]> = [
  // the hall
  ['/desk', 'desk'],
  // the network (before /settings and before /suppliers stays here too)
  ['/network', 'network'],
  ['/settings/messages', 'network'],
  ['/settings/feedback', 'network'],
  ['/expert-partners', 'network'],
  ['/suppliers', 'network'],
  ['/supplier-responsibility', 'network'],
  // today (but Targets is a "prove & steer" surface, so it lives in the
  // evidence room, checked before the /pulse catch-all)
  ['/pulse/targets', 'evidence'],
  ['/rosa', 'today'],
  ['/pulse', 'today'],
  ['/dashboard', 'today'],
  // the workbench (data going in)
  ['/workbench', 'workbench'],
  ['/company', 'workbench'],
  ['/data', 'workbench'],
  ['/vineyards', 'workbench'],
  ['/orchards', 'workbench'],
  ['/arable-fields', 'workbench'],
  ['/hospitality', 'workbench'],
  ['/uploads', 'workbench'],
  // the cellar (footprints being made)
  ['/cellar', 'cellar'],
  ['/products', 'cellar'],
  ['/reports/lcas', 'cellar'],
  ['/nature-assessment', 'cellar'],
  ['/performance', 'cellar'],
  // the evidence (before /reports catch nothing else; /reports/lcas already routed above)
  ['/evidence', 'evidence'],
  ['/reports', 'evidence'],
  ['/certifications', 'evidence'],
  ['/greenwash-guardian', 'evidence'],
  ['/evidence-library', 'evidence'],
  // the library
  ['/library', 'library'],
  ['/knowledge-bank', 'library'],
  ['/wiki', 'library'],
  // the wiring (settings, compliance, the rare)
  ['/wiring', 'wiring'],
  ['/settings', 'wiring'],
  ['/epr', 'wiring'],
  ['/people-culture', 'wiring'],
  ['/governance', 'wiring'],
  ['/community-impact', 'wiring'],
  ['/byproducts', 'wiring'],
  ['/nature-actions', 'wiring'],
  ['/dependencies', 'wiring'],
  ['/admin', 'wiring'],
  ['/dev', 'wiring'],
  ['/create-organization', 'wiring'],
  ['/complete-subscription', 'wiring'],
];

/** Which room does this path belong to? The desk and unknowns take ink. */
export function roomForPath(pathname: string | null): RoomConfig {
  if (pathname) {
    for (const [prefix, key] of ROOM_PREFIXES) {
      if (pathname.startsWith(prefix)) return PLATFORM_ROOMS[key];
    }
  }
  // The desk and anything unmapped sit quietly in ink.
  return PLATFORM_ROOMS.wiring;
}

/**
 * The desk's poster-block order, re-weighted by persona so the room a
 * user lives in leads. The wiring is always the quiet ink block last.
 * Every persona sees the same rooms, only the order shifts.
 */
const CORE_ORDER: PlatformRoomKey[] = [
  'today',
  'workbench',
  'cellar',
  'network',
  'evidence',
  'library',
];

const PERSONA_LEAD: Record<Persona, PlatformRoomKey[]> = {
  // operators live in data capture
  operator: ['today', 'workbench', 'cellar', 'network', 'evidence', 'library'],
  // finance leads with the numbers and the proof
  finance: ['today', 'evidence', 'cellar', 'workbench', 'network', 'library'],
  // leadership wants the headline and what we can show
  leadership: ['today', 'evidence', 'network', 'cellar', 'workbench', 'library'],
  // sustainability leads build footprints and chase certifications
  sustainability: ['today', 'cellar', 'evidence', 'workbench', 'network', 'library'],
  unknown: CORE_ORDER,
};

export function deskOrderForPersona(persona: Persona | null | undefined): PlatformRoomKey[] {
  const order = (persona && PERSONA_LEAD[persona]) || CORE_ORDER;
  return [...order, 'wiring'];
}

/**
 * A room's tabs, re-weighted so the persona's daily driver leads. Only
 * reorders the primary tabs; the `more` overflow is untouched. Rooms
 * with no persona-relevant reordering return their tabs unchanged.
 */
function moveToFront(tabs: RoomConfig['tabs'], hrefs: string[]): RoomConfig['tabs'] {
  const lead = hrefs
    .map((h) => tabs.find((t) => t.href === h))
    .filter((t): t is RoomConfig['tabs'][number] => Boolean(t));
  if (lead.length === 0) return tabs;
  const rest = tabs.filter((t) => !lead.includes(t));
  return [...lead, ...rest];
}

export function tabsForPersona(
  room: RoomConfig,
  persona: Persona | null | undefined,
): RoomConfig['tabs'] {
  if (!persona || persona === 'unknown') return room.tabs;
  // Finance and leadership want the money surface first in Today.
  if (room.key === 'today' && (persona === 'finance' || persona === 'leadership')) {
    return moveToFront(room.tabs, ['/pulse/financial/', '/pulse/']);
  }
  return room.tabs;
}

/** The rooms in desk order: the six colours, then the wiring in ink. */
export const DESK_ORDER: PlatformRoomKey[] = [...CORE_ORDER, 'wiring'];
