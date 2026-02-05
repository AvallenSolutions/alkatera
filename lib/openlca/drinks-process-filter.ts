/**
 * Drinks-relevant process filter for ecoinvent.
 *
 * Two-layer filtering:
 * 1. ISIC category filter — cuts 26,533 processes to ~5,000 relevant ones
 * 2. Alias-boosted search — surfaces the best process for common drinks terms
 */

import { findMatchingAliases } from './drinks-aliases';

// ─── LAYER 1: ISIC CATEGORY FILTER ─────────────────────────────────────────

/**
 * Allowed ISIC category prefixes for drinks-relevant processes.
 * Processes whose category starts with any of these are kept.
 */
const ALLOWED_CATEGORY_PREFIXES = [
  // Agriculture — raw ingredients (crops, livestock, forestry)
  'A:Agriculture',

  // Food & beverage manufacturing
  'C:Manufacturing/10', // Manufacture of food products
  'C:Manufacturing/11', // Manufacture of beverages

  // Packaging materials manufacturing
  'C:Manufacturing/16', // Wood products (pallets, corks)
  'C:Manufacturing/17', // Paper & cardboard (cartons, labels, boxes)
  'C:Manufacturing/20', // Chemicals (cleaning, CO2, additives, plastics production)
  'C:Manufacturing/22', // Rubber & plastics (PET, HDPE, closures, film)
  'C:Manufacturing/23', // Non-metallic minerals (glass production)
  'C:Manufacturing/24', // Basic metals (aluminium, steel for cans)
  'C:Manufacturing/25', // Fabricated metals (deep drawing, sheet rolling, coating)

  // Energy
  'D:Electricity',

  // Water supply & recycling
  'E:Water supply; sewerage, waste management and remediation activities/36', // Water collection & supply
  'E:Water supply; sewerage, waste management and remediation activities/38/383', // Materials recovery (recycling)

  // Transport & logistics
  'H:Transportation',

  // Food service (e.g. restaurant/bar operations)
  'I:Accommodation and food',

  // Recycled content processes
  'Recycled content cut-off',
];

/**
 * Name patterns that indicate irrelevant processes — even within allowed categories.
 * These are checked as lowercase substring matches against process names.
 */
const NAME_EXCLUSION_PATTERNS = [
  // Heavy industry / mining
  'coal mining',
  'uranium',
  'nuclear',
  'petroleum refinery operation',

  // Vehicle & machinery manufacturing
  'vehicle production',
  'car production',
  'aircraft production',
  'lorry production',
  'ship production',
  'railway',

  // Construction
  'building construction',
  'road construction',

  // Electronics
  'circuit board',
  'semiconductor',
  'photovoltaic',
  'solar cell',
  'wind turbine',

  // Specific chemical processes unlikely for drinks
  'pesticide production',
  'herbicide production',
  'fungicide production',
  'insecticide production',

  // Waste treatment (except recycling which is in allowed categories)
  'treatment of sewage sludge',
  'treatment of municipal solid waste',
  'landfill of',
  'incineration of',
  'open dump',
  'unsanitary landfill',

  // Livestock feed processing (too niche)
  'cattle for slaughtering',
  'pig for slaughtering',
  'poultry for slaughtering',
  'chicken for slaughtering',
];

/**
 * Name patterns that should KEEP a process even if it would be excluded.
 * Checked before exclusion patterns.
 */
const NAME_KEEP_PATTERNS = [
  'beverage',
  'packaging glass',
  'bottle',
  'can ',
  'carton',
  'recycling of aluminium',
  'recycling of glass',
  'recycling of PET',
  'recycling of steel',
  'used beverage',
];

/**
 * Filter the full ecoinvent process list to only drinks-relevant processes.
 *
 * @param allProcesses - Full list of ecoinvent process descriptors
 * @returns Filtered list of drinks-relevant processes
 */
export function filterDrinksRelevantProcesses(allProcesses: any[]): any[] {
  return allProcesses.filter(process => {
    const category = process.category || '';
    const nameLower = (process.name || '').toLowerCase();

    // Step 1: Check if the category is in our allowed list
    const categoryAllowed = ALLOWED_CATEGORY_PREFIXES.some(prefix =>
      category.startsWith(prefix)
    );

    if (!categoryAllowed) {
      return false;
    }

    // Step 2: Check keep patterns first (overrides exclusions)
    const isKept = NAME_KEEP_PATTERNS.some(pattern =>
      nameLower.includes(pattern.toLowerCase())
    );

    if (isKept) {
      return true;
    }

    // Step 3: Check exclusion patterns
    const isExcluded = NAME_EXCLUSION_PATTERNS.some(pattern =>
      nameLower.includes(pattern.toLowerCase())
    );

    return !isExcluded;
  });
}

// ─── LAYER 2: ALIAS-BOOSTED SEARCH ─────────────────────────────────────────

interface ScoredProcess {
  process: any;
  score: number;
}

/**
 * Score a process's relevance to a search query.
 *
 * Scoring:
 *  +100  matches an alias pattern for this query
 *  +50   starts with "market for" (representative average supply)
 *  +20   contains the query as a word-boundary match
 *  +10   contains all query words
 *  -20   contains "treatment of waste" or "treatment of used" (end-of-life)
 *  -15   chemical/oxide/fluoride/chloride (niche industrial chemicals)
 *  -10   very long process name (>120 chars, overly specific)
 */
function scoreRelevance(
  process: any,
  queryLower: string,
  queryWords: string[],
  aliasPatterns: string[]
): number {
  const nameLower = (process.name || '').toLowerCase();
  let score = 0;

  // Alias pattern match — strongest boost
  if (aliasPatterns.length > 0) {
    const matchesAlias = aliasPatterns.some(pattern =>
      nameLower.includes(pattern.toLowerCase())
    );
    if (matchesAlias) {
      score += 100;
    }
  }

  // "market for" processes represent average supply — preferred for LCA
  if (nameLower.startsWith('market for')) {
    score += 50;
  }

  // Exact query appears as a word boundary in the name
  // e.g. "barley" in "barley grain production" but not "barely"
  const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(queryLower)}\\b`);
  if (wordBoundaryRegex.test(nameLower)) {
    score += 20;
  }

  // All query words appear in name
  const allWordsMatch = queryWords.every(word => nameLower.includes(word));
  if (allWordsMatch) {
    score += 10;
  }

  // Penalise end-of-life / waste treatment processes
  if (nameLower.includes('treatment of waste') || nameLower.includes('treatment of used')) {
    score -= 20;
  }

  // Penalise industrial chemicals that are rarely what drinks users want
  const chemicalIndicators = ['oxide', 'fluoride', 'chloride', 'hydroxide', 'sulfate', 'sulphate', 'nitrate', 'carbonate'];
  if (chemicalIndicators.some(chem => nameLower.includes(chem))) {
    score -= 15;
  }

  // Boost processes with packaging/beverage context
  const packagingIndicators = ['packaging', 'beverage', 'bottle', 'wrought', 'sheet rolling', 'deep drawing'];
  if (packagingIndicators.some(pkg => nameLower.includes(pkg))) {
    score += 15;
  }

  // Penalise very long names (overly specific sub-processes)
  if (nameLower.length > 120) {
    score -= 10;
  }

  return score;
}

/**
 * Search drinks-filtered processes with alias boosting.
 *
 * @param query - User search query
 * @param filteredProcesses - Pre-filtered drinks-relevant processes
 * @returns Scored and sorted processes (highest relevance first)
 */
export function searchWithAliases(query: string, filteredProcesses: any[]): any[] {
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);

  if (queryWords.length === 0) {
    return [];
  }

  // Find alias patterns for this query
  const matchingAliases = findMatchingAliases(queryLower);
  const aliasPatterns = matchingAliases.flatMap(alias => alias.processPatterns);

  // Score all processes that match the query
  const scored: ScoredProcess[] = [];

  for (const process of filteredProcesses) {
    const nameLower = (process.name || '').toLowerCase();

    // Must match at least one query word OR an alias pattern
    const matchesQuery = queryWords.some(word => nameLower.includes(word));
    const matchesAlias = aliasPatterns.some(pattern =>
      nameLower.includes(pattern.toLowerCase())
    );

    if (!matchesQuery && !matchesAlias) {
      continue;
    }

    const score = scoreRelevance(process, queryLower, queryWords, aliasPatterns);
    scored.push({ process, score });
  }

  // Sort by score descending, then alphabetically for ties
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const nameA = a.process.name || '';
    const nameB = b.process.name || '';
    return nameA.localeCompare(nameB);
  });

  return scored.map(s => s.process);
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
