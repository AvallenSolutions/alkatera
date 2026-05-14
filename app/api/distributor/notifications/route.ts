import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * GET  /api/distributor/notifications?unread=1&limit=20
 *   Lists notifications for the caller's distributor org. When
 *   `unread=1` is set, only unread rows are returned.
 *
 * PATCH /api/distributor/notifications
 *   Body: { ids?: string[], mark_all_read?: boolean }
 *   Marks specific notification ids (or all of them) as read.
 */
export async function GET(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') === '1';
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;

  let query = auth.supabase
    .from('distributor_notifications')
    .select('id, brand_profile_id, notification_type, title, body, link_url, read_at, created_at')
    .eq('distributor_org_id', auth.organization.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (unreadOnly) query = query.is('read_at', null);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count: unreadCount } = await auth.supabase
    .from('distributor_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('distributor_org_id', auth.organization.id)
    .is('read_at', null);

  return NextResponse.json({ notifications: data ?? [], unread_count: unreadCount ?? 0 });
}

export async function PATCH(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  let body: { ids?: unknown; mark_all_read?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const now = new Date().toISOString();
  if (body.mark_all_read === true) {
    const { error } = await auth.supabase
      .from('distributor_notifications')
      .update({ read_at: now })
      .eq('distributor_org_id', auth.organization.id)
      .is('read_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const ids = body.ids.filter((v): v is string => typeof v === 'string');
    const { error } = await auth.supabase
      .from('distributor_notifications')
      .update({ read_at: now })
      .eq('distributor_org_id', auth.organization.id)
      .in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, marked: ids.length });
  }

  return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
}
