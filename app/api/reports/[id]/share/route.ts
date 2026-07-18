import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildScreenReportHtml } from '@/lib/reports/build-screen-report';
import { generateShareToken, isShareActive, type ReportShareRow } from '@/lib/reports/report-shares';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { enforceProvenanceGate } from '@/lib/provenance/gate';

/**
 * Report share links.
 *
 * POST   /api/reports/[id]/share  — create (or return the existing active)
 *                                   share link for a report. Renders the
 *                                   screen-mode document once and stores it,
 *                                   so the public route serves a fast, stable
 *                                   snapshot.
 * DELETE /api/reports/[id]/share  — revoke the active share link and remove
 *                                   the stored document.
 *
 * Authentication: Bearer token (Supabase session). All report/share reads and
 * writes go through the caller's RLS-scoped client, so membership rules
 * decide access; the service role is used only for Storage.
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

const SHARE_BUCKET = 'report-shares';

// Opt out of Next's fetch cache: PostgREST selects are GETs and would
// otherwise be cached across invocations on this no-next/headers route.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

function getAuthedClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch } }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const supabase = getAuthedClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { data: report, error: reportError } = await supabase
      .from('generated_reports')
      .select('*')
      .eq('id', reportId)
      .single();
    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // A public link is the MOST external artefact here: it needs the same
    // confirmed-data backing as the PDF. Gated at creation only, so links
    // already out in the world keep working (revocation is the kill switch).
    const provenanceBlocked = await enforceProvenanceGate(supabase, report.organization_id, 'overall');
    if (provenanceBlocked) return provenanceBlocked;

    // Reuse an existing active link rather than minting a second one.
    const { data: existing } = await (supabase as any)
      .from('report_shares')
      .select('*')
      .eq('report_id', reportId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && isShareActive(existing as ReportShareRow)) {
      return NextResponse.json({ token: existing.token, url: `/report/${existing.token}` });
    }

    // Render the document once, with the caller's own visibility.
    const html = await buildScreenReportHtml(supabase, report);

    const token = generateShareToken();
    const htmlPath = `shares/${report.organization_id}/${token}.html`;

    const admin = getSupabaseAdminClient();
    // Plain 'text/html': the bucket's mime allowlist matches exactly, and the
    // public route adds the charset when it serves the bytes.
    const { error: uploadError } = await admin.storage
      .from(SHARE_BUCKET)
      .upload(htmlPath, html, { contentType: 'text/html', upsert: false });
    if (uploadError) {
      console.error('[report-share] Storage upload failed:', uploadError);
      return NextResponse.json({ error: 'Failed to store the shared document' }, { status: 500 });
    }

    const { error: insertError } = await (supabase as any)
      .from('report_shares')
      .insert({
        report_id: reportId,
        organization_id: report.organization_id,
        token,
        html_path: htmlPath,
        created_by: user.id,
      });
    if (insertError) {
      // Roll the orphaned document back out of Storage.
      await admin.storage.from(SHARE_BUCKET).remove([htmlPath]).catch(() => {});
      console.error('[report-share] Insert failed:', insertError);
      return NextResponse.json({ error: 'Failed to create the share link' }, { status: 500 });
    }

    return NextResponse.json({ token, url: `/report/${token}` });
  } catch (error) {
    console.error('[report-share] Create failed:', error);
    return NextResponse.json({ error: 'Failed to create the share link' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const supabase = getAuthedClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { data: shares } = await (supabase as any)
      .from('report_shares')
      .select('*')
      .eq('report_id', reportId)
      .is('revoked_at', null);
    if (!shares || shares.length === 0) {
      return NextResponse.json({ revoked: 0 });
    }

    const { error: revokeError } = await (supabase as any)
      .from('report_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('report_id', reportId)
      .is('revoked_at', null);
    if (revokeError) {
      console.error('[report-share] Revoke failed:', revokeError);
      return NextResponse.json({ error: 'Failed to revoke the share link' }, { status: 500 });
    }

    // Remove the stored documents too, so revocation really cuts access.
    const admin = getSupabaseAdminClient();
    const paths = (shares as ReportShareRow[]).map(s => s.html_path).filter(Boolean);
    if (paths.length > 0) {
      await admin.storage.from(SHARE_BUCKET).remove(paths).catch(() => {});
    }

    return NextResponse.json({ revoked: shares.length });
  } catch (error) {
    console.error('[report-share] Revoke failed:', error);
    return NextResponse.json({ error: 'Failed to revoke the share link' }, { status: 500 });
  }
}
