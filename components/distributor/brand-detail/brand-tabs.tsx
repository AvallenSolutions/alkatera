'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  brandId: string;
  unresolvedConflicts: number;
}

interface TabDef {
  label: string;
  href: (id: string) => string;
  matches: (path: string, id: string) => boolean;
}

const TABS: TabDef[] = [
  {
    label: 'Overview',
    href: (id) => `/distributor/brands/${id}`,
    matches: (path, id) => path === `/distributor/brands/${id}`,
  },
  {
    label: 'Products',
    href: (id) => `/distributor/brands/${id}/products`,
    // Matches the products tab AND any per-SKU detail page under /skus/...
    matches: (path, id) =>
      path.startsWith(`/distributor/brands/${id}/products`) ||
      path.startsWith(`/distributor/brands/${id}/skus`),
  },
  {
    label: 'Data',
    href: (id) => `/distributor/brands/${id}/data`,
    matches: (path, id) => path.startsWith(`/distributor/brands/${id}/data`),
  },
  {
    label: 'Documents',
    href: (id) => `/distributor/brands/${id}/documents`,
    matches: (path, id) => path.startsWith(`/distributor/brands/${id}/documents`),
  },
  {
    label: 'Outreach',
    href: (id) => `/distributor/brands/${id}/outreach`,
    matches: (path, id) => path.startsWith(`/distributor/brands/${id}/outreach`),
  },
];

export function BrandTabs({ brandId, unresolvedConflicts }: Props) {
  const pathname = usePathname() ?? '';
  return (
    <div className="border-b border-border/60">
      <nav className="flex gap-1 -mb-px overflow-x-auto">
        {TABS.map((tab) => {
          const active = tab.matches(pathname, brandId);
          const showBadge = tab.label === 'Data' && unresolvedConflicts > 0;
          return (
            <Link
              key={tab.label}
              href={tab.href(brandId)}
              className={`relative px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-all ${
                active
                  ? 'text-sky-200 border-sky-400 font-semibold'
                  : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
              }`}
            >
              {active && (
                <span className="pointer-events-none absolute inset-x-3 -bottom-px h-[2px] bg-sky-400 rounded-full shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              )}
              {tab.label}
              {showBadge && (
                <span className="ml-1.5 inline-flex items-center justify-center text-[10px] h-4 min-w-[16px] px-1 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                  {unresolvedConflicts}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
