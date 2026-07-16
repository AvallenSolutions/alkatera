/**
 * Rosa — file uploads.
 *
 * POST /api/rosa/uploads
 * Multipart form with a single `file` field (PDF, PNG, JPEG, WebP, GIF).
 * Stores the file in the ingest-staging Supabase Storage bucket — the same
 * bucket every Smart Upload channel stashes into (data-revolution-plan.md
 * Pillar 1: one classifier, one learning substrate) — under
 * `{organization_id}/{user_id}/{uuid}-{safe_filename}`, and creates a real
 * ingest_jobs row (channel='rosa') so the extract step can classify it
 * through the shared Claude classifier. Returns the storage path as
 * `file_id` (for the user to attach to the next chat message, unchanged
 * contract) plus the new `job_id`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import {
  buildUploadPath,
  inferMediaType,
  isSupportedMediaType,
  ROSA_UPLOAD_BUCKET,
} from '@/lib/rosa/document-extraction';
import { checkRateLimit } from '@/lib/rosa/rate-limiter';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_RATE_LIMIT = 10; // per minute

export async function POST(request: NextRequest) {
  const userSupabase = getSupabaseServerClient();
  const { data: { user }, error: userErr } = await userSupabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const rl = checkRateLimit(`upload:${user.id}`, UPLOAD_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many uploads. Please wait ${Math.ceil(rl.retryAfterMs / 1000)} seconds.` },
      { status: 429 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 500 });
  }
  const service = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Member OR active advisor for the caller's selected org (advisor reads honoured).
  const organizationId = await resolveAccessibleOrg(service, user);
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 });
  }

  const mediaType = inferMediaType(file.name, file.type);
  if (!mediaType || !isSupportedMediaType(mediaType)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Upload a PDF, PNG, JPG, WebP, or GIF.' },
      { status: 415 },
    );
  }

  const fileUuid = randomUUID();
  const path = buildUploadPath(organizationId, user.id, fileUuid, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await service.storage
    .from(ROSA_UPLOAD_BUCKET)
    .upload(path, buffer, {
      contentType: mediaType,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Real ingest_jobs row so the extract step (next request) can classify
  // through the shared Claude classifier and the confirm step can teach
  // ingest_document_profiles via /api/ingest/feedback, exactly like every
  // other Smart Upload channel.
  const { data: job, error: jobError } = await service
    .from('ingest_jobs')
    .insert({
      user_id: user.id,
      organization_id: organizationId,
      status: 'pending',
      phase_message: 'Queued…',
      stash_path: path,
      file_name: file.name,
      file_mime: mediaType,
      channel: 'rosa',
    })
    .select('id')
    .single();
  if (jobError || !job) {
    console.error('[rosa/uploads] ingest_jobs insert failed:', jobError);
    // The file itself is safely stashed; only the classify step degrades.
    // Fail the request rather than hand back a file_id the extract step
    // cannot classify — the client re-uploads on error, same as any other
    // upload failure.
    return NextResponse.json({ error: 'Could not start document processing' }, { status: 500 });
  }

  return NextResponse.json({
    file_id: path,
    job_id: job.id,
    filename: file.name,
    media_type: mediaType,
    size_bytes: file.size,
  });
}
