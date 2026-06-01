'use client';

import Link from 'next/link';
import { useDistributor } from '@/lib/distributor/context';
import { NotificationBell } from '@/components/distributor/notifications/notification-bell';
import { distributorCan } from '@/lib/distributor/capabilities';

/**
 * Mobile header for the distributor portal. Shown only below the `md`
 * breakpoint; on desktop the sidebar carries the org identity.
 * Procurement-partner-tier distributors get the procurement client's
 * branding (Foodbuy logo) and the upload link only renders when they
 * actually have permission to use it.
 */
export function DistributorHeader() {
  const { organization, partnerProcurement } = useDistributor();
  const canUpload = distributorCan(organization, 'upload_own_sku_lists');

  if (partnerProcurement) {
    const partnerName = partnerProcurement.display_name ?? partnerProcurement.name;
    return (
      <header className="md:hidden sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex h-12 items-center justify-between px-4">
          <Link href="/distributor/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="h-2 w-2 rounded-full bg-brand-primary shrink-0" />
            {partnerProcurement.logo_url ? (
              <img
                src={partnerProcurement.logo_url}
                alt={partnerName}
                className="h-5 max-w-[140px] object-contain"
              />
            ) : (
              <span className="text-sm font-semibold text-foreground truncate max-w-[180px]">
                {partnerName}
              </span>
            )}
          </Link>
          {canUpload ? (
            <Link
              href="/distributor/sku-lists/upload"
              className="text-xs text-brand-primary font-medium"
            >
              Upload
            </Link>
          ) : null}
        </div>
      </header>
    );
  }

  return (
    <header className="md:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-12 items-center justify-between px-4">
        <Link href="/distributor/dashboard" className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-sky-400" />
          <span className="text-sm font-semibold truncate max-w-[180px]">{organization.name}</span>
        </Link>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <Link
            href="/distributor/sku-lists/upload"
            className="text-xs text-sky-400 font-medium"
          >
            Upload
          </Link>
        </div>
      </div>
    </header>
  );
}
