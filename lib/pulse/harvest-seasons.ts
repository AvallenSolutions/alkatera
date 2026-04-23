/**
 * Pulse -- Harvest season reference data.
 *
 * Curated annual seasonality for the crops that dominate alkatera's
 * customer base (drinks industry: spirits, wine, beer, RTD, soft drinks).
 *
 * Each entry covers the *Northern hemisphere* harvest window; if a supplier
 * sources from the southern hemisphere (e.g. Chilean wine, NZ hops), shift
 * by six months. The widget surfaces both hemispheres when the org has
 * sourcing across them.
 *
 * `peakMonths` are the 1-indexed months where harvest activity (and thus
 * upstream emissions, transport spikes, raw material price moves) is most
 * concentrated. `windowMonths` is the broader picking/processing window.
 */

export interface CropSeason {
  /** Lower-cased lookup key. */
  key: string;
  /** Display name. */
  label: string;
  /** Northern hemisphere peak months (1-12). */
  peakMonths: number[];
  /** Northern hemisphere full window months (1-12). */
  windowMonths: number[];
  /** What the harvest signals on the dashboard. */
  notes: string;
  /** Search aliases used for fuzzy-matching against BOM/product names. */
  aliases: string[];
}

export const HARVEST_SEASONS: CropSeason[] = [
  {
    key: 'grape',
    label: 'Wine grapes',
    peakMonths: [9, 10],
    windowMonths: [8, 9, 10, 11],
    notes:
      'Vintage. Expect transport-emission spikes from inbound grape and bottling supply, and a step-change in ingredient lots after.',
    aliases: ['grape', 'wine', 'cabernet', 'merlot', 'chardonnay', 'pinot', 'syrah', 'sauvignon', 'riesling'],
  },
  {
    key: 'agave',
    label: 'Blue agave',
    peakMonths: [10, 11, 12, 1, 2, 3],
    windowMonths: [10, 11, 12, 1, 2, 3, 4],
    notes:
      'Year-round in Jalisco but the dry season produces highest sugar concentration. 7-year maturation means harvest planning lags decisions by years.',
    aliases: ['agave', 'tequila', 'mezcal', 'sotol', 'raicilla'],
  },
  {
    key: 'sugarcane',
    label: 'Sugarcane',
    peakMonths: [11, 12, 1, 2, 3, 4],
    windowMonths: [10, 11, 12, 1, 2, 3, 4, 5],
    notes:
      'Caribbean / Central American crop. Northern-hemisphere mills run autumn-to-spring; expect molasses and rum-spirit shipments to peak mid-window.',
    aliases: ['sugarcane', 'cane', 'molasses', 'rum', 'cachaca', 'cachaça'],
  },
  {
    key: 'barley',
    label: 'Malting barley',
    peakMonths: [7, 8],
    windowMonths: [7, 8, 9],
    notes:
      'UK / European harvest July-September. New-crop malt typically reaches breweries and distilleries in Q4. Quality variance feeds product LCAs.',
    aliases: ['barley', 'malt', 'beer', 'whisky', 'whiskey', 'lager', 'ale'],
  },
  {
    key: 'hops',
    label: 'Hops',
    peakMonths: [8, 9],
    windowMonths: [8, 9, 10],
    notes:
      'Late-summer harvest in Pacific NW USA, Germany (Hallertau) and the UK. Wet-hop windows are short and emissions-intensive due to rapid air-freight.',
    aliases: ['hop', 'hops', 'cascade', 'centennial', 'mosaic', 'citra'],
  },
  {
    key: 'apple',
    label: 'Apples (cider)',
    peakMonths: [9, 10],
    windowMonths: [8, 9, 10, 11],
    notes:
      'Cider apple harvest. Pressing and fermentation kicks off in autumn; maturation drives Q4-Q1 cellar emissions.',
    aliases: ['apple', 'cider', 'cyder', 'pomace'],
  },
  {
    key: 'juniper',
    label: 'Juniper berries',
    peakMonths: [9, 10, 11],
    windowMonths: [9, 10, 11, 12],
    notes:
      'Wild-harvested in autumn from Mediterranean and Balkan regions. Two-year ripening means yields swing year to year.',
    aliases: ['juniper', 'gin'],
  },
  {
    key: 'corn',
    label: 'Maize / corn',
    peakMonths: [9, 10],
    windowMonths: [9, 10, 11],
    notes:
      'US Midwest harvest. Bourbon and grain-spirit producers see new-crop arrivals from October.',
    aliases: ['corn', 'maize', 'bourbon'],
  },
  {
    key: 'rye',
    label: 'Rye',
    peakMonths: [7, 8],
    windowMonths: [7, 8, 9],
    notes:
      'European and US Midwest harvest. Used in rye whisky, vodka and as a malt bill component.',
    aliases: ['rye'],
  },
  {
    key: 'orange',
    label: 'Oranges',
    peakMonths: [12, 1, 2],
    windowMonths: [11, 12, 1, 2, 3],
    notes:
      'Mediterranean (Sicily, Spain) bittersweet harvest peaks midwinter. Drives liqueur, vermouth and aperitif aromatics supply.',
    aliases: ['orange', 'bitter orange', 'curaçao', 'curacao', 'triple sec'],
  },
];

/** Flip a Northern-hemisphere month to its Southern-hemisphere equivalent. */
export function flipHemisphere(month: number): number {
  return ((month + 5) % 12) + 1;
}

/**
 * Resolve which curated crops are relevant to the org based on free-text
 * names from products, BOM or supplier products. Case-insensitive substring
 * match against each crop's aliases. Stops looking once it finds 6 matches.
 */
export function relevantCrops(
  freeTextNames: Iterable<string>,
  limit = 6,
): CropSeason[] {
  const haystack = Array.from(freeTextNames)
    .map(s => s.toLowerCase())
    .join(' | ');
  if (!haystack.trim()) return [];
  const hits: CropSeason[] = [];
  for (const crop of HARVEST_SEASONS) {
    const matched = crop.aliases.some(a => haystack.includes(a.toLowerCase()));
    if (matched) {
      hits.push(crop);
      if (hits.length >= limit) break;
    }
  }
  return hits;
}
