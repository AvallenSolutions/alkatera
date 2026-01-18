/*
  # Fix subscription_tier default value

  ## Problem
  The subscription_tier column has a default value of 'basic' but the constraint
  only allows: NULL, 'seed', 'blossom', 'canopy'. This causes organization creation
  to fail with: "violates check constraint valid_subscription_tier"

  ## Solution
  1. Update the default value from 'basic' to 'seed'
  2. Fix any existing organizations that may have 'basic' as their tier
*/

-- Update the default value for new organizations
ALTER TABLE organizations
ALTER COLUMN subscription_tier SET DEFAULT 'seed';

-- Fix any existing organizations with the invalid 'basic' tier
UPDATE organizations
SET subscription_tier = 'seed'
WHERE subscription_tier = 'basic';
