-- Rosa message feedback -- Pillar 4 step 1 "Capture" (data-revolution-plan.md).
--
-- Per-message helpful / not-right / too-vague chip on Rosa's studio
-- conversation (components/rosa/RosaConversation.tsx). One tap stores a
-- verdict; a second tap on a different option replaces it (unique per
-- message+user, upserted by POST /api/rosa/feedback). Written by the
-- service-role route only -- the RLS policy below is defence-in-depth for
-- direct reads, not the write path.
--
-- Distinct from the legacy gaia_feedback table (positive/negative only,
-- wired to the old GaiaChat/RosaChat widget still live at /gaia and
-- /admin/rosa): this is the new studio conversation's feedback store, with
-- the third "too vague" verdict the flywheel plan calls for.

CREATE TABLE IF NOT EXISTS "public"."rosa_message_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" uuid NOT NULL REFERENCES "public"."gaia_messages"("id") ON DELETE CASCADE,
  "conversation_id" uuid NOT NULL REFERENCES "public"."gaia_conversations"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "verdict" text NOT NULL CHECK ("verdict" IN ('helpful', 'not_right', 'too_vague')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("message_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "rosa_message_feedback_org_created_idx"
  ON "public"."rosa_message_feedback" ("organization_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "rosa_message_feedback_conversation_idx"
  ON "public"."rosa_message_feedback" ("conversation_id");

ALTER TABLE "public"."rosa_message_feedback" ENABLE ROW LEVEL SECURITY;

-- Users can read their own feedback (e.g. a future "you already answered
-- this" UI). All writes go through POST /api/rosa/feedback's service-role
-- client, which verifies the message belongs to the caller's own
-- conversation before upserting, so there is no authenticated-role write
-- policy here (mirrors growth_score_snapshots' service-role-writes pattern).
CREATE POLICY "rosa_message_feedback_owner_read" ON "public"."rosa_message_feedback"
  FOR SELECT USING (("user_id" = auth.uid()));
