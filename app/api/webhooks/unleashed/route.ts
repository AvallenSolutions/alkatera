import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptConfig } from '@/lib/crypto/config-encryption'
import { verifyUnleashedWebhook, type UnleashedWebhookPayload } from '@/lib/integrations/unleashed/webhooks'

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

// POST /api/webhooks/unleashed?organizationId=…
//
// Unleashed posts events here. We verify the HMAC signature against the
// signing key stashed on integration_connections.encrypted_config.webhookKey,
// log the event, and queue follow-up work. The query-string organizationId is
// the lookup hint — we do NOT trust it for auth (signature verification does that).
//
// Headers expected:
//   x-unleashed-signature  (base64 HMAC-SHA256)
//   x-unleashed-timestamp  (Unix seconds)

export async function POST(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get('organizationId')
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId query param required' }, { status: 400 })
  }

  // Read body as raw text — we MUST hash exactly what arrived on the wire.
  const rawBody = await request.text()

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: noStoreFetch } },
  )

  const { data: conn } = await serviceClient
    .from('integration_connections')
    .select('encrypted_config, status')
    .eq('organization_id', organizationId)
    .eq('provider_slug', 'unleashed')
    .maybeSingle()
  if (!conn) {
    return NextResponse.json({ error: 'No Unleashed connection for this org' }, { status: 404 })
  }

  let signingKey: string | null = null
  try {
    const cfg = decryptConfig<{ apiId: string; apiKey: string; webhookKey?: string }>(
      conn.encrypted_config,
    )
    signingKey = cfg.webhookKey ?? null
  } catch (err) {
    console.error('[unleashed/webhook] Could not decrypt config:', err)
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
  }
  if (!signingKey) {
    return NextResponse.json(
      { error: 'No webhook signing key on file — recreate the subscription.' },
      { status: 409 },
    )
  }

  const verification = verifyUnleashedWebhook({
    signatureHeader: request.headers.get('x-unleashed-signature'),
    timestampHeader: request.headers.get('x-unleashed-timestamp'),
    rawBody,
    signingKey,
  })

  let payload: UnleashedWebhookPayload | null = null
  try {
    payload = JSON.parse(rawBody) as UnleashedWebhookPayload
  } catch {
    payload = null
  }

  await serviceClient.from('unleashed_webhook_events').insert({
    organization_id: organizationId,
    event_type: payload?.EventType ?? 'unknown',
    object_type: payload?.ObjectType ?? null,
    object_id: payload?.ObjectId ?? null,
    signature_valid: verification.ok,
    processed: false,
    process_error: verification.ok ? null : `Verification failed: ${verification.reason}`,
    payload: payload ?? { raw: rawBody },
  })

  if (!verification.ok) {
    return NextResponse.json(
      { error: `Signature verification failed: ${verification.reason}` },
      { status: 401 },
    )
  }

  // Acknowledge fast. Actual processing (re-fetch the changed object and
  // re-run the relevant import-helper) is intentionally deferred — that work
  // belongs in a background worker so the webhook ack stays under Unleashed's
  // timeout budget. For v1 we just persist the event log; a subsequent
  // commit will wire processing.
  return NextResponse.json({ received: true })
}
