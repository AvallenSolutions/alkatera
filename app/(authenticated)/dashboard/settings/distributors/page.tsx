'use client';

import { DistributorListPanel } from '@/components/brand/distributors/distributor-list';
import { DirectoryDiscoveryToggle } from '@/components/brand/distributors/discovery-toggle';

/**
 * Brand-side Distributors management page. Sits in the existing alkatera
 * brand portal at /dashboard/settings/distributors. Shows every
 * distributor that has linked to the brand's alkatera org, with
 * confirm / pause / disconnect controls and per-field privacy toggles.
 *
 * Phase 4 of the proactive-data programme adds the
 * DirectoryDiscoveryToggle at the top: a brand-wide switch that hides
 * the brand from the new distributor Discover search surface without
 * affecting distributors who already list them.
 */
export default function BrandDistributorsSettingsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Distributors who list you</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every distributor that lists your brand on alka<strong>tera</strong>, in one place.
          Block any distributor from seeing your verified sustainability data, customise sharing
          field by field, or remove yourself from a portfolio entirely. Your data always stays in
          the canonical brand directory.
        </p>
      </div>
      <DirectoryDiscoveryToggle />
      <DistributorListPanel />
    </div>
  );
}
