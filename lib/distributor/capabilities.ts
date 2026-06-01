import type { DistributorOrganization } from '@/types/distributor';

/**
 * Capabilities the distributor portal gates on `is_procurement_partner`.
 *
 * Procurement partners get a free tier limited to "doing the work
 * Foodbuy needs them to do". Everything that would let them use
 * alka<strong>tera</strong> for their broader business (their own SKU uploads,
 * Discover, portfolio reports) is gated so we have a clear upgrade
 * narrative. Full subscribed distributors (`is_procurement_partner =
 * false`) can do everything.
 *
 * The gate is enforced both server-side (API routes return 402) and
 * client-side (UI shows an Unlock prompt instead of the action).
 */
export type DistributorCapability =
  | 'upload_own_sku_lists'
  | 'browse_discover'
  | 'export_portfolio_reports'
  | 'manual_alkatera_matching';

const PROCUREMENT_PARTNER_DENIED: ReadonlySet<DistributorCapability> = new Set<DistributorCapability>([
  'upload_own_sku_lists',
  'browse_discover',
  'export_portfolio_reports',
  'manual_alkatera_matching',
]);

/**
 * Does the given distributor org have access to the named capability?
 * Returns true for direct subscribers, false for procurement partners
 * on any gated capability.
 */
export function distributorCan(
  org: Pick<DistributorOrganization, 'is_procurement_partner'>,
  capability: DistributorCapability,
): boolean {
  if (!org.is_procurement_partner) return true;
  return !PROCUREMENT_PARTNER_DENIED.has(capability);
}

/**
 * Human-readable label used in the upgrade prompt for each capability.
 */
export const CAPABILITY_LABELS: Record<DistributorCapability, { title: string; description: string }> = {
  upload_own_sku_lists: {
    title: 'Upload your own SKU lists',
    description:
      "Add your full distribution portfolio, not just what one procurement client routes to you. Every buyer you serve gets the alka<strong>tera</strong> sustainability flow, not only Foodbuy.",
  },
  browse_discover: {
    title: 'Discover new brands',
    description:
      "Browse the global brand directory for brands you don't yet list. Auto-matched sustainability data, ready-to-onboard signals, contact-brand workflow.",
  },
  export_portfolio_reports: {
    title: 'Export portfolio reports',
    description:
      'Generate client-ready PDF and CSV exports for the buyers you serve beyond Foodbuy. Your branding, your data, your story.',
  },
  manual_alkatera_matching: {
    title: 'Manual alka<strong>tera</strong> matching',
    description:
      'Resolve brand-directory matches that the auto-matcher leaves pending. Get high-confidence alka<strong>tera</strong> customer links and the verified data that comes with them.',
  },
};
