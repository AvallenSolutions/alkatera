'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RoomTab } from './theme';

interface MonoTabsProps {
  tabs: RoomTab[];
  /** Long-tail surfaces shown behind a "More…" menu. */
  more?: RoomTab[];
  /** Band tabs run full-height with a 3px underline; paper tabs are inline. */
  on?: 'band' | 'paper';
  className?: string;
}

/**
 * Reduce an href or a pathname to a comparable form: no trailing slash, no
 * query string. The room registry writes hrefs with a trailing slash
 * ('/products/') while `usePathname()` returns none ('/products'), so a
 * literal comparison matched nothing and NO tab has ever shown as active in
 * any room. One href also carries a query ('/settings?tab=billing'), which a
 * pathname never does.
 */
function comparablePath(value: string): string {
  const withoutQuery = value.split('?')[0];
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
}

/** Finds the tab whose href is the longest prefix of the current path. */
export function activeHref(pathname: string, tabs: RoomTab[]): string | undefined {
  const path = comparablePath(pathname);
  return tabs
    .filter((t) => {
      const href = comparablePath(t.href);
      // Longest-prefix, so a nested surface ('/products/liquids') lights its
      // own tab rather than its parent's.
      return path === href || path.startsWith(`${href}/`);
    })
    .sort((a, b) => comparablePath(b.href).length - comparablePath(a.href).length)[0]?.href;
}

/** The room's surfaces as mono tabs; the active one carries a 3px rule. */
export function MonoTabs({ tabs, more, on = 'band', className }: MonoTabsProps) {
  const pathname = usePathname() ?? '';
  const active = activeHref(pathname, tabs);
  const moreActive = more ? activeHref(pathname, more) : undefined;

  return (
    <nav className={cn('flex items-center gap-5 overflow-x-auto', className)}>
      {tabs.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'relative whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.22em] transition-opacity duration-150 ease-studio',
              on === 'band' ? 'flex h-[52px] items-center' : 'py-2',
              isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'
            )}
          >
            {tab.label}
            {isActive ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-x-0 bottom-0 h-[3px] bg-current',
                  on === 'paper' && 'bg-room-accent'
                )}
              />
            ) : null}
          </Link>
        );
      })}

      {more && more.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'relative flex items-center gap-1 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.22em] outline-none transition-opacity duration-150 ease-studio',
              on === 'band' ? 'h-[52px]' : 'py-2',
              moreActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'
            )}
          >
            More
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
            {moreActive ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-x-0 bottom-0 h-[3px] bg-current',
                  on === 'paper' && 'bg-room-accent'
                )}
              />
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {more.map((tab) => (
              <DropdownMenuItem key={tab.href} asChild>
                <Link
                  href={tab.href}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]"
                >
                  {tab.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </nav>
  );
}
