import type { Organization } from '@/lib/organizationContext';

/**
 * Check whether an organisation is eligible for viticulture features.
 * Only Wine producers and the alkatera platform admin (demo) account see
 * vineyard-related UI. This is a UI visibility check; the server-side
 * beta feature flag (`viticulture_beta`) remains the authoritative gate.
 */
export function isViticultureEligible(
  org: Pick<Organization, 'product_type'> | null | undefined,
  isAlkateraAdmin: boolean
): boolean {
  if (isAlkateraAdmin) return true;
  return org?.product_type === 'Wine';
}
