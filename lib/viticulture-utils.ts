import type { Organization } from '@/lib/organizationContext';
import { parseWorksWith } from '@/lib/subscription/works-with';

/**
 * Check whether an organisation is eligible for viticulture features.
 * Wine producers, admins, and any org that has declared the module in
 * `works_with` see vineyard-related UI. This is a UI visibility check; the
 * Canopy tier gate (`hasFeature('viticulture')`) remains authoritative.
 */
export function isViticultureEligible(
  org: Pick<Organization, 'product_type' | 'works_with'> | null | undefined,
  isAlkateraAdmin: boolean
): boolean {
  if (isAlkateraAdmin) return true;
  if (parseWorksWith(org?.works_with).includes('viticulture')) return true;
  return org?.product_type === 'Wine';
}
