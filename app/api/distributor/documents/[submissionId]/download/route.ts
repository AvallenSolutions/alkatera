import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';

/**
 * GET /api/distributor/documents/[submissionId]/download
 *
 * Returns a short-lived signed URL for the brand-uploaded source file so
 * a distributor can open the original document. Ownership is verified
 * against the caller's distributor org with their own session; the signed
 * URL itself is minted with the admin client because the brand-documents
 * bucket is private.
 */
export async function GET(_request: Request, { params }: { params: { submissionId: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const { data: submission } = await auth.supabase
    .from('brand_document_submissions')
    .select('id, file_path')
    .eq('id', params.submissionId)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (!submission) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Inline (no forced download) so PDFs/images open in a new tab; the
  // browser falls back to downloading types it can't render.
  const filePath = (submission as { file_path: string }).file_path;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from('brand-documents')
    .createSignedUrl(filePath, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'sign_failed' }, { status: 500 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
