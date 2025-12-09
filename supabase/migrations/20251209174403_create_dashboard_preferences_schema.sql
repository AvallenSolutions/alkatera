/*
  # Dashboard Preferences Schema

  1. New Tables
    - `dashboard_widgets` - Defines available widget types with metadata
      - `id` (text, primary key) - Unique widget identifier
      - `name` (text) - Display name for the widget
      - `description` (text) - Brief description of what the widget shows
      - `category` (text) - Widget category (metrics, activity, navigation, etc.)
      - `default_size` (text) - Default size: compact, standard, expanded
      - `min_col_span` (integer) - Minimum column span (1-4)
      - `max_col_span` (integer) - Maximum column span (1-4)
      - `icon` (text) - Lucide icon name
      - `is_active` (boolean) - Whether widget is available
      - `requires_data` (text[]) - Data sources required for this widget
      - `created_at` (timestamptz) - Creation timestamp

    - `user_dashboard_preferences` - Stores per-user widget configuration
      - `id` (uuid, primary key) - Unique preference record ID
      - `user_id` (uuid, foreign key) - Reference to auth.users
      - `organization_id` (uuid, foreign key) - Reference to organizations
      - `widget_id` (text, foreign key) - Reference to dashboard_widgets
      - `enabled` (boolean) - Whether widget is shown
      - `display_order` (integer) - Order position in dashboard
      - `col_span` (integer) - Number of columns widget spans
      - `row_span` (integer) - Number of rows widget spans
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on both tables
    - Users can only view/modify their own preferences
    - All authenticated users can view widget definitions

  3. Default Data
    - Seed initial widget definitions
*/

-- =====================================================
-- DASHBOARD_WIDGETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  default_size text NOT NULL DEFAULT 'standard',
  min_col_span integer NOT NULL DEFAULT 1,
  max_col_span integer NOT NULL DEFAULT 4,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  requires_data text[] DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view widgets"
  ON dashboard_widgets FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- USER_DASHBOARD_PREFERENCES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  widget_id text NOT NULL REFERENCES dashboard_widgets(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  col_span integer NOT NULL DEFAULT 2,
  row_span integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, organization_id, widget_id)
);

ALTER TABLE user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dashboard preferences"
  ON user_dashboard_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboard preferences"
  ON user_dashboard_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard preferences"
  ON user_dashboard_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboard preferences"
  ON user_dashboard_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_dashboard_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_dashboard_preferences_timestamp ON user_dashboard_preferences;
CREATE TRIGGER update_dashboard_preferences_timestamp
  BEFORE UPDATE ON user_dashboard_preferences
  FOR EACH ROW EXECUTE FUNCTION update_dashboard_preferences_updated_at();

-- =====================================================
-- SEED DASHBOARD WIDGETS
-- =====================================================
INSERT INTO dashboard_widgets (id, name, description, category, default_size, min_col_span, max_col_span, icon, is_active, requires_data, sort_order)
VALUES
  ('headline-metrics', 'Headline Metrics', 'Large hero card showing total carbon footprint with Scope 1/2/3 breakdown', 'metrics', 'expanded', 2, 4, 'Leaf', true, ARRAY['company_metrics'], 1),
  ('quick-actions', 'Quick Actions', 'Shortcuts to key platform actions like adding products and logging production', 'navigation', 'standard', 2, 4, 'Zap', true, ARRAY[]::text[], 2),
  ('ghg-summary', 'GHG Emissions Summary', 'Greenhouse gas emissions breakdown by scope', 'metrics', 'standard', 1, 2, 'Cloud', true, ARRAY['ghg_hotspots'], 3),
  ('supplier-engagement', 'Supplier Engagement', 'Supply chain engagement status donut chart', 'metrics', 'compact', 1, 2, 'Users', true, ARRAY['suppliers'], 4),
  ('recent-activity', 'Recent Activity', 'Latest updates and changes in your organisation', 'activity', 'compact', 1, 2, 'Activity', true, ARRAY['activity_stream'], 5),
  ('data-quality', 'Data Quality', 'Data quality distribution and upgrade opportunities', 'metrics', 'standard', 1, 2, 'BarChart3', true, ARRAY['data_quality'], 6),
  ('product-lca-status', 'Product LCA Status', 'Overview of products with completed vs pending LCAs', 'metrics', 'standard', 1, 2, 'Package', true, ARRAY['products'], 7),
  ('getting-started', 'Getting Started', 'Onboarding checklist for new users', 'navigation', 'expanded', 2, 4, 'Rocket', true, ARRAY[]::text[], 8),
  ('annual-progress', 'Annual Footprint Progress', 'Progress towards annual reporting completion', 'metrics', 'compact', 1, 2, 'Target', true, ARRAY['company_metrics'], 9),
  ('water-risk', 'Water Risk Overview', 'Facility water scarcity risk summary', 'metrics', 'compact', 1, 2, 'Droplet', true, ARRAY['company_metrics'], 10),
  ('emissions-trend', 'Emissions Trend', 'Historical emissions trajectory chart', 'metrics', 'standard', 2, 4, 'TrendingDown', true, ARRAY['company_metrics'], 11),
  ('compliance-status', 'Compliance Status', 'CSRD and regulatory compliance readiness', 'metrics', 'compact', 1, 2, 'ShieldCheck', true, ARRAY['company_metrics'], 12)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  default_size = EXCLUDED.default_size,
  min_col_span = EXCLUDED.min_col_span,
  max_col_span = EXCLUDED.max_col_span,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active,
  requires_data = EXCLUDED.requires_data,
  sort_order = EXCLUDED.sort_order;

-- =====================================================
-- HELPER FUNCTION: Get default widget layout for user
-- =====================================================
CREATE OR REPLACE FUNCTION get_default_dashboard_layout()
RETURNS TABLE (
  widget_id text,
  widget_enabled boolean,
  widget_order integer,
  widget_col_span integer,
  widget_row_span integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dw.id,
    true,
    dw.sort_order,
    CASE dw.default_size
      WHEN 'compact' THEN 1
      WHEN 'standard' THEN 2
      WHEN 'expanded' THEN 4
      ELSE 2
    END,
    1
  FROM dashboard_widgets dw
  WHERE dw.is_active = true
  ORDER BY dw.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTION: Initialize dashboard preferences for user
-- =====================================================
CREATE OR REPLACE FUNCTION initialize_dashboard_preferences(
  p_user_id uuid,
  p_organization_id uuid
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_dashboard_preferences (user_id, organization_id, widget_id, enabled, display_order, col_span, row_span)
  SELECT 
    p_user_id,
    p_organization_id,
    widget_id,
    widget_enabled,
    widget_order,
    widget_col_span,
    widget_row_span
  FROM get_default_dashboard_layout()
  ON CONFLICT (user_id, organization_id, widget_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;