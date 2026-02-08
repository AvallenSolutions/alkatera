-- Add the is_archived column to gaia_conversations
-- This column is expected by the Rosa client library (getConversations, archiveConversation, etc.)
-- but was missing from the initial schema, causing all conversation queries to fail silently.

ALTER TABLE "public"."gaia_conversations"
ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false;

-- Index for efficient filtering of active vs archived conversations
CREATE INDEX IF NOT EXISTS "idx_gaia_conversations_is_archived"
ON "public"."gaia_conversations" ("organization_id", "is_archived", "updated_at" DESC);
