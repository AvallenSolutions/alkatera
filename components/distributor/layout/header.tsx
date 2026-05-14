'use client';

import Link from 'next/link';
import { useDistributor } from '@/lib/distributor/context';
import { NotificationBell } from '@/components/distributor/notifications/notification-bell';

/**
 * Mobile header for the distributor portal. Shown only below the `md`
 * breakpoint; on desktop the sidebar carries the org identity.
 */
export function DistributorHeader() {
  const { organization } = useDistributor();
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
