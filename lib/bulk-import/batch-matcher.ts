import type {
  MaterialMatchState,
  MaterialMatchSelection,
  SearchResultForMatch,
} from './types';

// ── Query cleaning ───────────────────────────────────────────────────────

/**
 * Common modifiers/adjectives that don't help identify a material
 * in LCA databases. Stripped during search to improve match quality.
 * Covers both ingredient modifiers and packaging descriptors.
 */
const MATERIAL_MODIFIERS = new Set([
  // Ingredient quality/processing modifiers
  'granulated', 'refined', 'raw', 'organic', 'conventional',
  'natural', 'pure', 'food', 'grade', 'technical',
  'powdered', 'ground', 'crushed', 'whole', 'dried',
  'liquid', 'crystalline', 'anhydrous', 'hydrated',
  'deionised', 'deionized', 'distilled', 'filtered',
  'premium', 'standard', 'commercial',
  // Packaging descriptors (not the core material)
  'corrugated', 'fluted', 'recycled', 'virgin', 'coated',
  'laminated', 'printed', 'unprinted', 'clear', 'coloured',
  'colored', 'tinted', 'frosted', 'embossed', 'moulded',
  'molded', 'rigid', 'flexible', 'lightweight', 'heavy',
  'single', 'double', 'triple', 'wall', 'ply',
  'primary', 'secondary', 'tertiary', 'outer', 'inner',
]);

/**
 * Clean a raw ingredient name for search by stripping supplier codes,
 * percentages, volume info, parenthetical trade names, and common
 * non-meaningful modifiers.
 *
 * Examples:
 *  "Orange Blossom Extract FA-13523"    → "Orange Blossom Extract"
 *  "Vanilla Inf 48% Vol"               → "Vanilla"
 *  "Ethanol 96%"                       → "Ethanol"
 *  "Granulated Beet Sugar (Kent Foods)" → "Beet Sugar"
 *  "Barley Malt"                       → "Barley Malt" (no change)
 */
export function cleanSearchQuery(raw: string): string {
  let q = raw.trim();

  // Strip trailing parenthetical notes: "(Kent Foods)", "(Lambda)"
  q = q.replace(/\s*\([^)]*\)\s*$/, '');

  // Strip supplier/product codes: FA-13523, SKU-001, REF 12345
  q = q.replace(/\b[A-Z]{1,4}[-\s]?\d{3,}\b/gi, '');

  // Strip percentage/volume info: 48% Vol, 96%, 5.5% abv, 40% v/v
  q = q.replace(/\d+(\.\d+)?\s*%\s*(v\/v|vol|abv|alc\.?)?/gi, '');

  // Strip size/unit info: 75cl, 330ml, 500ml, 1L, 1.5L, 20L, etc.
  q = q.replace(/\b\d+(\.\d+)?\s*(cl|ml|l|litre|liter|oz|fl\.?\s*oz|gal|gallon|pt|pint)\b/gi, '');

  // Strip standalone "Inf" / "Infusion" (often precedes percentages)
  q = q.replace(/\b(?:inf|infusion)\b/gi, '');

  // Strip common non-meaningful modifiers (only if other words remain)
  const words = q.split(/\s+/).filter(w => w.length > 0);
  const coreWords = words.filter(w => !MATERIAL_MODIFIERS.has(w.toLowerCase()));
  if (coreWords.length >= 1) {
    q = coreWords.join(' ');
  }

  // Collapse multiple spaces and trim
  q = q.replace(/\s{2,}/g, ' ').trim();

  // If cleaning removed everything, fall back to the original
  if (q.length < 2) return raw.trim();

  return q;
}

// ── String similarity ────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
}

/**
 * Generate character trigrams from a string.
 * E.g. "malic acid" → ["mal", "ali", "lic", "ic ", "c a", " ac", "aci", "cid"]
 */
function trigrams(s: string): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i <= s.length - 3; i++) {
    grams.add(s.substring(i, i + 3));
  }
  return grams;
}

/**
 * Compute trigram overlap ratio between two strings.
 * Returns 0-1 (1 = perfect overlap).
 */
function trigramOverlap(a: string, b: string): number {
  const aGrams = trigrams(a);
  const bGrams = trigrams(b);
  if (aGrams.size === 0 || bGrams.size === 0) return 0;

  let shared = 0;
  aGrams.forEach(g => { if (bGrams.has(g)) shared++; });

  return shared / Math.min(aGrams.size, bGrams.size);
}

/** Minimum auto-match confidence — below this, mark as no_match */
export const MIN_AUTO_MATCH_CONFIDENCE = 0.4;

/**
 * Confidence score based on string similarity between query and result.
 *
 * Returns 0.0–1.0 where:
 *  - 1.0 = exact match
 *  - 0.8 = substring containment
 *  - 0.7 = all result core words found in query (e.g. "sugar beet" in "granulated beet sugar")
 *  - 0.6 = first word match
 *  - 0.5 = significant word overlap (≥50% of query words found in result)
 *  - 0.45 = moderate word overlap (≥33% of query words, or result words found in query)
 *  - 0.15 = fallback (very weak / no meaningful match)
 *
 * Uses trigram analysis to catch false positives like "malic" ≠ "maize".
 */
export function computeConfidence(query: string, resultName: string): number {
  const q = normalise(query);
  const r = normalise(resultName);

  // Exact match
  if (q === r) return 1.0;

  // One contains the other
  if (r.includes(q) || q.includes(r)) return 0.8;

  const qWords = q.split(' ').filter(w => w.length > 2);
  const rWords = r.split(' ').filter(w => w.length > 2);
  const qWordSet = new Set(qWords);
  const rWordSet = new Set(rWords);

  // Check if ALL significant result words appear in the query
  // E.g. result "sugar beet" → words ["sugar", "beet"] both in query "granulated beet sugar"
  // This is a strong signal even if the query has extra words
  if (rWords.length > 0) {
    const resultWordsInQuery = rWords.filter(w => qWordSet.has(w)).length;
    if (resultWordsInQuery === rWords.length) return 0.7;
  }

  // First word matches (must be 3+ chars)
  const qFirst = qWords[0] || '';
  const rFirst = rWords[0] || '';
  if (qFirst.length >= 3 && qFirst === rFirst) return 0.6;

  // Forward overlap — query words found in result (≥50%)
  const forwardOverlap = qWords.length > 0
    ? qWords.filter(w => rWordSet.has(w)).length / qWords.length
    : 0;
  if (forwardOverlap >= 0.5) return 0.5;

  // Reverse overlap — result words found in query (≥50%)
  // Catches "beet sugar" (query has 3 words, result has 2, both in query)
  const reverseOverlap = rWords.length > 0
    ? rWords.filter(w => qWordSet.has(w)).length / rWords.length
    : 0;
  if (reverseOverlap >= 0.5) return 0.45;

  // Any meaningful word overlap — but distinguish core material words from fillers
  // Words like "for", "at", "the", "and", "market" are common in process names
  // but don't indicate a real match. A core word overlap (e.g. "glass", "aluminium") is stronger.
  if (forwardOverlap > 0 || reverseOverlap > 0) {
    const fillers = new Set(['for', 'at', 'the', 'and', 'market', 'production', 'processing', 'plant', 'white', 'black', 'global', 'average']);
    const coreOverlapping = qWords.filter(w => rWordSet.has(w) && !fillers.has(w));
    if (coreOverlapping.length > 0) return 0.42;
    return 0.35;
  }

  // Trigram analysis — catch near-misses vs false positives
  // E.g. "malic" vs "maize" have low trigram overlap despite similar first letters
  const tOverlap = trigramOverlap(q, r);
  if (tOverlap >= 0.5) return 0.3;
  if (tOverlap >= 0.3) return 0.2;

  // Very weak or no meaningful match
  return 0.15;
}

// ── Source type mapping ──────────────────────────────────────────────────

/**
 * Map a search result's source_type to the DB-compatible data_source fields.
 *
 * DB constraints:
 *  - valid_data_source: data_source IN ('openlca', 'supplier') OR data_source IS NULL
 *  - data_source_integrity: openlca → data_source_id NOT NULL; supplier → supplier_product_id NOT NULL
 */
export function mapSearchResultToDBSource(
  result: SearchResultForMatch
): MaterialMatchSelection {
  if (result.source_type === 'primary') {
    return {
      data_source: 'supplier',
      data_source_id: null,
      supplier_product_id: result.id,
    };
  }

  // All other source types → openlca
  return {
    data_source: 'openlca',
    data_source_id: result.id,
    supplier_product_id: null,
  };
}

// ── Batch matcher ────────────────────────────────────────────────────────

interface BatchMatchOptions {
  organizationId: string;
  authToken: string;
  concurrency?: number;
  onProgress?: (completed: number, total: number, states: Record<string, MaterialMatchState>) => void;
}

/**
 * Batch-match a list of material names against the ingredient search API.
 *
 * De-duplicates names, runs searches with concurrency control, and returns
 * a map of normalised name → MaterialMatchState.
 */
export async function batchMatchMaterials(
  materials: Array<{ name: string; type: 'ingredient' | 'packaging' }>,
  options: BatchMatchOptions
): Promise<Record<string, MaterialMatchState>> {
  const { organizationId, authToken, concurrency = 4, onProgress } = options;

  // De-duplicate by normalised name
  const uniqueMap = new Map<string, { name: string; type: 'ingredient' | 'packaging' }>();
  for (const mat of materials) {
    const key = normalise(mat.name);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, mat);
    }
  }

  const uniqueItems = Array.from(uniqueMap.values());
  const states: Record<string, MaterialMatchState> = {};

  // Initialise all states as pending
  for (const item of uniqueItems) {
    const key = normalise(item.name);
    states[key] = {
      materialName: item.name,
      materialType: item.type,
      status: 'pending',
      searchResults: [],
      selectedIndex: null,
      autoMatchConfidence: null,
      userReviewed: false,
    };
  }

  let completed = 0;

  // Process with concurrency limit
  const queue = [...uniqueItems];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () =>
    processQueue()
  );

  async function processQueue() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const key = normalise(item.name);
      states[key].status = 'searching';

      try {
        const results = await searchMaterial(item.name, organizationId, authToken);

        if (results.length > 0) {
          const confidence = computeConfidence(item.name, results[0].name);

          if (confidence >= MIN_AUTO_MATCH_CONFIDENCE) {
            // Good enough to auto-select
            states[key] = {
              ...states[key],
              status: 'matched',
              searchResults: results.slice(0, 10),
              selectedIndex: 0,
              autoMatchConfidence: confidence,
            };
          } else {
            // Results exist but confidence too low — show as unlinked
            // with search results available for manual review
            states[key] = {
              ...states[key],
              status: 'no_match',
              searchResults: results.slice(0, 10),
              selectedIndex: null,
              autoMatchConfidence: confidence,
            };
          }
        } else {
          states[key] = {
            ...states[key],
            status: 'no_match',
            searchResults: [],
            selectedIndex: null,
            autoMatchConfidence: null,
          };
        }
      } catch (err) {
        console.error(`Search failed for "${item.name}":`, err);
        states[key] = {
          ...states[key],
          status: 'error',
          searchResults: [],
          selectedIndex: null,
          autoMatchConfidence: null,
        };
      }

      completed++;
      onProgress?.(completed, uniqueItems.length, { ...states });
    }
  }

  await Promise.all(workers);

  return states;
}

async function searchMaterial(
  name: string,
  organizationId: string,
  authToken: string
): Promise<SearchResultForMatch[]> {
  // Clean the name before searching — strip supplier codes, percentages, etc.
  const cleanedName = cleanSearchQuery(name);
  const url = `/api/ingredients/search?q=${encodeURIComponent(cleanedName)}&organization_id=${organizationId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Search returned ${response.status}`);
  }

  const data = await response.json();
  return (data.results || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    source_type: r.source_type,
    co2_factor: r.co2_factor,
    source: r.source,
  }));
}

// ── Helpers for getting selection from state ─────────────────────────────

/**
 * Look up the MaterialMatchSelection for a given material name.
 * Returns undefined if no match selected.
 */
export function getMatchSelection(
  materialName: string,
  matchStates: Record<string, MaterialMatchState>
): MaterialMatchSelection | undefined {
  const key = normalise(materialName);
  const state = matchStates[key];
  if (!state || state.selectedIndex == null || state.searchResults.length === 0) {
    return undefined;
  }

  const selected = state.searchResults[state.selectedIndex];
  if (!selected) return undefined;

  return mapSearchResultToDBSource(selected);
}
