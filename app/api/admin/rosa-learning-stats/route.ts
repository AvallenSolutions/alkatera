import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/rosa-learning-stats
 *
 * Pillar 4 step 5 "Measure" (data-revolution-plan.md). 30-day window:
 * helpfulness rate (rosa_message_feedback verdicts), proposal confirm rate
 * (rosa_pending_actions confirmed vs cancelled), knowledge-miss count,
 * rephrase count, tickets filed after an answer, and the latest
 * scripts/rosa-eval.ts scoreboard. Reads only -- no writes.
 */
export async function GET() {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    const [feedbackRes, actionsRes, knowledgeMissRes, rephraseRes, ticketsRes, lastEvalRes] = await Promise.all([
      service.from('rosa_message_feedback').select('verdict').gte('created_at', sinceIso).limit(20000),
      service.from('rosa_pending_actions').select('status').in('status', ['confirmed', 'cancelled']).gte('created_at', sinceIso).limit(20000),
      service.from('rosa_telemetry').select('id', { count: 'exact', head: true }).eq('event', 'learning.knowledge_miss').gte('created_at', sinceIso),
      service.from('rosa_telemetry').select('id', { count: 'exact', head: true }).eq('event', 'learning.rephrase').gte('created_at', sinceIso),
      service
        .from('rosa_telemetry')
        .select('id', { count: 'exact', head: true })
        .eq('event', 'support.ticket_filed')
        .eq('payload->>after_answer', 'true')
        .gte('created_at', sinceIso),
      service.from('rosa_eval_runs').select('id, run_at, total, passed').order('run_at', { ascending: false }).limit(1),
    ]);

    const feedback = feedbackRes.data ?? [];
    const helpful = feedback.filter((f: any) => f.verdict === 'helpful').length;
    const helpfulnessRate = feedback.length > 0 ? Math.round((helpful / feedback.length) * 100) : null;

    const actions = actionsRes.data ?? [];
    const confirmed = actions.filter((a: any) => a.status === 'confirmed').length;
    const proposalConfirmRate = actions.length > 0 ? Math.round((confirmed / actions.length) * 100) : null;

    const lastEval = lastEvalRes.data?.[0] ?? null;

    return NextResponse.json({
      window_days: 30,
      helpfulness_rate: helpfulnessRate,
      feedback_count: feedback.length,
      proposal_confirm_rate: proposalConfirmRate,
      proposal_count: actions.length,
      knowledge_miss_count: knowledgeMissRes.count ?? 0,
      rephrase_count: rephraseRes.count ?? 0,
      tickets_after_answer_count: ticketsRes.count ?? 0,
      last_eval: lastEval
        ? { run_at: lastEval.run_at, total: lastEval.total, passed: lastEval.passed }
        : null,
    });
  } catch (err: any) {
    console.error('[admin/rosa-learning-stats] Error:', err);
    return NextResponse.json({ error: 'Failed to load Rosa learning stats' }, { status: 500 });
  }
}
