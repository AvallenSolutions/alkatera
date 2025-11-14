'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Database,
  Building2,
  FileText,
  Target,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

interface NavLink {
  name: string
  href: string
}

interface NavItem {
  name: string
  href?: string
  icon?: any
  links?: NavLink[]
}

const navigationStructure: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Data Hub',
    icon: Database,
    links: [
      { name: 'Scope 1: Direct Emissions', href: '/dashboard/data-hub/scope-1' },
      { name: 'Scope 2: Purchased Energy', href: '/dashboard/data-hub/scope-2' },
      { name: 'Scope 3: Value Chain', href: '/dashboard/data-hub/scope-3' },
    ],
  },
  {
    name: 'Company Settings',
    icon: Building2,
    links: [
      { name: 'Facilities', href: '/company/facilities' },
      { name: 'Suppliers', href: '/dashboard/company/suppliers' },
      { name: 'Products', href: '/dashboard/company/products' },
      { name: 'Team Members', href: '/dashboard/settings/team' },
    ],
  },
  {
    name: 'Reports',
    icon: FileText,
    links: [
      { name: 'Sustainability Reports', href: '/dashboard/reports/sustainability' },
      { name: 'Product LCA Reports', href: '/dashboard/reports/product-lca' },
    ],
  },
  {
    name: 'Goals & KPIs',
    icon: Target,
    links: [
      { name: 'SMART Goals', href: '/dashboard/goals/smart-goals' },
      { name: 'KPI Management', href: '/dashboard/goals/kpi-management' },
    ],
  },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'Data Hub',
    'Company Settings',
  ])

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === path
    }
    return pathname.startsWith(path)
  }

  const isAnySectionLinkActive = (links?: NavLink[]) => {
    if (!links) return false
    return links.some((link) => isActive(link.href))
  }

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((name) => name !== sectionName)
        : [...prev, sectionName]
    )
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
          const hasLinks = item.links && item.links.length > 0
          const isExpanded = expandedSections.includes(item.name)
          const isSectionActive = hasLinks && isAnySectionLinkActive(item.links)

          if (hasLinks) {
            return (
              <div key={item.name} className="space-y-1">
                <button
                  onClick={() => toggleSection(item.name)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                    isSectionActive
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-700 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {IconComponent && <IconComponent className="h-4 w-4 flex-shrink-0" />}
                    <span className="truncate">{item.name}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>

                {isExpanded && item.links && (
                  <div className="ml-4 space-y-1 border-l border-slate-200 dark:border-slate-800 pl-3">
                    {item.links.map((link) => {
                      const active = isActive(link.href)
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-all',
                            active
                              ? 'bg-slate-900 text-slate-50 shadow-sm dark:bg-slate-50 dark:text-slate-900 font-medium'
                              : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50'
                          )}
                        >
                          <span className="truncate">{link.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const active = item.href ? isActive(item.href) : false

          return (
            <Link
              key={item.href}
              href={item.href || '#'}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                active
                  ? 'bg-slate-900 text-slate-50 shadow-sm dark:bg-slate-50 dark:text-slate-900'
                  : 'text-slate-700 hover:bg-slate-200/50 dark:text-slate-300 dark:hover:bg-slate-800/50'
              )}
            >
              {IconComponent && <IconComponent className="h-4 w-4 flex-shrink-0" />}
              <span className="truncate">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
