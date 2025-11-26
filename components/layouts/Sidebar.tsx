'use client'

import { useState } from 'react'
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
  Sparkles,
  ChevronDown,
  ChevronRight,
  FileBarChart,
  Award,
  ShieldCheck,
} from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: any
  children?: NavItem[]
}

const navigationStructure: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Company Vitality',
    href: '/performance',
    icon: Sparkles,
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
    name: 'Reports',
    href: '/reports',
    icon: FileText,
    children: [
      {
        name: 'Sustainability Reports',
        href: '/reports/sustainability',
        icon: TrendingUp,
      },
      {
        name: "LCA's & EPD's",
        href: '/reports/lcas',
        icon: Award,
      },
    ],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

const developmentStructure: NavItem[] = [
  {
    name: 'ISO 14044 Compliance',
    href: '/dev/docs/iso-14044-compliance',
    icon: ShieldCheck,
  },
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
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === path
    }
    return pathname.startsWith(path)
  }

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuName)
        ? prev.filter(name => name !== menuName)
        : [...prev, menuName]
    )
  }

  const isExpanded = (menuName: string) => expandedMenus.includes(menuName)

  // Auto-expand parent menu if child is active
  const shouldAutoExpand = (item: NavItem) => {
    if (item.children) {
      return item.children.some(child => isActive(child.href))
    }
    return false
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
          const hasChildren = item.children && item.children.length > 0
          const expanded = isExpanded(item.name) || shouldAutoExpand(item)

          if (hasChildren) {
            return (
              <div key={item.href}>
                <button
                  onClick={() => toggleMenu(item.name)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                    active || shouldAutoExpand(item)
                      ? 'bg-slate-900 text-slate-50 shadow-sm dark:bg-slate-50 dark:text-slate-900'
                      : 'text-slate-700 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                  )}
                >
                  <IconComponent className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate flex-1 text-left">{item.name}</span>
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>

                {expanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.children?.map((child) => {
                      const ChildIcon = child.icon
                      const childActive = isActive(child.href)

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                            childActive
                              ? 'bg-slate-200 text-slate-900 font-medium dark:bg-slate-800 dark:text-slate-100'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/50'
                          )}
                        >
                          <ChildIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{child.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

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
