/*
  # Add Subscription Tiers and Methodology Access Control

  ## Overview
  This migration implements a tiered subscription system that controls access to 
  LCA methodologies. Basic tier gets ReCiPe 2016, while Premium and Enterprise 
  tiers unlock EF 3.1 with full PEF/OEF compliance capabilities.

  ## Changes to `organizations` Table
  
  ### New Columns
  - `subscription_tier` (text) - basic, premium, enterprise
  - `subscription_status` (text) - active, trial, suspended, cancelled
  - `subscription_started_at` (timestamptz) - When subscription began
  - `subscription_expires_at` (timestamptz) - When current period ends
  - `methodology_access` (jsonb) - List of accessible methodologies
  - `feature_flags` (jsonb) - Granular feature access control
  - `billing_email` (text) - Email for billing notifications

  ## New Table: `subscription_tier_features`
  Defines which features/methodologies are available per tier:
  - tier_name (text)
  - feature_name (text)
  - enabled (boolean)

  ## New Table: `lca_methodology_audit_log`
  Tracks methodology access attempts for compliance:
  - organization_id
  - user_id
  - methodology_requested
  - access_granted
  - denial_reason

  ## Tier Feature Matrix
  
  | Feature                     | Basic | Premium | Enterprise |
  |-----------------------------|-------|---------|------------|
  | ReCiPe 2016 Midpoint        | Yes   | Yes     | Yes        |
  | EF 3.1 (16 categories)      | No    | Yes     | Yes        |
  | EF 3.1 Single Score         | No    | Yes     | Yes        |
  | Custom Weighting Sets       | No    | No      | Yes        |
  | PEF Compliance Reports      | No    | Yes     | Yes        |
  | API Access                  | No    | Limited | Full       |
  | Multi-product Comparison    | 5/mo  | 50/mo   | Unlimited  |
  | White-label Reports         | No    | No      | Yes        |

  ## Security
  - All new columns have appropriate RLS
  - Methodology access is verified at calculation time
  - Audit log tracks all access attempts
*/

-- =====================================================
-- STEP 1: ADD SUBSCRIPTION COLUMNS TO ORGANIZATIONS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN subscription_tier TEXT DEFAULT 'basic';

    COMMENT ON COLUMN public.organizations.subscription_tier IS
      'Subscription tier: "basic" (ReCiPe 2016), "premium" (+ EF 3.1), "enterprise" (+ custom weights, API).';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN subscription_status TEXT DEFAULT 'active';

    COMMENT ON COLUMN public.organizations.subscription_status IS
      'Subscription status: "active", "trial", "suspended", "cancelled".';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'subscription_started_at'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN subscription_started_at TIMESTAMPTZ DEFAULT now();

    COMMENT ON COLUMN public.organizations.subscription_started_at IS
      'When the current subscription period started.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'subscription_expires_at'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN subscription_expires_at TIMESTAMPTZ DEFAULT NULL;

    COMMENT ON COLUMN public.organizations.subscription_expires_at IS
      'When the current subscription period expires. NULL for non-expiring.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'methodology_access'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN methodology_access JSONB DEFAULT '["recipe_2016"]'::jsonb;

    COMMENT ON COLUMN public.organizations.methodology_access IS
      'Array of accessible LCA methodologies based on subscription tier.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'feature_flags'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN feature_flags JSONB DEFAULT '{}'::jsonb;

    COMMENT ON COLUMN public.organizations.feature_flags IS
      'Granular feature flags for fine-grained access control.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'organizations'
    AND column_name = 'billing_email'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN billing_email TEXT DEFAULT NULL;

    COMMENT ON COLUMN public.organizations.billing_email IS
      'Email address for billing and subscription notifications.';
  END IF;
END $$;

-- Add constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_subscription_tier'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT valid_subscription_tier
      CHECK (subscription_tier IN ('basic', 'premium', 'enterprise'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_subscription_status'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT valid_subscription_status
      CHECK (subscription_status IN ('active', 'trial', 'suspended', 'cancelled'));
  END IF;
END $$;

-- =====================================================
-- STEP 2: CREATE SUBSCRIPTION TIER FEATURES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.subscription_tier_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  feature_code TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  feature_description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  usage_limit INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tier_name, feature_code),
  CONSTRAINT valid_tier CHECK (tier_name IN ('basic', 'premium', 'enterprise'))
);

COMMENT ON TABLE public.subscription_tier_features IS
  'Defines which features are available for each subscription tier.';

ALTER TABLE public.subscription_tier_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tier features"
  ON public.subscription_tier_features
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- STEP 3: POPULATE TIER FEATURES
-- =====================================================

INSERT INTO public.subscription_tier_features (tier_name, feature_code, feature_name, feature_description, enabled, usage_limit) VALUES
  -- Basic Tier
  ('basic', 'recipe_2016', 'ReCiPe 2016 Midpoint', '18 impact categories using ReCiPe 2016 methodology', true, NULL),
  ('basic', 'ef_31', 'EF 3.1 Methodology', '16 EF 3.1 impact categories with PEF compliance', false, NULL),
  ('basic', 'ef_31_single_score', 'EF 3.1 Single Score', 'Normalised and weighted single score calculation', false, NULL),
  ('basic', 'custom_weighting', 'Custom Weighting Sets', 'Create custom weighting sets for single score', false, NULL),
  ('basic', 'pef_reports', 'PEF Compliance Reports', 'Export PEF-compliant PDF reports', false, NULL),
  ('basic', 'api_access', 'API Access', 'Programmatic access to LCA calculations', false, NULL),
  ('basic', 'product_comparison', 'Multi-product Comparison', 'Compare LCA results across products', true, 5),
  ('basic', 'white_label', 'White-label Reports', 'Custom branding on reports', false, NULL),
  
  -- Premium Tier
  ('premium', 'recipe_2016', 'ReCiPe 2016 Midpoint', '18 impact categories using ReCiPe 2016 methodology', true, NULL),
  ('premium', 'ef_31', 'EF 3.1 Methodology', '16 EF 3.1 impact categories with PEF compliance', true, NULL),
  ('premium', 'ef_31_single_score', 'EF 3.1 Single Score', 'Normalised and weighted single score calculation', true, NULL),
  ('premium', 'custom_weighting', 'Custom Weighting Sets', 'Create custom weighting sets for single score', false, NULL),
  ('premium', 'pef_reports', 'PEF Compliance Reports', 'Export PEF-compliant PDF reports', true, NULL),
  ('premium', 'api_access', 'API Access', 'Programmatic access to LCA calculations', true, 1000),
  ('premium', 'product_comparison', 'Multi-product Comparison', 'Compare LCA results across products', true, 50),
  ('premium', 'white_label', 'White-label Reports', 'Custom branding on reports', false, NULL),
  
  -- Enterprise Tier
  ('enterprise', 'recipe_2016', 'ReCiPe 2016 Midpoint', '18 impact categories using ReCiPe 2016 methodology', true, NULL),
  ('enterprise', 'ef_31', 'EF 3.1 Methodology', '16 EF 3.1 impact categories with PEF compliance', true, NULL),
  ('enterprise', 'ef_31_single_score', 'EF 3.1 Single Score', 'Normalised and weighted single score calculation', true, NULL),
  ('enterprise', 'custom_weighting', 'Custom Weighting Sets', 'Create custom weighting sets for single score', true, NULL),
  ('enterprise', 'pef_reports', 'PEF Compliance Reports', 'Export PEF-compliant PDF reports', true, NULL),
  ('enterprise', 'api_access', 'API Access', 'Programmatic access to LCA calculations', true, NULL),
  ('enterprise', 'product_comparison', 'Multi-product Comparison', 'Compare LCA results across products', true, NULL),
  ('enterprise', 'white_label', 'White-label Reports', 'Custom branding on reports', true, NULL)
ON CONFLICT (tier_name, feature_code) DO NOTHING;

-- =====================================================
-- STEP 4: CREATE METHODOLOGY ACCESS AUDIT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lca_methodology_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_lca_id UUID REFERENCES public.product_lcas(id) ON DELETE SET NULL,
  methodology_requested TEXT NOT NULL,
  access_granted BOOLEAN NOT NULL,
  denial_reason TEXT,
  request_context JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.lca_methodology_audit_log IS
  'Audit log tracking all methodology access requests for compliance and billing.';

CREATE INDEX IF NOT EXISTS idx_methodology_audit_org
  ON public.lca_methodology_audit_log(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_methodology_audit_user
  ON public.lca_methodology_audit_log(user_id, created_at DESC);

ALTER TABLE public.lca_methodology_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization audit logs"
  ON public.lca_methodology_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.roles r ON om.role_id = r.id
      WHERE om.organization_id = lca_methodology_audit_log.organization_id
      AND om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- =====================================================
-- STEP 5: CREATE HELPER FUNCTION TO CHECK METHODOLOGY ACCESS
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_methodology_access(
  p_organization_id UUID,
  p_methodology TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
  v_has_access BOOLEAN;
BEGIN
  SELECT subscription_tier, subscription_status
  INTO v_tier, v_status
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_tier IS NULL THEN
    RETURN false;
  END IF;

  IF v_status != 'active' AND v_status != 'trial' THEN
    RETURN false;
  END IF;

  SELECT enabled INTO v_has_access
  FROM public.subscription_tier_features
  WHERE tier_name = v_tier
  AND feature_code = p_methodology;

  RETURN COALESCE(v_has_access, false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.check_methodology_access IS
  'Checks if an organization has access to a specific LCA methodology based on their subscription tier.';

-- =====================================================
-- STEP 6: CREATE FUNCTION TO GET AVAILABLE METHODOLOGIES
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_available_methodologies(
  p_organization_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_tier TEXT;
  v_result JSONB := '[]'::jsonb;
BEGIN
  SELECT subscription_tier INTO v_tier
  FROM public.organizations
  WHERE id = p_organization_id;

  SELECT jsonb_agg(jsonb_build_object(
    'code', feature_code,
    'name', feature_name,
    'enabled', enabled,
    'usage_limit', usage_limit
  ))
  INTO v_result
  FROM public.subscription_tier_features
  WHERE tier_name = v_tier
  AND feature_code IN ('recipe_2016', 'ef_31', 'ef_31_single_score');

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_available_methodologies IS
  'Returns list of available LCA methodologies for an organization based on their tier.';

-- =====================================================
-- STEP 7: CREATE FUNCTION TO LOG METHODOLOGY ACCESS
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_methodology_access(
  p_organization_id UUID,
  p_user_id UUID,
  p_product_lca_id UUID,
  p_methodology TEXT,
  p_granted BOOLEAN,
  p_denial_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.lca_methodology_audit_log (
    organization_id,
    user_id,
    product_lca_id,
    methodology_requested,
    access_granted,
    denial_reason
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_product_lca_id,
    p_methodology,
    p_granted,
    p_denial_reason
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_methodology_access IS
  'Logs a methodology access attempt for audit and compliance purposes.';

-- =====================================================
-- STEP 8: UPDATE EXISTING ORGANIZATIONS WITH DEFAULT TIER
-- =====================================================

UPDATE public.organizations
SET 
  subscription_tier = 'basic',
  subscription_status = 'active',
  methodology_access = '["recipe_2016"]'::jsonb,
  feature_flags = '{}'::jsonb
WHERE subscription_tier IS NULL;

-- =====================================================
-- STEP 9: CREATE VIEW FOR ORGANIZATION SUBSCRIPTION STATUS
-- =====================================================

CREATE OR REPLACE VIEW public.organization_subscription_summary AS
SELECT 
  o.id AS organization_id,
  o.name AS organization_name,
  o.subscription_tier,
  o.subscription_status,
  o.subscription_started_at,
  o.subscription_expires_at,
  o.methodology_access,
  (SELECT COUNT(*) FROM public.product_lcas pl WHERE pl.organization_id = o.id) AS total_lcas,
  (SELECT COUNT(*) FROM public.product_lcas pl WHERE pl.organization_id = o.id AND pl.lca_methodology = 'ef_31') AS ef31_lcas,
  (
    SELECT jsonb_agg(jsonb_build_object('code', f.feature_code, 'enabled', f.enabled))
    FROM public.subscription_tier_features f
    WHERE f.tier_name = o.subscription_tier
  ) AS tier_features
FROM public.organizations o;

COMMENT ON VIEW public.organization_subscription_summary IS
  'Summary view of organization subscription status and methodology usage.';

-- =====================================================
-- STEP 10: VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_org_columns INTEGER;
  v_tier_features INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_org_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'organizations'
  AND column_name IN ('subscription_tier', 'subscription_status', 'methodology_access', 'feature_flags');

  SELECT COUNT(*) INTO v_tier_features
  FROM public.subscription_tier_features;

  RAISE NOTICE 'Subscription Tier Migration Summary:';
  RAISE NOTICE '  Organization columns added: % (expected 4+)', v_org_columns;
  RAISE NOTICE '  Tier features defined: % (expected 24: 8 per tier x 3 tiers)', v_tier_features;
  RAISE NOTICE '  Helper functions: check_methodology_access, get_available_methodologies, log_methodology_access';
  RAISE NOTICE '  Migration completed successfully';
END $$;
