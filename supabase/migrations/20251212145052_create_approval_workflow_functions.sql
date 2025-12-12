/*
  # Create Approval Workflow Functions

  ## Overview
  This migration creates functions to handle the approval workflow for pending
  data submissions. When an admin approves data, it gets copied to the main
  table. When rejected, the reason is recorded.

  ## 1. Approval Functions
    - `approve_pending_activity_data(pending_id)` - Approve and copy to activity_data
    - `approve_pending_facility(pending_id)` - Approve and copy to facilities
    - `approve_pending_product(pending_id)` - Approve and copy to products
    - `approve_pending_supplier(pending_id)` - Approve and copy to suppliers

  ## 2. Rejection Functions
    - `reject_pending_submission(table_name, pending_id, reason)` - Generic rejection

  ## 3. Notification Table
    - `user_notifications` - Stores notifications for approval/rejection events

  ## 4. Security
    - All approval functions check for admin permissions
    - Audit trail maintained in pending tables
*/

-- ============================================================================
-- STEP 1: Create user_notifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Reference to related entity
  entity_type TEXT,
  entity_id TEXT,
  
  -- Status
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id 
  ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread 
  ON public.user_notifications(user_id, is_read) WHERE is_read = false;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.user_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.user_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can insert notifications
CREATE POLICY "System can insert notifications"
  ON public.user_notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- STEP 2: Create notification helper function
-- ============================================================================

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_org_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.user_notifications (
    user_id, organization_id, notification_type, title, message,
    entity_type, entity_id, metadata
  ) VALUES (
    p_user_id, p_org_id, p_type, p_title, p_message,
    p_entity_type, p_entity_id, p_metadata
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- ============================================================================
-- STEP 3: Approve pending activity data function
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_pending_activity_data(p_pending_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_record RECORD;
  new_record_id UUID;
BEGIN
  -- Check if user can approve
  IF NOT can_approve_data() THEN
    RAISE EXCEPTION 'Permission denied: User cannot approve data';
  END IF;
  
  -- Get the pending record
  SELECT * INTO pending_record
  FROM public.pending_activity_data
  WHERE id = p_pending_id
    AND organization_id = get_current_organization_id()
    AND approval_status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending record not found or already processed';
  END IF;
  
  -- Insert into main table
  INSERT INTO public.activity_data (
    organization_id, user_id, name, category, quantity, unit, activity_date
  ) VALUES (
    pending_record.organization_id,
    pending_record.submitted_by,
    pending_record.name,
    pending_record.category,
    pending_record.quantity,
    pending_record.unit,
    pending_record.activity_date
  )
  RETURNING id INTO new_record_id;
  
  -- Update pending record
  UPDATE public.pending_activity_data
  SET approval_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      original_id = new_record_id
  WHERE id = p_pending_id;
  
  -- Notify submitter
  PERFORM create_notification(
    pending_record.submitted_by,
    pending_record.organization_id,
    'approval',
    'Data Approved',
    'Your activity data submission "' || pending_record.name || '" has been approved.',
    'activity_data',
    new_record_id::text
  );
  
  -- Log platform activity
  PERFORM log_platform_activity('data_approved', 'approval_workflow');
  
  RETURN new_record_id;
END;
$$;

-- ============================================================================
-- STEP 4: Approve pending facility function
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_pending_facility(p_pending_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_record RECORD;
  new_record_id UUID;
BEGIN
  IF NOT can_approve_data() THEN
    RAISE EXCEPTION 'Permission denied: User cannot approve data';
  END IF;
  
  SELECT * INTO pending_record
  FROM public.pending_facilities
  WHERE id = p_pending_id
    AND organization_id = get_current_organization_id()
    AND approval_status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending record not found or already processed';
  END IF;
  
  INSERT INTO public.facilities (
    organization_id, name, location, facility_type, facility_type_id,
    address, city, country, latitude, longitude, is_contract_manufacturer
  ) VALUES (
    pending_record.organization_id,
    pending_record.name,
    pending_record.location,
    pending_record.facility_type,
    pending_record.facility_type_id,
    pending_record.address,
    pending_record.city,
    pending_record.country,
    pending_record.latitude,
    pending_record.longitude,
    pending_record.is_contract_manufacturer
  )
  RETURNING id INTO new_record_id;
  
  UPDATE public.pending_facilities
  SET approval_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      original_id = new_record_id
  WHERE id = p_pending_id;
  
  PERFORM create_notification(
    pending_record.submitted_by,
    pending_record.organization_id,
    'approval',
    'Facility Approved',
    'Your facility submission "' || pending_record.name || '" has been approved.',
    'facilities',
    new_record_id::text
  );
  
  PERFORM log_platform_activity('facility_approved', 'approval_workflow');
  
  RETURN new_record_id;
END;
$$;

-- ============================================================================
-- STEP 5: Approve pending product function
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_pending_product(p_pending_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_record RECORD;
  new_record_id BIGINT;
BEGIN
  IF NOT can_approve_data() THEN
    RAISE EXCEPTION 'Permission denied: User cannot approve data';
  END IF;
  
  SELECT * INTO pending_record
  FROM public.pending_products
  WHERE id = p_pending_id
    AND organization_id = get_current_organization_id()
    AND approval_status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending record not found or already processed';
  END IF;
  
  INSERT INTO public.products (
    organization_id, name, product_description, product_image_url, sku,
    functional_unit_type, functional_unit_volume, functional_unit_measure,
    system_boundary, product_category, is_draft, created_by
  ) VALUES (
    pending_record.organization_id,
    pending_record.name,
    pending_record.product_description,
    pending_record.product_image_url,
    pending_record.sku,
    pending_record.functional_unit_type,
    pending_record.functional_unit_volume,
    pending_record.functional_unit_measure,
    pending_record.system_boundary,
    pending_record.product_category,
    pending_record.is_draft,
    pending_record.submitted_by
  )
  RETURNING id INTO new_record_id;
  
  UPDATE public.pending_products
  SET approval_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      original_id = new_record_id
  WHERE id = p_pending_id;
  
  PERFORM create_notification(
    pending_record.submitted_by,
    pending_record.organization_id,
    'approval',
    'Product Approved',
    'Your product submission "' || pending_record.name || '" has been approved.',
    'products',
    new_record_id::text
  );
  
  PERFORM log_platform_activity('product_approved', 'approval_workflow');
  
  RETURN new_record_id;
END;
$$;

-- ============================================================================
-- STEP 6: Approve pending supplier function
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_pending_supplier(p_pending_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_record RECORD;
  new_record_id UUID;
BEGIN
  IF NOT can_approve_data() THEN
    RAISE EXCEPTION 'Permission denied: User cannot approve data';
  END IF;
  
  SELECT * INTO pending_record
  FROM public.pending_suppliers
  WHERE id = p_pending_id
    AND organization_id = get_current_organization_id()
    AND approval_status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending record not found or already processed';
  END IF;
  
  INSERT INTO public.suppliers (
    organization_id, name, contact_email, contact_name, phone,
    website, address, city, country
  ) VALUES (
    pending_record.organization_id,
    pending_record.name,
    pending_record.contact_email,
    pending_record.contact_name,
    pending_record.phone,
    pending_record.website,
    pending_record.address,
    pending_record.city,
    pending_record.country
  )
  RETURNING id INTO new_record_id;
  
  UPDATE public.pending_suppliers
  SET approval_status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      original_id = new_record_id
  WHERE id = p_pending_id;
  
  PERFORM create_notification(
    pending_record.submitted_by,
    pending_record.organization_id,
    'approval',
    'Supplier Approved',
    'Your supplier submission "' || pending_record.name || '" has been approved.',
    'suppliers',
    new_record_id::text
  );
  
  PERFORM log_platform_activity('supplier_approved', 'approval_workflow');
  
  RETURN new_record_id;
END;
$$;

-- ============================================================================
-- STEP 7: Generic rejection function
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_pending_submission(
  p_table_name TEXT,
  p_pending_id UUID,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_record RECORD;
  submitter_id UUID;
  org_id UUID;
  item_name TEXT;
BEGIN
  IF NOT can_approve_data() THEN
    RAISE EXCEPTION 'Permission denied: User cannot approve/reject data';
  END IF;
  
  -- Handle each table type
  CASE p_table_name
    WHEN 'pending_activity_data' THEN
      SELECT submitted_by, organization_id, name INTO submitter_id, org_id, item_name
      FROM public.pending_activity_data
      WHERE id = p_pending_id AND approval_status = 'pending';
      
      UPDATE public.pending_activity_data
      SET approval_status = 'rejected',
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          rejection_reason = p_reason
      WHERE id = p_pending_id;
      
    WHEN 'pending_facilities' THEN
      SELECT submitted_by, organization_id, name INTO submitter_id, org_id, item_name
      FROM public.pending_facilities
      WHERE id = p_pending_id AND approval_status = 'pending';
      
      UPDATE public.pending_facilities
      SET approval_status = 'rejected',
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          rejection_reason = p_reason
      WHERE id = p_pending_id;
      
    WHEN 'pending_products' THEN
      SELECT submitted_by, organization_id, name INTO submitter_id, org_id, item_name
      FROM public.pending_products
      WHERE id = p_pending_id AND approval_status = 'pending';
      
      UPDATE public.pending_products
      SET approval_status = 'rejected',
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          rejection_reason = p_reason
      WHERE id = p_pending_id;
      
    WHEN 'pending_suppliers' THEN
      SELECT submitted_by, organization_id, name INTO submitter_id, org_id, item_name
      FROM public.pending_suppliers
      WHERE id = p_pending_id AND approval_status = 'pending';
      
      UPDATE public.pending_suppliers
      SET approval_status = 'rejected',
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          rejection_reason = p_reason
      WHERE id = p_pending_id;
      
    ELSE
      RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END CASE;
  
  IF submitter_id IS NULL THEN
    RAISE EXCEPTION 'Pending record not found or already processed';
  END IF;
  
  -- Notify submitter of rejection
  PERFORM create_notification(
    submitter_id,
    org_id,
    'rejection',
    'Submission Rejected',
    'Your submission "' || COALESCE(item_name, 'Unknown') || '" was rejected. Reason: ' || p_reason,
    p_table_name,
    p_pending_id::text,
    jsonb_build_object('reason', p_reason)
  );
  
  PERFORM log_platform_activity('submission_rejected', 'approval_workflow');
END;
$$;

-- ============================================================================
-- STEP 8: Get pending count for user's organisation
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_approval_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  total_count INTEGER := 0;
  org_id UUID;
BEGIN
  org_id := get_current_organization_id();
  
  IF org_id IS NULL OR NOT can_approve_data() THEN
    RETURN 0;
  END IF;
  
  SELECT 
    (SELECT COUNT(*) FROM pending_activity_data WHERE organization_id = org_id AND approval_status = 'pending') +
    (SELECT COUNT(*) FROM pending_facilities WHERE organization_id = org_id AND approval_status = 'pending') +
    (SELECT COUNT(*) FROM pending_products WHERE organization_id = org_id AND approval_status = 'pending') +
    (SELECT COUNT(*) FROM pending_suppliers WHERE organization_id = org_id AND approval_status = 'pending')
  INTO total_count;
  
  RETURN COALESCE(total_count, 0);
END;
$$;

COMMENT ON FUNCTION get_pending_approval_count() IS 
  'Get total count of pending approvals for current organisation (admin only)';

-- ============================================================================
-- STEP 9: Function comments
-- ============================================================================

COMMENT ON FUNCTION approve_pending_activity_data(UUID) IS 
  'Approve pending activity data and copy to main table';
COMMENT ON FUNCTION approve_pending_facility(UUID) IS 
  'Approve pending facility and copy to main table';
COMMENT ON FUNCTION approve_pending_product(UUID) IS 
  'Approve pending product and copy to main table';
COMMENT ON FUNCTION approve_pending_supplier(UUID) IS 
  'Approve pending supplier and copy to main table';
COMMENT ON FUNCTION reject_pending_submission(TEXT, UUID, TEXT) IS 
  'Reject a pending submission with a reason';
COMMENT ON TABLE public.user_notifications IS 
  'Notification center for user alerts including approval/rejection notifications';
