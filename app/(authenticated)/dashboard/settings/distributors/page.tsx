'use client';

import { DistributorListPanel } from '@/components/brand/distributors/distributor-list';

/**
 * Brand-side Distributors management page. Sits in the existing alkatera
 * brand portal at /dashboard/settings/distributors. Shows every
 * distributor that has linked to the brand's alkatera org, with
 * confirm / pause / disconnect controls and per-field privacy toggles.
 */
export default function BrandDistributorsSettingsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Distributors</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage which distributors can see your sustainability data and exactly which fields are
          shared. You can pause or disconnect any distributor at any time.
        </p>
      </div>
      <DistributorListPanel />
    </div>
  );
}
