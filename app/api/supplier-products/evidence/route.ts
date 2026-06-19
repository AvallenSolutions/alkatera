import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';

/**
 * POST /api/supplier-products/evidence
 *
 * Files an extracted supplier Certificate of Analysis / spec sheet against a
 * supplier product as a supplier_product_evidence record. The uploaded file was
 * stashed in ingest-staging; we copy it into the supplier-product-evidence
 * bucket (no cross-bucket copy API, so download + re-upload) and store the
 * extracted metadata in queryable columns.
 */

const STASH_BUCKET = 'ingest-staging';
const EVIDENCE_BUCKET = 'supplier-product-evidence';
const ALLOWED_EVIDENCE_TYPES = new Set(['specification_sheet', 'test_report', 'carbon_certificate']);

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = await resolveAccessibleOrg(supabase, user);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const body = await request.json();
    const supplierProductId: string | undefined = body.supplier_product_id;
    const stashId: string | undefined = body.stash_id;
    if (!supplierProductId) {
      return NextResponse.json({ error: 'supplier_product_id is required' }, { status: 400 });
    }

    // Verify the supplier product is visible to the caller (RLS scopes to org).
    const { data: sp } = await supabase
      .from('supplier_products')
      .select('id, name, organization_id')
      .eq('id', supplierProductId)
      .maybeSingle();
    if (!sp || sp.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Supplier product not found' }, { status: 404 });
    }

    const evidenceType = ALLOWED_EVIDENCE_TYPES.has(body.document_type)
      ? body.document_type
      : 'specification_sheet';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }
    const service = createClient(supabaseUrl, serviceKey);

    // Copy the stashed file into the evidence bucket, if a stash was provided
    // and it belongs to this organisation.
    let documentUrl: string | null = null;
    let storagePath: string | null = null;
    let fileSize: number | null = null;
    let mimeType: string | null = null;

    if (stashId && stashId.startsWith(`${organizationId}/`)) {
      const { data: blob, error: dlError } = await service.storage.from(STASH_BUCKET).download(stashId);
      if (!dlError && blob) {
        const buffer = Buffer.from(await blob.arrayBuffer());
        const baseName = stashId.split('/').pop() || 'evidence';
        const target = `${organizationId}/products/${supplierProductId}/${Date.now()}-${baseName}`;
        const { error: upError } = await service.storage
          .from(EVIDENCE_BUCKET)
          .upload(target, buffer, { contentType: blob.type || 'application/octet-stream', upsert: false });
        if (!upError) {
          storagePath = target;
          fileSize = buffer.length;
          mimeType = blob.type || null;
          documentUrl = service.storage.from(EVIDENCE_BUCKET).getPublicUrl(target).data.publicUrl;
          // Tidy up the stash once it has been copied.
          await service.storage.from(STASH_BUCKET).remove([stashId]).catch(() => {});
        }
      }
    }

    const { data, error } = await service
      .from('supplier_product_evidence')
      .insert({
        supplier_product_id: supplierProductId,
        organization_id: organizationId,
        evidence_type: evidenceType,
        document_name: body.document_name || sp.name || 'Supplier document',
        document_url: documentUrl,
        storage_object_path: storagePath,
        file_size_bytes: fileSize,
        mime_type: mimeType,
        covers_climate: !!body.covers_climate,
        covers_water: !!body.covers_water,
        covers_waste: !!body.covers_waste,
        covers_land: false,
        document_date: body.document_date || null,
        document_expiry: body.expiry_date || null,
        document_reference_number: body.reference_number || null,
        verification_status: 'pending',
        uploaded_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[supplier-products/evidence POST] Insert error:', error);
      return NextResponse.json({ error: 'Could not file the document.' }, { status: 500 });
    }

    return NextResponse.json({ saved: 1, id: data?.id, attached_file: !!storagePath }, { status: 201 });
  } catch (err) {
    console.error('[supplier-products/evidence POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
