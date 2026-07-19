/**
 * Rosa answer feedback.
 *
 * POST /api/rosa/feedback
 *   body: {
 *     message_id: string          // gaia_messages.id, from the stream's done event
 *     rating: 'positive' | 'negative'
 *     feedback_text?: string      // what was wrong, free text
 *     remember?: boolean          // persist the correction as an org fact
 *   }
 *
 * Until now, thumbs up/down existed only in GaiaChat, which is mounted solely
 * at /admin/rosa. Every real user talks to Rosa through the drawer, which had
 * no feedback affordance at all, so nobody outside the admin page could tell
 * Rosa she was wrong and nothing accumulated to learn from.
 *
 * Two Smart Upload invariants apply here (see lib/ingest/*):
 *   - Learning must never block the product. Every write past the feedback row
 *     itself is best-effort; a failed memory write or telemetry ping still
 *     returns 200, because the user's feedback WAS recorded.
 *   - Per-org learning stays per-org. A remembered correction is written with
 *     the caller's organization_id and can never surface in another org.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { saveMemory } from '@/lib/rosa/memory';

export const runtime = 'nodejs';

const MAX_FEEDBACK_CHARS = 2000;

export async function POST(req: NextRequest) {
  let body: {
    message_id?: string;
    rating?: string;
    feedback_text?: string;
    remember?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const messageId = String(body.message_id ?? '').trim();
  const rating = String(body.rating ?? '').trim();
  if (!messageId) {
    return NextResponse.json({ error: 'message_id required' }, { status: 400 });
  }
  if (rating !== 'positive' && rating !== 'negative') {
    return NextResponse.json({ error: 'rating must be positive or negative' }, { status: 400 });
  }

  const feedbackText = (body.feedback_text ?? '').trim().slice(0, MAX_FEEDBACK_CHARS) || null;

  const userSupabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
  const svc = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const organizationId = await resolveAccessibleOrg(svc, user);
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 });
  }

  // The message must belong to a conversation in the caller's org. Without
  // this, message_id is an unchecked id from the request body and anyone could
  // attach feedback to another org's conversation.
  const { data: message } = await svc
    .from('gaia_messages')
    .select('id, conversation_id, role, gaia_conversations!inner(organization_id)')
    .eq('id', messageId)
    .maybeSingle();

  const messageOrg = (message as any)?.gaia_conversations?.organization_id;
  if (!message || messageOrg !== organizationId) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  // One verdict per user per message. A second submission updates rather than
  // erroring, so changing your mind is not a dead end in the UI.
  const { data: existing } = await svc
    .from('gaia_feedback')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await svc
      .from('gaia_feedback')
      .update({ rating, feedback_text: feedbackText })
      .eq('id', existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await svc.from('gaia_feedback').insert({
      message_id: messageId,
      user_id: user.id,
      organization_id: organizationId,
      rating,
      feedback_text: feedbackText,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Everything below is best-effort. The feedback is already saved.
  let remembered = false;
  if (body.remember && feedbackText && rating === 'negative') {
    // Only an explicit "remember this" persists. Auto-saving every complaint
    // would fill the org's memory with grumbles rather than facts, and Rosa
    // reads memory into every future prompt.
    // Org scope: a correction about the business, not about the person.
    const saved = await saveMemory(
      svc,
      organizationId,
      user.id,
      'org',
      `correction_${messageId.slice(0, 8)}`,
      feedbackText,
    );
    remembered = saved.ok;
    if (!saved.ok) {
      console.warn('[rosa feedback] memory write failed:', saved.error);
    }
  }

  try {
    await svc.from('rosa_telemetry').insert({
      organization_id: organizationId,
      user_id: user.id,
      event: rating === 'positive' ? 'answer.rated_up' : 'answer.rated_down',
      payload: { message_id: messageId, has_text: Boolean(feedbackText), remembered },
    });
  } catch (err) {
    console.warn('[rosa feedback] telemetry write failed', err);
  }

  return NextResponse.json({ ok: true, remembered });
}
