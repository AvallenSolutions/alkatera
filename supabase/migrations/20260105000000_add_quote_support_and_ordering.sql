/*
  # Add Quote Support and Display Ordering to Blog Posts

  Adds support for quote-type blog posts and allows manual ordering
  of posts on the Knowledge page.
*/

-- Add display_order column to blog_posts
ALTER TABLE blog_posts
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_blog_posts_display_order
ON blog_posts(display_order DESC, created_at DESC);

-- Add comment
COMMENT ON COLUMN blog_posts.display_order IS
  'Manual ordering for posts on Knowledge page. Higher numbers appear first. Default 0 means chronological order.';

-- Update existing posts to have default order (by creation date)
UPDATE blog_posts
SET display_order = 0
WHERE display_order IS NULL;
