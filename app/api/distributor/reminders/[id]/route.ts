import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * PATCH /api/distributor/reminders/[id]
 *   Body: { interval_days?: number, max_reminders?: number, active?: boolean }
 *   Owner / data_manager only.
 *
 * DELETE /api/distributor/reminders/[id]
 *   Owner / data_manager only.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { interval_days?: unknown; max_reminders?: unknown; active?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.interval_days === 'number' && body.interval_days >= 1 && body.interval_days <= 90) {
    update.interval_days = body.interval_days;
  }
  if (typeof body.max_reminders === 'number' && body.max_reminders >= 1 && body.max_reminders <= 10) {
    update.max_reminders = body.max_reminders;
  }
  if (typeof body.active === 'boolean') {
    update.active = body.active;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('outreach_reminder_schedules')
    .update(update)
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .select('*')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ schedule: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { error } = await auth.supabase
    .from('outreach_reminder_schedules')
    .delete()
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
