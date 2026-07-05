/**
 * The platform's house of rooms.
 *
 * Five rooms, one house: Today (forest), the measures (cobalt), the
 * evidence (brick), the post (ochre), the wiring (ink). The desk
 * (/desk) is the hall; every room keeps it one click away, top left.
 *
 * Room mapping approved by Tim at the M1 review (5 July 2026). Tabs are
 * the room's surfaces; deep sub-navigation stays inside the pages
 * themselves. Tier/milestone gating still happens on the pages (the
 * band does not hide tabs yet; refine after the M2 review).
 */

import { ON_COLOUR_RGB, STUDIO, type RoomConfig } from './theme';

export type PlatformRoomKey =
  | 'desk'
  | 'today'
  | 'measures'
  | 'evidence'
  | 'post'
  | 'wiring';

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
      { label: 'Targets', href: '/pulse/targets/' },
    ],
  },
  measures: {
    key: 'measures',
    name: 'The measures.',
    colour: STUDIO.cobalt,
    rgb: '43 70 192',
    accentOnPaper: STUDIO.cobalt,
    accentRgb: '43 70 192',
    onColour: 'cream',
    onRgb: ON_COLOUR_RGB.cream,
    mark: 'triangle', // the climb
    tabs: [
      { label: 'Facilities', href: '/company/facilities/' },
      { label: 'Emissions', href: '/data/scope-1-2/' },
      { label: 'Suppliers', href: '/suppliers/' },
      { label: 'Products', href: '/products/' },
      { label: 'Vitality', href: '/performance/' },
      { label: 'People', href: '/people-culture/' },
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
    tabs: [
      { label: 'Reports', href: '/reports/' },
      { label: 'Certifications', href: '/certifications/' },
      { label: 'EPR', href: '/epr/' },
      { label: 'Guardian', href: '/greenwash-guardian/' },
      { label: 'Library', href: '/evidence-library/' },
      { label: 'Knowledge', href: '/knowledge-bank/' },
    ],
  },
  post: {
    key: 'post',
    name: 'The post.',
    colour: STUDIO.ochre,
    rgb: '223 163 43',
    accentOnPaper: STUDIO.ochreInk,
    accentRgb: '169 124 20',
    onColour: 'ink', // ochre always takes ink text
    onRgb: ON_COLOUR_RGB.ink,
    mark: 'square', // the envelope, tilted
    tabs: [
      { label: 'Messages', href: '/settings/messages/' },
      { label: 'Support', href: '/settings/feedback/' },
      { label: 'Experts', href: '/expert-partners/' },
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
    tabs: [{ label: 'Settings', href: '/settings/' }],
  },
};

/**
 * Path-prefix → room resolution. Order matters: the post's surfaces live
 * under /settings/, so its specific prefixes are checked before the
 * wiring's catch-all /settings.
 */
const ROOM_PREFIXES: Array<[prefix: string, room: PlatformRoomKey]> = [
  // the hall
  ['/desk', 'desk'],
  // the post (before /settings)
  ['/settings/messages', 'post'],
  ['/settings/feedback', 'post'],
  ['/expert-partners', 'post'],
  // today
  ['/rosa', 'today'],
  ['/pulse', 'today'],
  ['/dashboard', 'today'],
  // the measures
  ['/company', 'measures'],
  ['/data', 'measures'],
  ['/suppliers', 'measures'],
  ['/products', 'measures'],
  ['/performance', 'measures'],
  ['/people-culture', 'measures'],
  ['/community-impact', 'measures'],
  ['/governance', 'measures'],
  ['/hospitality', 'measures'],
  ['/vineyards', 'measures'],
  ['/orchards', 'measures'],
  ['/arable-fields', 'measures'],
  ['/nature-assessment', 'measures'],
  // the evidence
  ['/reports', 'evidence'],
  ['/certifications', 'evidence'],
  ['/epr', 'evidence'],
  ['/evidence-library', 'evidence'],
  ['/greenwash-guardian', 'evidence'],
  ['/knowledge-bank', 'evidence'],
  ['/wiki', 'evidence'],
  // the wiring
  ['/settings', 'wiring'],
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

/** The rooms in desk order: four colours, then the wiring in ink. */
export const DESK_ORDER: PlatformRoomKey[] = [
  'today',
  'measures',
  'evidence',
  'post',
  'wiring',
];
