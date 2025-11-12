'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Leaf,
  Users,
  Building2,
  FileText,
  Settings,
  TrendingUp,
  Package,
  Database,
} from 'lucide-react'

interface NavItem {
  name: string
  path: string
  icon: any
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const navigationSections: NavSection[] = [
  {
    items: [
      {
        name: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        name: 'Emissions',
        path: '/emissions',
        icon: Leaf,
      },
      {
        name: 'Suppliers',
        path: '/suppliers',
        icon: Building2,
      },
      {
        name: 'Facilities',
        path: '/company/facilities',
        icon: Package,
      },
      {
        name: 'KPIs',
        path: '/kpis',
        icon: TrendingUp,
      },
      {
        name: 'Reports',
        path: '/reports',
        icon: FileText,
      },
    ],
  },
  {
    title: 'Data Management',
    items: [
      {
        name: 'Ingest Activity Data',
        path: '/data/ingest',
        icon: Database,
      },
    ],
  },
  {
    items: [
      {
        name: 'Team',
        path: '/dashboard/settings/team',
        icon: Users,
      },
      {
        name: 'Settings',
        path: '/settings',
        icon: Settings,
      },
    ],
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

      <nav className="flex-1 space-y-4">
        {navigationSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="space-y-1">
            {section.title && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            {section.items.map((item) => {
              const IconComponent = item.icon
              const active = isActive(item.path)

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    'flex items-centre gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
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
        ))}
      </nav>
    </aside>
  )
}
