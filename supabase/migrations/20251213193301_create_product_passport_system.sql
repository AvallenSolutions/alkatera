/*
  # Product Passport System Implementation

  ## Overview
  Creates a public-facing "Live Passport" feature for products, allowing organizations
  to generate shareable public URLs with QR codes. Access respects subscription tier limits:
  - Seed: GHG emissions only
  - Blossom: GHG, Water, Waste with EF 3.1 and ReCiPe 2016
  - Canopy: GHG, Water, Waste, Biodiversity with full methodology access

  ## Changes

  ### 1. Products Table Enhancements
  - `passport_enabled` (boolean) - Controls public access to product passport
  - `passport_token` (text, unique) - Secure token for public URL
  - `passport_settings` (jsonb) - Display preferences and customisation
  - `passport_views_count` (integer) - Total number of passport views
  - `passport_last_viewed_at` (timestamptz) - Last time passport was accessed

  ### 2. Passport Views Analytics Table
  - `passport_views` - Tracks anonymous viewing analytics
  - Includes timestamp, user agent, referer for basic analytics
  - Respects privacy with minimal data collection

  ### 3. Security
  - RLS policy allowing anonymous SELECT for enabled passports only
  - Token generation function for secure random URLs
  - Rate limiting considerations via view tracking

  ## Migration Safety
  - All new columns nullable with safe defaults
  - Existing products remain unaffected (passport_enabled defaults to false)
  - No data loss or breaking changes
*/

-- =====================================================
-- PRODUCTS TABLE: Add Passport Fields
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'passport_enabled'
  ) THEN
    ALTER TABLE products
    ADD COLUMN passport_enabled BOOLEAN DEFAULT false;

    COMMENT ON COLUMN products.passport_enabled IS
    'Controls whether this product has a public-facing passport page accessible without authentication';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'passport_token'
  ) THEN
    ALTER TABLE products
    ADD COLUMN passport_token TEXT UNIQUE;

    COMMENT ON COLUMN products.passport_token IS
    'Unique secure token used in public passport URLs. Generated automatically when passport is enabled.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'passport_settings'
  ) THEN
    ALTER TABLE products
    ADD COLUMN passport_settings JSONB DEFAULT '{}'::jsonb;

    COMMENT ON COLUMN products.passport_settings IS
    'JSON settings for passport display preferences (e.g., which metrics to show/hide, branding options)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'passport_views_count'
  ) THEN
    ALTER TABLE products
    ADD COLUMN passport_views_count INTEGER DEFAULT 0;

    COMMENT ON COLUMN products.passport_views_count IS
    'Total number of times this product passport has been viewed publicly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'passport_last_viewed_at'
  ) THEN
    ALTER TABLE products
    ADD COLUMN passport_last_viewed_at TIMESTAMPTZ;

    COMMENT ON COLUMN products.passport_last_viewed_at IS
    'Timestamp of the most recent public passport view';
  END IF;
END $$;

-- =====================================================
-- INDEXES: Performance Optimization
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_products_passport_token
ON products (passport_token)
WHERE passport_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_passport_enabled
ON products (passport_enabled)
WHERE passport_enabled = true;

-- =====================================================
-- PASSPORT TOKEN GENERATION FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION generate_passport_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_token TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 32-character token using URL-safe characters
    new_token := encode(gen_random_bytes(24), 'base64');
    new_token := replace(new_token, '/', '_');
    new_token := replace(new_token, '+', '-');
    new_token := replace(new_token, '=', '');
    
    -- Check if token already exists
    SELECT EXISTS(
      SELECT 1 FROM products WHERE passport_token = new_token
    ) INTO token_exists;
    
    -- Exit loop if unique token generated
    EXIT WHEN NOT token_exists;
  END LOOP;
  
  RETURN new_token;
END;
$$;

COMMENT ON FUNCTION generate_passport_token IS
'Generates a cryptographically secure random token for product passport URLs';

-- =====================================================
-- PASSPORT VIEWS ANALYTICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS passport_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_passport_views_product_id
ON passport_views (product_id);

CREATE INDEX IF NOT EXISTS idx_passport_views_viewed_at
ON passport_views (viewed_at DESC);

-- Enable RLS
ALTER TABLE passport_views ENABLE ROW LEVEL SECURITY;

-- Policy: Organization members can view their product's passport analytics
CREATE POLICY "Organization members can view passport analytics"
ON passport_views
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM products
    JOIN organization_members ON products.organization_id = organization_members.organization_id
    WHERE products.id = passport_views.product_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Policy: Allow anonymous insert for tracking views (no read access)
CREATE POLICY "Allow anonymous view tracking"
ON passport_views
FOR INSERT
TO anon
WITH CHECK (true);

COMMENT ON TABLE passport_views IS
'Analytics tracking for product passport views. Minimal data collection for privacy.';

-- =====================================================
-- RLS POLICY: Public Passport Access
-- =====================================================

-- Policy: Allow anonymous users to view products with enabled passports
CREATE POLICY "Public access to enabled product passports"
ON products
FOR SELECT
TO anon
USING (passport_enabled = true);

-- =====================================================
-- HELPER FUNCTION: Record Passport View
-- =====================================================

CREATE OR REPLACE FUNCTION record_passport_view(
  p_token TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_referer TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_id BIGINT;
  v_result JSONB;
BEGIN
  -- Find product by token
  SELECT id INTO v_product_id
  FROM products
  WHERE passport_token = p_token
  AND passport_enabled = true;

  -- If product not found or passport not enabled, return error
  IF v_product_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or disabled passport token'
    );
  END IF;

  -- Insert view record
  INSERT INTO passport_views (product_id, user_agent, referer)
  VALUES (v_product_id, p_user_agent, p_referer);

  -- Update product view count and last viewed timestamp
  UPDATE products
  SET 
    passport_views_count = COALESCE(passport_views_count, 0) + 1,
    passport_last_viewed_at = now()
  WHERE id = v_product_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'product_id', v_product_id
  );
END;
$$;

COMMENT ON FUNCTION record_passport_view IS
'Records a passport view event and updates product analytics. Called from public passport pages.';

-- =====================================================
-- HELPER FUNCTION: Enable Product Passport
-- =====================================================

CREATE OR REPLACE FUNCTION enable_product_passport(p_product_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
  v_org_id UUID;
BEGIN
  -- Verify user has access to this product
  SELECT products.organization_id INTO v_org_id
  FROM products
  JOIN organization_members ON products.organization_id = organization_members.organization_id
  WHERE products.id = p_product_id
  AND organization_members.user_id = auth.uid();

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Product not found or access denied'
    );
  END IF;

  -- Generate token if not exists
  SELECT passport_token INTO v_token
  FROM products
  WHERE id = p_product_id;

  IF v_token IS NULL THEN
    v_token := generate_passport_token();
  END IF;

  -- Enable passport and set token
  UPDATE products
  SET 
    passport_enabled = true,
    passport_token = v_token
  WHERE id = p_product_id;

  -- Return success with token
  RETURN jsonb_build_object(
    'success', true,
    'token', v_token
  );
END;
$$;

COMMENT ON FUNCTION enable_product_passport IS
'Enables product passport and generates token. Only accessible by organization members.';

-- =====================================================
-- HELPER FUNCTION: Disable Product Passport
-- =====================================================

CREATE OR REPLACE FUNCTION disable_product_passport(p_product_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Verify user has access to this product
  SELECT products.organization_id INTO v_org_id
  FROM products
  JOIN organization_members ON products.organization_id = organization_members.organization_id
  WHERE products.id = p_product_id
  AND organization_members.user_id = auth.uid();

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Product not found or access denied'
    );
  END IF;

  -- Disable passport (keep token for potential re-enable)
  UPDATE products
  SET passport_enabled = false
  WHERE id = p_product_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true
  );
END;
$$;

COMMENT ON FUNCTION disable_product_passport IS
'Disables product passport. Token is retained for potential re-enabling.';
