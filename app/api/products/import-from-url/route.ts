import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

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

    const hmacSecret = process.env.INTERNAL_JOB_HMAC_SECRET;
    if (!hmacSecret) {
      console.error('[import-from-url] INTERNAL_JOB_HMAC_SECRET not set');
      return NextResponse.json({ error: 'Import service not configured' }, { status: 500 });
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

    const payload = JSON.stringify({ jobId: job.id, url: normalizedUrl });
    const signature = createHmac('sha256', hmacSecret).update(payload).digest('hex');

    // Local dev (`pnpm dev`) doesn't run Netlify functions, so firing at
    // `/.netlify/functions/...` would 404 and the job would sit at 'pending'
    // forever. Invoke the runner directly in-process instead — Next.js dev
    // doesn't impose the 26s synchronous cap that drove the original
    // background-function split, so a long-running scrape is fine.
    const isDev = process.env.NODE_ENV !== 'production' && !process.env.NETLIFY;
    if (isDev) {
      // Fire-and-forget: don't await, the client polls for completion.
      void (async () => {
        try {
          const { handler } = await import('@/netlify/functions/import-from-url-background');
          await handler({
            body: payload,
            headers: { 'x-internal-hmac': signature },
          });
        } catch (err) {
          console.error('[import-from-url] Inline runner failed:', err);
        }
      })();
    } else {
      // Production: kick off the Netlify background function. The -background
      // suffix gives it 15 min of runtime, dodging the 26s sync cap.
      //
      // baseUrl must be the APP's own origin. Deriving it from parsedUrl (the
      // user-submitted site) borrowed that site's protocol; use only the app's
      // env origin, falling back to https + the request host, never the target
      // site's protocol.
      const baseUrl = process.env.URL || process.env.DEPLOY_URL || `https://${request.headers.get('host')}`;
      const target = `${baseUrl}/.netlify/functions/import-from-url-background`;
      // AWAIT the dispatch: a fire-and-forget fetch can be dropped when the
      // Lambda freezes as soon as the response returns, leaving the job stuck
      // at 'pending' forever. A -background function returns 202 immediately,
      // so awaiting adds only the round-trip.
      try {
        await fetch(target, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-hmac': signature,
          },
          body: payload,
        });
      } catch (err) {
        console.error('[import-from-url] Failed to trigger background function:', err);
        await (client as any)
          .from('product_import_jobs')
          .update({ status: 'failed', error: 'Could not start the import worker. Please try again.' })
          .eq('id', job.id);
        return NextResponse.json({ error: 'Failed to start import' }, { status: 502 });
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
