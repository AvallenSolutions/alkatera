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
      author_name,
      video_url,
      video_duration,
    } = body;

    // Validate required fields
    const isQuote = content_type === 'quote';
    const isVideo = content_type === 'video';

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }
    if (!isQuote && !isVideo && !content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }
    if (isQuote && !author_name) {
      return NextResponse.json(
        { error: 'Author name is required for quotes' },
        { status: 400 }
      );
    }
    if (isVideo && !video_url) {
      return NextResponse.json(
        { error: 'Video URL is required for video posts' },
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
    // For quotes, use the provided author_name (the person being quoted)
    // For other content types, use the logged-in user's name
    let finalAuthorName = author_name;
    if (!isQuote) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      finalAuthorName = profile?.full_name || user.email?.split('@')[0] || 'AlkaTera Team';
    }

    // Create blog post
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({
        title,
        slug: finalSlug,
        excerpt: excerpt || null,
        content: content || null,
        featured_image_url: featured_image_url || null,
        author_id: user.id,
        author_name: finalAuthorName,
        tags: tags || [],
        content_type: content_type || 'article',
        status: status || 'draft',
        published_at: status === 'published' ? new Date().toISOString() : null,
        read_time: finalReadTime || null,
        meta_title: meta_title || title,
        meta_description: meta_description || excerpt || null,
        og_image_url: og_image_url || featured_image_url || null,
        video_url: video_url || null,
        video_duration: video_duration || null,
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
