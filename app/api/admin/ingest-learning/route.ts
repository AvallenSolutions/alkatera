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
  misclassified: number;
  misclassification_rate: number;
  dismissed: number;
}

export async function GET() {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  try {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const [feedbackRes, profilesRes, recentRes, misclassifiedRes] = await Promise.all([
      service
        .from('ingest_feedback')
        .select('result_type, corrected_result_type, misclassified, field_diff, context')
        .gte('created_at', since.toISOString())
        .limit(5000),
      service
        .from('ingest_document_profiles')
        .select('supplier_key, result_type, times_seen, hints, last_seen_at, match_kind, organization_id, organizations(name)')
        .order('times_seen', { ascending: false })
        .limit(20),
      service
        .from('ingest_feedback')
        .select(
          'id, created_at, result_type, corrected_result_type, misclassified, supplier_key, field_diff, context, organization_id, organizations(name)',
        )
        .order('created_at', { ascending: false })
        .limit(50),
      service
        .from('ingest_feedback')
        .select(
          'id, created_at, job_id, result_type, corrected_result_type, organization_id, organizations(name), ingest_jobs(file_name, stash_path)',
        )
        .eq('misclassified', true)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const perTypeMap = new Map<
      string,
      { total: number; edited: number; misclassified: number; dismissed: number }
    >();
    for (const row of feedbackRes.data ?? []) {
      const stat =
        perTypeMap.get(row.result_type) ?? { total: 0, edited: 0, misclassified: 0, dismissed: 0 };
      stat.total += 1;
      const diff = row.field_diff as { edited?: number; added?: number; removed?: number } | null;
      const changes = (diff?.edited ?? 0) + (diff?.added ?? 0) + (diff?.removed ?? 0);
      if (changes > 0) stat.edited += 1;
      if ((row as any).misclassified) stat.misclassified += 1;
      if ((row.context as any)?.dismissed === true) stat.dismissed += 1;
      perTypeMap.set(row.result_type, stat);
    }
    const perType: PerTypeStat[] = Array.from(perTypeMap.entries())
      .map(([result_type, s]) => ({
        result_type,
        total: s.total,
        edited: s.edited,
        edit_rate: s.total > 0 ? Math.round((s.edited / s.total) * 100) : 0,
        misclassified: s.misclassified,
        misclassification_rate: s.total > 0 ? Math.round((s.misclassified / s.total) * 100) : 0,
        dismissed: s.dismissed,
      }))
      .sort((a, b) => b.total - a.total);

    // Confusion pairs: classifier said X, users corrected to Y (90d window).
    const confusionMap = new Map<string, number>();
    for (const row of feedbackRes.data ?? []) {
      if (!(row as any).misclassified || !row.corrected_result_type) continue;
      const key = `${row.result_type}→${row.corrected_result_type}`;
      confusionMap.set(key, (confusionMap.get(key) ?? 0) + 1);
    }
    const confusionPairs = Array.from(confusionMap.entries())
      .map(([pair, count]) => {
        const [from, to] = pair.split('→');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      confusionPairs,
      misclassifications: (misclassifiedRes.data ?? []).map((f: any) => ({
        id: f.id,
        created_at: f.created_at,
        job_id: f.job_id,
        result_type: f.result_type,
        corrected_result_type: f.corrected_result_type,
        file_name: f.ingest_jobs?.file_name ?? null,
        has_stash: !!f.ingest_jobs?.stash_path,
        organization_name: f.organizations?.name ?? null,
      })),
      perType,
      topSuppliers: (profilesRes.data ?? []).map((p: any) => ({
        supplier_key: p.supplier_key,
        result_type: p.result_type,
        times_seen: p.times_seen,
        hints: p.hints,
        last_seen_at: p.last_seen_at,
        match_kind: p.match_kind ?? 'supplier',
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
