import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import {
  gatherInsightContext,
  generateInsight,
  persistInsight,
} from '@/lib/pulse/insights';

/**
 * POST /api/pulse/refresh-insight
 *
 * Body: { organization_id: string }
 *
 * On-demand insight generation invoked from the InsightCard "Refresh" button.
 * Authenticates the calling user via cookies, verifies they belong to the
 * specified org, then runs the same pipeline as the nightly cron.
 *
 * Rate-limited to one refresh per org per hour via a cheap DB check rather
 * than in-memory state (which would reset on every Next.js dev rebuild).
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: { organization_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const orgId = body.organization_id;
  if (!orgId) {
    return NextResponse.json({ error: 'organization_id required' }, { status: 400 });
  }

  // Authenticate the caller and verify org membership via RLS-aware client.
  const cookieStore = cookies();
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    },
  );

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: membership } = await userClient
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userData.user.id)
    .eq('organization_id', orgId)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Service-role client for the gather + write (it bypasses RLS so the
  // insight builder can read all the cross-table context efficiently).
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Rate limit: one refresh per org per hour.
  const sinceStr = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: recent } = await adminClient
    .from('dashboard_insights')
    .select('id, generated_at')
    .eq('organization_id', orgId)
    .gte('generated_at', sinceStr)
    .order('generated_at', { ascending: false })
    .limit(1);
  if (recent && recent.length > 0) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Try again in less than an hour.' },
      { status: 429 },
    );
  }

  try {
    const context = await gatherInsightContext(adminClient, orgId);
    if (context.snapshots.length === 0) {
      return NextResponse.json({ error: 'no_data' }, { status: 422 });
    }
    const insight = await generateInsight(context, { period: 'daily' });
    if (!insight) {
      return NextResponse.json({ error: 'generation_failed' }, { status: 502 });
    }
    const { id, error } = await persistInsight(adminClient, orgId, insight, 'daily');
    if (error || !id) {
      return NextResponse.json({ error: error ?? 'write_failed' }, { status: 500 });
    }
    return NextResponse.json({ id, headline: insight.headline });
  } catch (err: any) {
    console.error('[refresh-insight]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
