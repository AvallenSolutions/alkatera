/**
 * Per-route help registry — the "?" affordance in the room band.
 *
 * One entry per route: a plain-language sentence on what the page is for,
 * up to three real wiki pages that go deeper, and a prompt Rosa can act on
 * straight away. Surfaced by components/studio/help-panel.tsx.
 *
 * Longest-match wins, same approach as roomForPath in platform-rooms.ts:
 * more specific prefixes are listed first so e.g. /settings/feedback
 * resolves before the generic /settings entry.
 *
 * WIKI_TITLES is a small display-only lookup (slug -> title) so the panel
 * never needs a network round trip just to label a link. It is a plain
 * client-safe data map, not the wiki content itself (that stays server-only
 * in lib/wiki.ts). Keep it in sync with wiki/pages/*.md front matter when
 * slugs used here change.
 *
 * See tasks/onboarding-support-plan.md, Phase 3.
 */

export interface HelpEntry {
  prefix: string;
  /** One plain-language sentence. British English, no em dashes, full stop. */
  summary: string;
  /** Real wiki slugs (wiki/pages/<slug>.md), most relevant first. Max 3 used. */
  wikiSlugs: string[];
  /** Seed prompt for the "Ask Rosa" pill, phrased as the user would ask it. */
  rosaPrompt: string;
}

export const WIKI_TITLES: Record<string, string> = {
  'b-corp': 'B Corp',
  'carbon-footprint': 'Carbon Footprint',
  'carbon-intensity': 'Carbon Intensity',
  'csrd': 'Corporate Sustainability Reporting Directive (CSRD)',
  'drinks-carbon-hotspots': 'Drinks Carbon Hotspots',
  'extended-producer-responsibility': 'Extended Producer Responsibility (EPR)',
  'functional-unit': 'Functional Unit',
  'life-cycle-assessment': 'Life Cycle Assessment',
  'primary-vs-secondary-data': 'Primary vs Secondary Data',
  'product-carbon-footprint': 'Product Carbon Footprint',
  'science-based-targets': 'Science-Based Targets',
  'scope-1-emissions': 'Scope 1 Emissions',
  'scope-2-emissions': 'Scope 2 Emissions',
  'scope-3-categories': 'The 15 Scope 3 Categories',
  'scope-3-emissions': 'Scope 3 Emissions',
  'secr': 'Streamlined Energy and Carbon Reporting (SECR)',
  'sustainability-reporting': 'Sustainability Reporting',
  'system-boundaries': 'System Boundaries',
  'uk-plastic-packaging-tax': 'UK Plastic Packaging Tax',
  'vsme': 'VSME Standard',
};

/** Ordered most-specific-first; see helpForPath. */
export const HELP_MAP: HelpEntry[] = [
  // More specific than the generic /settings entry below.
  {
    prefix: '/settings/feedback',
    summary: 'The support desk holds every ticket you have raised and any reply from the team.',
    wikiSlugs: [],
    rosaPrompt: 'I need help with something. Can you look into it or raise a ticket for me?',
  },
  // More specific than the generic /pulse entry below.
  {
    prefix: '/pulse/targets',
    summary: 'Targets tracks the reduction goals you have set against your actual progress.',
    wikiSlugs: ['science-based-targets', 'carbon-intensity'],
    rosaPrompt: 'Help me understand my targets and whether I am on track.',
  },
  {
    prefix: '/desk',
    summary: 'The desk shows how complete your alkatera data is, and the single next thing worth doing.',
    wikiSlugs: [],
    rosaPrompt: 'What should I do next?',
  },
  {
    prefix: '/rosa',
    summary: "This is Rosa's home: the daily brief and pulse for how your organisation is doing.",
    wikiSlugs: [],
    rosaPrompt: 'What should I look at today?',
  },
  {
    prefix: '/pulse',
    summary: 'Pulse tracks your emissions and other sustainability metrics over time, in one place.',
    wikiSlugs: ['carbon-footprint', 'carbon-intensity', 'scope-1-emissions'],
    rosaPrompt: 'What is Pulse showing me, and what should I do about it?',
  },
  {
    prefix: '/workbench',
    summary: 'The workbench is where your operational data goes in: facilities, energy, spend and everything you measure.',
    wikiSlugs: ['scope-1-emissions', 'scope-2-emissions', 'primary-vs-secondary-data'],
    rosaPrompt: 'What data should I add in the workbench next?',
  },
  {
    prefix: '/cellar',
    summary: 'The cellar turns your products into carbon footprints, one life cycle assessment at a time.',
    wikiSlugs: ['life-cycle-assessment', 'product-carbon-footprint', 'functional-unit'],
    rosaPrompt: 'Help me understand my product footprints.',
  },
  {
    prefix: '/products',
    summary: 'Products is where you manage what you make, and start a life cycle assessment for each one.',
    wikiSlugs: ['product-carbon-footprint', 'life-cycle-assessment', 'system-boundaries'],
    rosaPrompt: 'How do I add a product and start its LCA?',
  },
  {
    prefix: '/network',
    summary: 'The network is where you reach your suppliers, your messages and the people you can call on for help.',
    wikiSlugs: ['scope-3-emissions', 'scope-3-categories', 'drinks-carbon-hotspots'],
    rosaPrompt: 'How do I get my suppliers set up?',
  },
  {
    prefix: '/suppliers',
    summary: 'Suppliers holds everyone in your supply chain, and the Scope 3 data they can share with you.',
    wikiSlugs: ['scope-3-emissions', 'scope-3-categories', 'primary-vs-secondary-data'],
    rosaPrompt: 'How do I add a supplier and request their data?',
  },
  {
    prefix: '/evidence',
    summary: 'The evidence is where your work becomes proof: reports, certifications and the targets you are working towards.',
    wikiSlugs: ['sustainability-reporting', 'science-based-targets', 'b-corp'],
    rosaPrompt: 'What evidence am I missing?',
  },
  {
    prefix: '/reports',
    summary: 'Reports turns your data into a sustainability report you can share with customers, investors or regulators.',
    wikiSlugs: ['sustainability-reporting', 'csrd', 'vsme'],
    rosaPrompt: 'What report should I generate, and who is it for?',
  },
  {
    prefix: '/certifications',
    summary: 'Certifications tracks your progress towards schemes like B Corp, so you always know what is left to do.',
    wikiSlugs: ['b-corp', 'sustainability-reporting'],
    rosaPrompt: 'What is left for me to do on my certification?',
  },
  {
    prefix: '/library',
    summary: 'The library is your reference shelf: the knowledge bank and the wiki, whenever you need to look something up.',
    wikiSlugs: [],
    rosaPrompt: 'What should I read to understand my footprint better?',
  },
  {
    prefix: '/wiki',
    summary: 'The wiki explains the standards, regulations and terms behind sustainability reporting in plain language.',
    wikiSlugs: [],
    rosaPrompt: 'Explain a sustainability term to me.',
  },
  {
    prefix: '/wiring',
    summary: 'The wiring is the quiet machinery behind everything else: settings, billing, compliance and the rest of the platform.',
    wikiSlugs: ['extended-producer-responsibility', 'uk-plastic-packaging-tax', 'secr'],
    rosaPrompt: 'What compliance do I need to be aware of?',
  },
  {
    prefix: '/settings',
    summary: 'Settings is where you manage your team, billing, integrations and account preferences.',
    wikiSlugs: [],
    rosaPrompt: 'How do I invite my team or change my plan?',
  },
];

/** Which help entry does this path belong to? Longest-prefix, first match wins. */
export function helpForPath(pathname: string | null): HelpEntry | null {
  if (!pathname) return null;
  for (const entry of HELP_MAP) {
    if (pathname.startsWith(entry.prefix)) return entry;
  }
  return null;
}
