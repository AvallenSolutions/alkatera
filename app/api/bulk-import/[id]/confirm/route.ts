import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseServerClient();

    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const importId = params.id;

    const { data: import_record, error: fetchError } = await supabase
      .from('bom_imports')
      .select('*')
      .eq('id', importId)
      .single();

    if (fetchError || !import_record) {
      return NextResponse.json(
        { error: 'Import record not found' },
        { status: 404 }
      );
    }

    const { data: organization_member, error: orgError } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', import_record.organization_id)
      .eq('user_id', session.data.session.user.id)
      .single();

    if (orgError || !organization_member) {
      return NextResponse.json(
        { error: 'Not authorized to confirm this import' },
        { status: 403 }
      );
    }

    const { data: extracted_items, error: itemsError } = await supabase
      .from('bom_extracted_items')
      .select('*')
      .eq('bom_import_id', importId)
      .eq('is_imported', false);

    if (itemsError) {
      return NextResponse.json(
        { error: 'Failed to fetch imported items' },
        { status: 500 }
      );
    }

    if (!extracted_items || extracted_items.length === 0) {
      await supabase
        .from('bom_imports')
        .update({ status: 'completed' })
        .eq('id', importId);

      return NextResponse.json({
        success: true,
        message: 'Import confirmed but no items to process',
        itemsProcessed: 0,
      });
    }

    const updateData = extracted_items.map((item: any) => ({
      ...item,
      is_imported: true,
    }));

    const { error: updateError } = await supabase
      .from('bom_extracted_items')
      .upsert(updateData);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to mark items as imported' },
        { status: 500 }
      );
    }

    await supabase
      .from('bom_imports')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId);

    return NextResponse.json({
      success: true,
      message: `Successfully confirmed ${extracted_items.length} items`,
      itemsProcessed: extracted_items.length,
    });
  } catch (error) {
    console.error('Confirm error:', error);
    return NextResponse.json(
      { error: 'An error occurred while confirming the import' },
      { status: 500 }
    );
  }
}
