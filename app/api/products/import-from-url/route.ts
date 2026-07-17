import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { inngest } from '@/lib/inngest/client';
import { runImportFromUrl } from '@/lib/products/import-from-url-worker';

// Inline fallback (see dispatch below) can run the full scrape + Claude
// extraction synchronously within the request. Vercel Fluid Compute allows
// up to 300s; the worker's own poll budget on the client side is 60s, so
// this is headroom, not the expected duration.
export const maxDuration = 300;

// SSRF protection: block private/internal IP ranges
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^\[::1\]$/,
  /^\[fc/i,
  /^\[fd/i,
  /^\[fe80/i,
];

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOSTS.some(pattern => pattern.test(hostname));
}

export async function POST(request: NextRequest) {
  try {
    const { client, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let normalizedUrl = String(url).trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizedUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are allowed' }, { status: 400 });
    }

    if (isBlockedHost(parsedUrl.hostname)) {
      return NextResponse.json({ error: 'Access to internal addresses is not allowed' }, { status: 400 });
    }

    // Best-effort per-user rate limit: each non-Shopify run costs ~10 page
    // fetches plus a Claude Sonnet call, so cap concurrent/rapid submissions.
    const { count: recentCount } = await (client as any)
      .from('product_import_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['pending', 'scraping', 'extracting'])
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
    if (typeof recentCount === 'number' && recentCount >= 5) {
      return NextResponse.json(
        { error: 'You already have several imports running. Please wait for them to finish before starting another.' },
        { status: 429 }
      );
    }

    // Resolve the caller's organisation so the job row is org-scoped (enables
    // org-level auditing and cleanup); polling remains gated on user_id.
    const orgId = (user.app_metadata as any)?.current_organization_id ?? null;

    const { data: job, error: insertError } = await (client as any)
      .from('product_import_jobs')
      .insert({
        user_id: user.id,
        organization_id: orgId,
        url: normalizedUrl,
        status: 'pending',
        phase_message: 'Starting import…',
      })
      .select('id')
      .single();

    if (insertError || !job) {
      console.error('[import-from-url] Failed to create job:', insertError);
      return NextResponse.json({ error: 'Failed to start import' }, { status: 500 });
    }

    // Dispatch the long-running import (scrape + Claude extract) to Inngest
    // when it's configured — no Netlify-only background-function URL to
    // construct, and it runs identically in local dev (via the Inngest dev
    // server) and production.
    //
    // When Inngest isn't configured (no event key — true on staging/local
    // unless someone has run up the Inngest dev server), there is no worker
    // listening for the event, so `inngest.send` would silently no-op and
    // the job would sit at 'pending' forever, which is what made the
    // arrival "confirm" step arrive empty on Tim's staging test. Instead,
    // run the same worker function inline, synchronously, within this
    // request. It's the same `runImportFromUrl` the Inngest function calls
    // (lib/inngest/functions/product-import.ts) — it never throws, every
    // failure path writes `status: 'failed'` onto the job row itself — so
    // calling it directly with no `step` context is safe. The client's poll
    // loop against GET .../[jobId] doesn't change either way: inline
    // completion just means the very first poll already sees the result.
    if (process.env.INNGEST_EVENT_KEY) {
      try {
        await inngest.send({
          name: 'products/import-from-url.run',
          data: { job_id: job.id, url: normalizedUrl },
        });
      } catch (err) {
        console.error('[import-from-url] Failed to dispatch import job:', err);
        await (client as any)
          .from('product_import_jobs')
          .update({ status: 'failed', error: 'Could not start the import worker. Please try again.' })
          .eq('id', job.id);
        return NextResponse.json({ error: 'Failed to start import' }, { status: 502 });
      }
    } else {
      try {
        await runImportFromUrl({ supabase: client as any, jobId: job.id, url: normalizedUrl });
      } catch (err) {
        // Belt and braces only — runImportFromUrl already writes a 'failed'
        // status for every failure mode it knows about.
        console.error('[import-from-url] Inline worker run threw:', err);
        await (client as any)
          .from('product_import_jobs')
          .update({ status: 'failed', error: 'Failed to import products from URL' })
          .eq('id', job.id);
      }
    }

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (error: any) {
    console.error('[import-from-url] Error:', error);
    return NextResponse.json({ error: 'Failed to start import' }, { status: 500 });
  }
}

export interface ExtractedProduct {
  name: string;
  description: string;
  abv: number | null;
  unit_size_value: number | null;
  unit_size_unit: string | null;
  product_category: string;
  product_image_url: string | null;
  packaging_type: 'glass_bottle' | 'aluminium_can' | 'keg_cask' | 'pet_bag' | null;
  ingredients: string[];
  certifications: string[];
}
