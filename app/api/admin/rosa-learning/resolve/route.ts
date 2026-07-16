import { NextRequest, NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

type ResolveAction = 'knowledge' | 'exemplar' | 'memory' | 'code' | 'dismiss';
const VALID_ACTIONS: ResolveAction[] = ['knowledge', 'exemplar', 'memory', 'code', 'dismiss'];

/**
 * POST /api/admin/rosa-learning/resolve
 *
 * Resolves one curation case (Pillar 4 step 2) to one of the four levers
 * the plan describes, or dismisses it as noise:
 *   - knowledge -- the admin is writing/editing a wiki page elsewhere
 *     (/admin/wiki); this just records that and closes the case.
 *   - exemplar  -- creates a rosa_exemplars row from the supplied
 *     question/ideal_answer (Pillar 4 step 3) and links it back via
 *     created_from.
 *   - memory    -- an org-memory correction was made elsewhere (no
 *     dedicated admin UI exists yet); records a note and closes the case.
 *   - code      -- flags a tool/prompt bug for a follow-up code fix.
 *   - dismiss   -- noise, no lever needed.
 *
 * Body: { caseId, action, note?, exemplar?: { question, ideal_answer, tags? } }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  try {
    const body = await request.json().catch(() => null);
    const caseId: string | null = typeof body?.caseId === 'string' ? body.caseId : null;
    const action: string | null = typeof body?.action === 'string' ? body.action : null;
    const note: string | null = typeof body?.note === 'string' ? body.note.slice(0, 1000) : null;

    if (!caseId) return NextResponse.json({ error: 'caseId required' }, { status: 400 });
    if (!action || !VALID_ACTIONS.includes(action as ResolveAction)) {
      return NextResponse.json({ error: `action must be one of ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }

    const { data: caseRow } = await service
      .from('rosa_learning_cases')
      .select('id, status')
      .eq('id', caseId)
      .maybeSingle();
    if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (caseRow.status !== 'open') {
      return NextResponse.json({ error: `Case is already ${caseRow.status}` }, { status: 409 });
    }

    let exemplarId: string | null = null;
    if (action === 'exemplar') {
      const question = typeof body?.exemplar?.question === 'string' ? body.exemplar.question.trim() : '';
      const idealAnswer = typeof body?.exemplar?.ideal_answer === 'string' ? body.exemplar.ideal_answer.trim() : '';
      const tags = Array.isArray(body?.exemplar?.tags)
        ? body.exemplar.tags.filter((t: unknown): t is string => typeof t === 'string')
        : [];
      if (!question || !idealAnswer) {
        return NextResponse.json({ error: 'exemplar.question and exemplar.ideal_answer are required' }, { status: 400 });
      }
      const { data: exemplar, error: exemplarErr } = await service
        .from('rosa_exemplars')
        .insert({ question, ideal_answer: idealAnswer, tags, created_from: caseId })
        .select('id')
        .single();
      if (exemplarErr) {
        console.error('[admin/rosa-learning/resolve] exemplar insert failed:', exemplarErr.message);
        return NextResponse.json({ error: 'Could not create the exemplar' }, { status: 500 });
      }
      exemplarId = exemplar.id;
    }

    const resolution: Record<string, unknown> = { type: action };
    if (note) resolution.note = note;
    if (exemplarId) resolution.exemplar_id = exemplarId;

    const status = action === 'dismiss' ? 'dismissed' : 'resolved';
    const { error: updateErr } = await service
      .from('rosa_learning_cases')
      .update({ status, resolved_at: new Date().toISOString(), resolution })
      .eq('id', caseId);
    if (updateErr) {
      console.error('[admin/rosa-learning/resolve] case update failed:', updateErr.message);
      return NextResponse.json({ error: 'Could not update the case' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status, exemplarId });
  } catch (err: any) {
    console.error('[admin/rosa-learning/resolve] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
