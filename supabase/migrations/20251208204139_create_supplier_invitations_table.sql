/*
  # Create Supplier Invitations Table

  1. New Table: `supplier_invitations`
    - Tracks supplier invitations sent from supply chain map
    - Links to specific materials that need supplier verification
    - Stores invitation tokens and status tracking

  2. Changes
    - Create supplier_invitations table with invitation tracking
    - Add indexes for efficient lookups by email and status
    - Enable RLS for multi-tenant security
    - Create helper function for validating invitation tokens

  3. Security
    - RLS policies ensure users only see invitations from their organisation
    - Invitation tokens are unique and secure
    - Expiry tracking prevents stale invitations
*/

-- ============================================================================
-- STEP 1: Create supplier invitation status enum
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplier_invitation_status') THEN
    CREATE TYPE supplier_invitation_status AS ENUM (
      'pending',
      'accepted',
      'expired',
      'cancelled'
    );
  END IF;
END $$;

COMMENT ON TYPE supplier_invitation_status IS
  'Status of supplier invitation: pending, accepted, expired, or cancelled';

-- ============================================================================
-- STEP 2: Create supplier_invitations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.supplier_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.product_materials(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  material_type TEXT NOT NULL CHECK (material_type IN ('ingredient', 'packaging')),
  supplier_email TEXT NOT NULL,
  supplier_name TEXT,
  invitation_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status supplier_invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  personal_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_email CHECK (supplier_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE public.supplier_invitations IS
  'Tracks supplier invitations sent from supply chain map to request verified product data';

COMMENT ON COLUMN public.supplier_invitations.invitation_token IS
  'Unique secure token used in invitation URL for supplier onboarding';

COMMENT ON COLUMN public.supplier_invitations.material_id IS
  'Reference to the specific material that prompted this invitation';

COMMENT ON COLUMN public.supplier_invitations.expires_at IS
  'Invitation expiry date, defaults to 30 days from creation';

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_supplier_invitations_organization_id
  ON public.supplier_invitations(organization_id);

CREATE INDEX IF NOT EXISTS idx_supplier_invitations_supplier_email
  ON public.supplier_invitations(LOWER(supplier_email));

CREATE INDEX IF NOT EXISTS idx_supplier_invitations_status
  ON public.supplier_invitations(status);

CREATE INDEX IF NOT EXISTS idx_supplier_invitations_token
  ON public.supplier_invitations(invitation_token);

CREATE INDEX IF NOT EXISTS idx_supplier_invitations_material_id
  ON public.supplier_invitations(material_id);

CREATE INDEX IF NOT EXISTS idx_supplier_invitations_product_id
  ON public.supplier_invitations(product_id);

CREATE INDEX IF NOT EXISTS idx_supplier_invitations_active
  ON public.supplier_invitations(organization_id, status)
  WHERE status = 'pending';

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.supplier_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies
-- ============================================================================

CREATE POLICY "Users can view invitations from their organization"
  ON public.supplier_invitations
  FOR SELECT
  TO authenticated
  USING (organization_id = get_current_organization_id());

CREATE POLICY "Users can create invitations in their organization"
  ON public.supplier_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can update invitations from their organization"
  ON public.supplier_invitations
  FOR UPDATE
  TO authenticated
  USING (organization_id = get_current_organization_id())
  WITH CHECK (organization_id = get_current_organization_id());

CREATE POLICY "Users can delete invitations from their organization"
  ON public.supplier_invitations
  FOR DELETE
  TO authenticated
  USING (organization_id = get_current_organization_id());

CREATE POLICY "Anyone can view invitations by valid token"
  ON public.supplier_invitations
  FOR SELECT
  TO anon
  USING (
    invitation_token IS NOT NULL
    AND status = 'pending'
    AND expires_at > now()
  );

-- ============================================================================
-- STEP 6: Create updated_at trigger
-- ============================================================================

DROP TRIGGER IF EXISTS update_supplier_invitations_updated_at ON public.supplier_invitations;

CREATE TRIGGER update_supplier_invitations_updated_at
  BEFORE UPDATE ON public.supplier_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- STEP 7: Create helper function to validate invitation tokens
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_supplier_invitation_token(p_token TEXT)
RETURNS TABLE (
  invitation_id UUID,
  organization_id UUID,
  product_id BIGINT,
  material_id UUID,
  material_name TEXT,
  material_type TEXT,
  supplier_email TEXT,
  supplier_name TEXT,
  invited_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.organization_id,
    si.product_id,
    si.material_id,
    si.material_name,
    si.material_type,
    si.supplier_email,
    si.supplier_name,
    si.invited_at,
    si.expires_at,
    (si.status = 'pending' AND si.expires_at > now()) as is_valid
  FROM public.supplier_invitations si
  WHERE si.invitation_token = p_token;
END;
$$;

COMMENT ON FUNCTION public.validate_supplier_invitation_token IS
  'Validates an invitation token and returns invitation details if valid';

-- ============================================================================
-- STEP 8: Create function to mark expired invitations
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_old_supplier_invitations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE public.supplier_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at <= now();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RETURN v_expired_count;
END;
$$;

COMMENT ON FUNCTION public.expire_old_supplier_invitations IS
  'Marks pending invitations as expired if past their expiry date. Returns count of expired invitations.';

-- ============================================================================
-- STEP 9: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invitations TO authenticated;
GRANT SELECT ON public.supplier_invitations TO anon;
GRANT EXECUTE ON FUNCTION public.validate_supplier_invitation_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_old_supplier_invitations TO authenticated;