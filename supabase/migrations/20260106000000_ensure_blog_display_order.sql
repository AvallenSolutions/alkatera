/*
  # Ensure Blog Posts Display Order Column Exists

  This migration ensures the display_order column exists in the blog_posts table.
  It's safe to run multiple times (idempotent).
*/

-- Add display_order column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'blog_posts'
    AND column_name = 'display_order'
  ) THEN
    ALTER TABLE public.blog_posts
    ADD COLUMN display_order INTEGER DEFAULT 0;

    -- Create index for faster ordering queries
    CREATE INDEX idx_blog_posts_display_order
    ON public.blog_posts(display_order DESC, created_at DESC);

    -- Add comment
    COMMENT ON COLUMN public.blog_posts.display_order IS
      'Manual ordering for posts on Knowledge page. Higher numbers appear first. Default 0 means chronological order.';

    -- Update existing posts to have default order
    UPDATE public.blog_posts
    SET display_order = 0
    WHERE display_order IS NULL;
  END IF;
END $$;
