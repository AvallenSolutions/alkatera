import { NextRequest, NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/rosa-learning/promote
 *
 * "Promote to eval" on a curation case (Pillar 4 step 4, mirrors the ingest
 * classifier's /api/admin/ingest-learning/promote). Creates a
 * rosa_eval_cases row prefilled from the case's evidence: the question, a
 * minimal org_snapshot (organisation id + name, so the eval harness can run
 * the real tool loop against real read-only org data), and empty
 * expectations for the admin to fill in later (editing rosa_eval_cases
 * directly, or via a future edit UI -- out of scope here). Marks the case
 * status='promoted'.
 *
 * Body: { caseId }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  try {
    const body = await request.json().catch(() => null);
    const caseId: string | null = typeof body?.caseId === 'string' ? body.caseId : null;
    if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });

    const { data: caseRow } = await service
      .from('rosa_learning_cases')
      .select('id, status, summary, evidence, organization_id, organizations(name)')
      .eq('id', caseId)
      .maybeSingle();
    if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const evidence = (caseRow.evidence ?? {}) as Record<string, unknown>;
    const question =
      (typeof evidence.question === 'string' && evidence.question) ||
      (typeof evidence.query === 'string' && evidence.query) ||
      caseRow.summary;

    let orgSnapshot: Record<string, unknown> = {};
    if (caseRow.organization_id) {
      const orgName = (caseRow as any).organizations?.name ?? null;
      const [{ count: productCount }, { count: facilityCount }] = await Promise.all([
        service.from('products').select('id', { count: 'exact', head: true }).eq('organization_id', caseRow.organization_id),
        service.from('facilities').select('id', { count: 'exact', head: true }).eq('organization_id', caseRow.organization_id),
      ]);
      orgSnapshot = {
        organization_id: caseRow.organization_id,
        name: orgName,
        counts: { products: productCount ?? 0, facilities: facilityCount ?? 0 },
      };
    }

    const { data: evalCase, error: insertErr } = await service
      .from('rosa_eval_cases')
      .insert({
        question,
        org_snapshot: orgSnapshot,
        expectations: {},
        source_case: caseId,
      })
      .select('id')
      .single();
    if (insertErr) {
      console.error('[admin/rosa-learning/promote] insert failed:', insertErr.message);
      return NextResponse.json({ error: 'Could not create the eval case' }, { status: 500 });
    }

    await service
      .from('rosa_learning_cases')
      .update({ status: 'promoted', resolved_at: new Date().toISOString(), resolution: { type: 'eval', eval_case_id: evalCase.id } })
      .eq('id', caseId);

    return NextResponse.json({ ok: true, evalCaseId: evalCase.id });
  } catch (err: any) {
    console.error('[admin/rosa-learning/promote] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
