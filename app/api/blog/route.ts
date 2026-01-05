import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

// GET /api/blog - List blog posts
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const searchParams = request.nextUrl.searchParams;

    const status = searchParams.get('status') || 'published';
    const tag = searchParams.get('tag');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('blog_posts')
      .select('*', { count: 'exact' })
      .order('display_order', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    }

    // Filter by tag
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching blog posts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch blog posts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      posts: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Blog API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// POST /api/blog - Create new blog post (admin only)
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
    const {
      title,
      slug,
      excerpt,
      content,
      featured_image_url,
      tags,
      content_type,
      status,
      read_time,
      meta_title,
      meta_description,
      og_image_url,
    } = body;

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    let finalSlug = slug;
    if (!finalSlug) {
      const { data: generatedSlug } = await supabase.rpc('generate_slug', { title });
      finalSlug = generatedSlug;
    }

    // Calculate read time if not provided and content_type is article
    let finalReadTime = read_time;
    if (!finalReadTime && content_type === 'article') {
      const { data: calculatedTime } = await supabase.rpc('calculate_read_time', { content });
      finalReadTime = calculatedTime;
    }

    // Get author info
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const author_name = profile?.full_name || user.email?.split('@')[0] || 'AlkaTera Team';

    // Create blog post
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title,
        slug: finalSlug,
        excerpt,
        content,
        featured_image_url,
        author_id: user.id,
        author_name,
        tags: tags || [],
        content_type: content_type || 'article',
        status: status || 'draft',
        published_at: status === 'published' ? new Date().toISOString() : null,
        read_time: finalReadTime,
        meta_title: meta_title || title,
        meta_description: meta_description || excerpt,
        og_image_url: og_image_url || featured_image_url,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating blog post:', error);

      // Handle unique constraint violation (slug already exists)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A post with this slug already exists. Please use a different slug.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create blog post' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      post: data,
    }, { status: 201 });

  } catch (error) {
    console.error('Blog creation error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
