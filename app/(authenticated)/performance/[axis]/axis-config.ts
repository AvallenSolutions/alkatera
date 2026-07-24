import type {
  CircularityScoreBreakdown,
  ClimateScoreBreakdown,
  NatureScoreBreakdown,
  WaterScoreBreakdown,
} from '@/lib/vitality/environmental';
import type { VitalityComposite } from '@/lib/vitality/composite';

/**
 * The four environmental axes that have a page of their own.
 *
 * Social and Governance axes are listed on /performance/ but have no route
 * yet — they have no deep-dive body to show. `isAxisSlug` is what stops a
 * vitality row linking somewhere that would 404.
 */
export const AXIS_SLUGS = ['climate', 'water', 'circularity', 'nature'] as const;

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
