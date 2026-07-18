import { NextRequest, NextResponse } from 'next/server';
import { getActiveShareByToken } from '@/lib/reports/report-shares';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';

/**
 * Public shared sustainability report: /report/[token]
 *
 * Serves the stored screen-mode HTML document for an ACTIVE share link. The
 * unguessable token is the entire access control (exact match, no listing,
 * mirroring /r/[token]); a revoked or expired link 404s. Responses are never
 * cached or indexed — revocation must take effect immediately.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const share = await getActiveShareByToken(token);
  if (!share) {
    return new NextResponse('Not found', { status: 404 });
  }

  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  const { data: file, error } = await admin.storage
    .from('report-shares')
    .download(share.html_path);
  if (error || !file) {
    console.error('[report-share] Stored document missing for active share:', share.id, error);
    return new NextResponse('Not found', { status: 404 });
  }

  const html = await file.text();
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
