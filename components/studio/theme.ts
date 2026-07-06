/**
 * The studio design language for alkatera.
 *
 * Single source of truth for the palette and the room registry.
 * Hex literals are exported because Recharts (and SVG fills generally)
 * cannot read Tailwind classes. Everything visual should come from here
 * or from the :root CSS variables in app/globals.css.
 *
 * NOTE: the ROOMS registry below is still distributor-flavoured; the
 * platform-wide room mapping is Milestone 2 (workshopped with Tim).
 */

export const STUDIO = {
  // the ground
  paper: '#ECEAE3',
  cream: '#F2F1EA',
  hairline: '#D9D6CB',
  dim: '#6F6F68',
  ink: '#1A1B1D',
  // the rooms — one colour each, spent deliberately
  forest: '#205E40',
  teal: '#1E5F5B',
  cobalt: '#2B46C0',
  plum: '#6D3A5D',
  ochre: '#DFA32B',
  ochreInk: '#A97C14', // ochre's accent form on paper (contrast)
  brick: '#BF4B2A',
  // working tones — states, never decoration
  good: '#047857',
  attention: '#B45309',
  stale: '#BE123C',
  hold: '#6D28D9',
} as const;

export type WorkingTone = 'good' | 'attention' | 'stale' | 'hold' | 'quiet';

export type MarkShape = 'circle' | 'triangle' | 'square' | 'quarter' | 'diamond' | 'arch' | 'ring';

export type RoomKey = 'desk' | 'portfolio' | 'supply' | 'post' | 'evidence';

export interface RoomTab {
  label: string;
  href: string;
}

export interface RoomConfig {
  /** Registry key. A string so both the distributor registry (RoomKey)
      and the platform registry (PlatformRoomKey) can share the shape. */
  key: string;
  /** Plain words with a little pride: "The portfolio." */
  name: string;
  /** Saturated room ink (band + poster block fill). */
  colour: string;
  /** "R G B" triplet for the --room-rgb variable. */
  rgb: string;
  /** Accent used for text on paper (ochre swaps to its ink form). */
  accentOnPaper: string;
  /** "R G B" triplet for the --room-accent-rgb variable. */
  accentRgb: string;
  /** Text colour on the saturated block: cream or ink only. */
  onColour: 'cream' | 'ink';
  /** "R G B" triplet for the --room-on-rgb variable. */
  onRgb: string;
  mark: MarkShape;
  /** The room's surfaces, most-used first. */
  tabs: RoomTab[];
  /** Overflow surfaces shown behind a "More…" menu (rare / long-tail). */
  more?: RoomTab[];
}

/** "R G B" triplets for the two permitted text colours on saturated blocks. */
export const ON_COLOUR_RGB = {
  cream: '242 241 234',
  ink: '26 27 29',
} as const;

export const ROOMS: Record<RoomKey, RoomConfig> = {
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
    tabs: [
      { label: 'Dashboard', href: '/distributor/dashboard' },
      { label: 'Notifications', href: '/distributor/notifications' },
    ],
  },
  portfolio: {
    key: 'portfolio',
    name: 'The portfolio.',
    colour: STUDIO.forest,
    rgb: '32 94 64',
    accentOnPaper: STUDIO.forest,
    accentRgb: '32 94 64',
    onColour: 'cream',
    onRgb: ON_COLOUR_RGB.cream,
    mark: 'circle',
    tabs: [
      { label: 'Brands', href: '/distributor/brands' },
      { label: 'Matches', href: '/distributor/brands/pending-matches' },
    ],
  },
  supply: {
    key: 'supply',
    name: 'The supply.',
    colour: STUDIO.cobalt,
    rgb: '43 70 192',
    accentOnPaper: STUDIO.cobalt,
    accentRgb: '43 70 192',
    onColour: 'cream',
    onRgb: ON_COLOUR_RGB.cream,
    mark: 'triangle',
    tabs: [
      { label: 'Discover', href: '/distributor/discover' },
      { label: 'Lists', href: '/distributor/sku-lists' },
      { label: 'Upload', href: '/distributor/sku-lists/upload' },
    ],
  },
  post: {
    key: 'post',
    name: 'The post.',
    colour: STUDIO.ochre,
    rgb: '223 163 43',
    accentOnPaper: STUDIO.ochreInk,
    accentRgb: '169 124 20',
    onColour: 'ink',
    onRgb: ON_COLOUR_RGB.ink,
    mark: 'square',
    tabs: [
      { label: 'Outreach', href: '/distributor/outreach' },
      { label: 'Queue', href: '/distributor/outreach/queue' },
      { label: 'Reminders', href: '/distributor/outreach/reminders' },
      { label: 'Submissions', href: '/distributor/submissions' },
      { label: 'Conflicts', href: '/distributor/conflicts' },
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
    mark: 'quarter',
    tabs: [{ label: 'Reports', href: '/distributor/reports' }],
  },
};

export const WORKING_TONE_HEX: Record<Exclude<WorkingTone, 'quiet'>, string> = {
  good: STUDIO.good,
  attention: STUDIO.attention,
  stale: STUDIO.stale,
  hold: STUDIO.hold,
};

/** The studio ease: starts briskly, settles softly. */
export const STUDIO_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
