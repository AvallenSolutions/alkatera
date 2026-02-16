import type {
  MaterialMatchState,
  MaterialMatchSelection,
  SearchResultForMatch,
} from './types';

// ── String similarity ────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
}

/**
 * Simple confidence score based on string similarity between query and result.
 */
export function computeConfidence(query: string, resultName: string): number {
  const q = normalise(query);
  const r = normalise(resultName);

  // Exact match
  if (q === r) return 1.0;

  // One contains the other
  if (r.includes(q) || q.includes(r)) return 0.8;

  // First word matches
  const qFirst = q.split(' ')[0];
  const rFirst = r.split(' ')[0];
  if (qFirst.length >= 3 && qFirst === rFirst) return 0.6;

  // Partial overlap — check if most words in query appear in result
  const qWords = q.split(' ').filter(w => w.length > 2);
  const rWords = new Set(r.split(' '));
  const overlap = qWords.filter(w => rWords.has(w)).length;
  if (qWords.length > 0 && overlap / qWords.length >= 0.5) return 0.5;

  return 0.3;
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
          states[key] = {
            ...states[key],
            status: 'matched',
            searchResults: results.slice(0, 10),
            selectedIndex: 0,
            autoMatchConfidence: confidence,
          };
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
  const url = `/api/ingredients/search?q=${encodeURIComponent(name)}&organization_id=${organizationId}`;

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
