import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

/**
 * GET /api/admin/analytics/overview
 *
 * One-shot snapshot for the admin dashboard. Returns:
 *   - kpis: 8 headline numbers
 *   - growth: directory growth, last 12 weeks stacked by discovered_via
 *   - sources: current discovered_via breakdown
 *   - completeness: directory-wide distribution bucketed 0-25/25-50/50-75/75-100
 *   - sync_health: alkatera_sync_queue last 7 days stacked by status
 *   - top_contributors: top 10 distributor orgs by brands surfaced
 *   - top_viewed: top 10 brands by directory_brand_views in last 30d
 *   - failed_scraping: last 20 scraping_jobs with status='error'
 *   - stuck_sync_queue: alkatera_sync_queue rows failed or stuck running
 *
 * All queries run in parallel. Resilient — any single query failure
 * returns null for that block rather than breaking the whole response.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  const [
    kpis,
    growth,
    sources,
    completeness,
    syncHealth,
    topContributors,
    topViewed,
    failedScraping,
    stuckSyncQueue,
  ] = await Promise.all([
    buildKpis(service),
    buildGrowth(service),
    buildSources(service),
    buildCompleteness(service),
    buildSyncHealth(service),
    buildTopContributors(service),
    buildTopViewed(service),
    buildFailedScraping(service),
    buildStuckSyncQueue(service),
  ]);

  return NextResponse.json({
    kpis,
    growth,
    sources,
    completeness,
    sync_health: syncHealth,
    top_contributors: topContributors,
    top_viewed: topViewed,
    failed_scraping: failedScraping,
    stuck_sync_queue: stuckSyncQueue,
    generated_at: new Date().toISOString(),
  });
}

async function buildKpis(s: SupabaseClient) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const safeCount = async (
    fn: () => Promise<{ count: number | null }>,
  ): Promise<number> => {
    try {
      const { count } = await fn();
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  const [
    brandsTotal,
    brandsOnAlkatera,
    brandsAdded30d,
    productsTotal,
    productsWithLca,
    activeDistributors,
    contactsLast7d,
    searchesLast7d,
    syncQueuePending,
    syncQueueFailed,
  ] = await Promise.all([
    safeCount(() => s.from('brand_directory').select('id', { count: 'exact', head: true })),
    safeCount(() =>
      s
        .from('brand_directory')
        .select('id', { count: 'exact', head: true })
        .not('alkatera_org_id', 'is', null),
    ),
    safeCount(() =>
      s
        .from('brand_directory')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo),
    ),
    safeCount(() => s.from('product_directory').select('id', { count: 'exact', head: true })),
    safeCount(() =>
      s
        .from('product_directory')
        .select('id', { count: 'exact', head: true })
        .not('embodied_carbon_kgco2e', 'is', null),
    ),
    safeCount(async () => {
      // Distinct distributor_org_ids with any scraping_jobs activity in last 30d.
      const { data } = await s
        .from('scraping_jobs')
        .select('distributor_org_id')
        .gte('created_at', thirtyDaysAgo);
      const set = new Set(
        ((data ?? []) as Array<{ distributor_org_id: string }>).map((r) => r.distributor_org_id),
      );
      return { count: set.size };
    }),
    safeCount(() =>
      s
        .from('directory_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', sevenDaysAgo),
    ),
    safeCount(() =>
      s
        .from('directory_searches')
        .select('id', { count: 'exact', head: true })
        .gte('searched_at', sevenDaysAgo),
    ),
    safeCount(() =>
      s
        .from('alkatera_sync_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ),
    safeCount(() =>
      s
        .from('alkatera_sync_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed'),
    ),
  ]);

  return {
    brands_total: brandsTotal,
    brands_on_alkatera: brandsOnAlkatera,
    brands_added_30d: brandsAdded30d,
    products_total: productsTotal,
    products_with_lca: productsWithLca,
    active_distributors: activeDistributors,
    contacts_last_7d: contactsLast7d,
    searches_last_7d: searchesLast7d,
    sync_queue_pending: syncQueuePending,
    sync_queue_failed: syncQueueFailed,
  };
}

async function buildGrowth(s: SupabaseClient) {
  const weeksBack = 12;
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - weeksBack * 7);
  start.setUTCHours(0, 0, 0, 0);
  try {
    const { data } = await s
      .from('brand_directory')
      .select('created_at, discovered_via')
      .gte('created_at', start.toISOString());

    const buckets = new Map<string, Record<string, number>>();
    for (let i = 0; i < weeksBack; i += 1) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i * 7);
      buckets.set(weekKey(d), {});
    }
    for (const row of (data ?? []) as Array<{ created_at: string; discovered_via: string }>) {
      const key = weekKey(new Date(row.created_at));
      if (!buckets.has(key)) buckets.set(key, {});
      const bucket = buckets.get(key)!;
      bucket[row.discovered_via] = (bucket[row.discovered_via] ?? 0) + 1;
    }
    return Array.from(buckets.entries()).map(([week, counts]) => ({
      week_start: week,
      ...counts,
    }));
  } catch {
    return [];
  }
}

function weekKey(d: Date): string {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = copy.getUTCDay(); // 0 = Sun
  // Snap to the Monday of the week.
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy.toISOString().slice(0, 10);
}

async function buildSources(s: SupabaseClient) {
  try {
    const { data } = await s.from('brand_directory').select('discovered_via');
    const counts = new Map<string, number>();
    for (const r of (data ?? []) as Array<{ discovered_via: string }>) {
      counts.set(r.discovered_via, (counts.get(r.discovered_via) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([source, count]) => ({ source, count }));
  } catch {
    return [];
  }
}

async function buildCompleteness(s: SupabaseClient) {
  try {
    const { data } = await s
      .from('brand_directory')
      .select('completeness_score')
      .not('completeness_score', 'is', null);
    const buckets = {
      '0-25': 0,
      '25-50': 0,
      '50-75': 0,
      '75-100': 0,
    };
    for (const r of (data ?? []) as Array<{ completeness_score: number | null }>) {
      const v = Number(r.completeness_score ?? 0);
      if (v < 25) buckets['0-25'] += 1;
      else if (v < 50) buckets['25-50'] += 1;
      else if (v < 75) buckets['50-75'] += 1;
      else buckets['75-100'] += 1;
    }
    return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
  } catch {
    return [];
  }
}

async function buildSyncHealth(s: SupabaseClient) {
  try {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 7);
    start.setUTCHours(0, 0, 0, 0);
    const { data } = await s
      .from('alkatera_sync_queue')
      .select('created_at, status')
      .gte('created_at', start.toISOString());
    const buckets = new Map<string, Record<string, number>>();
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      buckets.set(d.toISOString().slice(0, 10), { done: 0, failed: 0, pending: 0, running: 0 });
    }
    for (const r of (data ?? []) as Array<{ created_at: string; status: string }>) {
      const key = r.created_at.slice(0, 10);
      if (!buckets.has(key)) buckets.set(key, { done: 0, failed: 0, pending: 0, running: 0 });
      const bucket = buckets.get(key)!;
      bucket[r.status] = (bucket[r.status] ?? 0) + 1;
    }
    return Array.from(buckets.entries()).map(([day, counts]) => ({ day, ...counts }));
  } catch {
    return [];
  }
}

async function buildTopContributors(s: SupabaseClient) {
  try {
    const { data } = await s
      .from('brand_directory')
      .select('discovered_by_distributor_org_id')
      .not('discovered_by_distributor_org_id', 'is', null);
    const counts = new Map<string, number>();
    for (const r of (data ?? []) as Array<{ discovered_by_distributor_org_id: string }>) {
      counts.set(
        r.discovered_by_distributor_org_id,
        (counts.get(r.discovered_by_distributor_org_id) ?? 0) + 1,
      );
    }
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    if (top.length === 0) return [];
    const { data: orgs } = await s
      .from('distributor_organizations')
      .select('id, name')
      .in('id', top.map(([id]) => id));
    const byId = new Map(((orgs ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]));
    return top.map(([id, count]) => ({
      distributor_org_id: id,
      name: byId.get(id) ?? '—',
      brands_added: count,
    }));
  } catch {
    return [];
  }
}

async function buildTopViewed(s: SupabaseClient) {
  try {
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await s
      .from('directory_brand_views')
      .select('brand_directory_id')
      .gte('viewed_at', start);
    const counts = new Map<string, number>();
    for (const r of (data ?? []) as Array<{ brand_directory_id: string }>) {
      counts.set(r.brand_directory_id, (counts.get(r.brand_directory_id) ?? 0) + 1);
    }
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    if (top.length === 0) return [];
    const { data: brands } = await s
      .from('brand_directory')
      .select('id, name, alkatera_org_id')
      .in('id', top.map(([id]) => id));
    const byId = new Map(
      ((brands ?? []) as Array<{ id: string; name: string; alkatera_org_id: string | null }>).map(
        (b) => [b.id, b],
      ),
    );
    return top.map(([id, count]) => ({
      brand_directory_id: id,
      name: byId.get(id)?.name ?? '—',
      on_alkatera: !!byId.get(id)?.alkatera_org_id,
      views: count,
    }));
  } catch {
    return [];
  }
}

async function buildFailedScraping(s: SupabaseClient) {
  try {
    const { data } = await s
      .from('scraping_jobs')
      .select('id, brand_profile_id, error_message, created_at')
      .eq('status', 'error')
      .order('created_at', { ascending: false })
      .limit(20);
    return data ?? [];
  } catch {
    return [];
  }
}

async function buildStuckSyncQueue(s: SupabaseClient) {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: failed } = await s
      .from('alkatera_sync_queue')
      .select('id, trigger_source, attempts, last_error, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(20);
    const { data: stuck } = await s
      .from('alkatera_sync_queue')
      .select('id, trigger_source, attempts, last_error, started_at')
      .eq('status', 'running')
      .lt('started_at', fiveMinutesAgo)
      .order('started_at', { ascending: false })
      .limit(20);
    return [...(failed ?? []), ...(stuck ?? [])];
  } catch {
    return [];
  }
}
