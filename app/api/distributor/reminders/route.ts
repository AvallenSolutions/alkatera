import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * GET  /api/distributor/reminders
 *   Lists every reminder schedule for the caller's org. Includes
 *   inactive ones so the UI can show "off" toggles.
 *
 * POST /api/distributor/reminders
 *   Body: { brand_profile_id?: string|null, interval_days?: number, max_reminders?: number, active?: boolean }
 *   Creates a new schedule. Owner / data_manager only.
 *   `brand_profile_id` null → org-wide default.
 */
export async function GET() {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const { data, error } = await auth.supabase
    .from('outreach_reminder_schedules')
    .select('id, brand_profile_id, interval_days, max_reminders, active, created_at, created_by')
    .eq('distributor_org_id', auth.organization.id)
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ schedules: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    brand_profile_id?: unknown;
    interval_days?: unknown;
    max_reminders?: unknown;
    active?: unknown;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const intervalDays =
    typeof body.interval_days === 'number' && body.interval_days >= 1 && body.interval_days <= 90
      ? body.interval_days
      : 14;
  const maxReminders =
    typeof body.max_reminders === 'number' && body.max_reminders >= 1 && body.max_reminders <= 10
      ? body.max_reminders
      : 3;

  let brandProfileId: string | null = null;
  if (typeof body.brand_profile_id === 'string' && body.brand_profile_id.length > 0) {
    const { data } = await auth.supabase
      .from('brand_profiles')
      .select('id')
      .eq('id', body.brand_profile_id)
      .eq('distributor_org_id', auth.organization.id)
      .maybeSingle();
    if (!data) {
      return NextResponse.json({ error: 'brand_not_found' }, { status: 404 });
    }
    brandProfileId = body.brand_profile_id;
  }

  const { data, error } = await auth.supabase
    .from('outreach_reminder_schedules')
    .insert({
      distributor_org_id: auth.organization.id,
      created_by: auth.user.id,
      brand_profile_id: brandProfileId,
      interval_days: intervalDays,
      max_reminders: maxReminders,
      active: body.active !== false,
    })
    .select('*')
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'insert_failed' }, { status: 500 });
  }
  return NextResponse.json({ schedule: data }, { status: 201 });
}
