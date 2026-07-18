import { NextRequest, NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/reports/route-auth';
import { assembleReportData } from '@/lib/reports/assemble-report-data';
import { buildNarratives, buildDraftSnapshot, TONE_OVERRIDES } from '@/lib/reports/build-narratives';
import { applyNarrativeEdits, NarrativeEditError, type NarrativeEditPatch, type ReportDataSnapshot } from '@/lib/reports/narrative-store';
import { enforceExportAllowed } from '@/middleware/subscription-check';

/**
 * Draft-then-edit narratives (Phase C).
 *
 * POST  /api/reports/[id]/narratives — assemble data and draft every
 *       narrative block into data_snapshot. Body: { toneOverride?, force? }.
 *       Only valid while the report is in 'draft'; the AI spend is gated the
 *       same way shipping is (trial orgs cannot burn generations they can
 *       never ship).
 * PATCH /api/reports/[id]/narratives — persist human edits. The server
 *       flips aiGenerated flags itself; acceptForeword also copies the
 *       message into config.branding.leadership (the only path to print).
 *
 * Every write carries .eq('status','draft') as the race lock: shipping
 * moves the status, so a late draft write affects zero rows and 409s.
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

async function fetchDraftReport(supabase: NonNullable<ReturnType<typeof getAuthedClient>>, reportId: string) {
  const { data: report, error } = await supabase
    .from('generated_reports')
    .select('*')
    .eq('id', reportId)
    .single();
  if (error || !report) return { report: null, response: NextResponse.json({ error: 'Report not found' }, { status: 404 }) };
  if (report.status !== 'draft') {
    return { report: null, response: NextResponse.json({ error: 'This report has already been shipped' }, { status: 409 }) };
  }
  return { report, response: null };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const supabase = getAuthedClient(request);
    if (!supabase) return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { report, response } = await fetchDraftReport(supabase, reportId);
    if (!report) return response!;

    const exportBlocked = await enforceExportAllowed(report.organization_id);
    if (exportBlocked) return exportBlocked;

    const body = await request.json().catch(() => ({}));
    const toneOverride: string | null =
      typeof body.toneOverride === 'string' && TONE_OVERRIDES[body.toneOverride]
        ? body.toneOverride
        : null;

    const config = { ...(report.config ?? {}), toneOverride: toneOverride ?? undefined };
    const reportWithTone = { ...report, config };

    const { config: assembledConfig, reportData } = await assembleReportData(supabase, reportWithTone);

    // Tone changes MUST bypass the assistants' caches (their keys ignore tone).
    const storedTone = (report.data_snapshot as ReportDataSnapshot | null)?.narrative_meta?.tone_override ?? null;
    const force = body.force === true || toneOverride !== storedTone;

    const built = await buildNarratives({ config: assembledConfig, reportData, force, includeForeword: true });
    const snapshot = buildDraftSnapshot(built, reportData);

    const { data: updated, error: updateError } = await supabase
      .from('generated_reports')
      .update({
        data_snapshot: snapshot,
        config,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .eq('status', 'draft')
      .select('id');
    if (updateError) {
      console.error('[narratives] Draft write failed:', updateError);
      return NextResponse.json({ error: 'Failed to store the drafts' }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'This report has already been shipped' }, { status: 409 });
    }

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error('[narratives] Draft generation failed:', error);
    return NextResponse.json({ error: 'Failed to draft the narratives' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const supabase = getAuthedClient(request);
    if (!supabase) return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { report, response } = await fetchDraftReport(supabase, reportId);
    if (!report) return response!;

    const patch = (await request.json().catch(() => ({}))) as NarrativeEditPatch;

    let result;
    try {
      result = applyNarrativeEdits(report.data_snapshot as ReportDataSnapshot, patch);
    } catch (err) {
      if (err instanceof NarrativeEditError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const updates: Record<string, any> = {
      data_snapshot: result.snapshot,
      updated_at: new Date().toISOString(),
    };
    if (result.acceptedForewordMessage !== null) {
      const config = (report.config ?? {}) as Record<string, any>;
      updates.config = {
        ...config,
        branding: {
          ...(config.branding ?? {}),
          leadership: {
            ...(config.branding?.leadership ?? {}),
            message: result.acceptedForewordMessage,
          },
        },
      };
    }

    const { data: updated, error: updateError } = await supabase
      .from('generated_reports')
      .update(updates)
      .eq('id', reportId)
      .eq('status', 'draft')
      .select('id');
    if (updateError) {
      console.error('[narratives] Edit write failed:', updateError);
      return NextResponse.json({ error: 'Failed to save the edits' }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'This report has already been shipped' }, { status: 409 });
    }

    return NextResponse.json({ snapshot: result.snapshot });
  } catch (error) {
    console.error('[narratives] Edit failed:', error);
    return NextResponse.json({ error: 'Failed to save the edits' }, { status: 500 });
  }
}
