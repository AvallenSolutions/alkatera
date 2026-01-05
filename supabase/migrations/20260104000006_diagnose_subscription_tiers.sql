/*
  # Diagnostic Query - Check Existing Subscription Tiers

  Run this to see what subscription tier values actually exist in your database.
  This will help us create the correct constraint.
*/

-- Show all unique subscription tier values currently in use
SELECT
  subscription_tier,
  COUNT(*) as organization_count,
  array_agg(slug) as organization_slugs
FROM organizations
WHERE subscription_tier IS NOT NULL
GROUP BY subscription_tier
ORDER BY subscription_tier;

-- Also show any NULL values
SELECT
  'NULL' as subscription_tier,
  COUNT(*) as organization_count
FROM organizations
WHERE subscription_tier IS NULL;
