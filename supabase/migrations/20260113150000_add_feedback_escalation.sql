-- Migration: Add Feedback Escalation System
-- Purpose: Auto-escalate ticket priority based on age

-- ============================================================================
-- Add Escalation Fields to Feedback Tickets
-- ============================================================================

ALTER TABLE public.feedback_tickets
ADD COLUMN IF NOT EXISTS last_escalation_at TIMESTAMPTZ;

ALTER TABLE public.feedback_tickets
ADD COLUMN IF NOT EXISTS escalation_count INTEGER DEFAULT 0;

ALTER TABLE public.feedback_tickets
ADD COLUMN IF NOT EXISTS days_unresolved INTEGER GENERATED ALWAYS AS (
  CASE
    WHEN status IN ('resolved', 'closed') THEN NULL
    ELSE EXTRACT(DAY FROM (now() - created_at))::INTEGER
  END
) STORED;

-- ============================================================================
-- Create Index for Finding Old Unresolved Tickets
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_feedback_tickets_unresolved
ON public.feedback_tickets(created_at)
WHERE status NOT IN ('resolved', 'closed');

-- ============================================================================
-- Escalation Function
-- ============================================================================

CREATE OR REPLACE FUNCTION escalate_old_tickets()
RETURNS TABLE(
  escalated_count INTEGER,
  escalated_tickets JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_escalated_count INTEGER := 0;
  v_escalated_ids UUID[] := ARRAY[]::UUID[];
  v_ticket RECORD;
  v_days_old INTEGER;
  v_new_priority TEXT;
  v_old_priority TEXT;
BEGIN
  -- Find tickets that need escalation
  FOR v_ticket IN
    SELECT
      ft.id,
      ft.priority,
      ft.created_at,
      ft.status,
      ft.title,
      ft.organization_id,
      EXTRACT(DAY FROM (now() - ft.created_at))::INTEGER as days_old,
      ft.last_escalation_at
    FROM public.feedback_tickets ft
    WHERE ft.status NOT IN ('resolved', 'closed')
      AND ft.created_at < (now() - interval '7 days')
      -- Only escalate once per day at most
      AND (ft.last_escalation_at IS NULL OR ft.last_escalation_at < (now() - interval '1 day'))
  LOOP
    v_days_old := v_ticket.days_old;
    v_old_priority := v_ticket.priority;

    -- Determine new priority based on days unresolved
    v_new_priority := CASE
      WHEN v_days_old >= 21 THEN 'critical'
      WHEN v_days_old >= 14 THEN 'high'
      WHEN v_days_old >= 7 THEN 'medium'
      ELSE v_old_priority
    END;

    -- Only escalate if priority is actually increasing
    IF v_new_priority != v_old_priority AND
       (
         (v_old_priority = 'low' AND v_new_priority IN ('medium', 'high', 'critical')) OR
         (v_old_priority = 'medium' AND v_new_priority IN ('high', 'critical')) OR
         (v_old_priority = 'high' AND v_new_priority = 'critical')
       ) THEN

      -- Update the ticket
      UPDATE public.feedback_tickets
      SET
        priority = v_new_priority,
        last_escalation_at = now(),
        escalation_count = escalation_count + 1,
        updated_at = now()
      WHERE id = v_ticket.id;

      -- Create notification for admins
      INSERT INTO public.user_notifications (
        id,
        user_id,
        organization_id,
        notification_type,
        title,
        message,
        entity_type,
        entity_id,
        metadata,
        is_read,
        created_at
      )
      SELECT
        gen_random_uuid(),
        p.id,
        v_ticket.organization_id,
        'ticket_escalated',
        'Ticket Escalated: ' || v_ticket.title,
        'Ticket has been unresolved for ' || v_days_old || ' days. Priority escalated from ' || v_old_priority || ' to ' || v_new_priority || '.',
        'feedback_ticket',
        v_ticket.id::text,
        jsonb_build_object(
          'previous_priority', v_old_priority,
          'new_priority', v_new_priority,
          'days_unresolved', v_days_old,
          'ticket_id', v_ticket.id
        ),
        false,
        now()
      FROM public.profiles p
      WHERE p.is_alkatera_admin = true;

      v_escalated_count := v_escalated_count + 1;
      v_escalated_ids := array_append(v_escalated_ids, v_ticket.id);
    END IF;
  END LOOP;

  -- Return results
  RETURN QUERY SELECT
    v_escalated_count,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title, 'priority', priority))
       FROM public.feedback_tickets WHERE id = ANY(v_escalated_ids)),
      '[]'::jsonb
    );
END;
$$;

-- ============================================================================
-- View for Escalated Tickets (for Admin Dashboard)
-- ============================================================================

CREATE OR REPLACE VIEW public.escalated_feedback_tickets AS
SELECT
  ft.id,
  ft.title,
  ft.description,
  ft.category,
  ft.status,
  ft.priority,
  ft.created_at,
  ft.updated_at,
  ft.escalation_count,
  ft.last_escalation_at,
  EXTRACT(DAY FROM (now() - ft.created_at))::INTEGER as days_open,
  ft.organization_id,
  ft.created_by,
  p.full_name as creator_name,
  p.email as creator_email,
  o.name as organization_name
FROM public.feedback_tickets ft
LEFT JOIN public.profiles p ON ft.created_by = p.id
LEFT JOIN public.organizations o ON ft.organization_id = o.id
WHERE ft.status NOT IN ('resolved', 'closed')
  AND ft.created_at < (now() - interval '7 days')
ORDER BY ft.created_at ASC;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT ON public.escalated_feedback_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION escalate_old_tickets() TO authenticated;
