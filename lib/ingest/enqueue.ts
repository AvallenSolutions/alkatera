import 'server-only'
import { createHmac } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyDocument, shapeIngestResult } from '@/lib/ingest/classify-document'
import { buildIngestOrgContext } from '@/lib/ingest/org-context'

/**
 * Shared core of the Smart Upload enqueue path: stash a file into
 * ingest-staging, create its ingest_jobs row, and either classify it inline
 * or hand it to the background Netlify function — the same decision
 * `app/api/ingest/auto/route.ts` (the browser dropzone endpoint) makes.
 *
 * Extracted so every intake channel (Rosa drawer, supplier smart-import,
 * and now email-in — data-revolution-plan.md Pillar 1) benefits from one
 * classification path and one ingest_document_profiles learning loop
 * instead of duplicating the inline/background split. The HTTP route keeps
 * everything that's genuinely request-shaped — auth, per-org rate limiting,
 * read-only-advisor and access checks, multipart parsing — and calls
 * `enqueueIngestJob` for the rest. The IMAP poller
 * (lib/inngest/functions/email-intake.ts) has no HTTP request to parse and
 * calls it directly with bytes read off the message.
 */

export type IngestChannel = 'rosa' | 'supplier_import' | 'email_intake' | null

export interface IngestFileInput {
  bytes: Uint8Array
  name: string
  /** MIME type if known; empty string is fine, callers downstream treat it as unknown. */
  mime: string
  size: number
}

export interface EnqueueIngestJobParams {
  serviceClient: SupabaseClient
  organizationId: string
  userId: string
  file: IngestFileInput
  channel?: IngestChannel
  /**
   * Base URL to reach this deployment's Netlify functions for the
   * background-trigger fetch (e.g. `https://app.alkatera.com`). Falls back
   * to `URL`/`DEPLOY_URL` (set by Netlify on every function invocation) when
   * omitted, so background-eligible callers outside an HTTP request (the
   * email poller) still work without passing anything.
   */
  baseUrl?: string | null
}

export interface EnqueueIngestJobResult {
  jobId: string
  /** True if the file was classified inline before this call returned. */
  inline: boolean
}

// Kept in step with app/api/ingest/auto/route.ts — see that file for the
// reasoning behind each threshold.
const INLINE_FALLBACK_MAX_BYTES = 5 * 1024 * 1024
const INLINE_MAX_PDF_PAGES = 8
const TRIGGER_TIMEOUT_MS = 4000

function estimatePdfPageCount(bytes: Uint8Array): number | null {
  try {
    const text = Buffer.from(bytes).toString('latin1')
    const matches = text.match(/\/Type\s*\/Page[^s]/g)
    return matches ? matches.length : null
  } catch {
    return null
  }
}

async function stashBytes(
  serviceClient: SupabaseClient,
  orgId: string,
  userId: string,
  file: IngestFileInput,
): Promise<string | null> {
  try {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const path = `${orgId}/${userId}/${unique}`
    const { error } = await serviceClient.storage
      .from('ingest-staging')
      .upload(path, Buffer.from(file.bytes), {
        contentType: file.mime || 'application/octet-stream',
        upsert: false,
      })
    if (error) {
      console.error('[ingest/enqueue] Stash upload failed:', error.message)
      return null
    }
    return path
  } catch (err: any) {
    console.error('[ingest/enqueue] Stash unexpected error:', err?.message)
    return null
  }
}

async function triggerBackground(target: string, hmacSecret: string, jobId: string): Promise<boolean> {
  const triggerPayload = JSON.stringify({ jobId })
  const signature = createHmac('sha256', hmacSecret).update(triggerPayload).digest('hex')
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), TRIGGER_TIMEOUT_MS)
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-hmac': signature },
      body: triggerPayload,
      signal: ctrl.signal,
    })
    return res.status >= 200 && res.status < 300
  } catch (err: any) {
    console.error('[ingest/enqueue] trigger fetch failed:', err?.name, err?.message)
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function runInlineClassifier(
  serviceClient: SupabaseClient,
  jobId: string,
  file: IngestFileInput,
  stashPath: string,
  organizationId: string,
): Promise<void> {
  const updateJob = (patch: Record<string, any>) =>
    (serviceClient as any)
      .from('ingest_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId)
  try {
    await updateJob({ status: 'extracting', phase_message: 'Reading the document…' })
    const orgContext = await buildIngestOrgContext(serviceClient, organizationId).catch(() => null)
    const result = await classifyDocument({
      fileBytes: file.bytes,
      fileName: file.name,
      fileMime: file.mime,
      orgContext: orgContext ?? undefined,
    })
    const shaped = shapeIngestResult(result.type, result.payload, stashPath, result.meta)
    await updateJob({
      status: 'completed',
      phase_message: null,
      result_type: shaped.result_type,
      result_payload: shaped.result_payload,
    })
  } catch (err: any) {
    console.error('[ingest/enqueue] Inline classifier failed:', err)
    await updateJob({
      status: 'failed',
      error: err?.message?.slice(0, 500) || 'Inline classification failed',
    })
  }
}

/**
 * Stash a file, create its ingest_jobs row, and classify it inline or hand
 * it to the background Netlify function — mirroring exactly what
 * `POST /api/ingest/auto` does for a browser upload. Always resolves (never
 * throws past the job-creation step); a background-trigger failure is
 * recorded on the job row itself, matching the poll UI's existing failure
 * vocabulary, and this function returns normally either way.
 */
export async function enqueueIngestJob(params: EnqueueIngestJobParams): Promise<EnqueueIngestJobResult> {
  const { serviceClient, organizationId, userId, file, channel = null, baseUrl } = params

  const stashPath = await stashBytes(serviceClient, organizationId, userId, file)
  if (!stashPath) throw new Error('Failed to stash uploaded file')

  const { data: job, error: insertErr } = await (serviceClient as any)
    .from('ingest_jobs')
    .insert({
      user_id: userId,
      organization_id: organizationId,
      status: 'pending',
      phase_message: 'Queued…',
      stash_path: stashPath,
      file_name: file.name,
      file_mime: file.mime || null,
      channel,
    })
    .select('id')
    .single()

  if (insertErr || !job) {
    console.error('[ingest/enqueue] Failed to create job:', insertErr)
    throw new Error('Failed to start ingest')
  }

  const isPdf = (file.mime || '').includes('pdf') || file.name.toLowerCase().endsWith('.pdf')
  let inlineEligible = file.size <= INLINE_FALLBACK_MAX_BYTES
  if (inlineEligible && isPdf) {
    const pageCount = estimatePdfPageCount(file.bytes)
    if (pageCount != null && pageCount > INLINE_MAX_PDF_PAGES) {
      inlineEligible = false
    }
  }

  if (inlineEligible) {
    await runInlineClassifier(serviceClient, job.id, file, stashPath, organizationId)
    return { jobId: job.id, inline: true }
  }

  const hmacSecret = process.env.INTERNAL_JOB_HMAC_SECRET
  const resolvedBaseUrl = baseUrl ?? process.env.URL ?? process.env.DEPLOY_URL ?? null
  const target = resolvedBaseUrl ? `${resolvedBaseUrl}/.netlify/functions/ingest-auto-background` : null

  const triggerOk =
    hmacSecret && target
      ? await triggerBackground(target, hmacSecret, job.id).catch((err) => {
          console.error('[ingest/enqueue] Background trigger error:', err)
          return false
        })
      : false

  if (!triggerOk) {
    await (serviceClient as any)
      .from('ingest_jobs')
      .update({
        status: 'failed',
        error:
          'This file is too large for synchronous processing and the background processor is unavailable. Try uploading a smaller (< 5MB) version, or contact support.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
  }

  return { jobId: job.id, inline: false }
}
