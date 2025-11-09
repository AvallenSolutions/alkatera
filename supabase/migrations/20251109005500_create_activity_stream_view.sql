/*
  # Create Activity Stream View

  ## Overview
  This migration creates a unified activity stream view that combines events from
  multiple sources using UNION ALL. This provides a chronological feed of all
  activities and changes within an organization for dashboard display.

  ## Problem Being Solved
  Organizations need to:
  - Track all activities across different modules (users, suppliers, emissions, etc.)
  - View a unified chronological feed of recent changes
  - Monitor team actions and system events
  - Provide audit trail visibility
  - Ensure multi-tenant data isolation

  ## Solution Architecture

  ### Part 1: Activity Log Table
  Creates a general-purpose activity log table for storing events that don't
  have a natural source table (system events, external actions, etc.)

  ### Part 2: Activity Stream View
  Creates `activity_stream_view` that:
  - Uses UNION ALL to combine events from multiple sources
  - Standardizes event structure across all sources
  - Returns: event_id, event_type, event_timestamp, actor_name, details (JSONB)
  - Orders chronologically (newest first)
  - Inherits RLS from source tables
  - Optimized for dashboard display

  ### Part 3: Security (RLS)
  - All source tables already have organization-based RLS
  - View inherits security automatically via security_invoker
  - Users only see events from their organization

  ## Event Sources

  ### Current Sources:
  1. **Organization Members** - User invitations, role changes
  2. **Suppliers** - Supplier additions, updates
  3. **GHG Emissions** - Emission data entries
  4. **KPI Data Points** - KPI value updates
  5. **Activity Log** - General system events

  ### Future Sources (Ready to Add):
  - Facilities/Sites CRUD
  - Products CRUD
  - Reports generation
  - Data exports
  - Configuration changes

  ## Event Types

  ### User Events:
  - USER_INVITED
  - USER_JOINED
  - USER_ROLE_CHANGED

  ### Supplier Events:
  - SUPPLIER_ADDED
  - SUPPLIER_UPDATED
  - SUPPLIER_ENGAGEMENT_CHANGED

  ### Emissions Events:
  - EMISSION_DATA_ADDED
  - EMISSION_DATA_UPDATED

  ### KPI Events:
  - KPI_CREATED
  - KPI_DATA_RECORDED

  ### System Events:
  - SYSTEM_NOTIFICATION
  - DATA_EXPORT
  - REPORT_GENERATED

  ## View Schema

  ### activity_stream_view
  Unified activity feed with standardized structure
  
  Columns:
  - event_id (uuid): Unique identifier for the event
  - organization_id (uuid): Which organization this event belongs to
  - event_type (text): Type of event (USER_INVITED, SUPPLIER_ADDED, etc.)
  - event_timestamp (timestamptz): When the event occurred
  - actor_name (text): Who performed the action (user name or "System")
  - actor_email (text): Email of the actor (if applicable)
  - details (jsonb): Event-specific details (varies by type)

  ## Performance Considerations
  - UNION ALL (not UNION) for performance (no deduplication needed)
  - Indexed timestamp columns on source tables
  - LIMIT typically applied at query time
  - View definition is lightweight (no joins in view, joins happen in SELECTs)
*/

-- =====================================================
-- PART 1: CREATE ACTIVITY LOG TABLE
-- =====================================================

-- Table: activity_log
-- General-purpose table for events that don't have a natural source table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id),
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.activity_log IS 
  'General-purpose activity log for events that do not have a natural source table. Used for system events, notifications, and custom actions.';

COMMENT ON COLUMN public.activity_log.event_type IS 
  'Type of event (e.g., SYSTEM_NOTIFICATION, DATA_EXPORT, REPORT_GENERATED)';

COMMENT ON COLUMN public.activity_log.details IS 
  'Event-specific details in JSONB format. Structure varies by event_type.';

-- =====================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for fast organization filtering
CREATE INDEX IF NOT EXISTS idx_activity_log_organization_id 
  ON public.activity_log(organization_id);

-- Index for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at 
  ON public.activity_log(created_at DESC);

-- Composite index for organization + timestamp queries
CREATE INDEX IF NOT EXISTS idx_activity_log_org_timestamp 
  ON public.activity_log(organization_id, created_at DESC);

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type 
  ON public.activity_log(event_type);

-- =====================================================
-- PART 3: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 4: CREATE RLS POLICIES FOR ACTIVITY_LOG
-- =====================================================

-- SELECT policy: Users can view activity log from their organization
CREATE POLICY "Users can view activity log from their organization"
  ON public.activity_log
  FOR SELECT
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- INSERT policy: Users can create activity log entries for their organization
CREATE POLICY "Users can create activity log for their organization"
  ON public.activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_current_organization_id());

-- UPDATE policy: Users can update activity log from their organization
CREATE POLICY "Users can update activity log from their organization"
  ON public.activity_log
  FOR UPDATE
  TO authenticated
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

-- DELETE policy: Users can delete activity log from their organization
CREATE POLICY "Users can delete activity log from their organization"
  ON public.activity_log
  FOR DELETE
  TO authenticated
  USING (organization_id = get_current_organization_id());

-- =====================================================
-- PART 5: CREATE ACTIVITY STREAM VIEW
-- =====================================================

-- Drop the view if it exists (for idempotency)
DROP VIEW IF EXISTS public.activity_stream_view CASCADE;

-- Create the unified activity stream view
-- Combines events from multiple sources using UNION ALL
CREATE VIEW public.activity_stream_view
WITH (security_invoker = true)
AS

-- Source 1: Organization Member Events (User Invitations/Joins)
SELECT 
  om.id as event_id,
  om.organization_id,
  CASE 
    WHEN om.joined_at IS NOT NULL THEN 'USER_JOINED'
    ELSE 'USER_INVITED'
  END as event_type,
  COALESCE(om.joined_at, om.joined_at, now()) as event_timestamp,
  COALESCE(inviter.full_name, inviter.email, 'System') as actor_name,
  inviter.email as actor_email,
  jsonb_build_object(
    'user_name', member.full_name,
    'user_email', member.email,
    'role', r.name,
    'invited_by', inviter.full_name
  ) as details
FROM public.organization_members om
INNER JOIN public.profiles member ON om.user_id = member.id
LEFT JOIN public.profiles inviter ON om.invited_by = inviter.id
LEFT JOIN public.roles r ON om.role_id = r.id
WHERE om.joined_at IS NOT NULL

UNION ALL

-- Source 2: Supplier Events (Additions)
SELECT 
  s.id as event_id,
  s.organization_id,
  'SUPPLIER_ADDED' as event_type,
  s.created_at as event_timestamp,
  'System' as actor_name,
  NULL as actor_email,
  jsonb_build_object(
    'supplier_name', s.name,
    'contact_email', s.contact_email,
    'industry_sector', s.industry_sector,
    'country', s.country
  ) as details
FROM public.suppliers s

UNION ALL

-- Source 3: Supplier Engagement Events
SELECT 
  se.id as event_id,
  s.organization_id,
  CASE se.status
    WHEN 'invited' THEN 'SUPPLIER_INVITED'
    WHEN 'active' THEN 'SUPPLIER_ACTIVATED'
    WHEN 'data_provided' THEN 'SUPPLIER_DATA_RECEIVED'
    WHEN 'inactive' THEN 'SUPPLIER_DEACTIVATED'
  END as event_type,
  COALESCE(
    se.data_submitted_date,
    se.accepted_date,
    se.invited_date,
    se.created_at
  ) as event_timestamp,
  COALESCE(actor.full_name, actor.email, 'System') as actor_name,
  actor.email as actor_email,
  jsonb_build_object(
    'supplier_name', s.name,
    'status', se.status,
    'data_quality_score', se.data_quality_score
  ) as details
FROM public.supplier_engagements se
INNER JOIN public.suppliers s ON se.supplier_id = s.id
LEFT JOIN public.profiles actor ON se.created_by = actor.id
WHERE se.status IS NOT NULL

UNION ALL

-- Source 4: GHG Emissions Events
SELECT 
  e.id as event_id,
  e.organization_id,
  'EMISSION_DATA_ADDED' as event_type,
  e.created_at as event_timestamp,
  COALESCE(actor.full_name, actor.email, 'System') as actor_name,
  actor.email as actor_email,
  jsonb_build_object(
    'category', c.name,
    'scope', c.scope,
    'total_emissions', e.total_emissions,
    'unit', 'tCO₂e',
    'reporting_period', e.reporting_period
  ) as details
FROM public.ghg_emissions e
INNER JOIN public.ghg_categories c ON e.category_id = c.id
LEFT JOIN public.profiles actor ON e.created_by = actor.id

UNION ALL

-- Source 5: KPI Data Point Events
SELECT 
  kdp.id as event_id,
  k.organization_id,
  'KPI_DATA_RECORDED' as event_type,
  kdp.created_at as event_timestamp,
  COALESCE(actor.full_name, actor.email, 'System') as actor_name,
  actor.email as actor_email,
  jsonb_build_object(
    'kpi_name', k.name,
    'value', kdp.value,
    'unit', k.unit,
    'recorded_date', kdp.recorded_date
  ) as details
FROM public.kpi_data_points kdp
INNER JOIN public.kpis k ON kdp.kpi_id = k.id
LEFT JOIN public.profiles actor ON kdp.created_by = actor.id

UNION ALL

-- Source 6: Activity Log (General Events)
SELECT 
  al.id as event_id,
  al.organization_id,
  al.event_type,
  al.created_at as event_timestamp,
  COALESCE(actor.full_name, actor.email, 'System') as actor_name,
  actor.email as actor_email,
  al.details
FROM public.activity_log al
LEFT JOIN public.profiles actor ON al.actor_id = actor.id

-- Order by timestamp descending (newest first)
ORDER BY event_timestamp DESC;

COMMENT ON VIEW public.activity_stream_view IS 
  'Unified activity stream combining events from multiple sources using UNION ALL. Shows chronological feed of all organization activities. Uses security_invoker=true to inherit RLS from source tables.';

-- =====================================================
-- PART 6: GRANT PERMISSIONS
-- =====================================================

-- Grant permissions on table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;

-- Grant SELECT permission on view
GRANT SELECT ON public.activity_stream_view TO authenticated;

-- =====================================================
-- PART 7: CREATE HELPER FUNCTION FOR LOGGING ACTIVITIES
-- =====================================================

-- Function to easily log custom activities
CREATE OR REPLACE FUNCTION public.log_activity(
  p_event_type text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_activity_id uuid;
  v_org_id uuid;
  v_user_id uuid;
BEGIN
  -- Get current organization and user
  v_org_id := get_current_organization_id();
  v_user_id := auth.uid();
  
  -- Insert activity log entry
  INSERT INTO public.activity_log (
    organization_id,
    event_type,
    actor_id,
    details
  ) VALUES (
    v_org_id,
    p_event_type,
    v_user_id,
    p_details
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_activity(text, jsonb) IS 
  'Helper function to log custom activities. Automatically captures current organization and user.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.log_activity(text, jsonb) TO authenticated;
