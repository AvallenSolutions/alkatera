import { NextRequest, NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/rosa-learning/exemplars
 *
 * Author a worked example directly (Pillar 4 step 3), independent of the
 * curation queue. Body: { question, ideal_answer, tags? }.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  try {
    const body = await request.json().catch(() => null);
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    const idealAnswer = typeof body?.ideal_answer === 'string' ? body.ideal_answer.trim() : '';
    const tags = Array.isArray(body?.tags) ? body.tags.filter((t: unknown): t is string => typeof t === 'string') : [];
    if (!question || !idealAnswer) {
      return NextResponse.json({ error: 'question and ideal_answer are required' }, { status: 400 });
    }

    const { data, error } = await service
      .from('rosa_exemplars')
      .insert({ question, ideal_answer: idealAnswer, tags })
      .select('id, question, ideal_answer, tool_trace, tags, active, created_from, created_at')
      .single();
    if (error) {
      console.error('[admin/rosa-learning/exemplars] insert failed:', error.message);
      return NextResponse.json({ error: 'Could not create the exemplar' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, exemplar: data });
  } catch (err: any) {
    console.error('[admin/rosa-learning/exemplars] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
