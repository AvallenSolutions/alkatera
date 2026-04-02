import { NextRequest, NextResponse } from 'next/server';
import { filterDrinksRelevantProcesses, searchWithAliases, filterAgribalyseProcesses, searchAgribalyseWithAliases } from '@/lib/openlca/drinks-process-filter';
import { createOpenLCAClientForDatabase, isAgribalyseConfigured } from '@/lib/openlca/client';
import { INGREDIENT_ALIASES, PACKAGING_ALIASES } from '@/lib/openlca/drinks-aliases';

export const dynamic = 'force-dynamic';

interface SearchResult {
  id: string;
  name: string;
  friendly_name?: string;
  category: string;
  unit?: string;
  processType?: string;
  location?: string;
  co2_factor?: number;
  water_factor?: number;
  land_factor?: number;
  waste_factor?: number;
  source: string;
  source_type: 'primary' | 'staging' | 'global_library' | 'ecoinvent_proxy' | 'ecoinvent_live' | 'agribalyse_live' | 'defra';
  data_quality?: 'verified' | 'calculated' | 'estimated';
  data_quality_grade?: 'HIGH' | 'MEDIUM' | 'LOW';
  uncertainty_percent?: number;
  source_citation?: string;
  metadata?: Record<string, any>;
  // Supplier product packaging data (passed through to form cards)
  supplier_product_type?: 'ingredient' | 'packaging';
  supplier_weight_g?: number | null;
  supplier_packaging_category?: string | null;
  supplier_primary_material?: string | null;
  supplier_epr_material_code?: string | null;
  supplier_epr_is_drinks_container?: boolean | null;
  recycled_content_pct?: number | null;
  packaging_components?: any;
}

// Cache the ecoinvent process list in memory to avoid fetching 23k+ processes on every search
let cachedProcesses: any[] | null = null;
let cachedFilteredProcesses: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Separate cache for Agribalyse processes (different server)
let cachedAgribalyseProcesses: any[] | null = null;
let cachedAgribalyseFilteredProcesses: any[] | null = null;
let agribalyseCacheTimestamp: number = 0;

async function getOpenLCAProcesses(): Promise<any[]> {
  // Return cached processes if still valid
  if (cachedProcesses && Date.now() - cacheTimestamp < CACHE_DURATION_MS) {
    return cachedProcesses;
  }

  const client = createOpenLCAClientForDatabase('ecoinvent');
  if (!client || process.env.OPENLCA_SERVER_ENABLED !== 'true') {
    return [];
  }

  try {
    const processes = await client.getAllProcesses();
    cachedProcesses = Array.isArray(processes) ? processes : [];
    cachedFilteredProcesses = filterDrinksRelevantProcesses(cachedProcesses);
    cacheTimestamp = Date.now();
    return cachedProcesses;
  } catch (error) {
    console.error('Error fetching ecoinvent OpenLCA processes:', error);
    return [];
  }
}

async function getAgribalyseProcesses(): Promise<any[]> {
  // Return cached processes if still valid
  if (cachedAgribalyseProcesses && Date.now() - agribalyseCacheTimestamp < CACHE_DURATION_MS) {
    return cachedAgribalyseProcesses;
  }

  if (!isAgribalyseConfigured()) {
    return [];
  }

  const client = createOpenLCAClientForDatabase('agribalyse');
  if (!client) {
    return [];
  }

  try {
    const processes = await client.getAllProcesses();
    cachedAgribalyseProcesses = Array.isArray(processes) ? processes : [];
    cachedAgribalyseFilteredProcesses = filterAgribalyseProcesses(cachedAgribalyseProcesses);
    agribalyseCacheTimestamp = Date.now();
    return cachedAgribalyseProcesses;
  } catch (error) {
    console.error('Error fetching Agribalyse OpenLCA processes:', error);
    return [];
  }
}

async function searchOpenLCAProcesses(query: string): Promise<SearchResult[]> {
  // Ensure processes are loaded and filtered
  await getOpenLCAProcesses();

  if (!cachedFilteredProcesses || cachedFilteredProcesses.length === 0) {
    return [];
  }

  // Use alias-boosted search against the drinks-filtered process list
  const rankedProcesses = searchWithAliases(query, cachedFilteredProcesses);

  return rankedProcesses.slice(0, 30).map((process: any) => {
    // Extract geography from process name or location
    const location = process.location || '';
    const name = process.name || 'Unnamed Process';

    // Determine system model from name
    let systemModel = 'unknown';
    if (name.includes('Cutoff')) systemModel = 'Cutoff';
    else if (name.includes('APOS')) systemModel = 'APOS';
    else if (name.includes('Consequential')) systemModel = 'Consequential';

    return {
      id: process['@id'] || process.id,
      name: name,
      category: process.category || 'Uncategorized',
      unit: 'kg',
      processType: process.processType || 'LCI_RESULT',
      location: location,
      source: `ecoInvent 3.12 (${systemModel})`,
      source_type: 'ecoinvent_live' as const,
      data_quality: 'calculated' as const,
      metadata: {
        openlca_id: process['@id'],
        system_model: systemModel,
        flow_type: process.flowType,
      },
    };
  });
}

async function searchAgribalyseOpenLCAProcesses(query: string): Promise<SearchResult[]> {
  // Ensure Agribalyse processes are loaded and filtered
  await getAgribalyseProcesses();

  if (!cachedAgribalyseFilteredProcesses || cachedAgribalyseFilteredProcesses.length === 0) {
    return [];
  }

  // Use Agribalyse-specific alias-boosted search (includes French name support)
  const rankedProcesses = searchAgribalyseWithAliases(query, cachedAgribalyseFilteredProcesses);

  return rankedProcesses.slice(0, 20).map((process: any) => {
    const location = process.location || '';
    const name = process.name || 'Unnamed Process';

    return {
      id: process['@id'] || process.id,
      name: name,
      category: process.category || 'Uncategorized',
      unit: 'kg',
      processType: process.processType || 'LCI_RESULT',
      location: location,
      source: 'Agribalyse 3.2',
      source_type: 'agribalyse_live' as const,
      data_quality: 'calculated' as const,
      metadata: {
        openlca_id: process['@id'],
        database: 'agribalyse',
        flow_type: process.flowType,
      },
    };
  });
}

/**
 * Compute a 0-100 relevance score for a search result name against a query.
 * Used to rank results by name similarity rather than just source type.
 *
 * Scoring tiers:
 *  100 = exact match
 *   95 = reversed ingredient name (e.g. "Syrup, Maple" for "maple syrup")
 *   90 = result starts with query
 *   80 = query fully contained in result AND result is an ingredient
 *   70 = all query words present in result
 *   60 = reverse word coverage ≥50%
 *   55 = ≥75% of query words present
 *   40 = ≥50% of query words present
 *   25 = any single query word present
 *   10 = weak/alias-only match
 *
 * Sub-process penalty: results starting with non-ingredient terms like
 * "Heat,", "Transport,", "Metal working" etc. get a -50 penalty.
 */
function computeSearchRelevance(resultName: string, query: string): number {
  const r = resultName.toLowerCase();
  const q = query.toLowerCase();

  // Extract the "primary name" portion before any pipe or brace
  // e.g. "Syrup, Maple {CA-QC}| production..." → "syrup, maple"
  const rPrimary = r.split('|')[0].split('{')[0].trim();

  // ── Sub-process detection ──────────────────────────────────────────
  // Agribalyse/ecoinvent include many intermediate processes (heat,
  // transport, thermoforming, etc.) that are "adapted for [ingredient]".
  // These should always rank below the actual ingredient process.
  const SUB_PROCESS_PREFIXES = [
    'heat,', 'heat production', 'heat, central', 'heat, district',
    'transport,', 'transport ', 'lorry,', 'dry van',
    'thermoforming', 'calendering',
    'metal working', 'chromium steel', 'steel product',
    'electricity,', 'electricity production', 'electricity mix', 'electricity from',
    'packaging,', 'filling,',
    'treatment of', 'waste treatment',
    'water, deionised', 'water, decarbonised', 'water, ultrapure',
    'extrusion,', 'injection moulding', 'blow moulding',
    'corrugated board', 'kraft paper',
    'tap water', 'market for tap water',
    'diesel,', 'petrol,', 'natural gas,',
  ];
  const isSubProcess = SUB_PROCESS_PREFIXES.some(prefix => r.startsWith(prefix));
  const isAdaptedFor = r.includes('adapted for') || r.includes('- adapted');
  const subProcessPenalty = (isSubProcess || isAdaptedFor) ? 50 : 0;

  // Exact match
  if (r === q || rPrimary === q) return 100 - subProcessPenalty;

  // Check for reversed ingredient name: "maple syrup" → "Syrup, Maple"
  const qWords = q.split(/\s+/).filter(w => w.length >= 2);
  if (qWords.length >= 2) {
    const reversed = [...qWords].reverse().join(', ');
    if (rPrimary === reversed || rPrimary.startsWith(reversed)) {
      return 95 - subProcessPenalty;
    }
  }

  // Result name starts with the query
  if (r.startsWith(q + ' ') || r.startsWith(q + ',') || r.startsWith(q + '/')) return 90 - subProcessPenalty;
  if (r.startsWith(q)) return 90 - subProcessPenalty;
  if (rPrimary.startsWith(q)) return 90 - subProcessPenalty;

  // Query fully contained in result name
  if (r.includes(q)) return 80 - subProcessPenalty;

  // Result primary name fully contained in query
  if (q.includes(rPrimary) && rPrimary.length > 3) return 75 - subProcessPenalty;

  // Word-level analysis
  const rTokens = r.split(/[\s,/()]+/).filter(w => w.length >= 3);

  if (qWords.length === 0) return 10 - subProcessPenalty;

  // Count how many query words appear in the result name
  const matchedQueryWords = qWords.filter(w => r.includes(w));
  const queryWordCoverage = matchedQueryWords.length / qWords.length;

  if (queryWordCoverage === 1.0) return 70 - subProcessPenalty;

  // Check reverse: result words in query (catches "Syrup, Maple" vs "maple syrup")
  if (rTokens.length > 0) {
    const reverseMatched = rTokens.filter(w => q.includes(w));
    const reverseCoverage = reverseMatched.length / rTokens.length;
    if (reverseCoverage >= 0.5) return 60 - subProcessPenalty;
  }

  if (queryWordCoverage >= 0.75) return 55 - subProcessPenalty;
  if (queryWordCoverage >= 0.5) return 40 - subProcessPenalty;
  if (queryWordCoverage > 0) return 25 - subProcessPenalty;

  return 10 - subProcessPenalty;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const organizationId = searchParams.get('organization_id');

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query parameter "q" is required' },
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const normalizedQuery = query.trim().toLowerCase();

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Collect results from ALL sources in parallel
    const allResults: SearchResult[] = [];

    // Optional material_type filter: 'ingredient' or 'packaging'
    // When set, supplier products are filtered to only show matching product_type
    const materialType = searchParams.get('material_type'); // 'ingredient' | 'packaging' | null
    const packagingCategory = searchParams.get('packaging_category'); // 'container' | 'closure' | etc. | null

    // Run all searches in parallel for better performance
    const [
      supplierResults,
      stagingResults,
      ecoinventProxyResults,
      openLCAResults,
      agribalyseResults,
      boostResults,
    ] = await Promise.all([
      // SOURCE 1: Verified Supplier Products (Primary Data)
      organizationId ? (async () => {
        let supplierQuery = supabase
          .from('supplier_products')
          .select(`
            id, name, category, unit, carbon_intensity, product_code,
            verified_at, recycled_content_pct, impact_climate, impact_water, impact_land, impact_waste,
            product_type, weight_g, packaging_category, primary_material,
            epr_material_code, epr_is_drinks_container,
            suppliers!inner(name)
          `)
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .eq('is_verified', true)
          .ilike('name', `%${normalizedQuery}%`)
          .order('name')
          .limit(10);

        // Filter by product_type when materialType is specified
        if (materialType === 'ingredient' || materialType === 'packaging') {
          supplierQuery = supplierQuery.eq('product_type', materialType);
        }

        const { data: supplierProducts, error } = await supplierQuery;

        if (error || !supplierProducts) return [];

        // Load component breakdowns for packaging supplier products
        const packagingProductIds = supplierProducts
          .filter((p: any) => p.product_type === 'packaging')
          .map((p: any) => p.id);

        let componentsByProduct: Record<string, any[]> = {};
        if (packagingProductIds.length > 0) {
          const { data: components } = await supabase
            .from('supplier_product_components')
            .select('*')
            .in('supplier_product_id', packagingProductIds);

          for (const comp of (components || [])) {
            if (!componentsByProduct[comp.supplier_product_id]) {
              componentsByProduct[comp.supplier_product_id] = [];
            }
            componentsByProduct[comp.supplier_product_id].push({
              epr_material_type: comp.epr_material_type,
              component_name: comp.component_name,
              weight_grams: comp.weight_grams,
              recycled_content_percentage: comp.recycled_content_pct || 0,
              is_recyclable: comp.is_recyclable,
            });
          }
        }

        return supplierProducts.map((product: any): SearchResult => ({
          id: product.id,
          name: product.name,
          category: product.category || 'Supplier Product',
          unit: product.unit,
          processType: 'SUPPLIER_PRODUCT',
          location: product.suppliers?.name || 'Verified Supplier',
          co2_factor: product.carbon_intensity ?? product.impact_climate,
          water_factor: product.impact_water,
          land_factor: product.impact_land,
          waste_factor: product.impact_waste,
          source: 'Primary Verified',
          source_type: 'primary',
          data_quality: 'verified',
          // Supplier product packaging data (passed through to form cards)
          supplier_product_type: product.product_type || 'ingredient',
          supplier_weight_g: product.weight_g,
          supplier_packaging_category: product.packaging_category,
          supplier_primary_material: product.primary_material,
          supplier_epr_material_code: product.epr_material_code,
          supplier_epr_is_drinks_container: product.epr_is_drinks_container,
          recycled_content_pct: product.recycled_content_pct,
          packaging_components: componentsByProduct[product.id] || undefined,
          metadata: {
            supplier_name: product.suppliers?.name,
            product_code: product.product_code,
            verified_at: product.verified_at,
            recycled_content_pct: product.recycled_content_pct,
          },
        }));
      })() : Promise.resolve([]),

      // SOURCE 2: Staging Emission Factors (includes Global Drinks Factor Library)
      (async () => {
        let stagingFactors: any[] | null = null;
        let error: any = null;

        // Primary search: full phrase ILIKE match
        ({ data: stagingFactors, error } = await supabase
          .from('staging_emission_factors')
          .select('*')
          .ilike('name', `%${normalizedQuery}%`)
          .in('category', ['Ingredient', 'Packaging'])
          .order('name')
          .limit(15));

        // Fallback: if no results and query has multiple words, search by the
        // most distinctive (longest) word, then filter in-memory to require
        // multiple word matches. This catches "malic acid" → "Malic Acid
        // (DL-malic acid)" while preventing "maple syrup" from matching any
        // process that merely contains "syrup" (e.g. heat/syrup production).
        if ((!stagingFactors || stagingFactors.length === 0) && !error) {
          const words = normalizedQuery.split(/\s+/).filter((w: string) => w.length >= 3);
          if (words.length > 1) {
            // Use the longest word as the primary DB filter (most distinctive)
            const sortedByLength = [...words].sort((a, b) => b.length - a.length);
            const primaryWord = sortedByLength[0];

            ({ data: stagingFactors, error } = await supabase
              .from('staging_emission_factors')
              .select('*')
              .ilike('name', `%${primaryWord}%`)
              .in('category', ['Ingredient', 'Packaging'])
              .order('name')
              .limit(30));

            // In-memory AND filter: require at least 2 query words to appear
            // in the result name (or all words if only 2 words in query)
            if (stagingFactors && stagingFactors.length > 0) {
              const minWordsRequired = Math.min(words.length, 2);
              stagingFactors = stagingFactors.filter((factor: any) => {
                const nameLower = (factor.name as string).toLowerCase();
                const matchCount = words.filter(w => nameLower.includes(w)).length;
                return matchCount >= minWordsRequired;
              });
            }
          }
        }

        if (error || !stagingFactors) return [];

        return stagingFactors.map((factor: any): SearchResult => {
          // Distinguish global library factors (organization_id IS NULL + has data_quality_grade)
          const isGlobalLibrary = !factor.organization_id && factor.metadata?.data_quality_grade;
          const qualityGrade = factor.metadata?.data_quality_grade as 'HIGH' | 'MEDIUM' | 'LOW' | undefined;

          return {
            id: factor.id,
            name: factor.name,
            category: factor.category,
            unit: factor.reference_unit,
            processType: 'STAGING_FACTOR',
            location: isGlobalLibrary
              ? factor.geographic_scope || 'Global'
              : 'Internal Library',
            co2_factor: factor.co2_factor,
            water_factor: factor.water_factor,
            land_factor: factor.land_factor,
            waste_factor: factor.waste_factor,
            source: factor.source || 'Internal',
            source_type: isGlobalLibrary ? 'global_library' : 'staging',
            data_quality: qualityGrade === 'HIGH' ? 'verified'
              : qualityGrade === 'MEDIUM' ? 'calculated'
              : qualityGrade === 'LOW' ? 'estimated'
              : 'calculated',
            data_quality_grade: qualityGrade,
            uncertainty_percent: factor.uncertainty_percent,
            source_citation: factor.source,
            metadata: {
              ...factor.metadata,
              uncertainty_percent: factor.uncertainty_percent,
              geographic_scope: factor.geographic_scope,
              temporal_coverage: factor.temporal_coverage,
            },
          };
        });
      })(),

      // SOURCE 3: Ecoinvent Material Proxies (pre-calculated)
      (async () => {
        const { data: proxies, error } = await supabase
          .from('ecoinvent_material_proxies')
          .select('*')
          .or(`material_name.ilike.%${normalizedQuery}%,ecoinvent_process_name.ilike.%${normalizedQuery}%`)
          .order('material_name')
          .limit(10);

        if (error || !proxies) return [];

        return proxies.map((proxy: any): SearchResult => ({
          id: proxy.id,
          name: proxy.material_name,
          category: proxy.material_category,
          unit: proxy.reference_unit,
          processType: 'ECOINVENT_PROXY',
          location: proxy.geography || 'Global',
          co2_factor: proxy.impact_climate,
          water_factor: proxy.impact_water,
          land_factor: proxy.impact_land,
          waste_factor: proxy.impact_waste,
          source: `ecoInvent ${proxy.ecoinvent_version} (cached)`,
          source_type: 'ecoinvent_proxy',
          data_quality: 'calculated',
          metadata: {
            lcia_method: proxy.lcia_method,
            system_model: proxy.system_model,
            ecoinvent_process_name: proxy.ecoinvent_process_name,
            // Impact decomposition (populated when proxy resolved with contribution analysis)
            impact_climate_production: proxy.impact_climate_production,
            impact_climate_transport: proxy.impact_climate_transport,
            impact_climate_electricity: proxy.impact_climate_electricity,
            embedded_electricity_geography: proxy.embedded_electricity_geography,
          },
        }));
      })(),

      // SOURCE 4: Live OpenLCA Search (ecoinvent)
      searchOpenLCAProcesses(query),

      // SOURCE 5: Live Agribalyse Search (if configured)
      searchAgribalyseOpenLCAProcesses(query),

      // SOURCE 6: Favourites & popularity boost data
      (async () => {
        try {
          const { data } = await supabase.rpc('get_ef_search_boosts', {
            p_user_id: user.user.id,
            p_search_query: normalizedQuery,
            p_material_type: materialType || null,
            p_packaging_category: packagingCategory || null,
          });
          return data || [];
        } catch {
          return [];
        }
      })(),
    ]);

    // Combine all results
    allResults.push(...supplierResults);
    allResults.push(...stagingResults);
    allResults.push(...ecoinventProxyResults);
    allResults.push(...openLCAResults);
    allResults.push(...agribalyseResults);

    // Build boost map from favourites/popularity data
    const boostMap = new Map<string, { isUserFavourite: boolean; globalCount: number }>();
    for (const row of boostResults) {
      boostMap.set(row.selected_ef_id, {
        isUserFavourite: row.is_user_favourite,
        globalCount: Number(row.global_selection_count) || 0,
      });
    }

    // Score each result by name relevance to the query, then use source type
    // as a tiebreaker. This prevents irrelevant staging results (e.g. "Heat,
    // central...syrup production") from ranking above the correct Agribalyse
    // match (e.g. "Syrup, Maple") just because staging has a higher source priority.
    const sourceBoost: Record<string, number> = {
      'primary': 5,        // Verified supplier data gets a small boost
      'global_library': 3, // Curated drinks factor library
      'staging': 2,        // Internal/staging factors
      'ecoinvent_proxy': 1,
      'agribalyse_live': 1,
      'ecoinvent_live': 1,
      'defra': 0,
    };

    allResults.sort((a, b) => {
      const aBoostData = boostMap.get(a.id);
      const bBoostData = boostMap.get(b.id);

      // Tier 0: User favourites always first
      const aFav = aBoostData?.isUserFavourite ? 1 : 0;
      const bFav = bBoostData?.isUserFavourite ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      const aRelevance = computeSearchRelevance(a.name, normalizedQuery);
      const bRelevance = computeSearchRelevance(b.name, normalizedQuery);

      // Tier 1: Relevance score (higher is better)
      if (aRelevance !== bRelevance) return bRelevance - aRelevance;

      // Tier 2: Global popularity as tiebreaker within same relevance
      const aGlobal = aBoostData?.globalCount || 0;
      const bGlobal = bBoostData?.globalCount || 0;
      if (aGlobal !== bGlobal) return bGlobal - aGlobal;

      // Tier 3: Source type boost
      const aBoost = sourceBoost[a.source_type] ?? 0;
      const bBoost = sourceBoost[b.source_type] ?? 0;
      if (aBoost !== bBoost) return bBoost - aBoost;

      // Tier 4: Alphabetical
      return a.name.localeCompare(b.name);
    });

    // Add friendly names via reverse-lookup against drinks aliases.
    // When a technical ecoinvent name matches a known process pattern,
    // we provide a human-readable label (e.g. "Malted Barley" for
    // "malt production, from barley grain {GLO}| cut-off, U").
    const allAliases = [...INGREDIENT_ALIASES, ...PACKAGING_ALIASES];
    for (const result of allResults) {
      if (result.source_type === 'ecoinvent_live' || result.source_type === 'agribalyse_live' || result.source_type === 'ecoinvent_proxy') {
        const nameLower = result.name.toLowerCase();
        for (const alias of allAliases) {
          const matched = alias.processPatterns.some(pattern => nameLower.includes(pattern));
          if (matched) {
            // Title-case the first search term as the friendly name
            const term = alias.searchTerms[0];
            result.friendly_name = term.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            break;
          }
        }
      }
    }

    // Separate global library from org-specific staging counts
    const globalLibraryCount = stagingResults.filter(r => r.source_type === 'global_library').length;
    const orgStagingCount = stagingResults.filter(r => r.source_type === 'staging').length;

    // Log search misses for data strategy intelligence (fire-and-forget)
    if (allResults.length === 0) {
      void supabase.rpc('log_emission_factor_request', {
        p_search_query: query,
        p_material_name: query,
        p_material_type: null,
        p_context: 'search_miss',
        p_organization_id: organizationId || null,
        p_requested_by: user?.user?.id || null,
        p_source_page: '/ingredients/search',
        p_product_id: null,
        p_metadata: {
          sources_checked: {
            supplier: supplierResults.length,
            staging: stagingResults.length,
            ecoinvent_proxy: ecoinventProxyResults.length,
            ecoinvent_live: openLCAResults.length,
            agribalyse_live: agribalyseResults.length,
          },
        },
      }); // Fire-and-forget
    }

    return NextResponse.json({
      results: allResults.slice(0, 50).map(r => {
        const bd = boostMap.get(r.id);
        return {
          ...r,
          is_user_favourite: bd?.isUserFavourite || false,
          global_selection_count: bd?.globalCount || 0,
        };
      }),
      total_found: allResults.length,
      sources: {
        primary: supplierResults.length,
        staging: orgStagingCount,
        global_library: globalLibraryCount,
        ecoinvent_proxy: ecoinventProxyResults.length,
        ecoinvent_live: openLCAResults.length,
        agribalyse_live: agribalyseResults.length,
      },
      openlca_enabled: process.env.OPENLCA_SERVER_ENABLED === 'true',
      agribalyse_enabled: isAgribalyseConfigured(),
    });

  } catch (error) {
    console.error('Error in ingredient search API:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
