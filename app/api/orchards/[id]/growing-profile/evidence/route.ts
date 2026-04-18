import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

// Mirrors app/api/vineyards/[id]/growing-profile/evidence/route.ts. The
// orchard_soil_carbon_evidence table and orchard-soil-carbon-evidence
// storage bucket are created in migration 20260601000000_orchard_support.sql.

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const BUCKET = 'orchard-soil-carbon-evidence';
const TABLE = 'orchard_soil_carbon_evidence';

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
      .from(TABLE)
      .select('*')
      .eq('growing_profile_id', profileId)
      .eq('orchard_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OrchardEvidence GET] Query error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const withUrls = await Promise.all(
      (data || []).map(async (doc: any) => {
        const { data: signedUrlData } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(doc.storage_object_path, 3600);
        return { ...doc, signed_url: signedUrlData?.signedUrl || null };
      }),
    );

    return NextResponse.json({ data: withUrls });
  } catch (err: any) {
    console.error('[OrchardEvidence GET] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: 'file and profile_id are required' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File must be under 20 MB' }, { status: 400 });
    }

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

    const fileExt = file.name.split('.').pop() || 'pdf';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const storagePath = `${organizationId}/${params.id}/${uniqueName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file);
    if (uploadError) {
      console.error('[OrchardEvidence POST] Upload error:', uploadError);
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        growing_profile_id: profileId,
        orchard_id: params.id,
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
      console.error('[OrchardEvidence POST] Insert error:', error);
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error('[OrchardEvidence POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const { data: evidence, error: fetchError } = await supabase
      .from(TABLE)
      .select('storage_object_path')
      .eq('id', evidenceId)
      .eq('orchard_id', params.id)
      .single();
    if (fetchError || !evidence) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
    }

    await supabase.storage.from(BUCKET).remove([evidence.storage_object_path]);

    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', evidenceId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[OrchardEvidence DELETE] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
