import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  verifyResendWebhook,
  invitationStatusForEvent,
  shouldOverwriteStatus,
} from '@/lib/email/resend-webhook';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * POST /api/webhooks/resend
 *
 * Delivery events for outbound platform email. Resend accepts a send with an
 * HTTP 200 and only tells you about a bounce afterwards, out of band — so
 * without this endpoint a hard bounce is invisible to the product. That is
 * exactly how sixteen ESG surveys sent by London Botanical Drinks on 7 Jul 2026
 * appeared "sent" for two weeks while none of them had been delivered.
 *
 * Every event is logged to email_delivery_events. Events that carry a delivery
 * outcome additionally update the matching supplier_invitations row so the
 * brand sees "bounced" in their supplier list.
 *
 * Configure in Resend with the signing secret in RESEND_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed. An unauthenticated writer into this table would let anyone
    // mark a competitor's invitations as bounced.
    console.error('[resend/webhook] RESEND_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  // Read the body as raw text: we MUST hash exactly what arrived on the wire,
  // before any JSON round-trip reorders keys or changes whitespace.
  const rawBody = await request.text();

  const svixId = request.headers.get('svix-id');
  const verification = verifyResendWebhook(
    rawBody,
    {
      id: svixId,
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    },
    secret,
  );

  if (!verification.valid) {
    console.warn('[resend/webhook] Rejected delivery:', verification.reason);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Malformed JSON body' }, { status: 400 });
  }

  const eventType: string | undefined = event?.type;
  if (!eventType) {
    return NextResponse.json({ error: 'Missing event type' }, { status: 400 });
  }

  const data = event.data ?? {};
  const emailId: string | null = data.email_id ?? null;
  const recipient: string | null = Array.isArray(data.to) ? data.to[0] ?? null : data.to ?? null;
  const subject: string | null = data.subject ?? null;

  // Resend nests the human-readable cause differently per event type.
  const reason: string | null =
    data.bounce?.message ??
    data.failed?.reason ??
    data.suppressed?.reason ??
    null;

  const occurredAt: string = event.created_at ?? data.created_at ?? new Date().toISOString();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: noStoreFetch } },
  );

  // 1. Always log the raw event. Svix retries on any non-2xx, so this upserts
  //    on the Svix message id to stay idempotent under redelivery.
  const { error: logError } = await supabase
    .from('email_delivery_events')
    .upsert(
      {
        provider: 'resend',
        provider_event_id: svixId,
        provider_email_id: emailId,
        event_type: eventType,
        recipient,
        subject,
        reason,
        occurred_at: occurredAt,
        payload: event,
      },
      { onConflict: 'provider_event_id', ignoreDuplicates: false },
    );

  if (logError) {
    // Return 500 so Svix retries rather than dropping the event on the floor.
    console.error('[resend/webhook] Could not log event:', logError);
    return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
  }

  // 2. Reflect delivery outcomes onto the invitation the email belongs to.
  const status = invitationStatusForEvent(eventType);
  if (status && emailId) {
    const { data: invitation } = await supabase
      .from('supplier_invitations')
      .select('id, email_status')
      .eq('email_provider_id', emailId)
      .maybeSingle();

    if (invitation && shouldOverwriteStatus(invitation.email_status, status)) {
      const { error: updateError } = await supabase
        .from('supplier_invitations')
        .update({
          email_status: status,
          email_status_at: occurredAt,
          email_error: reason,
        })
        .eq('id', invitation.id);

      if (updateError) {
        console.error('[resend/webhook] Could not update invitation:', updateError);
        return NextResponse.json({ error: 'Could not update invitation' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
