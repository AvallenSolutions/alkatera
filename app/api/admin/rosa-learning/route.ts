import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { analyzeFeedbackPatterns, getFeedbackStats } from '@/lib/gaia/feedback-learning';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/rosa-learning?days=30
 *
 * Admin visibility for the Rosa learning loop, mirroring
 * /api/admin/ingest-learning for Smart Upload.
 *
 * Three signals feed this, and until now nothing read any of them:
 *   - gaia_feedback: explicit thumbs and correction text. Only collectable
 *     from /admin/rosa until the drawer controls shipped, so expect the
 *     history to be thin and the useful data to start from 2026-07-19.
 *   - rosa_telemetry: implicit behaviour. It has logged tile.clicked vs
 *     tile.snoozed since the hub shipped and has only ever been read as a
 *     daily cost counter, never as signal.
 *   - rosa_memory corrections: the durable per-org facts a thumbs-down
 *     produced, which Rosa now carries into later conversations.
 *
 * PLATFORM ADMIN ONLY, and deliberately cross-org: this is the one view
 * where aggregating every customer is the point. Nothing here is written
 * back anywhere shared, so no org's text can reach another org's Rosa.
 */

interface TelemetryRollup {
  event: string;
  count: number;
}

export async function GET(request: Request) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 30) || 30, 1), 365);

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [analytics, stats, telemetryRes, correctionsRes, feedbackVolumeRes] = await Promise.all([
      analyzeFeedbackPatterns(service as never, days),
      getFeedbackStats(service as never, undefined, days),
      service
        .from('rosa_telemetry')
        .select('event, organization_id, created_at')
        .gte('created_at', since.toISOString())
        .limit(20000),
      service
        .from('rosa_memory')
        .select('organization_id, key, value, updated_at, organizations(name)')
        .like('key', 'correction_%')
        .order('updated_at', { ascending: false })
        .limit(50),
      service
        .from('gaia_feedback')
        .select('id, rating, created_at, organization_id, organizations(name)')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    // Roll telemetry up by event. The pairs that matter are tile.clicked vs
    // tile.snoozed (did Rosa pick something worth surfacing?) and
    // answer.rated_up vs answer.rated_down.
    const counts = new Map<string, number>();
    for (const row of (telemetryRes.data ?? []) as Array<{ event: string }>) {
      counts.set(row.event, (counts.get(row.event) ?? 0) + 1);
    }
    const telemetry: TelemetryRollup[] = Array.from(counts.entries())
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);

    const clicked = counts.get('tile.clicked') ?? 0;
    const snoozed = counts.get('tile.snoozed') ?? 0;
    const shown = counts.get('tile.shown') ?? 0;

    return NextResponse.json({
      ok: true,
      period_days: days,
      analytics,
      stats,
      telemetry,
      // Derived rates, so the page does not have to know which event names
      // pair up. Null rather than 0 when the denominator is empty, so "no
      // data yet" cannot be mistaken for "nothing ever lands".
      tile_engagement: {
        shown,
        clicked,
        snoozed,
        click_rate: shown > 0 ? Math.round((clicked / shown) * 1000) / 10 : null,
        snooze_rate: shown > 0 ? Math.round((snoozed / shown) * 1000) / 10 : null,
      },
      corrections: correctionsRes.data ?? [],
      recent_feedback: feedbackVolumeRes.data ?? [],
    });
  } catch (err: any) {
    console.error('[admin rosa-learning]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
