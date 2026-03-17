-- ==========================================================================
-- Pre-requisite: Add supplier columns needed by subsequent migrations
-- These columns were originally in 20260315000000_supplier_role_and_portal.sql
-- but are referenced by earlier migrations (20260219130000 onwards).
-- ==========================================================================

-- Add user_id to suppliers table (links auth user to their supplier record)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.suppliers
      ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers (user_id);
  END IF;
END$$;

-- Add contact_person_name to supplier_invitations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'supplier_invitations'
      AND column_name = 'contact_person_name'
  ) THEN
    ALTER TABLE public.supplier_invitations ADD COLUMN contact_person_name text;
  END IF;
END$$;
