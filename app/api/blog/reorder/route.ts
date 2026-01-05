import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

// POST /api/blog/reorder - Update display order for multiple posts
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Check if user is authenticated and is Alkatera admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is Alkatera admin
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_alkatera_admin');

    if (adminError || !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { updates } = body; // Array of { id, display_order }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Updates array is required' },
        { status: 400 }
      );
    }

    // Update each post's display_order
    const updatePromises = updates.map(({ id, display_order }) =>
      supabase
        .from('blog_posts')
        .update({ display_order })
        .eq('id', id)
    );

    const results = await Promise.all(updatePromises);

    // Check if any updates failed
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Error updating post orders:', errors);
      return NextResponse.json(
        { error: 'Failed to update some post orders' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated: updates.length,
    });

  } catch (error) {
    console.error('Reorder API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
