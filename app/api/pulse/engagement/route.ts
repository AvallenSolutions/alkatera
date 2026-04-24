/**
 * Pulse -- Widget engagement (adaptive ranking).
 *
 * POST /api/pulse/engagement
 *   body: { widget_id: WidgetId, source?: 'click' | 'url' | 'programmatic' }
 *
 *   Upserts the engagement row for the current user + current organisation +
 *   widget_id. Appends a timestamp to `open_timestamps` (capped at the 90
 *   most recent). Requests with `source !== 'click'` are accepted but NOT
 *   recorded -- URL deep-links and programmatic opens don't count as
 *   engagement signal (per the plan's non-stupidity guard).
 *
 * GET /api/pulse/engagement
 *   Returns all engagement rows for the current user + current org.
 *   Used once on Pulse mount to compute the adaptive sort order.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export const runtime = 'nodejs';

const MAX_TIMESTAMPS = 90;

async function resolveContext(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthenticated', status: 401 as const };

  // Resolve current organisation from ?organization_id= or first membership.
  const param = request.nextUrl.searchParams.get('organization_id');
  let organizationId = param ?? null;
  if (!organizationId) {
    const { data: m } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    organizationId = m?.organization_id ?? null;
  } else {
    const { data: m } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (!m) return { error: 'Not a member', status: 403 as const };
  }
  if (!organizationId) return { error: 'No organisation', status: 403 as const };

  return { userId: user.id, organizationId, supabase };
}

export async function POST(request: NextRequest) {
  const ctx = await resolveContext(request);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let body: { widget_id?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const widgetId = (body?.widget_id ?? '').toString();
  if (!widgetId) {
    return NextResponse.json({ error: 'widget_id required' }, { status: 400 });
  }
  const source = body?.source ?? 'click';
  // URL deep-links and programmatic opens don't count -- they were
  // targeted navigation, not user-driven discovery.
  if (source !== 'click') {
    return NextResponse.json({ ok: true, skipped: true, reason: source });
  }

  const now = new Date().toISOString();

  // Fetch existing row so we can append to open_timestamps atomically.
  const { data: existing } = await ctx.supabase
    .from('pulse_widget_engagement')
    .select('open_count, open_timestamps')
    .eq('user_id', ctx.userId)
    .eq('organization_id', ctx.organizationId)
    .eq('widget_id', widgetId)
    .maybeSingle();

  const previousTimestamps = Array.isArray(existing?.open_timestamps)
    ? (existing!.open_timestamps as string[])
    : [];
  const nextTimestamps = [...previousTimestamps, now].slice(-MAX_TIMESTAMPS);
  const previousCount = Number(existing?.open_count ?? 0);

  const { error } = await ctx.supabase
    .from('pulse_widget_engagement')
    .upsert(
      {
        user_id: ctx.userId,
        organization_id: ctx.organizationId,
        widget_id: widgetId,
        open_count: previousCount + 1,
        last_opened_at: now,
        open_timestamps: nextTimestamps,
      },
      { onConflict: 'user_id,organization_id,widget_id' },
    );

  if (error) {
    console.error('[pulse engagement] upsert failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const ctx = await resolveContext(request);
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data, error } = await ctx.supabase
    .from('pulse_widget_engagement')
    .select('widget_id, open_count, last_opened_at, open_timestamps')
    .eq('user_id', ctx.userId)
    .eq('organization_id', ctx.organizationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
