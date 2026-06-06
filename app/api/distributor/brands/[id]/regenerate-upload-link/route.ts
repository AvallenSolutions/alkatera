import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * POST /api/distributor/brands/[id]/regenerate-upload-link
 *
 * Issues a FRESH self-upload token and resets the 90-day expiry for a
 * brand listing, so a distributor can revive an expired (or potentially
 * leaked) brand-upload link without recreating the brand. Owner /
 * data_manager only.
 *
 * The previous link is invalidated immediately — we overwrite the unique
 * `upload_token`, so any old link now 404s at validateUploadToken().
 * Scoped by distributor_org_id: the token lives on the per-distributor
 * brand_profiles listing, so this only affects this distributor's link,
 * not other distributors who list the same canonical brand.
 */
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + NINETY_DAYS_MS).toISOString();

  const { data, error } = await auth.supabase
    .from('brand_profiles')
    .update({ upload_token: token, upload_token_expires_at: expiresAt })
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .select('id, upload_token, upload_token_expires_at')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ brand: data });
}
