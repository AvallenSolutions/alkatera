import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface WebhookPayload {
  task_id: string;
  task_status: 'SUCCESS' | 'FAILED';
  task_result?: { url?: string } | null;
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
    // Unknown task — could be a duplicate delivery or stale webhook; ignore safely
    console.warn(`[SlideSpeak Webhook] No report found for task_id=${task_id}`);
    return NextResponse.json({ received: true });
  }

  if (task_status === 'SUCCESS') {
    const downloadUrl = task_result?.url;

    if (!downloadUrl) {
      console.error(`[SlideSpeak Webhook] SUCCESS but no download URL for task_id=${task_id}`);
      await supabase
        .from('generated_reports')
        .update({
          status: 'failed',
          error_message: 'SlideSpeak reported success but provided no download URL',
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

  // Always return 200 quickly — SlideSpeak expects fast acknowledgement
  return NextResponse.json({ received: true });
}
