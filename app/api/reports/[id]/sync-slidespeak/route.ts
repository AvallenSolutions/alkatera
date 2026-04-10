import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reports/[id]/sync-slidespeak
 *
 * Polls SlideSpeak directly for the current status of a report's generation task
 * and updates the DB accordingly. Acts as a fallback when the webhook doesn't fire,
 * and as a diagnostic to see what SlideSpeak actually thinks about a stuck report.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const reportId = params.id;

  // Auth: accept a logged-in user token
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service role client for updates (bypass RLS)
  const serviceClient = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Look up report
  const { data: report, error: reportError } = await serviceClient
    .from('generated_reports')
    .select('id, status, slidespeak_task_id, document_url, error_message')
    .eq('id', reportId)
    .maybeSingle();

  if (reportError || !report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  if (!report.slidespeak_task_id) {
    return NextResponse.json({
      status: report.status,
      message: 'Report has no SlideSpeak task ID — nothing to sync',
    });
  }

  if (report.status === 'completed' || report.status === 'failed') {
    return NextResponse.json({
      status: report.status,
      documentUrl: report.document_url,
      errorMessage: report.error_message,
      message: 'Report is already in a terminal state',
    });
  }

  // Query SlideSpeak directly for current status
  const apiKey = process.env.SLIDESPEAK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'SLIDESPEAK_API_KEY is not configured' },
      { status: 500 }
    );
  }

  const statusResponse = await fetch(
    `https://api.slidespeak.co/api/v1/task_status/${report.slidespeak_task_id}`,
    { headers: { 'X-API-Key': apiKey } }
  );

  if (!statusResponse.ok) {
    const text = await statusResponse.text();
    return NextResponse.json(
      { error: `SlideSpeak API error: ${statusResponse.status} ${text}` },
      { status: 502 }
    );
  }

  const statusData = await statusResponse.json() as Record<string, any>;

  // Log the full response so we can see SlideSpeak's actual schema
  console.log(
    `[SlideSpeak Sync] task_id=${report.slidespeak_task_id} full response:`,
    JSON.stringify(statusData)
  );

  // Extract URL from any of the many shapes SlideSpeak may use
  function extractUrl(data: any): string | undefined {
    if (!data) return undefined;
    if (typeof data === 'string' && data.startsWith('http')) return data;
    if (typeof data !== 'object') return undefined;
    // Direct top-level fields
    const directCandidates = [
      data.url,
      data.download_url,
      data.presentation_url,
      data.file_url,
      data.pptx_url,
    ];
    for (const c of directCandidates) {
      if (typeof c === 'string' && c.startsWith('http')) return c;
    }
    // Nested under task_result
    if (data.task_result) {
      if (typeof data.task_result === 'string' && data.task_result.startsWith('http')) {
        return data.task_result;
      }
      if (typeof data.task_result === 'object') {
        const nestedCandidates = [
          data.task_result.url,
          data.task_result.download_url,
          data.task_result.presentation_url,
          data.task_result.file_url,
          data.task_result.pptx_url,
        ];
        for (const c of nestedCandidates) {
          if (typeof c === 'string' && c.startsWith('http')) return c;
        }
      }
    }
    // Nested under result
    if (data.result && typeof data.result === 'object') {
      const resultCandidates = [
        data.result.url,
        data.result.download_url,
        data.result.presentation_url,
        data.result.file_url,
        data.result.pptx_url,
      ];
      for (const c of resultCandidates) {
        if (typeof c === 'string' && c.startsWith('http')) return c;
      }
    }
    return undefined;
  }

  const slidespeakStatus: string | undefined = statusData.task_status || statusData.status;

  // Map SlideSpeak status and update DB if terminal
  if (slidespeakStatus === 'SUCCESS' || slidespeakStatus === 'success') {
    const downloadUrl = extractUrl(statusData);

    if (!downloadUrl) {
      // Store the raw response in error_message so we can see the actual schema
      await serviceClient
        .from('generated_reports')
        .update({
          status: 'failed',
          error_message: `SlideSpeak SUCCESS but no URL found. Raw response: ${JSON.stringify(statusData).slice(0, 2000)}`,
        })
        .eq('id', report.id);

      return NextResponse.json({
        status: 'failed',
        error: 'SlideSpeak SUCCESS but no URL found in response',
        slidespeakResponse: statusData,
      });
    }

    await serviceClient
      .from('generated_reports')
      .update({
        status: 'completed',
        document_url: downloadUrl,
        generated_at: new Date().toISOString(),
      })
      .eq('id', report.id);

    return NextResponse.json({
      status: 'completed',
      documentUrl: downloadUrl,
      slidespeakResponse: statusData,
    });
  }

  if (slidespeakStatus === 'FAILED' || slidespeakStatus === 'failed') {
    await serviceClient
      .from('generated_reports')
      .update({
        status: 'failed',
        error_message: 'SlideSpeak generation failed',
      })
      .eq('id', report.id);

    return NextResponse.json({
      status: 'failed',
      error: 'SlideSpeak generation failed',
      slidespeakResponse: statusData,
    });
  }

  // Still pending/processing
  return NextResponse.json({
    status: report.status,
    slidespeakStatus,
    message: 'SlideSpeak is still processing this task',
    slidespeakResponse: statusData,
  });
}
