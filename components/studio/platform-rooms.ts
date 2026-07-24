/**
 * The platform's house of rooms.
 *
 * Seven rooms, one house, ordered by how often you reach for them:
 *   Today (forest)      · daily: the brief, the pulse
 *   The workbench (cobalt) · weekly: the data going in
 *   The cellar (plum)   · what a product is made of
 *   The network (ochre) · the people you talk to
 *   The evidence (brick)· the outputs you show, and the numbers behind them
 *   The library (teal)  · the reference you reach for now and then
 *   The wiring (ink)    · settings, compliance, the rare and the seasonal
 *
 * The desk (/desk) is the hall; every room keeps it one click away, top
 * left. Frequency defines the rooms (one set for everyone); the persona
 * only re-weights the desk order and each room's tab order. Room mapping
 * approved by Tim (6 July 2026), reorganised by Tim (24 July 2026):
 *
 *   · the cellar narrowed to composition alone — what a drink is made of.
 *     Its outcomes (LCAs, vitality, the nature assessment) moved next door.
 *   · the evidence became the room of proof AND the numbers behind it:
 *     reports, completed LCAs, vitality as its hero, and the emissions.
 *   · the library gained the evidence library ("your library") and uploads,
 *     so everything you have gathered sits on one shelf.
 *   · the workbench kept the operational data and gained integrations; the
 *     four growing/hospitality modules are declared per org, not universal.
 */

import { MODULE_HREF, MODULE_LABEL, WORKS_WITH_MODULES, type WorksWithModule } from '@/lib/subscription/works-with';
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
    // Six flat tabs: the operational surfaces an org touches every week.
    // Integrations points straight at the settings tab that owns it, the
    // Billing precedent. The declared modules (vineyards, orchards, arable
    // fields, hospitality) are appended to `more` per org — see
    // roomWithModules below; they are never in the static registry, so an
    // org that does not grow anything never sees the words.
    tabs: [
      { label: 'Facilities', href: '/company/facilities/' },
      { label: 'Spend', href: '/data/spend-data/' },
      { label: 'Integrations', href: '/settings?tab=integrations' },
      { label: 'Quality', href: '/data/quality/' },
      { label: 'Fleet', href: '/company/fleet/' },
      { label: 'Sources', href: '/data/sources/' },
    ],
    more: [{ label: 'Inventory', href: '/data/inventory-ledger/' }],
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
    // Composition only: what a drink is made of, each part owned once. The
    // outcomes the cellar used to carry (LCAs, vitality, the nature
    // assessment) live in the evidence room, where the proof lives.
    tabs: [
      { label: 'Products', href: '/products/' },
      { label: 'Liquids', href: '/products/liquids/' },
      { label: 'Packaging', href: '/products/packs/' },
      { label: 'Ingredients', href: '/products/ingredients/' },
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
    // Five flat tabs; the band fits them, so no "More…" overflow. Ordered
    // the way you reach for them: the chain first, the people you can call
    // second, then the two inboxes, then sourcing.
    tabs: [
      { label: 'Suppliers', href: '/suppliers/' },
      { label: 'Experts', href: '/expert-partners/' },
      { label: 'Messages', href: '/settings/messages/' },
      { label: 'Support', href: '/settings/feedback/' },
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
    // The room of proof and the numbers behind it. Four flat tabs: what you
    // publish, the finished product footprints, the vitality score (this
    // room's hero) and the corporate emissions. Reports points straight at
    // the real hub (the old /reports/ front door redirects there). The
    // longer tail — certifications, the guardian, targets, the company
    // footprint, the nature assessment, historical imports — sits behind
    // "More…" and on the landing, so nothing is undiscoverable.
    tabs: [
      { label: 'Reports', href: '/reports/sustainability/' },
      { label: 'LCAs', href: '/reports/lcas/' },
      { label: 'Vitality', href: '/performance/' },
      { label: 'Emissions', href: '/data/scope-1-2/' },
    ],
    more: [
      { label: 'Certifications', href: '/certifications/' },
      { label: 'Targets', href: '/pulse/targets/' },
      { label: 'Guardian', href: '/greenwash-guardian/' },
      { label: 'Company footprint', href: '/reports/company-footprint/' },
      { label: 'Nature', href: '/nature-assessment/' },
      { label: 'Historical', href: '/reports/historical/' },
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
    // Everything you have gathered, on one shelf: your own documents first
    // (the evidence library, renamed so it reads as yours rather than as a
    // second "library"), then the reference we bring, then the inbox that
    // fills the shelf.
    tabs: [
      { label: 'Your library', href: '/evidence-library/' },
      { label: 'Knowledge', href: '/knowledge-bank/' },
      { label: 'Wiki', href: '/wiki/' },
      { label: 'Uploads', href: '/uploads/' },
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
  // the evidence room's two strays out of /data — checked before the /data
  // catch-all below, which still belongs to the workbench.
  ['/data/scope-1-2', 'evidence'],
  // the workbench (data going in)
  ['/workbench', 'workbench'],
  ['/company', 'workbench'],
  ['/data', 'workbench'],
  ['/vineyards', 'workbench'],
  ['/orchards', 'workbench'],
  ['/arable-fields', 'workbench'],
  ['/hospitality', 'workbench'],
  // the cellar (what a drink is made of)
  ['/cellar', 'cellar'],
  ['/products', 'cellar'],
  // the evidence (the proof, and the numbers behind it). /reports/lcas is no
  // longer a special case: the whole /reports tree wears brick now.
  ['/evidence-library', 'library'], // before /evidence, and it moved rooms
  ['/evidence', 'evidence'],
  ['/reports', 'evidence'],
  ['/certifications', 'evidence'],
  ['/greenwash-guardian', 'evidence'],
  ['/nature-assessment', 'evidence'],
  ['/performance', 'evidence'],
  // the library (everything you have gathered, plus the reference we bring)
  ['/library', 'library'],
  ['/knowledge-bank', 'library'],
  ['/wiki', 'library'],
  ['/uploads', 'library'],
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
  ['/complete-subscription', 'wiring'],
];

/**
 * The workbench, with this org's declared modules appended to its overflow.
 *
 * The four modules (vineyards, orchards, arable fields, hospitality) are not
 * for every drinks business, so they are never in the static registry: an org
 * that does not grow anything never sees the words. What it declared on the
 * arrival ritual's modules step (organizations.works_with) is what appears.
 *
 * Returns the room untouched for every other room and for an org that has
 * declared nothing, so callers can pass every room through this without a
 * branch and without churning object identity for the common case.
 */
export function roomWithModules(
  room: RoomConfig,
  modules: WorksWithModule[] | null | undefined,
): RoomConfig {
  if (room.key !== 'workbench' || !modules || modules.length === 0) return room;
  // Canonical order, not click order, so the menu is stable between orgs.
  const declared = WORKS_WITH_MODULES.filter((m) => modules.includes(m));
  if (declared.length === 0) return room;
  return {
    ...room,
    more: [
      ...(room.more ?? []),
      ...declared.map((m) => ({ label: MODULE_LABEL[m], href: MODULE_HREF[m] })),
    ],
  };
}

/**
 * A room's name as a tab label: "The cellar." → "Cellar", "Today." → "Today".
 * Derived rather than stored so the registry keeps one name per room. The
 * band uppercases it in CSS; the value itself stays properly cased so it
 * reads correctly anywhere else it is used.
 */
export function roomShortName(room: RoomConfig): string {
  const bare = room.name.replace(/^The\s+/i, '').replace(/\.$/, '');
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/**
 * Where a room opens from outside it: its landing page, or its first
 * surface for the rooms that have no landing of their own (Today opens on
 * the brief). Never returns an empty string for a real room.
 */
export function roomHref(key: PlatformRoomKey): string {
  const room = PLATFORM_ROOMS[key];
  return room.landing ?? room.tabs[0]?.href ?? '/desk/';
}

/**
 * The rooms you could go to next, for the ink band at the foot of every
 * surface.
 *
 * The band used to repeat the room's own tabs, which the room band already
 * carries three lines above — the same six words twice on one screen, and
 * no way out of the room except back up to the desk. Going down the page
 * now means going somewhere else in the house.
 *
 * Ordered by persona like the desk's poster blocks, so the whole platform
 * agrees about which room a given person reaches for first. The current
 * room is omitted (you are in it) and so is the desk (the band's top-left
 * grid mark is already one click from anywhere).
 */
export function otherRoomLinks(
  current: PlatformRoomKey,
  persona?: Persona | null,
): RoomConfig['tabs'] {
  return deskOrderForPersona(persona)
    .filter((key) => key !== current && key !== 'desk')
    .map((key) => ({ label: roomShortName(PLATFORM_ROOMS[key]), href: roomHref(key) }));
}

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
