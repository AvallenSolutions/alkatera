import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * Cron: B Corp — stale evidence detection.
 *
 * POST /api/cron/detect-stale-evidence
 *
 * Marks certification_evidence_links as fresh / expiring_soon / stale based
 * on updated_at. Evidence older than 18 months is stale; within 60 days of
 * that threshold is expiring_soon. A notification is sent the first time a
 * piece of evidence becomes stale. Stale evidence still passes its
 * requirement; it only carries a warning.
 *
 * Schedule: nightly. Triggered externally with the CRON_SECRET bearer token.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const DAY = 24 * 60 * 60 * 1000;
const STALE_MS = 18 * 30 * DAY;
const SOON_WINDOW_MS = 60 * DAY;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (
      !cronSecret ||
      !authHeader ||
      !safeCompare(authHeader, `Bearer ${cronSecret}`)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.SUPABASE_SERVICE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: noStoreFetch } },
    );

    const { data: links } = await supabase
      .from('certification_evidence_links')
      .select(
        'id, organization_id, requirement_id, updated_at, created_at, staleness_status',
      )
      .eq('verification_status', 'verified');

    const now = Date.now();
    let staleCount = 0;
    let soonCount = 0;
    let newlyStale = 0;
    const newlyStaleByOrg = new Map<string, number>();

    for (const link of links ?? []) {
      const ts = new Date(
        link.updated_at ?? link.created_at ?? now,
      ).getTime();
      const age = now - ts;
      let next: 'fresh' | 'expiring_soon' | 'stale' = 'fresh';
      if (age >= STALE_MS) next = 'stale';
      else if (age >= STALE_MS - SOON_WINDOW_MS) next = 'expiring_soon';

      if (next === link.staleness_status) {
        if (next === 'stale') staleCount += 1;
        if (next === 'expiring_soon') soonCount += 1;
        continue;
      }

      await supabase
        .from('certification_evidence_links')
        .update({ staleness_status: next })
        .eq('id', link.id);

      if (next === 'stale') {
        staleCount += 1;
        if (link.staleness_status !== 'stale') {
          newlyStale += 1;
          newlyStaleByOrg.set(
            link.organization_id,
            (newlyStaleByOrg.get(link.organization_id) ?? 0) + 1,
          );
        }
      }
      if (next === 'expiring_soon') soonCount += 1;
    }

    // Notify owners about evidence that just went stale.
    for (const [orgId, count] of Array.from(newlyStaleByOrg.entries())) {
      try {
        const { data: members } = await supabase
          .from('organization_members')
          .select('user_id, roles!inner(name)')
          .eq('organization_id', orgId)
          .in('roles.name', ['owner', 'admin']);
        const userIds = ((members ?? []) as Array<{ user_id: string }>).map(
          (m) => m.user_id,
        );
        if (userIds.length === 0) continue;
        await supabase.from('user_notifications').insert(
          userIds.map((uid) => ({
            user_id: uid,
            organization_id: orgId,
            notification_type: 'certification_stale_evidence',
            title: 'B Corp evidence has gone stale',
            message: `${count} piece(s) of evidence are now over 18 months old. Consider updating before your next recertification.`,
            entity_type: 'organization',
            entity_id: orgId,
            metadata: { count },
          })),
        );
      } catch (e) {
        console.error('stale evidence notify failed:', e);
      }
    }

    return NextResponse.json({
      checked: links?.length ?? 0,
      stale: staleCount,
      expiring_soon: soonCount,
      newly_stale: newlyStale,
    });
  } catch (err) {
    console.error('[detect-stale-evidence cron]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
