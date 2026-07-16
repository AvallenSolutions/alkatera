import { NextRequest, NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/rosa-learning/exemplars/[id]
 *
 * Edit or deactivate an exemplar (Pillar 4 step 3). Body may include any of
 * { question, ideal_answer, tags, active }.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  try {
    const body = await request.json().catch(() => null);
    const update: Record<string, unknown> = {};
    if (typeof body?.question === 'string' && body.question.trim()) update.question = body.question.trim();
    if (typeof body?.ideal_answer === 'string' && body.ideal_answer.trim()) update.ideal_answer = body.ideal_answer.trim();
    if (Array.isArray(body?.tags)) update.tags = body.tags.filter((t: unknown): t is string => typeof t === 'string');
    if (typeof body?.active === 'boolean') update.active = body.active;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await service
      .from('rosa_exemplars')
      .update(update)
      .eq('id', params.id)
      .select('id, question, ideal_answer, tool_trace, tags, active, created_from, created_at')
      .single();
    if (error) {
      console.error('[admin/rosa-learning/exemplars/[id]] update failed:', error.message);
      return NextResponse.json({ error: 'Could not update the exemplar' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, exemplar: data });
  } catch (err: any) {
    console.error('[admin/rosa-learning/exemplars/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
