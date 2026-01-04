/*
  # Blog Posts Table for AlkaTera Knowledge Hub

  ## Overview
  This migration creates the blog_posts table for the marketing knowledge hub.
  Only Alkatera admins can create/edit posts. Published posts are publicly readable.

  ## Tables Created
  - `blog_posts` - Blog post content, metadata, and publishing status

  ## Security
  - RLS enabled
  - Public read access for published posts
  - Only Alkatera admins can create/edit/delete
*/

-- =====================================================
-- BLOG_POSTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Content fields
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  excerpt text,
  content text NOT NULL,
  featured_image_url text,

  -- Author information
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,

  -- Categorization
  tags text[] DEFAULT '{}',
  content_type text DEFAULT 'article' CHECK (content_type IN ('article', 'video', 'quote', 'tutorial')),

  -- Publishing
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,

  -- Metadata
  read_time text, -- e.g., "5 min read" or "3:24" for videos
  view_count integer DEFAULT 0,

  -- SEO
  meta_title text,
  meta_description text,
  og_image_url text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON public.blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_tags ON public.blog_posts USING GIN(tags);
CREATE INDEX idx_blog_posts_author ON public.blog_posts(author_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Public read access for published posts
CREATE POLICY "Public can view published blog posts"
  ON public.blog_posts
  FOR SELECT
  USING (status = 'published');

-- Alkatera admins can do everything
CREATE POLICY "Alkatera admins have full access to blog posts"
  ON public.blog_posts
  FOR ALL
  USING (is_alkatera_admin())
  WITH CHECK (is_alkatera_admin());

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_blog_post_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER set_blog_post_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_blog_post_updated_at();

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION public.generate_slug(title text)
RETURNS text AS $$
DECLARE
  slug text;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  slug := lower(trim(title));
  slug := regexp_replace(slug, '[^a-z0-9\s-]', '', 'g');
  slug := regexp_replace(slug, '\s+', '-', 'g');
  slug := regexp_replace(slug, '-+', '-', 'g');
  RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Function to estimate read time (basic: ~200 words per minute)
CREATE OR REPLACE FUNCTION public.calculate_read_time(content text)
RETURNS text AS $$
DECLARE
  word_count integer;
  minutes integer;
BEGIN
  word_count := array_length(regexp_split_to_array(content, '\s+'), 1);
  minutes := GREATEST(1, ROUND(word_count / 200.0));
  RETURN minutes || ' min read';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.blog_posts IS 'Blog posts for the AlkaTera knowledge hub';
COMMENT ON COLUMN public.blog_posts.slug IS 'URL-friendly slug generated from title';
COMMENT ON COLUMN public.blog_posts.content IS 'Full blog post content in markdown or HTML';
COMMENT ON COLUMN public.blog_posts.status IS 'Publication status: draft, published, or archived';
COMMENT ON COLUMN public.blog_posts.content_type IS 'Type of content: article, video, quote, or tutorial';
