import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface WebhookPayload {
  task_id: string;
  task_status: 'SUCCESS' | 'FAILED' | 'success' | 'failed';
  task_result?: {
    url?: string;
    presentation_id?: string;
    request_id?: string;
  } | null;
  task_info?: {
    request_id?: string;
  } | null;
  error?: string;
}

/**
 * SlideSpeak Webhook Receiver
 *
 * Called by SlideSpeak when a presentation generation completes or fails.
 * Looks up the report by slidespeak_task_id and updates its status.
 *
 * Security: validates a shared secret passed as ?secret=... on the registered URL.
 */
export async function POST(request: NextRequest) {
  // Validate shared secret
  const secret = request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.SLIDESPEAK_WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.error('[SlideSpeak Webhook] SLIDESPEAK_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  if (secret !== expectedSecret) {
    console.warn('[SlideSpeak Webhook] Invalid secret received');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json() as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('[SlideSpeak Webhook] Received payload:', JSON.stringify(payload));

  const { task_id, task_status, task_result, error } = payload;

  if (!task_id) {
    return NextResponse.json({ error: 'Missing task_id' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Look up the report by slidespeak_task_id
  const { data: report, error: lookupError } = await supabase
    .from('generated_reports')
    .select('id')
    .eq('slidespeak_task_id', task_id)
    .maybeSingle();

  if (lookupError) {
    console.error('[SlideSpeak Webhook] DB lookup error:', lookupError);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!report) {
    console.warn(`[SlideSpeak Webhook] No report found for task_id=${task_id}`);
    return NextResponse.json({ received: true });
  }

  const statusUpper = task_status?.toUpperCase();

  if (statusUpper === 'SUCCESS') {
    // Get the request_id and fetch the actual download URL from SlideSpeak
    const requestId = task_result?.request_id || payload.task_info?.request_id;
    let downloadUrl: string | undefined = task_result?.url;

    if (!downloadUrl && requestId) {
      const apiKey = process.env.SLIDESPEAK_API_KEY;
      if (apiKey) {
        try {
          const downloadResponse = await fetch(
            `https://api.slidespeak.co/api/v1/presentation/download/${requestId}`,
            { headers: { 'X-API-Key': apiKey } }
          );
          if (downloadResponse.ok) {
            const downloadData = await downloadResponse.json() as Record<string, any>;
            downloadUrl = downloadData.url || downloadData.download_url || downloadData.presentation_url;
          } else {
            const text = await downloadResponse.text();
            console.error(`[SlideSpeak Webhook] download endpoint failed: ${downloadResponse.status} ${text}`);
          }
        } catch (err) {
          console.error('[SlideSpeak Webhook] download endpoint threw:', err);
        }
      }
    }

    if (!downloadUrl) {
      await supabase
        .from('generated_reports')
        .update({
          status: 'failed',
          error_message: `SlideSpeak SUCCESS but no URL found. Raw payload: ${JSON.stringify(payload).slice(0, 2000)}`,
        })
        .eq('id', report.id);

      return NextResponse.json({ received: true });
    }

    const { error: updateError } = await supabase
      .from('generated_reports')
      .update({
        status: 'completed',
        document_url: downloadUrl,
        generated_at: new Date().toISOString(),
      })
      .eq('id', report.id);

    if (updateError) {
      console.error('[SlideSpeak Webhook] Failed to update report to completed:', updateError);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    console.log(`[SlideSpeak Webhook] Report ${report.id} completed. task_id=${task_id}`);
  } else {
    // FAILED
    const errorMessage = error || 'SlideSpeak generation failed';

    const { error: updateError } = await supabase
      .from('generated_reports')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', report.id);

    if (updateError) {
      console.error('[SlideSpeak Webhook] Failed to update report to failed:', updateError);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    console.error(`[SlideSpeak Webhook] Report ${report.id} failed. task_id=${task_id}, error=${errorMessage}`);
  }

  return NextResponse.json({ received: true });
}
