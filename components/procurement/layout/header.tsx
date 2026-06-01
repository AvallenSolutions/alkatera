'use client';

import Link from 'next/link';
import { useProcurement } from '@/lib/procurement/context';

/**
 * Mobile header for the procurement portal. Shown only below the `md`
 * breakpoint; on desktop the sidebar carries the org identity.
 */
export function ProcurementHeader() {
  const { organization } = useProcurement();
  const displayName = organization.display_name ?? organization.name;
  return (
    <header className="md:hidden sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-12 items-center justify-between px-4">
        <Link
          href={`/procurement/${organization.slug}/dashboard`}
          className="flex items-center gap-2"
        >
          <div className="h-2 w-2 rounded-full bg-brand-primary" />
          {organization.logo_url ? (
            <img
              src={organization.logo_url}
              alt={displayName}
              className="h-5 max-w-[140px] object-contain"
            />
          ) : (
            <span className="text-sm font-semibold text-foreground truncate max-w-[180px]">{displayName}</span>
          )}
        </Link>
        <Link
          href={`/procurement/${organization.slug}/sku-lists/upload`}
          className="text-xs text-brand-primary font-medium"
        >
          Upload
        </Link>
      </div>
    </header>
  );
}
