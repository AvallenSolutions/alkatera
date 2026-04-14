import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Batch cache warming can take a while

interface WarmCacheRequest {
  organizationId: string;
  materials: Array<{
    processId: string;
    database?: 'ecoinvent' | 'agribalyse';
  }>;
}

/**
 * POST /api/openlca/warm-cache
 *
 * Pre-warms the OpenLCA impact cache for a batch of materials.
 * Fires all calculations in parallel (concurrency-limited) so that when
 * the user triggers a full LCA calculation, the results are already cached.
 *
 * This is a fire-and-forget endpoint: it returns immediately with the count
 * of materials queued, while calculations continue in the background.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: WarmCacheRequest = await request.json();
    const { organizationId, materials } = body;

    if (!organizationId || !materials?.length) {
      return NextResponse.json({ error: 'Missing organizationId or materials' }, { status: 400 });
    }

    // Check which materials are already cached (skip those)
    const uncachedMaterials: typeof materials = [];
    for (const mat of materials) {
      try {
        const { data: cached } = await supabase
          .from('openlca_impact_cache')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('process_id', mat.processId)
          .eq('source_database', mat.database || 'ecoinvent')
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (!cached) {
          uncachedMaterials.push(mat);
        }
      } catch {
        uncachedMaterials.push(mat);
      }
    }

    if (uncachedMaterials.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All materials already cached',
        queued: 0,
        alreadyCached: materials.length,
      });
    }

    // Fire calculations in parallel (concurrency limited to 3)
    // Each call to /api/openlca/calculate will cache its result
    const CONCURRENCY = 3;
    const baseUrl = request.nextUrl.origin;

    const fireCalculation = async (mat: typeof materials[0]) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min per item

        const response = await fetch(`${baseUrl}/api/openlca/calculate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            processId: mat.processId,
            quantity: 1, // Cache stores per-kg values
            organizationId,
            database: mat.database || 'ecoinvent',
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Response is streamed (keepalive newlines + JSON). Read full text and parse.
        const text = await response.text();
        const jsonStr = text.trim();
        if (jsonStr) {
          try {
            const result = JSON.parse(jsonStr);
            if (result.success) {
              return { processId: mat.processId, status: 'cached' as const };
            }
            return { processId: mat.processId, status: 'failed' as const, error: result.error || 'Unknown error' };
          } catch {
            return { processId: mat.processId, status: 'failed' as const, error: 'Failed to parse response' };
          }
        }
        return { processId: mat.processId, status: 'failed' as const, error: 'Empty response' };
      } catch (err: any) {
        return { processId: mat.processId, status: 'failed' as const, error: err.message };
      }
    };

    // Run with concurrency limit
    const results: Array<{ processId: string; status: 'cached' | 'failed'; error?: string }> = [];
    const executing = new Set<Promise<void>>();

    for (const mat of uncachedMaterials) {
      const p = (async () => {
        const result = await fireCalculation(mat);
        results.push(result);
      })();
      executing.add(p);
      const cleanup = () => { executing.delete(p); };
      p.then(cleanup, cleanup);
      if (executing.size >= CONCURRENCY) {
        await Promise.race(executing);
      }
    }
    await Promise.allSettled(Array.from(executing));

    const cached = results.filter(r => r.status === 'cached').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      queued: uncachedMaterials.length,
      alreadyCached: materials.length - uncachedMaterials.length,
      results: { cached, failed },
      failures: results.filter(r => r.status === 'failed'),
    });
  } catch (error) {
    console.error('[OpenLCA warm-cache] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Warm cache failed',
    }, { status: 500 });
  }
}
