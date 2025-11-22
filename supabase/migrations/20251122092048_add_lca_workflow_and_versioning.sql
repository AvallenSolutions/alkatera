/*
  # Add LCA Workflow and Versioning Support
  
  1. Changes to `product_lcas` table
    - Add `lca_version` (TEXT) - Version identifier (e.g., "1.0", "2.0")
    - Add `lca_scope_type` (TEXT) - "cradle-to-gate" or "cradle-to-grave"
    - Add `parent_lca_id` (UUID) - Links extended LCAs to original
    - Add `goal_and_scope_confirmed` (BOOLEAN) - Tracks mandatory gateway completion
    - Add `goal_and_scope_confirmed_at` (TIMESTAMPTZ) - Audit timestamp
    - Add `goal_and_scope_confirmed_by` (UUID) - Audit trail
    - Add `draft_data` (JSONB) - Stores in-progress data with "draft" label
    - Add `is_draft` (BOOLEAN) - Distinguishes draft from completed sections
    - Add `ingredients_complete` (BOOLEAN) - Tab completion tracking
    - Add `packaging_complete` (BOOLEAN) - Tab completion tracking
    - Add `production_complete` (BOOLEAN) - Tab completion tracking
  
  2. New Table: `lca_workflow_audit`
    - Comprehensive audit trail for all workflow actions
    - Tracks step-by-step progress through LCA creation
    - Ensures ISO 14044 compliance documentation
  
  3. Changes to `products` table
    - Add `has_active_lca` (BOOLEAN) - Quick flag for UI state
    - Add `latest_lca_id` (UUID) - Direct reference to most recent completed LCA
  
  4. Security
    - Enable RLS on lca_workflow_audit table
    - Organization-based access control
  
  5. Notes
    - Supports phased analysis extension (Cradle-to-Gate → Cradle-to-Grave)
    - Complete audit trail for compliance
    - Version control for LCA iterations
*/

-- Add columns to product_lcas table
DO $$
BEGIN
  -- Version tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas' AND column_name = 'lca_version'
  ) THEN
    ALTER TABLE product_lcas ADD COLUMN lca_version TEXT DEFAULT '1.0';
  END IF;

  -- Scope type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas' AND column_name = 'lca_scope_type'
  ) THEN
    ALTER TABLE product_lcas ADD COLUMN lca_scope_type TEXT DEFAULT 'cradle-to-gate';
  END IF;

  -- Parent LCA reference for version chains
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas' AND column_name = 'parent_lca_id'
  ) THEN
    ALTER TABLE product_lcas ADD COLUMN parent_lca_id UUID REFERENCES product_lcas(id);
  END IF;

  -- Goal and scope confirmation tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas' AND column_name = 'goal_and_scope_confirmed'
  ) THEN
    ALTER TABLE product_lcas ADD COLUMN goal_and_scope_confirmed BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas' AND column_name = 'goal_and_scope_confirmed_at'
  ) THEN
    ALTER TABLE product_lcas ADD COLUMN goal_and_scope_confirmed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas' AND column_name = 'goal_and_scope_confirmed_by'
  ) THEN
    ALTER TABLE product_lcas ADD COLUMN goal_and_scope_confirmed_by UUID REFERENCES auth.users(id);
  END IF;

  -- Draft data storage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas' AND column_name = 'draft_data'
  ) THEN
    ALTER TABLE product_lcas ADD COLUMN draft_data JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas' AND column_name = 'is_draft'
  ) THEN
    ALTER TABLE product_lcas ADD COLUMN is_draft BOOLEAN DEFAULT true;
  END IF;

  -- Tab completion tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas' AND column_name = 'ingredients_complete'
  ) THEN
    ALTER TABLE product_lcas ADD COLUMN ingredients_complete BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas' AND column_name = 'packaging_complete'
  ) THEN
    ALTER TABLE product_lcas ADD COLUMN packaging_complete BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lcas' AND column_name = 'production_complete'
  ) THEN
    ALTER TABLE product_lcas ADD COLUMN production_complete BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create lca_workflow_audit table
CREATE TABLE IF NOT EXISTS lca_workflow_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_lca_id UUID NOT NULL REFERENCES product_lcas(id) ON DELETE CASCADE,
  workflow_step TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for lca_workflow_audit
CREATE INDEX IF NOT EXISTS idx_lca_workflow_audit_lca_id ON lca_workflow_audit(product_lca_id);
CREATE INDEX IF NOT EXISTS idx_lca_workflow_audit_user_id ON lca_workflow_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_lca_workflow_audit_created_at ON lca_workflow_audit(created_at DESC);

-- Enable RLS on lca_workflow_audit
ALTER TABLE lca_workflow_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy for lca_workflow_audit
CREATE POLICY "Users can view audit logs for their organization's LCAs"
ON lca_workflow_audit
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM product_lcas
    JOIN organization_members ON product_lcas.organization_id = organization_members.organization_id
    WHERE product_lcas.id = lca_workflow_audit.product_lca_id
    AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert audit logs for their organization's LCAs"
ON lca_workflow_audit
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM product_lcas
    JOIN organization_members ON product_lcas.organization_id = organization_members.organization_id
    WHERE product_lcas.id = lca_workflow_audit.product_lca_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Add columns to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'has_active_lca'
  ) THEN
    ALTER TABLE products ADD COLUMN has_active_lca BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'latest_lca_id'
  ) THEN
    ALTER TABLE products ADD COLUMN latest_lca_id UUID REFERENCES product_lcas(id);
  END IF;
END $$;

-- Create indexes for product_lcas new columns
CREATE INDEX IF NOT EXISTS idx_product_lcas_parent_lca_id ON product_lcas(parent_lca_id);
CREATE INDEX IF NOT EXISTS idx_product_lcas_lca_scope_type ON product_lcas(lca_scope_type);
CREATE INDEX IF NOT EXISTS idx_product_lcas_is_draft ON product_lcas(is_draft);

-- Add comments for documentation
COMMENT ON COLUMN product_lcas.lca_version IS 'Version identifier for tracking LCA iterations (e.g., "1.0", "2.0")';
COMMENT ON COLUMN product_lcas.lca_scope_type IS 'System boundary scope: "cradle-to-gate" or "cradle-to-grave"';
COMMENT ON COLUMN product_lcas.parent_lca_id IS 'Links extended LCAs to their parent version (e.g., v2.0 references v1.0)';
COMMENT ON COLUMN product_lcas.goal_and_scope_confirmed IS 'ISO 14044 compliance: Has user confirmed goal and scope definition?';
COMMENT ON COLUMN product_lcas.draft_data IS 'JSONB storage for in-progress data entries before finalization';
COMMENT ON COLUMN product_lcas.is_draft IS 'TRUE if any section is incomplete; FALSE when all data finalized';
COMMENT ON TABLE lca_workflow_audit IS 'Audit trail for LCA workflow actions, ensuring ISO 14044 compliance documentation';
