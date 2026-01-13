/*
  # Create Feedback & Bug Reporting System

  1. New Table: `feedback_tickets`
    - Stores bug reports and feature requests
    - Links to organization and user

  2. New Table: `feedback_messages`
    - Conversation thread for each ticket
    - Supports admin replies

  3. Storage bucket for screenshots

  4. Security
    - RLS policies for user and admin access
    - Notifications for new tickets/messages
*/

-- ============================================================================
-- STEP 1: Create feedback_tickets table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feedback_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Ticket details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'improvement', 'other')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),

  -- Admin handling
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Attachments (array of storage paths)
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  browser_info TEXT,
  page_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_org_id
ON public.feedback_tickets(organization_id);

CREATE INDEX IF NOT EXISTS idx_feedback_tickets_created_by
ON public.feedback_tickets(created_by);

CREATE INDEX IF NOT EXISTS idx_feedback_tickets_status
ON public.feedback_tickets(status);

CREATE INDEX IF NOT EXISTS idx_feedback_tickets_category
ON public.feedback_tickets(category);

CREATE INDEX IF NOT EXISTS idx_feedback_tickets_created_at
ON public.feedback_tickets(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_feedback_tickets_updated_at
BEFORE UPDATE ON public.feedback_tickets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.feedback_tickets IS 'User feedback tickets including bug reports and feature requests';
COMMENT ON COLUMN public.feedback_tickets.category IS 'Type: bug, feature, improvement, or other';
COMMENT ON COLUMN public.feedback_tickets.priority IS 'Urgency: low, medium, high, or critical';
COMMENT ON COLUMN public.feedback_tickets.status IS 'Current state: open, in_progress, resolved, or closed';

-- ============================================================================
-- STEP 2: Create feedback_messages table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.feedback_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Message content
  message TEXT NOT NULL,

  -- Is this from an admin?
  is_admin_reply BOOLEAN DEFAULT false,

  -- Attachments
  attachments JSONB DEFAULT '[]'::jsonb,

  -- Read tracking
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feedback_messages_ticket_id
ON public.feedback_messages(ticket_id);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_sender_id
ON public.feedback_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_created_at
ON public.feedback_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_is_read
ON public.feedback_messages(is_read) WHERE is_read = false;

-- Add comments
COMMENT ON TABLE public.feedback_messages IS 'Conversation thread messages for feedback tickets';
COMMENT ON COLUMN public.feedback_messages.is_admin_reply IS 'True if message is from Alkatera admin';

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.feedback_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: RLS Policies for feedback_tickets
-- ============================================================================

-- Users can view their own organization's tickets
CREATE POLICY "Users can view their organization tickets"
ON public.feedback_tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = feedback_tickets.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Users can create tickets for their organization
CREATE POLICY "Users can create tickets for their organization"
ON public.feedback_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = feedback_tickets.organization_id
    AND om.user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- Users can update their own tickets (limited fields)
CREATE POLICY "Users can update their own tickets"
ON public.feedback_tickets
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Alkatera admins can view all tickets
CREATE POLICY "Alkatera admins can view all tickets"
ON public.feedback_tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
);

-- Alkatera admins can update all tickets
CREATE POLICY "Alkatera admins can update all tickets"
ON public.feedback_tickets
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
);

-- ============================================================================
-- STEP 5: RLS Policies for feedback_messages
-- ============================================================================

-- Users can view messages for tickets in their organization
CREATE POLICY "Users can view messages for their organization tickets"
ON public.feedback_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.feedback_tickets ft
    JOIN public.organization_members om ON ft.organization_id = om.organization_id
    WHERE ft.id = feedback_messages.ticket_id
    AND om.user_id = auth.uid()
  )
);

-- Users can create messages for tickets in their organization
CREATE POLICY "Users can create messages for their organization tickets"
ON public.feedback_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.feedback_tickets ft
    JOIN public.organization_members om ON ft.organization_id = om.organization_id
    WHERE ft.id = feedback_messages.ticket_id
    AND om.user_id = auth.uid()
  )
  AND sender_id = auth.uid()
);

-- Alkatera admins can view all messages
CREATE POLICY "Alkatera admins can view all messages"
ON public.feedback_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
);

-- Alkatera admins can create messages (replies)
CREATE POLICY "Alkatera admins can create messages"
ON public.feedback_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
  AND sender_id = auth.uid()
);

-- Alkatera admins can update messages (mark as read)
CREATE POLICY "Alkatera admins can update messages"
ON public.feedback_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.is_alkatera_admin = true
  )
);

-- Users can update messages (mark as read) for their tickets
CREATE POLICY "Users can update messages for their tickets"
ON public.feedback_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.feedback_tickets ft
    WHERE ft.id = feedback_messages.ticket_id
    AND ft.created_by = auth.uid()
  )
);

-- ============================================================================
-- STEP 6: Create storage bucket for attachments
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-attachments',
  'feedback-attachments',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users can upload feedback attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'feedback-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view feedback attachments in their org"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback-attachments' AND
  (
    -- User's org
    (storage.foldername(name))[1] IN (
      SELECT om.organization_id::text
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
    OR
    -- Alkatera admin
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_alkatera_admin = true
    )
  )
);

CREATE POLICY "Users can delete their own feedback attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 7: Create helper function for ticket notifications
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_new_feedback_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_ids UUID[];
  admin_id UUID;
  submitter_name TEXT;
BEGIN
  -- Get submitter name
  SELECT COALESCE(full_name, email) INTO submitter_name
  FROM public.profiles
  WHERE id = NEW.created_by;

  -- Get all Alkatera admins
  SELECT ARRAY_AGG(id) INTO admin_ids
  FROM public.profiles
  WHERE is_alkatera_admin = true;

  -- Create notification for each admin
  IF admin_ids IS NOT NULL THEN
    FOREACH admin_id IN ARRAY admin_ids
    LOOP
      INSERT INTO public.user_notifications (
        user_id,
        organization_id,
        notification_type,
        title,
        message,
        entity_type,
        entity_id,
        metadata
      ) VALUES (
        admin_id,
        NEW.organization_id,
        'feedback_ticket',
        'New ' || NEW.category || ' report: ' || NEW.title,
        COALESCE(submitter_name, 'A user') || ' submitted a new ' || NEW.category || ' report',
        'feedback_ticket',
        NEW.id,
        jsonb_build_object('category', NEW.category, 'priority', NEW.priority)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new ticket notifications
DROP TRIGGER IF EXISTS on_feedback_ticket_created ON public.feedback_tickets;
CREATE TRIGGER on_feedback_ticket_created
AFTER INSERT ON public.feedback_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_new_feedback_ticket();

-- ============================================================================
-- STEP 8: Create helper function for message notifications
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_feedback_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ticket_record RECORD;
  sender_name TEXT;
BEGIN
  -- Get ticket info
  SELECT * INTO ticket_record
  FROM public.feedback_tickets
  WHERE id = NEW.ticket_id;

  -- Get sender name
  SELECT COALESCE(full_name, email) INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF NEW.is_admin_reply THEN
    -- Notify the ticket creator that admin replied
    INSERT INTO public.user_notifications (
      user_id,
      organization_id,
      notification_type,
      title,
      message,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      ticket_record.created_by,
      ticket_record.organization_id,
      'feedback_reply',
      'Reply to your ' || ticket_record.category || ' report',
      'Alkatera support responded to "' || ticket_record.title || '"',
      'feedback_ticket',
      ticket_record.id,
      jsonb_build_object('message_id', NEW.id)
    );
  ELSE
    -- Notify admins of new user message
    INSERT INTO public.user_notifications (
      user_id,
      organization_id,
      notification_type,
      title,
      message,
      entity_type,
      entity_id,
      metadata
    )
    SELECT
      p.id,
      ticket_record.organization_id,
      'feedback_message',
      'New message on ticket: ' || ticket_record.title,
      COALESCE(sender_name, 'User') || ' sent a message',
      'feedback_ticket',
      ticket_record.id,
      jsonb_build_object('message_id', NEW.id)
    FROM public.profiles p
    WHERE p.is_alkatera_admin = true;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for message notifications
DROP TRIGGER IF EXISTS on_feedback_message_created ON public.feedback_messages;
CREATE TRIGGER on_feedback_message_created
AFTER INSERT ON public.feedback_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_feedback_message();

-- ============================================================================
-- STEP 9: Create view for admin dashboard with user info
-- ============================================================================

CREATE OR REPLACE VIEW public.feedback_tickets_with_users AS
SELECT
  ft.*,
  p.full_name as creator_name,
  p.email as creator_email,
  o.name as organization_name,
  (
    SELECT COUNT(*)
    FROM public.feedback_messages fm
    WHERE fm.ticket_id = ft.id
    AND fm.is_read = false
    AND fm.is_admin_reply = false
  ) as unread_user_messages,
  (
    SELECT MAX(created_at)
    FROM public.feedback_messages fm
    WHERE fm.ticket_id = ft.id
  ) as last_message_at
FROM public.feedback_tickets ft
LEFT JOIN public.profiles p ON ft.created_by = p.id
LEFT JOIN public.organizations o ON ft.organization_id = o.id;

-- Grant access to view
GRANT SELECT ON public.feedback_tickets_with_users TO authenticated;
