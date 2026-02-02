-- Migration: Add 'pending' subscription status for new organisations
-- This ensures new organisations don't have full access until they complete payment

-- Step 1: Drop the existing constraint
ALTER TABLE public.organizations
DROP CONSTRAINT IF EXISTS valid_subscription_status;

-- Step 2: Add the new constraint with 'pending' status included
ALTER TABLE public.organizations
ADD CONSTRAINT valid_subscription_status
CHECK (subscription_status = ANY (ARRAY['active'::text, 'trial'::text, 'suspended'::text, 'cancelled'::text, 'pending'::text]));

-- Step 3: Change the default from 'active' to 'pending'
ALTER TABLE public.organizations
ALTER COLUMN subscription_status SET DEFAULT 'pending'::text;

-- Add comment explaining the status
COMMENT ON COLUMN public.organizations.subscription_status IS 'Subscription status: "active" (paid), "trial" (free trial), "pending" (awaiting payment), "suspended" (payment failed), "cancelled" (subscription ended).';
