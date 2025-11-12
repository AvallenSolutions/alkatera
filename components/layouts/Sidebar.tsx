'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  Building2,
  Truck,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Package,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NAV_ITEMS } from '@/app/config/sidebarNav';

const iconMap: Record<string, any> = {
  HomeIcon: Home,
  BuildingIcon: Building2,
  TruckIcon: Truck,
  ChartBarIcon: BarChart3,
  CogIcon: Settings,
  BoxIcon: Package,
};

interface NavItemConfig {
  href?: string;
  label: string;
  icon?: string;
  children?: { href: string; label: string }[];
}

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  const isParentActive = (children?: { href: string; label: string }[]) => {
    if (!children) return false;
    return children.some((child) => isActive(child.href));
  };

  useEffect(() => {
    const initialOpenState: Record<string, boolean> = {};

    NAV_ITEMS.forEach((item) => {
      if (item.children && isParentActive(item.children)) {
        initialOpenState[item.label] = true;
      }
    });

    setOpenSections(initialOpenState);
  }, [pathname]);

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  return (
    <aside
      className={cn(
        'flex flex-col gap-2 border-r bg-slate-50/50 dark:bg-slate-900/50 px-3 py-4 w-64',
        className
      )}
    >
      <div className="mb-4 px-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
          AlkaTera
        </h2>
        <p className="text-xs text-muted-foreground">Carbon Management</p>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item: NavItemConfig) => {
          if (!item.children) {
            const IconComponent = item.icon ? iconMap[item.icon] : null;
            const active = item.href ? isActive(item.href) : false;

            return (
              <Link
                key={item.href}
                href={item.href!}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  active
                    ? 'bg-slate-900 text-slate-50 shadow-sm dark:bg-slate-50 dark:text-slate-900'
                    : 'text-slate-700 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                )}
              >
                {IconComponent && <IconComponent className="h-4 w-4 flex-shrink-0" />}
                <span className="truncate">{item.label}</span>
              </Link>
            );
          }

          const IconComponent = item.icon ? iconMap[item.icon] : null;
          const isOpen = openSections[item.label];
          const hasActiveChild = isParentActive(item.children);

          return (
            <Collapsible
              key={item.label}
              open={isOpen}
              onOpenChange={() => toggleSection(item.label)}
            >
              <CollapsibleTrigger
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  hasActiveChild
                    ? 'bg-slate-200/70 text-slate-900 dark:bg-slate-800/70 dark:text-slate-100'
                    : 'text-slate-700 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                )}
              >
                {IconComponent && <IconComponent className="h-4 w-4 flex-shrink-0" />}
                <span className="flex-1 truncate text-left">{item.label}</span>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 space-y-1">
                {item.children?.map((child) => {
                  const active = isActive(child.href);

                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 pl-10 text-sm font-medium transition-all',
                        active
                          ? 'bg-slate-900 text-slate-50 shadow-sm dark:bg-slate-50 dark:text-slate-900'
                          : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                      )}
                    >
                      <span className="truncate">{child.label}</span>
                    </Link>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>
    </aside>
  );
}
