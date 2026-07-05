'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { RoomTab } from './theme';

interface MonoTabsProps {
  tabs: RoomTab[];
  /** Band tabs run full-height with a 3px underline; paper tabs are inline. */
  on?: 'band' | 'paper';
  className?: string;
}

/** Finds the tab whose href is the longest prefix of the current path. */
function activeHref(pathname: string, tabs: RoomTab[]): string | undefined {
  return tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** The room's surfaces as mono tabs; the active one carries a 3px rule. */
export function MonoTabs({ tabs, on = 'band', className }: MonoTabsProps) {
  const pathname = usePathname();
  const active = activeHref(pathname ?? '', tabs);

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
    </nav>
  );
}
