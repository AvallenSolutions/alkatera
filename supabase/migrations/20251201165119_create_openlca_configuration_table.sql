/*
  # OpenLCA Configuration Management
  
  ## Overview
  Store per-organization OpenLCA server configuration, impact method preferences,
  and calculation settings for automated LCA calculations with Ecoinvent database.
  
  ## New Tables
  
  ### `openlca_configurations`
  Stores OpenLCA server connection settings and preferences per organization
  
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key, unique) - One config per organization
  - `server_url` (text) - OpenLCA IPC server URL (e.g., http://localhost:8080)
  - `database_name` (text) - Name of the active database (e.g., ecoinvent_312_cutoff)
  - `enabled` (boolean, default false) - Whether OpenLCA integration is active
  - `preferred_system_model` (text) - Ecoinvent system model: 'cutoff', 'apos', 'consequential'
  - `default_allocation_method` (text) - 'economic', 'physical', 'causal', 'none'
  - `prefer_unit_processes` (boolean, default true) - For transparency vs speed
  - `with_regionalization` (boolean, default true) - Enable geographic specificity
  - `impact_methods` (jsonb) - Array of configured impact methods with IDs
  - `calculation_defaults` (jsonb) - Default calculation settings
  - `last_health_check` (timestamptz) - Last successful server connectivity test
  - `server_version` (text) - OpenLCA server version for compatibility tracking
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ## Security
  - RLS enabled with organization-scoped policies
  - Only organization admins can modify configurations
  
  ## Performance
  - Index on organization_id for fast lookups
  - Index on enabled for filtering active configurations
*/

-- ============================================================================
-- Create openlca_configurations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.openlca_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  server_url text NOT NULL DEFAULT 'http://localhost:8080',
  database_name text NOT NULL DEFAULT 'ecoinvent_312_cutoff',
  enabled boolean NOT NULL DEFAULT false,
  preferred_system_model text DEFAULT 'cutoff',
  default_allocation_method text DEFAULT 'economic',
  prefer_unit_processes boolean DEFAULT true,
  with_regionalization boolean DEFAULT true,
  impact_methods jsonb DEFAULT '[]'::jsonb,
  calculation_defaults jsonb DEFAULT '{}'::jsonb,
  last_health_check timestamptz,
  server_version text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_org_config UNIQUE (organization_id),
  CONSTRAINT valid_system_model CHECK (preferred_system_model IN ('cutoff', 'apos', 'consequential')),
  CONSTRAINT valid_allocation CHECK (default_allocation_method IN ('economic', 'physical', 'causal', 'none'))
);

COMMENT ON TABLE public.openlca_configurations IS 'OpenLCA server configuration and calculation preferences per organization';

-- ============================================================================
-- Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_openlca_config_org_id 
  ON public.openlca_configurations(organization_id);

CREATE INDEX IF NOT EXISTS idx_openlca_config_enabled 
  ON public.openlca_configurations(enabled) 
  WHERE enabled = true;

-- ============================================================================
-- Enable RLS
-- ============================================================================

ALTER TABLE public.openlca_configurations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Policy: Organization members can view their org's OpenLCA configuration
CREATE POLICY "Organization members can view OpenLCA configuration"
  ON public.openlca_configurations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = openlca_configurations.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Policy: Organization admins can insert OpenLCA configuration
CREATE POLICY "Organization admins can create OpenLCA configuration"
  ON public.openlca_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_organization_admin(openlca_configurations.organization_id)
  );

-- Policy: Organization admins can update OpenLCA configuration
CREATE POLICY "Organization admins can update OpenLCA configuration"
  ON public.openlca_configurations
  FOR UPDATE
  TO authenticated
  USING (
    is_organization_admin(openlca_configurations.organization_id)
  )
  WITH CHECK (
    is_organization_admin(openlca_configurations.organization_id)
  );

-- Policy: Organization admins can delete OpenLCA configuration
CREATE POLICY "Organization admins can delete OpenLCA configuration"
  ON public.openlca_configurations
  FOR DELETE
  TO authenticated
  USING (
    is_organization_admin(openlca_configurations.organization_id)
  );

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_openlca_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_openlca_config_timestamp
  BEFORE UPDATE ON public.openlca_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_openlca_config_updated_at();

-- ============================================================================
-- Example impact methods JSONB structure (for documentation)
-- ============================================================================

COMMENT ON COLUMN public.openlca_configurations.impact_methods IS 
'Array of configured impact methods. Example: 
[
  {
    "name": "IPCC 2021",
    "id": "uuid-of-ipcc-method",
    "enabled": true,
    "categories": ["Climate change - GWP100", "Climate change - GWP100 (fossil)", "Climate change - GWP100 (biogenic)"]
  },
  {
    "name": "AWARE 1.2",
    "id": "uuid-of-aware-method",
    "enabled": true,
    "categories": ["Water scarcity"]
  },
  {
    "name": "EF 3.1",
    "id": "uuid-of-ef31-method",
    "enabled": true,
    "categories": ["Land use"]
  }
]';

COMMENT ON COLUMN public.openlca_configurations.calculation_defaults IS 
'Default calculation settings. Example:
{
  "cutoff": 0.001,
  "monte_carlo_runs": 1000,
  "provider_linking": "PREFER_DEFAULTS",
  "timeout_seconds": 300
}';
