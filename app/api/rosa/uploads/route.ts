/**
 * Rosa — file uploads.
 *
 * POST /api/rosa/uploads
 * Multipart form with a single `file` field (PDF, PNG, JPEG, WebP, GIF).
 * Stores the file in the rosa-uploads Supabase Storage bucket under
 * `{organization_id}/{user_id}/{uuid}-{safe_filename}` and returns the path
 * as `file_id` for the user to attach to the next chat message.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { buildUploadPath, inferMediaType, isSupportedMediaType } from '@/lib/rosa/document-extraction';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const userSupabase = getSupabaseServerClient();
  const { data: { user }, error: userErr } = await userSupabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const { data: membership } = await userSupabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'No organisation membership' }, { status: 403 });
  }
  const organizationId = (membership as any).organization_id as string;

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 500 });
  }
  const service = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const fileUuid = randomUUID();
  const path = buildUploadPath(organizationId, user.id, fileUuid, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await service.storage
    .from('rosa-uploads')
    .upload(path, buffer, {
      contentType: mediaType,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  return NextResponse.json({
    file_id: path,
    filename: file.name,
    media_type: mediaType,
    size_bytes: file.size,
  });
}
