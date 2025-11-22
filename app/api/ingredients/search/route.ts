import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export const dynamic = 'force-dynamic';

interface OpenLCASearchResult {
  id: string;
  name: string;
  category: string;
  unit?: string;
  processType?: string;
  location?: string;
}

interface CachedResult {
  search_term: string;
  results: OpenLCASearchResult[];
  created_at: string;
}

interface JsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: Record<string, any>;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

const CACHE_TTL_HOURS = 24;
const OPENLCA_SERVER_URL = process.env.OPENLCA_SERVER_URL;
const OPENLCA_SERVER_ENABLED = process.env.OPENLCA_SERVER_ENABLED === 'true';

async function searchOpenLCAProcesses(query: string): Promise<OpenLCASearchResult[]> {
  if (!OPENLCA_SERVER_URL || !OPENLCA_SERVER_ENABLED) {
    console.warn('⚠️ OpenLCA server not configured. Set OPENLCA_SERVER_URL and OPENLCA_SERVER_ENABLED=true');
    console.warn('Returning mock data for development purposes.');

    return [
      {
        id: `mock-${query.toLowerCase()}-1`,
        name: `${query} - Organic Production`,
        category: 'Food/Agriculture',
        unit: 'kg',
        processType: 'UNIT_PROCESS',
        location: 'GB',
      },
      {
        id: `mock-${query.toLowerCase()}-2`,
        name: `${query} - Conventional Production`,
        category: 'Food/Agriculture',
        unit: 'kg',
        processType: 'UNIT_PROCESS',
        location: 'EU',
      },
      {
        id: `mock-${query.toLowerCase()}-3`,
        name: `${query} - Processing`,
        category: 'Food/Manufacturing',
        unit: 'kg',
        processType: 'UNIT_PROCESS',
        location: 'GB',
      },
    ];
  }

  const rpcRequest: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "search/processes",
    params: {
      query: query,
      pageSize: 20,
    }
  };

  try {
    const response = await fetch(`${OPENLCA_SERVER_URL}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcRequest),
    });

    if (!response.ok) {
      console.error('OpenLCA server error:', response.status, response.statusText);
      throw new Error(`OpenLCA server returned ${response.status}`);
    }

    const rpcResponse: JsonRpcResponse = await response.json();

    if (rpcResponse.error) {
      console.error('OpenLCA JSON-RPC error:', rpcResponse.error);
      throw new Error(`OpenLCA error: ${rpcResponse.error.message}`);
    }

    if (!rpcResponse.result) {
      return [];
    }

    const processes = Array.isArray(rpcResponse.result) ? rpcResponse.result : [];

    return processes.map((process: any) => ({
      id: process['@id'] || process.id,
      name: process.name || 'Unnamed Process',
      category: process.category || 'Uncategorized',
      unit: extractUnitFromProcess(process),
      processType: process.processType || 'UNIT_PROCESS',
      location: process.location?.code || process.location || '',
    })).slice(0, 50);

  } catch (error) {
    console.error('Error fetching from OpenLCA server:', error);
    throw error;
  }
}

function extractUnitFromProcess(process: any): string {
  if (process.referenceFlow?.unit?.name) {
    return process.referenceFlow.unit.name;
  }

  if (process.quantitativeReference?.unit?.name) {
    return process.quantitativeReference.unit.name;
  }

  if (process.exchanges && Array.isArray(process.exchanges)) {
    const refExchange = process.exchanges.find((ex: any) =>
      ex.isQuantitativeReference || ex.quantitativeReference
    );
    if (refExchange?.unit?.name) {
      return refExchange.unit.name;
    }
  }

  return 'kg';
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

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

    const { data: cacheResult } = await supabase
      .from('openlca_process_cache')
      .select('results, created_at')
      .eq('search_term', normalizedQuery)
      .gte('created_at', new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (cacheResult && cacheResult.results) {
      return NextResponse.json({
        results: cacheResult.results,
        cached: true,
        source: 'cache',
      });
    }

    const results = await searchOpenLCAProcesses(query);

    await supabase
      .from('openlca_process_cache')
      .insert({
        search_term: normalizedQuery,
        results: results,
      })
      .select();

    await supabase.rpc('cleanup_openlca_cache');

    return NextResponse.json({
      results: results,
      cached: false,
      source: OPENLCA_SERVER_ENABLED ? 'openlca_server' : 'mock_data',
      mock: !OPENLCA_SERVER_ENABLED,
      serverUrl: OPENLCA_SERVER_ENABLED ? OPENLCA_SERVER_URL : undefined,
    });

  } catch (error) {
    console.error('Error in OpenLCA search API:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isFetchError = errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED');

    if (isFetchError) {
      return NextResponse.json(
        {
          error: 'OpenLCA server unreachable. Check OPENLCA_SERVER_URL configuration.',
          details: errorMessage,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
