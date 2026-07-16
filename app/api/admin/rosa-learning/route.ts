import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/rosa-learning
 *
 * The curation queue for Rosa's self-learning flywheel (Pillar 4 step 2,
 * see tasks/data-revolution-plan.md). Returns open cases grouped by kind
 * (populated by the weekly sweep, lib/inngest/functions/rosa-learning.ts),
 * a short history of resolved/dismissed cases, and the exemplar library
 * (Pillar 4 step 3) for the admin CRUD panel.
 */

export async function GET() {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  try {
    const [openRes, historyRes, exemplarsRes] = await Promise.all([
      service
        .from('rosa_learning_cases')
        .select('id, kind, status, summary, evidence, organization_id, created_at, organizations(name)')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(200),
      service
        .from('rosa_learning_cases')
        .select('id, kind, status, summary, evidence, organization_id, created_at, resolved_at, resolution, organizations(name)')
        .neq('status', 'open')
        .order('resolved_at', { ascending: false, nullsFirst: false })
        .limit(50),
      service
        .from('rosa_exemplars')
        .select('id, question, ideal_answer, tool_trace, tags, active, created_from, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    const mapCase = (c: any) => ({
      id: c.id,
      kind: c.kind,
      status: c.status,
      summary: c.summary,
      evidence: c.evidence,
      organization_id: c.organization_id,
      organization_name: c.organizations?.name ?? null,
      created_at: c.created_at,
      resolved_at: c.resolved_at ?? null,
      resolution: c.resolution ?? null,
    });

    return NextResponse.json({
      openCases: (openRes.data ?? []).map(mapCase),
      recentHistory: (historyRes.data ?? []).map(mapCase),
      exemplars: exemplarsRes.data ?? [],
    });
  } catch (err: any) {
    console.error('[admin/rosa-learning] Error:', err);
    return NextResponse.json({ error: 'Failed to load Rosa learning queue' }, { status: 500 });
  }
}
