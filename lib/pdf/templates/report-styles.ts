/**
 * Report styles — the five audience-led presets.
 *
 * A style binds everything that should change together when the READER
 * changes: the look (theme), the narrative structure (section order and
 * emphasis), the imagery policy, and the tone of voice threaded into every
 * AI-written narrative. Users pick a style; everything else follows as an
 * editable default.
 *
 * The five styles (Tim, 2026-07-18):
 * - marketing     · storytelling and imagery, brand-forward
 * - customers     · product focus, plain and honest
 * - compliance    · the full technical document, standards-first
 * - investors     · financially focused board brief
 * - supply-chain  · collaborative, mutual goals with partners
 */

export type ReportStyleId = 'marketing' | 'customers' | 'compliance' | 'investors' | 'supply-chain';

export interface ReportStyle {
  id: ReportStyleId;
  name: string;
  description: string;
  /** Theme id (lib/pdf/templates/themes.ts) providing the look. */
  themeId: string;
  /**
   * Legacy audience value kept on the generated_reports.audience column
   * (its CHECK constraint predates styles) and fed to the AI assistants'
   * audience-focus map.
   */
  audience: string;
  /** Storytelling tier: gates leadership page + chapter dividers. */
  tier: 'full' | 'balanced' | 'data-first';
  /** Imagery policy: rich = hero photos + dividers wherever provided. */
  imagery: 'rich' | 'standard' | 'none';
  /**
   * Tone-of-voice instruction appended to every narrative prompt (exec
   * summary, section narratives, key findings).
   */
  tone: string;
  /**
   * The narrative arc: section ids in the order this reader should meet
   * them. Sections the user deselects (or without data) simply drop out.
   * Ids not listed render after the listed ones in catalogue order.
   */
  sectionOrder: string[];
  /** Sections preselected when this style is chosen in the builder. */
  defaultSections: string[];
  /** Reporting standards preselected when this style is chosen. */
  defaultStandards: string[];
  /** Three short lines the builder shows for the selected style. */
  cues: string[];
}

const CORE = ['executive-summary', 'scope-1-2-3'];

export const REPORT_STYLES: Record<ReportStyleId, ReportStyle> = {
  marketing: {
    id: 'marketing',
    name: 'Marketing',
    description: 'Storytelling and imagery. The brand story of the year, told through people, places and progress.',
    themeId: 'narrative',
    audience: 'customers',
    tier: 'full',
    imagery: 'rich',
    tone: 'Warm and story-led. Write in the first person plural, lead with people and progress, keep numbers to the few that carry the story. Plain language, no jargon, no superlatives that data does not support.',
    sectionOrder: [
      'executive-summary', 'key-findings', 'community-impact', 'people-culture',
      'product-footprints', 'scope-1-2-3', 'trends', 'targets', 'transition-roadmap',
      'supply-chain', 'facilities', 'governance', 'methodology',
    ],
    defaultSections: [...CORE, 'key-findings', 'community-impact', 'people-culture', 'product-footprints', 'targets'],
    defaultStandards: ['ghg-protocol'],
    cues: [
      'The story of the year, told through people and progress',
      'Hero photography, chapter dividers and the leadership foreword',
      'A few numbers that carry the story, not tables of them',
    ],
  },
  customers: {
    id: 'customers',
    name: 'Customers',
    description: 'Product focus. What is in the bottle, what it costs the planet, and what is getting better.',
    themeId: 'modern',
    audience: 'customers',
    tier: 'balanced',
    imagery: 'standard',
    tone: 'Plain, honest and product-first. Talk about the products by name, per-unit numbers over corporate totals, and what changed this year. Never overclaim; say what is not yet measured.',
    sectionOrder: [
      'executive-summary', 'product-footprints', 'key-findings', 'scope-1-2-3',
      'trends', 'supply-chain', 'facilities', 'targets', 'people-culture',
      'community-impact', 'governance', 'methodology',
    ],
    defaultSections: [...CORE, 'product-footprints', 'key-findings', 'trends', 'targets'],
    defaultStandards: ['iso-14067'],
    cues: [
      'Per-product footprints front and centre',
      'What changed this year, in plain language',
      'Honest about what is not yet measured',
    ],
  },
  compliance: {
    id: 'compliance',
    name: 'Compliance',
    description: 'The full technical document. Standards-first, complete disclosure, tables before stories.',
    themeId: 'data-dense',
    audience: 'regulators',
    tier: 'data-first',
    imagery: 'none',
    tone: 'Precise and standards-referenced. Cite clauses, state boundaries and methods, quantify uncertainty. No marketing language; every claim traceable to the data.',
    sectionOrder: [
      'executive-summary', 'scope-1-2-3', 'trends', 'key-findings',
      'product-footprints', 'supply-chain', 'facilities', 'people-culture',
      'governance', 'community-impact', 'targets', 'transition-roadmap',
      'risks-and-opportunities', 'methodology', 'regulatory',
    ],
    defaultSections: [
      ...CORE, 'trends', 'key-findings', 'product-footprints', 'supply-chain',
      'governance', 'targets', 'transition-roadmap', 'risks-and-opportunities',
      'methodology', 'regulatory',
    ],
    defaultStandards: ['csrd', 'iso-14064', 'gri'],
    cues: [
      'Framework compliance (CSRD, GRI, ISO)',
      'Methodology transparency and data quality',
      'Complete disclosure, tables before stories',
    ],
  },
  investors: {
    id: 'investors',
    name: 'Investors & Board',
    description: 'The financial lens. Targets, risk exposure and transition economics, metrics first.',
    themeId: 'executive',
    audience: 'investors',
    tier: 'balanced',
    imagery: 'none',
    tone: 'Concise and financially framed. Lead with material risks, targets and the transition plan; connect emissions to cost, regulation and revenue exposure. Board-brief register: short sentences, no colour.',
    sectionOrder: [
      'executive-summary', 'targets', 'risks-and-opportunities', 'trends',
      'transition-roadmap', 'scope-1-2-3', 'key-findings', 'governance',
      'product-footprints', 'supply-chain', 'facilities', 'methodology',
    ],
    defaultSections: [...CORE, 'targets', 'risks-and-opportunities', 'trends', 'transition-roadmap', 'key-findings', 'governance'],
    defaultStandards: ['csrd', 'tcfd'],
    cues: [
      'Material risks, targets and transition economics first',
      'Emissions connected to cost and revenue exposure',
      'Board-brief register: landscape, metrics-led',
    ],
  },
  'supply-chain': {
    id: 'supply-chain',
    name: 'Supply Chain Partners',
    description: 'Collaborative. Shared footprint, mutual goals, and what we can achieve together next year.',
    themeId: 'modern',
    audience: 'supply-chain',
    tier: 'balanced',
    imagery: 'standard',
    tone: 'Collaborative and mutual. Write as partners with shared goals: acknowledge suppliers by category, frame reductions as joint achievements, and be explicit about what is asked of partners next and what support is offered in return.',
    sectionOrder: [
      'executive-summary', 'supply-chain', 'facilities', 'key-findings',
      'scope-1-2-3', 'targets', 'transition-roadmap', 'product-footprints',
      'trends', 'governance', 'methodology',
    ],
    defaultSections: [...CORE, 'supply-chain', 'key-findings', 'targets', 'transition-roadmap'],
    defaultStandards: ['ghg-protocol'],
    cues: [
      'Shared footprint and joint achievements',
      'What we ask of partners next, and the support offered',
      'Mutual goals over one-way reporting',
    ],
  },
};

export const REPORT_STYLE_LIST: ReportStyle[] = [
  REPORT_STYLES.marketing,
  REPORT_STYLES.customers,
  REPORT_STYLES.compliance,
  REPORT_STYLES.investors,
  REPORT_STYLES['supply-chain'],
];

/**
 * Resolve a style from a stored config. Explicit style wins; otherwise the
 * legacy audience value maps to its nearest style so every existing report
 * keeps rendering sensibly.
 */
export function resolveReportStyle(styleId?: string | null, audience?: string | null): ReportStyle {
  if (styleId && styleId in REPORT_STYLES) return REPORT_STYLES[styleId as ReportStyleId];
  switch (audience) {
    case 'investors':
    case 'internal':
      return REPORT_STYLES.investors;
    case 'customers':
      return REPORT_STYLES.customers;
    case 'supply-chain':
      return REPORT_STYLES['supply-chain'];
    case 'regulators':
    case 'technical':
    default:
      return REPORT_STYLES.compliance;
  }
}
