import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/api-client'
import { classifyDocument, shapeIngestResult } from '@/lib/ingest/classify-document'
import { titleAndSummaryForExceptionPayload } from '@/lib/agents/exception-format'
import { safeCompare } from '@/lib/utils/safe-compare'

export const runtime = 'nodejs'
export const maxDuration = 60

// ───────────────────────────────────────────────────────────────────────────
// Email-in ingest webhook.
//
// Each managed-tier org has a unique forwarding address stored on
// organizations.agent_inbox_address (e.g. "inbox-<orgId>@ingest.alkatera.com").
// Customers forward utility bills, supplier replies, etc. to that address.
// The MX/forwarding pipeline (Cloudflare Email Routing → webhook, or Resend
// inbound) POSTs the parsed message here.
//
// Expected webhook shape (provider-agnostic, kept loose so we can swap):
//   {
//     to: string                    // forwarding address (used to look up org)
//     from: string
//     subject?: string
//     attachments: Array<{
//       filename: string
//       contentType: string
//       contentBase64: string       // base64-encoded file bytes
//     }>
//   }
//
// Auth: shared secret in `x-ingest-email-secret` header — the email
// forwarder is the only thing that should be able to call this endpoint.
//
// Per attachment:
//   1. Stash the file in ingest-staging
//   2. Insert an ingest_jobs row attached to the org's owner user
//   3. Run the classifier inline (small files) — same path /api/ingest/auto
//      uses for its inline fallback
//   4. Lift the result into agent_exceptions so it shows up in the queue
//
// We don't poll Resend / wait for the user to refresh: the exception is
// created synchronously, and the email body is preserved in source_ref
// for the user to see context.
// ───────────────────────────────────────────────────────────────────────────

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10MB per attachment

interface EmailWebhookPayload {
  to: string
  from?: string
  subject?: string
  attachments?: Array<{
    filename?: string
    contentType?: string
    contentBase64?: string
  }>
  bodyText?: string
}

async function stashAttachment(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  bytes: Uint8Array,
  filename: string,
  contentType: string,
  orgId: string,
  ownerUserId: string,
): Promise<string | null> {
  try {
    const ext = (filename.split('.').pop() || 'bin').toLowerCase()
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const path = `${orgId}/${ownerUserId}/email/${unique}`
    const { error } = await admin.storage.from('ingest-staging').upload(path, bytes, {
      contentType: contentType || 'application/octet-stream',
      upsert: false,
    })
    if (error) {
      console.error('[ingest/email] stash failed:', error.message)
      return null
    }
    return path
  } catch (err: any) {
    console.error('[ingest/email] stash error:', err?.message)
    return null
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.INGEST_EMAIL_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Email ingest not configured' }, { status: 500 })
  }
  const provided = request.headers.get('x-ingest-email-secret') || ''
  if (!safeCompare(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as EmailWebhookPayload
  if (!body.to) {
    return NextResponse.json({ error: 'Missing recipient' }, { status: 400 })
  }
  const attachments = body.attachments || []
  if (attachments.length === 0) {
    // Nothing to do, but accept the webhook so the forwarder doesn't retry.
    return NextResponse.json({ ok: true, message: 'No attachments — nothing to ingest' })
  }

  const admin = getSupabaseAdminClient()

  // Look up the org by its agent_inbox_address. The address is set per-org
  // when managed_footprint is enabled.
  const inboxAddress = body.to.trim().toLowerCase()
  const { data: org, error: orgErr } = await (admin as any)
    .from('organizations')
    .select('id, name, managed_footprint_enabled')
    .eq('agent_inbox_address', inboxAddress)
    .maybeSingle()

  if (orgErr || !org) {
    console.warn('[ingest/email] no org for address', inboxAddress)
    return NextResponse.json({ error: 'No organisation matched recipient' }, { status: 404 })
  }
  if (!org.managed_footprint_enabled) {
    return NextResponse.json(
      { error: 'Managed footprint is not enabled for this organisation' },
      { status: 403 },
    )
  }

  // Owner user — the email-in path needs a user to attach the ingest_job
  // to (foreign-key constraint). Use the org owner; if none, the first
  // member.
  const { data: ownerMember } = await (admin as any)
    .from('organization_members')
    .select('user_id, role_id, roles ( name )')
    .eq('organization_id', org.id)
    .order('joined_at', { ascending: true })
    .limit(20)

  const owner =
    (ownerMember || []).find((m: any) => m.roles?.name === 'owner') ||
    (ownerMember || [])[0]
  if (!owner) {
    return NextResponse.json({ error: 'No member to attribute job to' }, { status: 500 })
  }

  const results: Array<{ filename: string; ok: boolean; error?: string; exceptionId?: string }> = []

  for (const att of attachments) {
    const filename = att.filename || 'attachment'
    if (!att.contentBase64) {
      results.push({ filename, ok: false, error: 'No content' })
      continue
    }
    const bytes = Buffer.from(att.contentBase64, 'base64')
    if (bytes.length > MAX_ATTACHMENT_BYTES) {
      results.push({ filename, ok: false, error: 'Attachment exceeds size limit' })
      continue
    }

    const stashPath = await stashAttachment(
      admin,
      new Uint8Array(bytes),
      filename,
      att.contentType || 'application/octet-stream',
      org.id,
      owner.user_id,
    )
    if (!stashPath) {
      results.push({ filename, ok: false, error: 'Stash failed' })
      continue
    }

    const { data: job, error: jobErr } = await (admin as any)
      .from('ingest_jobs')
      .insert({
        user_id: owner.user_id,
        organization_id: org.id,
        status: 'extracting',
        phase_message: 'Email ingest — classifying…',
        stash_path: stashPath,
        file_name: filename,
        file_mime: att.contentType || null,
      })
      .select('id')
      .single()

    if (jobErr || !job) {
      results.push({ filename, ok: false, error: jobErr?.message || 'job create failed' })
      continue
    }

    let result_type: string = 'unsupported'
    let result_payload: Record<string, unknown> = { type: 'unsupported' }
    try {
      const classified = await classifyDocument({
        fileBytes: new Uint8Array(bytes),
        fileName: filename,
        fileMime: att.contentType || '',
      })
      const shaped = shapeIngestResult(classified.type, classified.payload, '')
      result_type = shaped.result_type
      result_payload = shaped.result_payload
      await (admin as any)
        .from('ingest_jobs')
        .update({
          status: 'completed',
          phase_message: null,
          result_type,
          result_payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
    } catch (err: any) {
      console.error('[ingest/email] classify failed:', err)
      await (admin as any)
        .from('ingest_jobs')
        .update({
          status: 'failed',
          error: err?.message?.slice(0, 500) || 'classifier failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      results.push({ filename, ok: false, error: 'classifier failed' })
      continue
    }

    if (result_type === 'unsupported') {
      results.push({ filename, ok: true, error: 'Classified as unsupported — not queued' })
      continue
    }

    const formatted = titleAndSummaryForExceptionPayload(result_type, result_payload, {
      fileName: filename,
    })

    const { data: created, error: insertErr } = await (admin as any)
      .from('agent_exceptions')
      .insert({
        organization_id: org.id,
        kind: result_type,
        source: 'email',
        source_ref: {
          ingestJobId: job.id,
          fileName: filename,
          fromAddress: body.from || null,
          subject: body.subject || null,
        },
        payload: result_payload,
        title: formatted.title,
        summary: formatted.summary,
        confidence: formatted.confidence,
        status: 'open',
      })
      .select('id')
      .single()

    if (insertErr) {
      // Duplicate (already queued) — not an error, just skip.
      if (insertErr.code === '23505') {
        results.push({ filename, ok: true })
      } else {
        results.push({ filename, ok: false, error: insertErr.message })
      }
      continue
    }
    results.push({ filename, ok: true, exceptionId: created.id })
  }

  return NextResponse.json({ ok: true, results })
}
