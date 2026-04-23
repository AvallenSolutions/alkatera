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

    const { data: job, error: insertError } = await (client as any)
      .from('product_import_jobs')
      .insert({
        user_id: user.id,
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

    // Fire-and-forget: kick off the Netlify background function. The -background
    // suffix gives it 15 min of runtime, so the slow Claude call no longer
    // threatens the 26s synchronous cap that produces 504s.
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || `${parsedUrl.protocol}//${request.headers.get('host')}`;
    const target = `${baseUrl}/.netlify/functions/import-from-url-background`;

    void fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-hmac': signature,
      },
      body: payload,
    }).catch((err) => {
      console.error('[import-from-url] Failed to trigger background function:', err);
    });

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
