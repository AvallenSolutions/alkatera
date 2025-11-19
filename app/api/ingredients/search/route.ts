import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

interface OpenLCASearchResult {
  id: string;
  name: string;
  category: string;
  unit?: string;
}

interface CachedResult {
  search_term: string;
  results: OpenLCASearchResult[];
  created_at: string;
}

const CACHE_TTL_HOURS = 24;
const OPENLCA_API_ENDPOINT = process.env.OPENLCA_API_ENDPOINT || 'https://api.openlca.org/v1';
const OPENLCA_API_KEY = process.env.OPENLCA_API_KEY;

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
    const supabase = getSupabaseServerClient();

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cacheResult = await supabase
      .from('openlca_process_cache')
      .select('*')
      .eq('search_term', normalizedQuery)
      .gte('created_at', new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (cacheResult.data) {
      return NextResponse.json({
        results: cacheResult.data.results,
        cached: true,
      });
    }

    if (!OPENLCA_API_KEY) {
      console.warn('OpenLCA API key not configured, returning mock data');
      const mockResults: OpenLCASearchResult[] = [
        {
          id: `mock-${normalizedQuery}-1`,
          name: `${query} - Generic Process`,
          category: 'Materials/Agriculture',
          unit: 'kg',
        },
        {
          id: `mock-${normalizedQuery}-2`,
          name: `${query} - Production`,
          category: 'Materials/Manufacturing',
          unit: 'kg',
        },
      ];

      await supabase
        .from('openlca_process_cache')
        .insert({
          search_term: normalizedQuery,
          results: mockResults,
        })
        .select();

      return NextResponse.json({
        results: mockResults,
        cached: false,
        mock: true,
      });
    }

    const openLCAResponse = await fetch(
      `${OPENLCA_API_ENDPOINT}/processes/search?q=${encodeURIComponent(query)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${OPENLCA_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!openLCAResponse.ok) {
      console.error('OpenLCA API error:', openLCAResponse.status, openLCAResponse.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch from OpenLCA API' },
        { status: 502 }
      );
    }

    const openLCAData = await openLCAResponse.json();

    const sanitizedResults: OpenLCASearchResult[] = (openLCAData.data || []).map((item: any) => ({
      id: item.id || item['@id'],
      name: item.name,
      category: item.category || 'Uncategorized',
      unit: item.unit || item.referenceUnit || 'unit',
    })).slice(0, 50);

    await supabase
      .from('openlca_process_cache')
      .insert({
        search_term: normalizedQuery,
        results: sanitizedResults,
      })
      .select();

    await supabase.rpc('cleanup_openlca_cache');

    return NextResponse.json({
      results: sanitizedResults,
      cached: false,
    });

  } catch (error) {
    console.error('Error in OpenLCA search API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
