import { NextResponse, type NextRequest } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { inngest } from '@/lib/inngest/client';
import { estimateBrandFootprint, type BrandFootprintInput } from '@/lib/outreach/brand-footprint-estimate';
import { generateReportToken } from '@/lib/outreach/report-token';

export const dynamic = 'force-dynamic';

function resolveBaseUrl(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return new URL(request.url).origin;
}

/** GET — recent reports + the funnel summary for the admin tool. */
export async function GET() {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.service
    .from('brand_reports')
    .select('id, token, brand_name, category, status, enrichment_status, first_viewed_at, claimed_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Funnel counts across ALL reports (not just the 50 listed). head:true returns
  // only the count, no rows.
  const countWhere = async (apply: (q: any) => any): Promise<number> => {
    const { count } = await apply(
      auth.service.from('brand_reports').select('id', { count: 'exact', head: true }),
    );
    return count ?? 0;
  };
  const [generated, viewed, claimed] = await Promise.all([
    countWhere((q) => q),
    countWhere((q) => q.not('first_viewed_at', 'is', null)),
    countWhere((q) => q.not('claimed_at', 'is', null)),
  ]);

  return NextResponse.json({ reports: data ?? [], stats: { generated, viewed, claimed } });
}

/** POST — generate one report and return its paste-ready link instantly. */
export async function POST(request: NextRequest) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let body: {
    brandName?: string;
    website?: string | null;
    category?: string | null;
    countryOfOrigin?: string | null;
    autoEnrich?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const brandName = body.brandName?.trim();
  if (!brandName) {
    return NextResponse.json({ error: 'brandName is required' }, { status: 400 });
  }

  // Instant, deterministic estimate from whatever was typed — never blocks on
  // enrichment (which runs in the background below).
  const input: BrandFootprintInput = {
    brandName,
    category: body.category?.trim() || null,
    countryOfOrigin: body.countryOfOrigin?.trim() || null,
  };
  const estimate = estimateBrandFootprint(input);
  const token = generateReportToken(brandName);
  const website = body.website?.trim() || null;

  const wantsEnrich = body.autoEnrich !== false; // default on
  const canEnrich = wantsEnrich && !!process.env.INNGEST_EVENT_KEY;

  const { data: inserted, error } = await auth.service
    .from('brand_reports')
    .insert({
      token,
      brand_name: brandName,
      website,
      country_of_origin: input.countryOfOrigin,
      category: estimate.category,
      inputs: input,
      estimate,
      status: 'draft',
      created_by: auth.user.id,
      enrichment_status: canEnrich ? 'pending' : 'idle',
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create report' }, { status: 500 });
  }

  // Background auto-enrich (Inngest). Guarded so local/dev without a key simply
  // returns the instant link with enrichment idle.
  let enrichmentDispatched = false;
  if (canEnrich) {
    try {
      await inngest.send({ name: 'outreach/report.enrich', data: { report_id: inserted.id } });
      enrichmentDispatched = true;
    } catch {
      // Roll the status back to idle so the UI doesn't show a stuck 'pending'.
      await auth.service.from('brand_reports').update({ enrichment_status: 'idle' }).eq('id', inserted.id);
    }
  }

  const base = resolveBaseUrl(request);
  return NextResponse.json(
    {
      id: inserted.id,
      token,
      path: `/r/${token}`,
      url: `${base}/r/${token}`,
      enrichmentDispatched,
      enrichmentRequested: wantsEnrich,
    },
    { status: 201 },
  );
}
