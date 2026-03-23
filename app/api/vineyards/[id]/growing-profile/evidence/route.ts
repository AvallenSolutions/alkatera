import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/**
 * GET /api/vineyards/[id]/growing-profile/evidence?profile_id=xxx
 * List evidence documents for a growing profile with signed download URLs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const profileId = request.nextUrl.searchParams.get('profile_id');
    if (!profileId) {
      return NextResponse.json({ error: 'profile_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('vineyard_soil_carbon_evidence')
      .select('*')
      .eq('growing_profile_id', profileId)
      .eq('vineyard_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SoilCarbonEvidence GET] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed URLs for each document
    const withUrls = await Promise.all(
      (data || []).map(async (doc) => {
        const { data: signedUrlData } = await supabase.storage
          .from('vineyard-soil-carbon-evidence')
          .createSignedUrl(doc.storage_object_path, 3600); // 1 hour

        return {
          ...doc,
          signed_url: signedUrlData?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({ data: withUrls });
  } catch (err: any) {
    console.error('[SoilCarbonEvidence GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/vineyards/[id]/growing-profile/evidence
 * Upload a soil carbon evidence PDF.
 * Expects multipart form data with fields: file, profile_id
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const profileId = formData.get('profile_id') as string | null;

    if (!file || !profileId) {
      return NextResponse.json(
        { error: 'file and profile_id are required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are accepted' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File must be under 20 MB' },
        { status: 400 }
      );
    }

    // Look up org membership
    let organizationId = user.user_metadata?.current_organization_id;
    if (!organizationId) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (!membership) {
        return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
    }

    // Generate unique storage path
    const fileExt = file.name.split('.').pop() || 'pdf';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const storagePath = `${organizationId}/${params.id}/${uniqueName}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('vineyard-soil-carbon-evidence')
      .upload(storagePath, file);

    if (uploadError) {
      console.error('[SoilCarbonEvidence POST] Upload error:', uploadError);
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
    }

    // Insert metadata row
    const { data, error } = await supabase
      .from('vineyard_soil_carbon_evidence')
      .insert({
        growing_profile_id: profileId,
        vineyard_id: params.id,
        organization_id: organizationId,
        document_name: file.name,
        storage_object_path: storagePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[SoilCarbonEvidence POST] Insert error:', error);
      // Clean up uploaded file on DB failure
      await supabase.storage
        .from('vineyard-soil-carbon-evidence')
        .remove([storagePath]);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error('[SoilCarbonEvidence POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/vineyards/[id]/growing-profile/evidence?evidence_id=xxx
 * Remove a soil carbon evidence document.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const evidenceId = request.nextUrl.searchParams.get('evidence_id');
    if (!evidenceId) {
      return NextResponse.json({ error: 'evidence_id is required' }, { status: 400 });
    }

    // Fetch the record to get storage path
    const { data: evidence, error: fetchError } = await supabase
      .from('vineyard_soil_carbon_evidence')
      .select('storage_object_path')
      .eq('id', evidenceId)
      .eq('vineyard_id', params.id)
      .single();

    if (fetchError || !evidence) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
    }

    // Delete from storage
    await supabase.storage
      .from('vineyard-soil-carbon-evidence')
      .remove([evidence.storage_object_path]);

    // Delete metadata row
    const { error: deleteError } = await supabase
      .from('vineyard_soil_carbon_evidence')
      .delete()
      .eq('id', evidenceId);

    if (deleteError) {
      console.error('[SoilCarbonEvidence DELETE] Error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[SoilCarbonEvidence DELETE] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
