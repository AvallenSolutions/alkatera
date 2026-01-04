/*
  # Simple Diagnostic - No column references that might not exist
*/

-- Show EVERY organization with their subscription tier
SELECT
  id,
  name,
  slug,
  subscription_tier,
  subscription_status
FROM organizations
ORDER BY created_at DESC;
