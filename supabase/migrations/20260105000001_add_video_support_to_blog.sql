/*
  # Add Video Support to Blog Posts

  ## Overview
  This migration adds video functionality to the blog_posts table.
  Supports both YouTube URLs and uploaded videos stored in Supabase.

  ## Changes
  - Add video_url field for YouTube URLs or Supabase storage paths
  - Add video_duration field for video length (e.g., "3:24")
  - Update content field to be nullable (videos may not have long-form content)
*/

-- Add video_url field
ALTER TABLE public.blog_posts
ADD COLUMN IF NOT EXISTS video_url text;

-- Add video_duration field
ALTER TABLE public.blog_posts
ADD COLUMN IF NOT EXISTS video_duration text;

-- Make content nullable for videos
ALTER TABLE public.blog_posts
ALTER COLUMN content DROP NOT NULL;

-- Add comments
COMMENT ON COLUMN public.blog_posts.video_url IS 'YouTube URL or Supabase storage path for video content';
COMMENT ON COLUMN public.blog_posts.video_duration IS 'Video duration in format MM:SS or HH:MM:SS';
