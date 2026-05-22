import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';

const ALLOWED_EXT = ['csv', 'xlsx'] as const;
type AllowedExt = (typeof ALLOWED_EXT)[number];
const ALLOWED_KIND = ['brands', 'products'] as const;
type AllowedKind = (typeof ALLOWED_KIND)[number];

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * GET /api/admin/directory/uploads
 * List admin directory upload audit rows (paginated, newest first).
 *
 * POST /api/admin/directory/uploads
 * Multipart form. Fields:
 *   - file: the CSV/XLSX
 *   - kind: 'brands' or 'products'
 * Uploads to admin-directory-uploads storage bucket, inserts a row with
 * status='pending', returns the row so the client can call /parse next.
 *
 * Both routes are gated by `is_alkatera_admin()`. After auth, we switch
 * to a service-role client so RLS doesn't get in the way of storage +
 * inserts — the admin check has already happened.
 */
export async function GET() {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service } = auth;

  const { data, error } = await service
    .from('admin_directory_uploads')
    .select(
      'id, uploaded_by, kind, file_name, status, row_count, brands_created, brands_linked, products_created, products_linked, error_message, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ uploads: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;
  const { service, user } = auth;

  const formData = await request.formData();
  const file = formData.get('file');
  const kind = formData.get('kind');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }
  if (typeof kind !== 'string' || !ALLOWED_KIND.includes(kind as AllowedKind)) {
    return NextResponse.json(
      { error: 'invalid_kind', allowed: ALLOWED_KIND },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'file_too_large', max_bytes: MAX_BYTES },
      { status: 400 },
    );
  }
  const ext = (file.name.split('.').pop() ?? '').toLowerCase() as AllowedExt;
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json(
      { error: 'unsupported_file_type', allowed: ALLOWED_EXT },
      { status: 400 },
    );
  }

  const storagePath = `${kind}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await service.storage
    .from('admin-directory-uploads')
    .upload(storagePath, buffer, {
      contentType: file.type || guessContentType(ext),
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json(
      { error: 'upload_failed', detail: uploadError.message },
      { status: 500 },
    );
  }

  const { data: row, error: insertError } = await service
    .from('admin_directory_uploads')
    .insert({
      uploaded_by: user.id,
      kind,
      file_name: file.name,
      file_path: storagePath,
      file_type: ext,
      status: 'pending',
    })
    .select('*')
    .single();
  if (insertError || !row) {
    await service.storage.from('admin-directory-uploads').remove([storagePath]);
    return NextResponse.json(
      { error: 'create_row_failed', detail: insertError?.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ upload: row });
}

function guessContentType(ext: AllowedExt): string {
  switch (ext) {
    case 'csv':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
}
