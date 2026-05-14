import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * PUT /api/distributor/brands/[id]/outreach-email
 * Body: { outreach_email: string | null }
 *
 * Owner / data_manager only. Used by the brand-detail editable field
 * and by the outreach dashboard inline editor.
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { outreach_email?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let outreachEmail: string | null = null;
  if (body.outreach_email === null || body.outreach_email === '') {
    outreachEmail = null;
  } else if (typeof body.outreach_email === 'string') {
    const trimmed = body.outreach_email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }
    outreachEmail = trimmed;
  } else {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('brand_profiles')
    .update({ outreach_email: outreachEmail })
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .select('id, outreach_email')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ brand: data });
}
