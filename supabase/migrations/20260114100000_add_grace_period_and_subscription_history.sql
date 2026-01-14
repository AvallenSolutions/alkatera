-- Migration: Add grace period system and subscription history
-- This migration adds:
-- 1. Grace period columns to organizations table
-- 2. Subscription history table for tracking plan changes
-- 3. Functions for grace period management

-- ============================================================================
-- 1. Add grace period columns to organizations
-- ============================================================================

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_period_resource_type TEXT,
ADD COLUMN IF NOT EXISTS grace_period_previous_tier TEXT,
ADD COLUMN IF NOT EXISTS grace_period_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN organizations.grace_period_end IS 'End date of grace period after downgrade with over-limit usage';
COMMENT ON COLUMN organizations.grace_period_resource_type IS 'Resource type that is over limit (facilities, products, team_members, etc.)';
COMMENT ON COLUMN organizations.grace_period_previous_tier IS 'Previous tier before downgrade that triggered grace period';
COMMENT ON COLUMN organizations.grace_period_notified_at IS 'When the 3-day warning notification was sent';

-- ============================================================================
-- 2. Create subscription history table
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('upgrade', 'downgrade', 'cancellation', 'reactivation', 'payment_failed', 'payment_succeeded', 'grace_period_started', 'grace_period_ended', 'grace_period_auto_deletion')),
  previous_tier TEXT,
  new_tier TEXT,
  previous_status TEXT,
  new_status TEXT,
  amount_charged NUMERIC(10, 2),
  amount_credited NUMERIC(10, 2),
  currency TEXT DEFAULT 'GBP',
  stripe_invoice_id TEXT,
  stripe_subscription_id TEXT,
  changed_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_org_id ON subscription_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON subscription_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_history_event_type ON subscription_history(event_type);

COMMENT ON TABLE subscription_history IS 'Tracks all subscription plan changes and billing events';

-- Enable RLS
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization subscription history"
  ON subscription_history
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. Function to check if downgrade would exceed limits
-- ============================================================================

CREATE OR REPLACE FUNCTION check_downgrade_limits(
  p_organization_id UUID,
  p_new_tier TEXT
)
RETURNS TABLE (
  resource_type TEXT,
  current_usage INT,
  new_limit INT,
  over_limit BOOLEAN,
  excess_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_limits RECORD;
  v_current_usage RECORD;
BEGIN
  -- Get the limits for the new tier
  SELECT * INTO v_new_limits
  FROM subscription_tier_limits
  WHERE tier_name = p_new_tier;

  IF v_new_limits IS NULL THEN
    RAISE EXCEPTION 'Invalid tier: %', p_new_tier;
  END IF;

  -- Get current usage
  SELECT * INTO v_current_usage
  FROM get_organization_usage(p_organization_id);

  -- Check facilities
  RETURN QUERY
  SELECT
    'facilities'::TEXT,
    (v_current_usage.usage->'facilities'->>'current')::INT,
    COALESCE(v_new_limits.max_facilities, 999999),
    (v_current_usage.usage->'facilities'->>'current')::INT > COALESCE(v_new_limits.max_facilities, 999999),
    GREATEST(0, (v_current_usage.usage->'facilities'->>'current')::INT - COALESCE(v_new_limits.max_facilities, 999999));

  -- Check products
  RETURN QUERY
  SELECT
    'products'::TEXT,
    (v_current_usage.usage->'products'->>'current')::INT,
    COALESCE(v_new_limits.max_products, 999999),
    (v_current_usage.usage->'products'->>'current')::INT > COALESCE(v_new_limits.max_products, 999999),
    GREATEST(0, (v_current_usage.usage->'products'->>'current')::INT - COALESCE(v_new_limits.max_products, 999999));

  -- Check team members
  RETURN QUERY
  SELECT
    'team_members'::TEXT,
    (v_current_usage.usage->'team_members'->>'current')::INT,
    COALESCE(v_new_limits.max_team_members, 999999),
    (v_current_usage.usage->'team_members'->>'current')::INT > COALESCE(v_new_limits.max_team_members, 999999),
    GREATEST(0, (v_current_usage.usage->'team_members'->>'current')::INT - COALESCE(v_new_limits.max_team_members, 999999));

  -- Check LCAs
  RETURN QUERY
  SELECT
    'lcas'::TEXT,
    (v_current_usage.usage->'lcas'->>'current')::INT,
    COALESCE(v_new_limits.max_lcas, 999999),
    (v_current_usage.usage->'lcas'->>'current')::INT > COALESCE(v_new_limits.max_lcas, 999999),
    GREATEST(0, (v_current_usage.usage->'lcas'->>'current')::INT - COALESCE(v_new_limits.max_lcas, 999999));

  -- Check suppliers
  RETURN QUERY
  SELECT
    'suppliers'::TEXT,
    (v_current_usage.usage->'suppliers'->>'current')::INT,
    COALESCE(v_new_limits.max_suppliers, 999999),
    (v_current_usage.usage->'suppliers'->>'current')::INT > COALESCE(v_new_limits.max_suppliers, 999999),
    GREATEST(0, (v_current_usage.usage->'suppliers'->>'current')::INT - COALESCE(v_new_limits.max_suppliers, 999999));
END;
$$;

-- ============================================================================
-- 4. Function to start grace period
-- ============================================================================

CREATE OR REPLACE FUNCTION start_grace_period(
  p_organization_id UUID,
  p_resource_type TEXT,
  p_previous_tier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE organizations
  SET
    grace_period_end = NOW() + INTERVAL '7 days',
    grace_period_resource_type = p_resource_type,
    grace_period_previous_tier = p_previous_tier,
    grace_period_notified_at = NULL,
    updated_at = NOW()
  WHERE id = p_organization_id;

  -- Log the event
  INSERT INTO subscription_history (
    organization_id,
    event_type,
    previous_tier,
    new_tier,
    metadata
  )
  SELECT
    p_organization_id,
    'grace_period_started',
    p_previous_tier,
    subscription_tier,
    jsonb_build_object(
      'resource_type', p_resource_type,
      'grace_period_end', NOW() + INTERVAL '7 days'
    )
  FROM organizations
  WHERE id = p_organization_id;
END;
$$;

-- ============================================================================
-- 5. Function to clear grace period
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_grace_period(
  p_organization_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE organizations
  SET
    grace_period_end = NULL,
    grace_period_resource_type = NULL,
    grace_period_previous_tier = NULL,
    grace_period_notified_at = NULL,
    updated_at = NOW()
  WHERE id = p_organization_id;

  -- Log the event
  INSERT INTO subscription_history (
    organization_id,
    event_type,
    metadata
  )
  VALUES (
    p_organization_id,
    'grace_period_ended',
    jsonb_build_object('reason', 'manual_clear')
  );
END;
$$;

-- ============================================================================
-- 6. Function to process expired grace periods (for cron job)
-- ============================================================================

CREATE OR REPLACE FUNCTION process_expired_grace_periods()
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  resource_type TEXT,
  items_deleted INT,
  billing_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org RECORD;
  v_deleted INT;
  v_limit INT;
  v_current INT;
BEGIN
  -- Find organizations with expired grace periods
  FOR v_org IN
    SELECT
      o.id,
      o.name,
      o.grace_period_resource_type,
      o.subscription_tier,
      o.billing_email
    FROM organizations o
    WHERE o.grace_period_end IS NOT NULL
      AND o.grace_period_end < NOW()
  LOOP
    v_deleted := 0;

    -- Get the limit for the resource type
    SELECT
      CASE v_org.grace_period_resource_type
        WHEN 'facilities' THEN max_facilities
        WHEN 'products' THEN max_products
        WHEN 'team_members' THEN max_team_members
        WHEN 'lcas' THEN max_lcas
        WHEN 'suppliers' THEN max_suppliers
        ELSE 999999
      END
    INTO v_limit
    FROM subscription_tier_limits
    WHERE tier_name = v_org.subscription_tier;

    -- Delete oldest items that exceed the limit based on resource type
    CASE v_org.grace_period_resource_type
      WHEN 'facilities' THEN
        WITH to_delete AS (
          SELECT id FROM production_sites
          WHERE organization_id = v_org.id
          ORDER BY created_at ASC
          OFFSET v_limit
        )
        DELETE FROM production_sites WHERE id IN (SELECT id FROM to_delete);
        GET DIAGNOSTICS v_deleted = ROW_COUNT;

      WHEN 'products' THEN
        WITH to_delete AS (
          SELECT id FROM products
          WHERE organization_id = v_org.id
          ORDER BY created_at ASC
          OFFSET v_limit
        )
        DELETE FROM products WHERE id IN (SELECT id FROM to_delete);
        GET DIAGNOSTICS v_deleted = ROW_COUNT;

      WHEN 'team_members' THEN
        -- For team members, we remove the newest non-owner members
        WITH to_delete AS (
          SELECT om.id FROM organization_members om
          WHERE om.organization_id = v_org.id
            AND om.role != 'owner'
          ORDER BY om.created_at DESC
          LIMIT (
            SELECT COUNT(*) - v_limit
            FROM organization_members
            WHERE organization_id = v_org.id
          )
        )
        DELETE FROM organization_members WHERE id IN (SELECT id FROM to_delete);
        GET DIAGNOSTICS v_deleted = ROW_COUNT;

      WHEN 'lcas' THEN
        WITH to_delete AS (
          SELECT id FROM product_lcas
          WHERE organization_id = v_org.id
          ORDER BY created_at ASC
          OFFSET v_limit
        )
        DELETE FROM product_lcas WHERE id IN (SELECT id FROM to_delete);
        GET DIAGNOSTICS v_deleted = ROW_COUNT;

      WHEN 'suppliers' THEN
        WITH to_delete AS (
          SELECT id FROM suppliers
          WHERE organization_id = v_org.id
          ORDER BY created_at ASC
          OFFSET v_limit
        )
        DELETE FROM suppliers WHERE id IN (SELECT id FROM to_delete);
        GET DIAGNOSTICS v_deleted = ROW_COUNT;

      ELSE
        v_deleted := 0;
    END CASE;

    -- Clear the grace period
    UPDATE organizations
    SET
      grace_period_end = NULL,
      grace_period_resource_type = NULL,
      grace_period_previous_tier = NULL,
      grace_period_notified_at = NULL,
      updated_at = NOW()
    WHERE id = v_org.id;

    -- Log the auto-deletion event
    INSERT INTO subscription_history (
      organization_id,
      event_type,
      metadata
    )
    VALUES (
      v_org.id,
      'grace_period_auto_deletion',
      jsonb_build_object(
        'resource_type', v_org.grace_period_resource_type,
        'items_deleted', v_deleted
      )
    );

    -- Return the result for this organization
    organization_id := v_org.id;
    organization_name := v_org.name;
    resource_type := v_org.grace_period_resource_type;
    items_deleted := v_deleted;
    billing_email := v_org.billing_email;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ============================================================================
-- 7. Function to get organizations needing 3-day warning
-- ============================================================================

CREATE OR REPLACE FUNCTION get_grace_period_warnings()
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  billing_email TEXT,
  grace_period_end TIMESTAMPTZ,
  resource_type TEXT,
  days_remaining INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.billing_email,
    o.grace_period_end,
    o.grace_period_resource_type,
    EXTRACT(DAY FROM o.grace_period_end - NOW())::INT
  FROM organizations o
  WHERE o.grace_period_end IS NOT NULL
    AND o.grace_period_end > NOW()
    AND o.grace_period_end <= NOW() + INTERVAL '3 days'
    AND o.grace_period_notified_at IS NULL;
END;
$$;

-- ============================================================================
-- 8. Function to mark 3-day warning as sent
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_grace_period_warning_sent(
  p_organization_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE organizations
  SET grace_period_notified_at = NOW()
  WHERE id = p_organization_id;
END;
$$;

-- ============================================================================
-- 9. Function to log subscription changes
-- ============================================================================

CREATE OR REPLACE FUNCTION log_subscription_change(
  p_organization_id UUID,
  p_event_type TEXT,
  p_previous_tier TEXT DEFAULT NULL,
  p_new_tier TEXT DEFAULT NULL,
  p_previous_status TEXT DEFAULT NULL,
  p_new_status TEXT DEFAULT NULL,
  p_amount_charged NUMERIC DEFAULT NULL,
  p_amount_credited NUMERIC DEFAULT NULL,
  p_stripe_invoice_id TEXT DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_history_id UUID;
BEGIN
  INSERT INTO subscription_history (
    organization_id,
    event_type,
    previous_tier,
    new_tier,
    previous_status,
    new_status,
    amount_charged,
    amount_credited,
    stripe_invoice_id,
    changed_by,
    metadata
  )
  VALUES (
    p_organization_id,
    p_event_type,
    p_previous_tier,
    p_new_tier,
    p_previous_status,
    p_new_status,
    p_amount_charged,
    p_amount_credited,
    p_stripe_invoice_id,
    p_changed_by,
    p_metadata
  )
  RETURNING id INTO v_history_id;

  RETURN v_history_id;
END;
$$;

-- ============================================================================
-- 10. View for subscription history with organization details
-- ============================================================================

CREATE OR REPLACE VIEW subscription_history_with_details AS
SELECT
  sh.*,
  o.name as organization_name,
  u.email as changed_by_email,
  u.raw_user_meta_data->>'full_name' as changed_by_name
FROM subscription_history sh
LEFT JOIN organizations o ON sh.organization_id = o.id
LEFT JOIN auth.users u ON sh.changed_by = u.id;

-- Grant access to authenticated users
GRANT SELECT ON subscription_history_with_details TO authenticated;
