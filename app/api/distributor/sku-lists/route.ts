import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

const ALLOWED_EXT = ['csv', 'xlsx', 'pdf'] as const;
type AllowedExt = (typeof ALLOWED_EXT)[number];

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * GET /api/distributor/sku-lists
 * Lists all SKU list upload records for the caller's distributor org.
 */
export async function GET() {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const { data, error } = await auth.supabase
    .from('distributor_sku_lists')
    .select('*')
    .eq('distributor_org_id', auth.organization.id)
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ lists: data ?? [] });
}

/**
 * POST /api/distributor/sku-lists
 * Multipart form with one "file" field. Uploads to the distributor-sku-lists
 * Storage bucket and inserts a distributor_sku_lists row with status='pending'.
 * Returns the new row's id so the client can call /parse next.
 *
 * Only owners and data_managers can upload.
 */
export async function POST(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large', max_bytes: MAX_BYTES }, { status: 400 });
  }

  const ext = (file.name.split('.').pop() ?? '').toLowerCase() as AllowedExt;
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json(
      { error: 'unsupported_file_type', allowed: ALLOWED_EXT },
      { status: 400 },
    );
  }

  const storagePath = `${auth.organization.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await auth.supabase.storage
    .from('distributor-sku-lists')
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

  const { data: row, error: insertError } = await auth.supabase
    .from('distributor_sku_lists')
    .insert({
      distributor_org_id: auth.organization.id,
      uploaded_by: auth.user.id,
      file_name: file.name,
      file_path: storagePath,
      file_type: ext,
      status: 'pending',
    })
    .select('*')
    .single();

  if (insertError || !row) {
    await auth.supabase.storage.from('distributor-sku-lists').remove([storagePath]);
    return NextResponse.json(
      { error: 'create_row_failed', detail: insertError?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ sku_list: row }, { status: 201 });
}

function guessContentType(ext: AllowedExt): string {
  switch (ext) {
    case 'csv':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'pdf':
      return 'application/pdf';
  }
}
