/**
 * Restrictable sections: the single source of truth for who may see what
 * INSIDE an organisation.
 *
 * Subscription tiers answer "has this org paid for the feature" (see
 * lib/subscription/feature-catalog.ts). This file answers a different
 * question, one level down: "should this particular person see it". Until
 * now the answer was always yes — being a member of an org meant reading
 * every row it owned, salaries included.
 *
 * Everything derives from `RESTRICTABLE_SECTIONS`:
 *   - the toggle rows in Team settings (label + blurb)
 *   - `sectionForPath()`, which the navigation filter and the page gate use
 *   - `sectionForApi()`, the map behind the route guards
 *   - `SECTION_ROSA_TOOLS`, withheld from a restricted caller's tool list
 *
 * To add a section: add one entry here, add its key to the `section_key`
 * CHECK constraint in the migration, and the rest follows.
 *
 * DEFAULT IS OPEN. A row in `organization_section_access` exists only where
 * someone has deliberately switched a section off, so nothing changes for
 * anyone until an owner or admin flips a switch.
 */

export type SectionKey = 'pulse' | 'financial' | 'compensation';

export interface SectionDef {
  key: SectionKey;
  /** Sentence case, as it appears on the toggle row. */
  label: string;
  /** One plain-language line: what this person loses when it is off. */
  blurb: string;
  /**
   * Page path prefixes this section owns. Order within the whole registry
   * matters, not within one entry — see `sectionForPath`.
   */
  paths: string[];
  /** API path prefixes this section owns. Same resolution rule. */
  apis: string[];
  /** Rosa tools withheld when this section is off. */
  rosaTools: string[];
}

export const RESTRICTABLE_SECTIONS: Record<SectionKey, SectionDef> = {
  pulse: {
    key: 'pulse',
    label: 'Pulse',
    blurb: 'The daily read on the numbers: the widget grid, the insights and the anomalies.',
    paths: ['/pulse'],
    apis: ['/api/pulse'],
    rosaTools: ['query_pulse_metrics', 'list_insights', 'list_recent_anomalies'],
  },
  financial: {
    key: 'financial',
    label: 'Financial',
    blurb: 'Money: the CFO view of the footprint, the spend ledger, and billing.',
    // Most specific first within the section; the cross-section ordering is
    // handled by PATH_PREFIXES below.
    paths: ['/pulse/financial', '/data/spend-data'],
    apis: [
      '/api/pulse/financial-footprint',
      '/api/pulse/expanded/financial-footprint',
      '/api/pulse/cost-intensity',
      '/api/pulse/cost-drivers',
      '/api/pulse/product-costs',
      '/api/pulse/board-pack',
      '/api/pulse/shadow-prices',
      '/api/pulse/issb-disclosure',
      '/api/spend',
      '/api/impact-valuation',
    ],
    rosaTools: [],
  },
  compensation: {
    key: 'compensation',
    label: 'Compensation records',
    blurb: 'Individual pay data: salaries, pay ratios and the living-wage evidence behind Fair work.',
    paths: ['/people-culture/fair-work'],
    apis: ['/api/people-culture/compensation'],
    rosaTools: [],
  },
};

export const SECTION_KEYS = Object.keys(RESTRICTABLE_SECTIONS) as SectionKey[];

/** A section's access, keyed by section. Absent key means allowed. */
export type SectionAccess = Partial<Record<SectionKey, boolean>>;

/**
 * Prefix → section, sorted longest-first.
 *
 * The nesting is the whole trick. `/pulse/financial` sits *under* `/pulse`,
 * so a naive `startsWith` scan in registry order would hand every financial
 * path to `pulse` and the Financial toggle would do nothing on its own.
 * Sorting by descending prefix length makes the most specific prefix win,
 * the same rule `ROOM_PREFIXES` follows in components/studio/platform-rooms.ts.
 *
 * The two directions this has to get right:
 *   deny `pulse`      → /pulse AND /pulse/financial both unreachable
 *                       (the caller checks both, see `sectionsForPath`)
 *   deny `financial`  → /pulse/financial closed, /pulse still open
 */
function buildPrefixTable(pick: (s: SectionDef) => string[]): Array<[string, SectionKey]> {
  return SECTION_KEYS.flatMap((key) =>
    pick(RESTRICTABLE_SECTIONS[key]).map((prefix) => [prefix, key] as [string, SectionKey]),
  ).sort((a, b) => b[0].length - a[0].length);
}

const PATH_PREFIXES = buildPrefixTable((s) => s.paths);
const API_PREFIXES = buildPrefixTable((s) => s.apis);

function matchPrefix(table: Array<[string, SectionKey]>, value: string | null | undefined) {
  if (!value) return null;
  // Normalise a trailing slash so '/pulse' and '/pulse/' behave alike, and so
  // '/pulsewidget' can never match the '/pulse' prefix.
  const path = value.endsWith('/') ? value.slice(0, -1) : value;
  for (const [prefix, key] of table) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return key;
  }
  return null;
}

/** The single section that owns this page path, most specific wins. */
export function sectionForPath(pathname: string | null | undefined): SectionKey | null {
  return matchPrefix(PATH_PREFIXES, pathname);
}

/** The single section that owns this API path, most specific wins. */
export function sectionForApi(pathname: string | null | undefined): SectionKey | null {
  return matchPrefix(API_PREFIXES, pathname);
}

/**
 * EVERY section standing between a user and this path — the owning section
 * plus each ancestor section it is nested inside.
 *
 * `/pulse/financial` needs both `financial` (it is that page) and `pulse`
 * (you get there through the Pulse room). Denying either closes it. Use this
 * for gating; use `sectionForPath` when you want the one owning section.
 */
export function sectionsForPath(pathname: string | null | undefined): SectionKey[] {
  if (!pathname) return [];
  const path = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const keys = new Set<SectionKey>();
  for (const [prefix, key] of PATH_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) keys.add(key);
  }
  return Array.from(keys);
}

/** Is this path reachable given the caller's access map? */
export function canReachPath(pathname: string | null | undefined, access: SectionAccess): boolean {
  return sectionsForPath(pathname).every((key) => access[key] !== false);
}

/** Rosa tool name → the section that must be open for her to call it. */
export const SECTION_ROSA_TOOLS: Record<string, SectionKey> = Object.fromEntries(
  SECTION_KEYS.flatMap((key) =>
    RESTRICTABLE_SECTIONS[key].rosaTools.map((tool) => [tool, key] as const),
  ),
);

/** Tool names this caller may not call, given their access map. */
export function withheldRosaTools(access: SectionAccess): string[] {
  return Object.entries(SECTION_ROSA_TOOLS)
    .filter(([, key]) => access[key] === false)
    .map(([tool]) => tool);
}
