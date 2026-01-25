/*
  # Add Archive and Search Support for Rosa Conversations

  1. Changes:
    - Add `is_archived` column to `gaia_conversations` table
    - Add index on `is_archived` for efficient filtering
    - Add full-text search index on conversation titles and messages

  2. Purpose:
    - Allow users to archive conversations to declutter their conversation list
    - Enable searching through previous conversations by title and content
*/

-- ============================================================================
-- STEP 1: Add is_archived column to gaia_conversations
-- ============================================================================

ALTER TABLE public.gaia_conversations
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Add index for efficient filtering of archived vs non-archived conversations
CREATE INDEX IF NOT EXISTS idx_gaia_conversations_is_archived
ON public.gaia_conversations(is_archived);

-- Combined index for common query pattern: user's non-archived conversations
CREATE INDEX IF NOT EXISTS idx_gaia_conversations_user_archived
ON public.gaia_conversations(user_id, is_archived, updated_at DESC);

-- Add comment
COMMENT ON COLUMN public.gaia_conversations.is_archived IS 'Whether the conversation is archived (hidden from main list but not deleted)';

-- ============================================================================
-- STEP 2: Add full-text search support for conversations
-- ============================================================================

-- Add text search vector column to messages for efficient searching
ALTER TABLE public.gaia_messages
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- Create GIN index for fast full-text search on messages
CREATE INDEX IF NOT EXISTS idx_gaia_messages_search
ON public.gaia_messages USING GIN(search_vector);

-- Add text search vector to conversations for title search
ALTER TABLE public.gaia_conversations
ADD COLUMN IF NOT EXISTS title_search_vector tsvector
GENERATED ALWAYS AS (to_tsvector('english', COALESCE(title, ''))) STORED;

-- Create GIN index for fast full-text search on conversation titles
CREATE INDEX IF NOT EXISTS idx_gaia_conversations_title_search
ON public.gaia_conversations USING GIN(title_search_vector);

-- ============================================================================
-- STEP 3: Create search function for conversations
-- ============================================================================

-- Function to search conversations by title and message content
CREATE OR REPLACE FUNCTION public.search_rosa_conversations(
  p_user_id UUID,
  p_organization_id UUID,
  p_search_query TEXT,
  p_include_archived BOOLEAN DEFAULT false
)
RETURNS TABLE (
  conversation_id UUID,
  title TEXT,
  is_archived BOOLEAN,
  message_count INTEGER,
  updated_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  match_type TEXT,
  matched_content TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  -- Convert search query to tsquery
  v_tsquery := plainto_tsquery('english', p_search_query);

  RETURN QUERY
  WITH title_matches AS (
    -- Search in conversation titles
    SELECT
      gc.id AS conversation_id,
      gc.title,
      gc.is_archived,
      gc.message_count,
      gc.updated_at,
      gc.last_message_at,
      'title'::TEXT AS match_type,
      gc.title AS matched_content,
      ts_rank(gc.title_search_vector, v_tsquery) AS rank
    FROM public.gaia_conversations gc
    WHERE gc.user_id = p_user_id
      AND gc.organization_id = p_organization_id
      AND gc.title_search_vector @@ v_tsquery
      AND (p_include_archived OR NOT gc.is_archived)
  ),
  message_matches AS (
    -- Search in message content
    SELECT DISTINCT ON (gc.id)
      gc.id AS conversation_id,
      gc.title,
      gc.is_archived,
      gc.message_count,
      gc.updated_at,
      gc.last_message_at,
      'message'::TEXT AS match_type,
      LEFT(gm.content, 200) AS matched_content,
      ts_rank(gm.search_vector, v_tsquery) AS rank
    FROM public.gaia_conversations gc
    INNER JOIN public.gaia_messages gm ON gm.conversation_id = gc.id
    WHERE gc.user_id = p_user_id
      AND gc.organization_id = p_organization_id
      AND gm.search_vector @@ v_tsquery
      AND (p_include_archived OR NOT gc.is_archived)
    ORDER BY gc.id, ts_rank(gm.search_vector, v_tsquery) DESC
  ),
  combined AS (
    SELECT * FROM title_matches
    UNION ALL
    SELECT * FROM message_matches
  )
  SELECT DISTINCT ON (c.conversation_id)
    c.conversation_id,
    c.title,
    c.is_archived,
    c.message_count,
    c.updated_at,
    c.last_message_at,
    c.match_type,
    c.matched_content
  FROM combined c
  ORDER BY c.conversation_id, c.rank DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_rosa_conversations TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.search_rosa_conversations IS 'Search Rosa conversations by title and message content with full-text search';
