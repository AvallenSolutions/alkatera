'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Factory,
  Package,
  ClipboardList,
  FileText,
  TrendingUp,
  Settings,
  Code,
  BookOpen,
  FlaskConical,
} from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: any
}

const navigationStructure: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Operations',
    href: '/operations',
    icon: Factory,
  },
  {
    name: 'Products',
    href: '/products',
    icon: Package,
  },
  {
    name: 'Production',
    href: '/production',
    icon: ClipboardList,
  },
  {
    name: 'Company Footprint',
    href: '/reports/company-footprint',
    icon: TrendingUp,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

const developmentStructure: NavItem[] = [
  {
    name: 'Reporting Standards',
    href: '/dev/docs/reporting-standards',
    icon: BookOpen,
  },
  {
    name: 'Fleet Implementation',
    href: '/dev/docs/fleet-implementation',
    icon: Code,
  },
  {
    name: 'Verification Tests',
    href: '/dev/docs/verification-tests',
    icon: FlaskConical,
  },
  {
    name: 'UI Documentation',
    href: '/dev/docs/ui-documentation',
    icon: BookOpen,
  },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === path
    }
    return pathname.startsWith(path)
  }

  return (
    <aside
      className={cn(
        'flex flex-col gap-2 border-r bg-slate-50/50 dark:bg-slate-900/50 px-3 py-4',
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
        {navigationStructure.map((item) => {
          const IconComponent = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                active
                  ? 'bg-slate-900 text-slate-50 shadow-sm dark:bg-slate-50 dark:text-slate-900'
                  : 'text-slate-700 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-800/50'
              )}
            >
              <IconComponent className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </Link>
          )
        })}

        {/* Development Section */}
        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="px-3 mb-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Development
            </h3>
          </div>
          {developmentStructure.map((item) => {
            const IconComponent = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  active
                    ? 'bg-slate-900 text-slate-50 shadow-sm dark:bg-slate-50 dark:text-slate-900'
                    : 'text-slate-700 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                )}
              >
                <IconComponent className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}
