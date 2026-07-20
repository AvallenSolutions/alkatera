import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';
import { enforceExportAllowed } from '@/middleware/subscription-check';
import { enforceProvenanceGate } from '@/lib/provenance/gate';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * Generate Sustainability Report PDF (dispatch only)
 *
 * POST /api/reports/[id]/generate-pdf
 *
 * Authorises the caller (Bearer token; the RLS-scoped report fetch doubles
 * as the ownership check), marks the report as generating and dispatches
 * 'reports/pdf.generate'. The pipeline itself (data assembly, AI narratives,
 * PDFShift, storage upload) runs in lib/inngest/functions/reports.ts — it
 * takes 40-90s, which blew this route's synchronous budget and produced
 * gateway timeouts after the AI/PDFShift spend was already incurred.
 *
 * The frontend polls generated_reports for status + document_url, so the
 * 202 response needs no payload beyond acknowledgement.
 */

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    // Auth via Bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // RLS-scoped fetch: returns nothing unless the caller can see the report.
    const { data: report, error: reportError } = await supabase
      .from('generated_reports')
      .select('id, organization_id')
      .eq('id', reportId)
      .single();
    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Report PDF generation is a paid feature — blocked on trial / read-only.
    const exportBlocked = await enforceExportAllowed(report.organization_id);
    if (exportBlocked) return exportBlocked;

    // External artefact: needs enough confirmed data across the whole footprint first (Pillar 2).
    const provenanceBlocked = await enforceProvenanceGate(supabase, report.organization_id, 'overall');
    if (provenanceBlocked) return provenanceBlocked;

    await supabase
      .from('generated_reports')
      .update({ status: 'aggregating_data', error_message: null, updated_at: new Date().toISOString() })
      .eq('id', reportId);

    await inngest.send({ name: 'reports/pdf.generate', data: { report_id: reportId } });

    return NextResponse.json({ queued: true, reportId }, { status: 202 });
  } catch (error: any) {
    console.error('Error dispatching sustainability report PDF generation:', error);
    return NextResponse.json(
      { error: 'Failed to queue PDF generation' },
      { status: 500 }
    );
  }
}
