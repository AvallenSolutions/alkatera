-- Migration: Add ui_preferences JSONB column to profiles table
--
-- Stores user-level UI preferences such as:
--   skip_lca_guide: boolean — whether to skip the LCA wizard guide step
--
-- User-global (not org-scoped) since preferences like LCA expertise
-- don't change per organization.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS ui_preferences JSONB DEFAULT '{}'::jsonb;
