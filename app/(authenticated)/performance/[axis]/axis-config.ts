import type {
  CircularityScoreBreakdown,
  ClimateScoreBreakdown,
  NatureScoreBreakdown,
  WaterScoreBreakdown,
} from '@/lib/vitality/environmental';
import type { VitalityComposite } from '@/lib/vitality/composite';

/**
 * Every axis surface: the four environmental ones, plus a page per pillar for
 * Social and Governance. `isAxisSlug` is what stops a vitality row linking
 * somewhere that would 404.
 */
export const AXIS_SLUGS = [
  'climate',
  'water',
  'circularity',
  'nature',
  // The two pillar pages. Social and Governance have no per-axis deep-dive
  // body to show, so each pillar gets one page covering its axes rather than
  // three near-empty ones. They were unreachable from the vitality page
  // entirely until now, which is what made the page argue against its own
  // headline: it said People & culture was dragging the score, then offered
  // nowhere to go and do something about it.
  'social',
  'governance',
] as const;

export type AxisSlug = (typeof AXIS_SLUGS)[number];

export function isAxisSlug(value: string): value is AxisSlug {
  return (AXIS_SLUGS as readonly string[]).includes(value);
}

export interface AxisDefinition {
  slug: AxisSlug;
  /** Sentence case, for the headline: "Your climate score is 60." */
  noun: string;
  /** Mono eyebrow suffix: "THE EVIDENCE · CLIMATE". */
  eyebrow: string;
  /** The poster's own eyebrow. */
  posterEyebrow: string;
  /**
   * The precise unit, which lives HERE rather than on the vitality list.
   * The list says "13,668 m² a year"; this page can afford "m²a crop eq"
   * because the methodology note sits beside it.
   */
  preciseUnit: string;
  /** One paragraph, plain language, on how the score is reached. */
  methodology: string;
}

/** Which page a vitality row goes to. Several axes share a pillar page. */
export const AXIS_ROUTE: Record<string, AxisSlug> = {
  climate: 'climate',
  water: 'water',
  circularity: 'circularity',
  nature: 'nature',
  community: 'social',
  people_culture: 'social',
  supplier_esg: 'social',
  governance: 'governance',
  certifications: 'governance',
};

export const AXES: Record<AxisSlug, AxisDefinition> = {
  climate: {
    slug: 'climate',
    noun: 'climate',
    eyebrow: 'THE EVIDENCE · CLIMATE',
    posterEyebrow: 'THE CLIMATE AXIS',
    preciseUnit: 'kg CO2e',
    methodology:
      'Intensity is kg CO2e per litre produced, scored against the drinks-sector band. ' +
      'Year on year compares this year to last on the same basis. Follows the GHG Protocol ' +
      'Corporate Standard and ISO 14064.',
  },
  water: {
    slug: 'water',
    noun: 'water',
    eyebrow: 'THE EVIDENCE · WATER',
    posterEyebrow: 'THE WATER AXIS',
    preciseUnit: 'm³ world eq',
    methodology:
      'Scarcity-weighted water use (AWARE) from facility readings where you have them, ' +
      'falling back to the water figures in your product LCAs. A cubic metre used where ' +
      'water is scarce counts for more than one used where it is plentiful.',
  },
  circularity: {
    slug: 'circularity',
    noun: 'circularity',
    eyebrow: 'THE EVIDENCE · CIRCULARITY',
    posterEyebrow: 'THE CIRCULARITY AXIS',
    preciseUnit: '% diverted',
    methodology:
      'The share of your waste diverted from landfill, plus the recycled content of your ' +
      'packaging. Measured from your own waste records where they exist, and from packaging ' +
      'specifications otherwise.',
  },
  nature: {
    slug: 'nature',
    noun: 'nature',
    eyebrow: 'THE EVIDENCE · NATURE',
    posterEyebrow: 'THE NATURE AXIS',
    preciseUnit: 'm²a crop eq',
    methodology:
      'Land occupation from the agricultural inputs in your product LCAs, expressed as ' +
      'crop-equivalent square metres per year. Land-use change and biodiversity pressure are ' +
      'reported separately and are not netted against it.',
  },
  social: {
    slug: 'social',
    noun: 'people',
    eyebrow: 'THE EVIDENCE · THE PEOPLE',
    posterEyebrow: 'THE PEOPLE PILLAR',
    preciseUnit: 'score 0-100',
    methodology:
      'Four measures: your workforce (pay, turnover, diversity actions), community contribution, ' +
      'how much of your supply chain has been assessed for social risk, and the change on last ' +
      'year. Each measure carries the weight shown against it. A measure you have no data for ' +
      'still counts against you at its weight; the year-on-year measure drops to zero weight ' +
      'until there is a prior year to compare with.',
  },
  governance: {
    slug: 'governance',
    noun: 'governance',
    eyebrow: 'THE EVIDENCE · THE GOVERNANCE',
    posterEyebrow: 'THE GOVERNANCE PILLAR',
    preciseUnit: 'score 0-100',
    methodology:
      'Three measures: your governance practices (policy, stakeholder engagement, board, ethics ' +
      'and transparency), progress against the certifications you are pursuing, and the change on ' +
      'last year.',
  },
};

/** The breakdown object for an axis, out of the composite the page already has. */
export function axisBreakdown(
  composite: VitalityComposite | null,
  slug: AxisSlug,
):
  | ClimateScoreBreakdown
  | WaterScoreBreakdown
  | CircularityScoreBreakdown
  | NatureScoreBreakdown
  | null {
  if (!composite) return null;
  const e = composite.e as any;
  switch (slug) {
    case 'social':
      return (composite.s as any).social_breakdown ?? null;
    case 'governance':
      return (composite.g as any).governance_breakdown ?? null;
    case 'climate':
      return e.climate_breakdown ?? null;
    case 'water':
      return e.water_breakdown ?? null;
    case 'circularity':
      return e.circularity_breakdown ?? null;
    case 'nature':
      return e.nature_breakdown ?? null;
  }
}
