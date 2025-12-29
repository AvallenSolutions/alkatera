'use client'

import { useState, useEffect } from 'react'
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
  TestTube,
  ClipboardCheck,
  Calculator,
  Building2,
  Warehouse,
  Truck,
  Flame,
  BarChart3,
  Users,
  Briefcase,
  GraduationCap,
  AlertCircle,
  Shield,
  CheckSquare,
  Activity,
  CreditCard,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'
import { Badge } from '@/components/ui/badge'
import { useSubscription } from '@/hooks/useSubscription'
import { TierBadge } from '@/components/subscription/TierBadge'
import { UsageMeterCompact } from '@/components/subscription/UsageMeter'

interface NavItem {
  name: string
  href: string
  icon: any
  children?: NavItem[]
  badge?: number
}

const navigationStructure: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard/',
    icon: LayoutDashboard,
  },
  {
    name: 'Company Vitality',
    href: '/performance/',
    icon: Sparkles,
  },
  {
    name: 'Company',
    href: '/company/',
    icon: Building2,
    children: [
      {
        name: 'Overview',
        href: '/company/overview/',
        icon: Building2,
      },
      {
        name: 'Facilities',
        href: '/company/facilities/',
        icon: Warehouse,
      },
      {
        name: 'Fleet',
        href: '/company/fleet/',
        icon: Truck,
      },
      {
        name: 'Company Emissions',
        href: '/data/scope-1-2/',
        icon: Flame,
      },
    ],
  },
  {
    name: 'Products',
    href: '/products/',
    icon: Package,
  },
  {
    name: 'Suppliers',
    href: '/suppliers/',
    icon: Users,
  },
  {
    name: 'Knowledge Bank',
    href: '/knowledge-bank/',
    icon: GraduationCap,
  },
  {
    name: 'Production',
    href: '/production/',
    icon: ClipboardList,
  },
  {
    name: 'Reports',
    href: '/reports/',
    icon: FileText,
    children: [
      {
        name: 'Sustainability Reports',
        href: '/reports/sustainability/',
        icon: TrendingUp,
      },
      {
        name: "LCA's & EPD's",
        href: '/reports/lcas/',
        icon: Award,
      },
    ],
  },
  {
    name: 'Settings',
    href: '/settings/',
    icon: Settings,
  },
]

const developmentStructure: NavItem[] = [
  {
    name: 'Technical Debt Audit',
    href: '/dev/docs/technical-debt/',
    icon: AlertCircle,
  },
  {
    name: 'Calculation Verifier',
    href: '/dev/calculation-verifier/',
    icon: Calculator,
  },
  {
    name: 'ISO 14044 Compliance',
    href: '/dev/docs/iso-14044-compliance/',
    icon: ShieldCheck,
  },
  {
    name: 'ISO Compliance Tests',
    href: '/dev/docs/iso-compliance-tests/',
    icon: FileBarChart,
  },
  {
    name: 'Reporting Standards',
    href: '/dev/docs/reporting-standards/',
    icon: BookOpen,
  },
  {
    name: 'LCA Calculation Testing',
    href: '/dev/docs/lca-calculation-testing/',
    icon: TestTube,
  },
  {
    name: 'LCA Testing Summary',
    href: '/dev/docs/lca-testing-summary/',
    icon: ClipboardCheck,
  },
  {
    name: 'Fleet Implementation',
    href: '/dev/docs/fleet-implementation/',
    icon: Code,
  },
  {
    name: 'Verification Tests',
    href: '/dev/docs/verification-tests/',
    icon: FlaskConical,
  },
  {
    name: 'UI Documentation',
    href: '/dev/docs/ui-documentation/',
    icon: BookOpen,
  },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])
  const { userRole, currentOrganization } = useOrganization()
  const [isAlkateraAdmin, setIsAlkateraAdmin] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const { usage, tierName, isLoading: subscriptionLoading } = useSubscription()

  const isOrgAdmin = userRole === 'owner' || userRole === 'admin'
  const isDevelopment = process.env.NODE_ENV === 'development'

  useEffect(() => {
    async function checkAlkateraAdmin() {
      try {
        const { data } = await supabase.rpc('is_alkatera_admin')
        setIsAlkateraAdmin(data === true)
      } catch (err) {
        console.error('Error checking admin status:', err)
      }
    }
    checkAlkateraAdmin()
  }, [])

  useEffect(() => {
    async function fetchPendingCount() {
      if (!isOrgAdmin || !currentOrganization?.id) return
      try {
        const { data } = await supabase.rpc('get_pending_approval_count')
        setPendingCount(data || 0)
      } catch (err) {
        console.error('Error fetching pending count:', err)
      }
    }
    fetchPendingCount()
  }, [isOrgAdmin, currentOrganization?.id])

  const isActive = (path: string) => {
    if (!pathname) return false
    const normalizedPathname = pathname.endsWith('/') ? pathname : `${pathname}/`
    const normalizedPath = path.endsWith('/') ? path : `${path}/`
    if (normalizedPath === '/dashboard/') {
      return normalizedPathname === normalizedPath
    }
    return normalizedPathname.startsWith(normalizedPath)
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
        'flex flex-col gap-2 border-r border-border bg-sidebar px-3 py-4 transition-colors h-screen',
        className
      )}
    >
      <div className="mb-6 px-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-neon-lime flex items-center justify-center">
            <span className="text-black font-bold text-sm">A</span>
          </div>
          <h2 className="text-lg font-heading font-bold tracking-tight">
            AlkaTera
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">Carbon Management</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
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
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                    active || shouldAutoExpand(item)
                      ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                      : 'text-sidebar-foreground hover:bg-secondary/50'
                  )}
                >
                  <IconComponent className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors',
                    active || shouldAutoExpand(item) ? 'text-neon-lime' : ''
                  )} />
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
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                            childActive
                              ? 'bg-secondary text-foreground font-medium'
                              : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                          )}
                        >
                          <ChildIcon className={cn(
                            'h-3.5 w-3.5 flex-shrink-0',
                            childActive ? 'text-neon-lime' : ''
                          )} />
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
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                active
                  ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                  : 'text-sidebar-foreground hover:bg-secondary/50'
              )}
            >
              <IconComponent className={cn(
                'h-4 w-4 flex-shrink-0 transition-colors',
                active ? 'text-neon-lime' : ''
              )} />
              <span className="truncate">{item.name}</span>
            </Link>
          )
        })}

        {/* Admin Section - Only visible to admins */}
        {(isOrgAdmin || isAlkateraAdmin) && (
          <div className="pt-4 mt-4 border-t border-border">
            <div className="px-3 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Admin
              </h3>
            </div>

            {/* Approval Queue - For Org Admins */}
            {isOrgAdmin && (
              <Link
                href="/admin/approvals/"
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                  isActive('/admin/approvals/')
                    ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                    : 'text-sidebar-foreground hover:bg-secondary/50'
                )}
              >
                <CheckSquare className={cn(
                  'h-4 w-4 flex-shrink-0 transition-colors',
                  isActive('/admin/approvals/') ? 'text-neon-lime' : ''
                )} />
                <span className="truncate flex-1">Approval Queue</span>
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {pendingCount}
                  </Badge>
                )}
              </Link>
            )}

            {/* Alkatera Admin Only Links */}
            {(isAlkateraAdmin || isDevelopment) && (
              <>
                <Link
                  href="/admin/platform/"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                    isActive('/admin/platform/')
                      ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                      : 'text-sidebar-foreground hover:bg-secondary/50'
                  )}
                >
                  <Activity className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors',
                    isActive('/admin/platform/') ? 'text-neon-lime' : ''
                  )} />
                  <span className="truncate">Platform Dashboard</span>
                  {isDevelopment && !isAlkateraAdmin && (
                    <span className="text-xs text-muted-foreground ml-auto">[Dev]</span>
                  )}
                </Link>

                <Link
                  href="/admin/supplier-verification/"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                    isActive('/admin/supplier-verification/')
                      ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                      : 'text-sidebar-foreground hover:bg-secondary/50'
                  )}
                >
                  <Shield className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors',
                    isActive('/admin/supplier-verification/') ? 'text-neon-lime' : ''
                  )} />
                  <span className="truncate">Supplier Verification</span>
                  {isDevelopment && !isAlkateraAdmin && (
                    <span className="text-xs text-muted-foreground ml-auto">[Dev]</span>
                  )}
                </Link>
              </>
            )}
          </div>
        )}

        {/* Development Section */}
        <div className="pt-4 mt-4 border-t border-border">
          <div className="px-3 mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                  active
                    ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                    : 'text-sidebar-foreground hover:bg-secondary/50'
                )}
              >
                <IconComponent className={cn(
                  'h-4 w-4 flex-shrink-0 transition-colors',
                  active ? 'text-neon-lime' : ''
                )} />
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Subscription Status Footer */}
      {!subscriptionLoading && usage && (
        <div className="mt-auto border-t border-border pt-4 px-3">
          <Link
            href="/settings/"
            className="block rounded-lg p-3 hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <TierBadge tier={tierName} size="sm" />
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Products</span>
                <UsageMeterCompact
                  current={usage.usage.products.current}
                  max={usage.usage.products.max}
                  isUnlimited={usage.usage.products.is_unlimited}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Reports</span>
                <UsageMeterCompact
                  current={usage.usage.reports_monthly.current}
                  max={usage.usage.reports_monthly.max}
                  isUnlimited={usage.usage.reports_monthly.is_unlimited}
                />
              </div>
            </div>
          </Link>
        </div>
      )}
    </aside>
  )
}
