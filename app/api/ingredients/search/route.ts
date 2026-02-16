import { NextRequest, NextResponse } from 'next/server';
import { filterDrinksRelevantProcesses, searchWithAliases, filterAgribalyseProcesses, searchAgribalyseWithAliases } from '@/lib/openlca/drinks-process-filter';
import { createOpenLCAClientForDatabase, isAgribalyseConfigured } from '@/lib/openlca/client';

export const dynamic = 'force-dynamic';

interface SearchResult {
  id: string;
  name: string;
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

    // Run all searches in parallel for better performance
    const [
      supplierResults,
      stagingResults,
      ecoinventProxyResults,
      openLCAResults,
      agribalyseResults,
    ] = await Promise.all([
      // SOURCE 1: Verified Supplier Products (Primary Data)
      organizationId ? (async () => {
        const { data: supplierProducts, error } = await supabase
          .from('supplier_products')
          .select(`
            id, name, category, unit, carbon_intensity, product_code,
            verified_at, recycled_content_pct, water_factor, land_factor, waste_factor,
            suppliers!inner(name)
          `)
          .eq('organization_id', organizationId)
          .eq('is_active', true)
          .eq('is_verified', true)
          .ilike('name', `%${normalizedQuery}%`)
          .order('name')
          .limit(10);

        if (error || !supplierProducts) return [];

        return supplierProducts.map((product: any): SearchResult => ({
          id: product.id,
          name: product.name,
          category: product.category || 'Supplier Product',
          unit: product.unit,
          processType: 'SUPPLIER_PRODUCT',
          location: product.suppliers?.name || 'Verified Supplier',
          co2_factor: product.carbon_intensity,
          water_factor: product.water_factor,
          land_factor: product.land_factor,
          waste_factor: product.waste_factor,
          source: 'Primary Verified',
          source_type: 'primary',
          data_quality: 'verified',
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

        // Fallback: if no results and query has multiple words, try word-by-word OR search
        // This catches cases like "malic acid" when DB has "Malic Acid (DL-malic acid)"
        if ((!stagingFactors || stagingFactors.length === 0) && !error) {
          const words = normalizedQuery.split(/\s+/).filter((w: string) => w.length >= 3);
          if (words.length > 1) {
            const orFilter = words.map((w: string) => `name.ilike.%${w}%`).join(',');
            ({ data: stagingFactors, error } = await supabase
              .from('staging_emission_factors')
              .select('*')
              .or(orFilter)
              .in('category', ['Ingredient', 'Packaging'])
              .order('name')
              .limit(15));
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
          },
        }));
      })(),

      // SOURCE 4: Live OpenLCA Search (ecoinvent)
      searchOpenLCAProcesses(query),

      // SOURCE 5: Live Agribalyse Search (if configured)
      searchAgribalyseOpenLCAProcesses(query),
    ]);

    // Combine all results
    allResults.push(...supplierResults);
    allResults.push(...stagingResults);
    allResults.push(...ecoinventProxyResults);
    allResults.push(...openLCAResults);
    allResults.push(...agribalyseResults);

    // Sort results: Primary first, then by relevance (exact matches first)
    const sortOrder: Record<string, number> = {
      'primary': 0,
      'staging': 1,
      'global_library': 2,
      'ecoinvent_proxy': 3,
      'agribalyse_live': 4,
      'ecoinvent_live': 5,
      'defra': 6,
    };

    allResults.sort((a, b) => {
      // First sort by source type priority
      const priorityDiff = sortOrder[a.source_type] - sortOrder[b.source_type];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by name match quality (exact match first)
      const aExact = a.name.toLowerCase().includes(normalizedQuery);
      const bExact = b.name.toLowerCase().includes(normalizedQuery);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Then alphabetically
      return a.name.localeCompare(b.name);
    });

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
        p_metadata: JSON.stringify({
          sources_checked: {
            supplier: supplierResults.length,
            staging: stagingResults.length,
            ecoinvent_proxy: ecoinventProxyResults.length,
            ecoinvent_live: openLCAResults.length,
            agribalyse_live: agribalyseResults.length,
          },
        }),
      }); // Fire-and-forget
    }

    return NextResponse.json({
      results: allResults.slice(0, 50), // Limit total results
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
