-- ============================================================================
-- Advisor Messaging System
-- Enables direct messaging between organization users and their advisors.
-- ============================================================================

-- Conversations between an organization and an advisor
CREATE TABLE IF NOT EXISTS "public"."advisor_conversations" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "advisor_user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "subject" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  "created_by" uuid NOT NULL REFERENCES "auth"."users"("id"),
  "last_message_at" timestamptz DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "advisor_conversations_pkey" PRIMARY KEY ("id")
);

-- Messages within advisor conversations
CREATE TABLE IF NOT EXISTS "public"."advisor_messages" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "public"."advisor_conversations"("id") ON DELETE CASCADE,
  "sender_id" uuid NOT NULL REFERENCES "auth"."users"("id"),
  "message" text NOT NULL,
  "attachments" jsonb DEFAULT '[]',
  "is_read" boolean NOT NULL DEFAULT false,
  "read_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "advisor_messages_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_advisor_conversations_org" ON "public"."advisor_conversations" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_advisor_conversations_advisor" ON "public"."advisor_conversations" ("advisor_user_id");
CREATE INDEX IF NOT EXISTS "idx_advisor_messages_conversation" ON "public"."advisor_messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "idx_advisor_messages_sender" ON "public"."advisor_messages" ("sender_id");
CREATE INDEX IF NOT EXISTS "idx_advisor_messages_unread" ON "public"."advisor_messages" ("conversation_id", "is_read") WHERE is_read = false;

-- Enable RLS
ALTER TABLE "public"."advisor_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."advisor_messages" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for advisor_conversations
-- ============================================================================

-- Organization members can view conversations for their org
CREATE POLICY "Org members can view advisor conversations"
  ON "public"."advisor_conversations" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."organization_members" om
      WHERE om.organization_id = advisor_conversations.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Advisors can view conversations where they are the advisor
CREATE POLICY "Advisors can view their conversations"
  ON "public"."advisor_conversations" FOR SELECT
  USING (advisor_user_id = auth.uid());

-- Organization members can create conversations for their org
CREATE POLICY "Org members can create advisor conversations"
  ON "public"."advisor_conversations" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."organization_members" om
      WHERE om.organization_id = advisor_conversations.organization_id
        AND om.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Advisors can create conversations for orgs they advise
CREATE POLICY "Advisors can create conversations"
  ON "public"."advisor_conversations" FOR INSERT
  WITH CHECK (
    advisor_user_id = auth.uid()
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM "public"."advisor_organization_access" aoa
      WHERE aoa.organization_id = advisor_conversations.organization_id
        AND aoa.advisor_user_id = auth.uid()
        AND aoa.is_active = true
    )
  );

-- Update policy for conversations (update last_message_at, status)
CREATE POLICY "Participants can update advisor conversations"
  ON "public"."advisor_conversations" FOR UPDATE
  USING (
    advisor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "public"."organization_members" om
      WHERE om.organization_id = advisor_conversations.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS Policies for advisor_messages
-- ============================================================================

-- Org members can view messages in their org's conversations
CREATE POLICY "Org members can view advisor messages"
  ON "public"."advisor_messages" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."advisor_conversations" ac
      JOIN "public"."organization_members" om ON om.organization_id = ac.organization_id
      WHERE ac.id = advisor_messages.conversation_id
        AND om.user_id = auth.uid()
    )
  );

-- Advisors can view messages in their conversations
CREATE POLICY "Advisors can view their messages"
  ON "public"."advisor_messages" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."advisor_conversations" ac
      WHERE ac.id = advisor_messages.conversation_id
        AND ac.advisor_user_id = auth.uid()
    )
  );

-- Both parties can insert messages
CREATE POLICY "Participants can send advisor messages"
  ON "public"."advisor_messages" FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM "public"."advisor_conversations" ac
      WHERE ac.id = advisor_messages.conversation_id
        AND (
          ac.advisor_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM "public"."organization_members" om
            WHERE om.organization_id = ac.organization_id
              AND om.user_id = auth.uid()
          )
        )
    )
  );

-- Participants can update messages (mark as read)
CREATE POLICY "Participants can update advisor messages"
  ON "public"."advisor_messages" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."advisor_conversations" ac
      WHERE ac.id = advisor_messages.conversation_id
        AND (
          ac.advisor_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM "public"."organization_members" om
            WHERE om.organization_id = ac.organization_id
              AND om.user_id = auth.uid()
          )
        )
    )
  );

-- ============================================================================
-- Trigger: notify participants when new advisor message is sent
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."notify_advisor_message"() RETURNS "trigger"
  LANGUAGE "plpgsql" SECURITY DEFINER
  SET search_path = 'public'
  AS $$
DECLARE
  conv_record RECORD;
  sender_name TEXT;
  recipient_id UUID;
BEGIN
  -- Get conversation info
  SELECT * INTO conv_record
  FROM public.advisor_conversations
  WHERE id = NEW.conversation_id;

  -- Get sender name
  SELECT COALESCE(full_name, email) INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Determine recipient: if sender is the advisor, notify org members; if sender is org member, notify advisor
  IF NEW.sender_id = conv_record.advisor_user_id THEN
    -- Advisor sent message → notify all org members
    INSERT INTO public.user_notifications (
      user_id, organization_id, notification_type,
      title, message, entity_type, entity_id, metadata
    )
    SELECT
      om.user_id,
      conv_record.organization_id,
      'advisor_message',
      'Message from advisor ' || COALESCE(sender_name, 'Advisor'),
      LEFT(NEW.message, 100),
      'advisor_conversation',
      conv_record.id::text,
      jsonb_build_object('message_id', NEW.id, 'sender_id', NEW.sender_id)
    FROM public.organization_members om
    WHERE om.organization_id = conv_record.organization_id
      AND om.user_id != NEW.sender_id;
  ELSE
    -- Org member sent message → notify the advisor
    INSERT INTO public.user_notifications (
      user_id, organization_id, notification_type,
      title, message, entity_type, entity_id, metadata
    ) VALUES (
      conv_record.advisor_user_id,
      conv_record.organization_id,
      'advisor_message',
      'Message from ' || COALESCE(sender_name, 'User'),
      LEFT(NEW.message, 100),
      'advisor_conversation',
      conv_record.id::text,
      jsonb_build_object('message_id', NEW.id, 'sender_id', NEW.sender_id)
    );
  END IF;

  -- Update conversation last_message_at
  UPDATE public.advisor_conversations
  SET last_message_at = now(), updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "on_advisor_message_created"
  AFTER INSERT ON "public"."advisor_messages"
  FOR EACH ROW EXECUTE FUNCTION "public"."notify_advisor_message"();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
