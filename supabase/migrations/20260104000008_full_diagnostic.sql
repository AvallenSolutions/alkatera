/*
  # Full Diagnostic - See ALL Organizations and Their Tiers
*/

-- Show EVERY organization with their subscription tier
SELECT
  id,
  name,
  slug,
  subscription_tier,
  subscription_status,
  is_platform_admin
FROM organizations
ORDER BY created_at DESC;

-- Count by tier
SELECT
  COALESCE(subscription_tier, 'NULL') as tier,
  COUNT(*) as count
FROM organizations
GROUP BY subscription_tier
ORDER BY tier;
