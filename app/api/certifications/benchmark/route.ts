/**
 * B Corp peer benchmark — anonymised.
 *
 * GET /api/certifications/benchmark
 *
 * Returns, per requirement, the share of brands pursuing B Corp 2026 that have
 * VERIFIED evidence for it ("X% of brands meet this"). Privacy: aggregates
 * only, never org identities, and suppressed entirely unless the cohort is at
 * least MIN_COHORT brands so no single org is identifiable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getBcorpFrameworkId } from '@/lib/certifications/readiness';

export const runtime = 'nodejs';

const MIN_COHORT = 5;

export async function GET(_request: NextRequest) {
  try {
    const userSupabase = getSupabaseServerClient();
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const frameworkId = await getBcorpFrameworkId(userSupabase);
    if (!frameworkId) return NextResponse.json({ available: false, reason: 'no_framework' });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const svc = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

    // Cohort: distinct orgs actively pursuing B Corp 2026.
    const { data: certs } = await svc
      .from('organization_certifications')
      .select('organization_id, status')
      .eq('framework_id', frameworkId)
      .neq('status', 'not_started');
    const cohort = new Set((certs ?? []).map((c: any) => c.organization_id));
    const cohortSize = cohort.size;

    // Suppress the whole benchmark below the minimum cohort, for anonymity.
    if (cohortSize < MIN_COHORT) {
      return NextResponse.json({ available: false, reason: 'cohort_too_small', cohortSize });
    }

    // Verified evidence across the cohort, grouped to distinct orgs per requirement.
    const { data: links } = await svc
      .from('certification_evidence_links')
      .select('organization_id, requirement_id')
      .eq('verification_status', 'verified');

    const orgsByReq = new Map<string, Set<string>>();
    for (const l of (links ?? []) as Array<{ organization_id: string; requirement_id: string }>) {
      if (!cohort.has(l.organization_id)) continue;
      (orgsByReq.get(l.requirement_id) ?? orgsByReq.set(l.requirement_id, new Set()).get(l.requirement_id)!).add(
        l.organization_id,
      );
    }

    const byRequirement: Record<string, number> = {};
    for (const [reqId, orgs] of Array.from(orgsByReq.entries())) {
      byRequirement[reqId] = Math.round((orgs.size / cohortSize) * 100);
    }

    return NextResponse.json({ available: true, cohortSize, byRequirement });
  } catch (err: any) {
    console.error('[certifications benchmark]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}
