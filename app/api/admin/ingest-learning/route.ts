import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ingest-learning
 *
 * Admin visibility for the Smart Upload learning loop: per-type volumes and
 * edit rates (is the classifier getting better?), the most-seen supplier
 * document profiles, and the most recent confirmations with their diffs.
 */

interface PerTypeStat {
  result_type: string;
  total: number;
  edited: number;
  edit_rate: number;
}

export async function GET() {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  try {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const [feedbackRes, profilesRes, recentRes] = await Promise.all([
      service
        .from('ingest_feedback')
        .select('result_type, field_diff')
        .gte('created_at', since.toISOString())
        .limit(5000),
      service
        .from('ingest_document_profiles')
        .select('supplier_key, result_type, times_seen, hints, last_seen_at, organization_id, organizations(name)')
        .order('times_seen', { ascending: false })
        .limit(20),
      service
        .from('ingest_feedback')
        .select(
          'id, created_at, result_type, supplier_key, field_diff, context, organization_id, organizations(name)',
        )
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const perTypeMap = new Map<string, { total: number; edited: number }>();
    for (const row of feedbackRes.data ?? []) {
      const stat = perTypeMap.get(row.result_type) ?? { total: 0, edited: 0 };
      stat.total += 1;
      const diff = row.field_diff as { edited?: number; added?: number; removed?: number } | null;
      const changes = (diff?.edited ?? 0) + (diff?.added ?? 0) + (diff?.removed ?? 0);
      if (changes > 0) stat.edited += 1;
      perTypeMap.set(row.result_type, stat);
    }
    const perType: PerTypeStat[] = Array.from(perTypeMap.entries())
      .map(([result_type, s]) => ({
        result_type,
        total: s.total,
        edited: s.edited,
        edit_rate: s.total > 0 ? Math.round((s.edited / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      perType,
      topSuppliers: (profilesRes.data ?? []).map((p: any) => ({
        supplier_key: p.supplier_key,
        result_type: p.result_type,
        times_seen: p.times_seen,
        hints: p.hints,
        last_seen_at: p.last_seen_at,
        organization_name: p.organizations?.name ?? null,
      })),
      recent: (recentRes.data ?? []).map((f: any) => ({
        id: f.id,
        created_at: f.created_at,
        result_type: f.result_type,
        supplier_key: f.supplier_key,
        field_diff: f.field_diff,
        context: f.context,
        organization_name: f.organizations?.name ?? null,
      })),
    });
  } catch (err: any) {
    console.error('[admin/ingest-learning] Error:', err);
    return NextResponse.json({ error: 'Failed to load learning stats' }, { status: 500 });
  }
}
