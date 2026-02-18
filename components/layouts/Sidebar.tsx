'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
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
  CheckSquare,
  Activity,
  CreditCard,
  FileEdit,
  Leaf,
  MessageSquare,
  Dog,
  Heart,
  UserCheck,
  Scale,
  Eye,
  Handshake,
  Gift,
  MapPin,
  HandHelping,
  FileHeart,
  Library,
  Lock,
  Database,
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
  minTier?: number // Minimum tier level required (1=Seed, 2=Blossom, 3=Canopy)
  featureCode?: string // Optional feature code requirement
  locked?: boolean // Set dynamically when user's tier is insufficient
  requiredTierName?: string // Display name of the required tier
}

// Navigation configuration with tier requirements
// Order: Core workflow first, then reporting/compliance, then ESG, then tools
const navigationStructure: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard/',
    icon: LayoutDashboard,
    minTier: 1,
  },
  {
    name: 'Company',
    href: '/company/facilities/',
    icon: Building2,
    minTier: 1,
    children: [
      {
        name: 'Facilities',
        href: '/company/facilities/',
        icon: Warehouse,
        minTier: 1,
      },
      {
        name: 'Fleet',
        href: '/company/fleet/',
        icon: Truck,
        minTier: 2,
        featureCode: 'vehicle_registry',
      },
      {
        name: 'Company Vitality',
        href: '/performance/',
        icon: Sparkles,
        minTier: 2,
      },
    ],
  },
  {
    name: 'Products',
    href: '/products/',
    icon: Package,
    minTier: 1,
  },
  {
    name: 'Suppliers',
    href: '/suppliers/',
    icon: Users,
    minTier: 1,
  },
  {
    name: 'Emissions Data',
    href: '/data/scope-1-2/',
    icon: Flame,
    minTier: 1,
    children: [
      {
        name: 'Company Emissions',
        href: '/data/scope-1-2/',
        icon: Flame,
        minTier: 1,
      },
      {
        name: 'Data Quality',
        href: '/data/quality/',
        icon: BarChart3,
        minTier: 1,
      },
      {
        name: 'Data Sources',
        href: '/data/sources/',
        icon: BookOpen,
        minTier: 1,
      },
    ],
  },
  {
    name: 'Reports',
    href: '/reports/',
    icon: FileText,
    minTier: 1,
    children: [
      {
        name: 'Sustainability Reports',
        href: '/reports/sustainability/',
        icon: TrendingUp,
        minTier: 1,
      },
      {
        name: "LCA Reports",
        href: '/reports/lcas/',
        icon: Award,
        minTier: 2,
      },
    ],
  },
  {
    name: 'EPR Compliance',
    href: '/epr/',
    icon: ShieldCheck,
    minTier: 1,
    children: [
      {
        name: 'Setup Wizard',
        href: '/epr/wizard/',
        icon: Sparkles,
        minTier: 1,
      },
      {
        name: 'Dashboard',
        href: '/epr/',
        icon: LayoutDashboard,
        minTier: 1,
      },
      {
        name: 'Submissions',
        href: '/epr/submissions/',
        icon: FileBarChart,
        minTier: 1,
      },
      {
        name: 'Cost Estimator',
        href: '/epr/costs/',
        icon: Calculator,
        minTier: 3,
      },
      {
        name: 'PRN Tracker',
        href: '/epr/prn/',
        icon: ClipboardCheck,
        minTier: 3,
      },
      {
        name: 'Settings',
        href: '/epr/settings/',
        icon: Settings,
        minTier: 1,
      },
      {
        name: 'Audit Trail',
        href: '/epr/audit/',
        icon: Activity,
        minTier: 1,
      },
    ],
  },
  {
    name: 'Certifications',
    href: '/certifications/',
    icon: Award,
    minTier: 2,
  },
  {
    name: 'People & Culture',
    href: '/people-culture/',
    icon: UserCheck,
    minTier: 2,
    children: [
      {
        name: 'Overview',
        href: '/people-culture/',
        icon: UserCheck,
        minTier: 2,
      },
      {
        name: 'Fair Work',
        href: '/people-culture/fair-work/',
        icon: Briefcase,
        minTier: 2,
      },
      {
        name: 'Diversity & Inclusion',
        href: '/people-culture/diversity-inclusion/',
        icon: Users,
        minTier: 2,
      },
      {
        name: 'Wellbeing',
        href: '/people-culture/wellbeing/',
        icon: Heart,
        minTier: 2,
      },
      {
        name: 'Training',
        href: '/people-culture/training/',
        icon: GraduationCap,
        minTier: 2,
      },
    ],
  },
  {
    name: 'Community Impact',
    href: '/community-impact/',
    icon: Heart,
    minTier: 2,
    children: [
      {
        name: 'Overview',
        href: '/community-impact/',
        icon: Heart,
        minTier: 2,
      },
      {
        name: 'Charitable Giving',
        href: '/community-impact/charitable-giving/',
        icon: Gift,
        minTier: 2,
      },
      {
        name: 'Local Impact',
        href: '/community-impact/local-impact/',
        icon: MapPin,
        minTier: 2,
      },
      {
        name: 'Volunteering',
        href: '/community-impact/volunteering/',
        icon: HandHelping,
        minTier: 2,
      },
      {
        name: 'Impact Stories',
        href: '/community-impact/stories/',
        icon: FileHeart,
        minTier: 2,
      },
    ],
  },
  {
    name: 'Governance',
    href: '/governance/',
    icon: Scale,
    minTier: 3,
    children: [
      {
        name: 'Overview',
        href: '/governance/',
        icon: Scale,
        minTier: 3,
      },
      {
        name: 'Policies',
        href: '/governance/policies/',
        icon: FileText,
        minTier: 3,
      },
      {
        name: 'Stakeholders',
        href: '/governance/stakeholders/',
        icon: Handshake,
        minTier: 3,
      },
      {
        name: 'Board',
        href: '/governance/board/',
        icon: Users,
        minTier: 3,
      },
      {
        name: 'Transparency',
        href: '/governance/transparency/',
        icon: Eye,
        minTier: 3,
      },
    ],
  },
  {
    name: 'Resources',
    href: '/knowledge-bank/',
    icon: Library,
    minTier: 1,
    children: [
      {
        name: 'Knowledge Bank',
        href: '/knowledge-bank/',
        icon: GraduationCap,
        minTier: 1,
      },
      {
        name: 'Greenwash Guardian',
        href: '/greenwash-guardian/',
        icon: Leaf,
        minTier: 2,
      },
    ],
  },
  {
    name: 'Rosa',
    href: '/rosa/',
    icon: Dog,
    minTier: 2,
  },
  {
    name: 'Settings',
    href: '/settings/',
    icon: Settings,
    minTier: 1,
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
    name: 'Maturation Tests',
    href: '/dev/docs/maturation-tests/',
    icon: TestTube,
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
  const { usage, tierName, tierLevel, hasFeature, isLoading: subscriptionLoading } = useSubscription()

  const isOrgAdmin = userRole === 'owner' || userRole === 'admin'

  const tierDisplayNames: Record<number, string> = { 1: 'Seed', 2: 'Blossom', 3: 'Canopy' }

  // Mark navigation items as locked instead of hiding them
  const filterNavItems = (items: NavItem[]): NavItem[] => {
    return items.map((item) => {
      const isLocked = (item.minTier && tierLevel < item.minTier) ||
        (item.featureCode && !hasFeature(item.featureCode as any))
      const requiredTierName = item.minTier ? tierDisplayNames[item.minTier] : undefined

      return {
        ...item,
        locked: !!isLocked,
        requiredTierName,
        // Recursively process children (but keep them even if locked)
        children: item.children ? filterNavItems(item.children) : undefined,
      }
    })
  }

  // Build final navigation structure (all items are now in the main array)
  const filteredNavigation = filterNavItems(navigationStructure)

  useEffect(() => {
    async function checkAlkateraAdmin() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsAlkateraAdmin(false)
          return
        }
        const { data } = await supabase.rpc('is_alkatera_admin')
        setIsAlkateraAdmin(data === true)
      } catch (err) {
        console.error('Error checking admin status:', err)
        setIsAlkateraAdmin(false)
      }
    }
    checkAlkateraAdmin()

    // Re-check when auth state changes (e.g. session switch, sign-out/sign-in)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAlkateraAdmin()
    })
    return () => subscription.unsubscribe()
  }, [currentOrganization?.id])

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

  // Check if a menu item has an active child (used for styling only)
  const hasActiveChild = (item: NavItem) => {
    if (item.children) {
      return item.children.some(child => isActive(child.href))
    }
    return false
  }

  // Auto-expand parent menus on route change (but don't prevent manual collapse)
  useEffect(() => {
    const menusToExpand: string[] = []
    for (const item of filteredNavigation) {
      if (item.children && !item.locked) {
        if (item.children.some(child => isActive(child.href))) {
          menusToExpand.push(item.name)
        }
        // Also check grandchildren
        for (const child of item.children) {
          if (child.children && child.children.some(gc => isActive(gc.href))) {
            menusToExpand.push(item.name)
            menusToExpand.push(child.name)
          }
        }
      }
    }
    if (menusToExpand.length > 0) {
      setExpandedMenus(prev => {
        const combined = new Set([...prev, ...menusToExpand])
        return Array.from(combined)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <aside
      className={cn(
        'flex flex-col gap-2 border-r border-border bg-sidebar px-3 py-4 transition-colors h-screen',
        className
      )}
    >
      <div className="mb-6 px-2">
        <div className="flex items-center mb-1">
          <img
            src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
            alt="AlkaTera"
            className="h-10 w-auto object-contain dark:invert-0 invert"
          />
        </div>
        <p className="text-xs text-muted-foreground">Sustainability, Distilled</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto" data-guide="sidebar-nav">
        {filteredNavigation.map((item) => {
          const IconComponent = item.icon
          const active = !item.locked && isActive(item.href)
          const hasChildren = item.children && item.children.length > 0
          const expanded = !item.locked && isExpanded(item.name)

          // Locked top-level item (no children) — show greyed out with lock
          if (item.locked && !hasChildren) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative opacity-40 hover:opacity-60 cursor-pointer"
                title={`Upgrade to ${item.requiredTierName} to unlock`}
              >
                <IconComponent className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate flex-1">{item.name}</span>
                <Lock className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              </Link>
            )
          }

          // Locked parent item with children — show collapsed with lock, click goes to feature page
          if (item.locked && hasChildren) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative opacity-40 hover:opacity-60 cursor-pointer"
                title={`Upgrade to ${item.requiredTierName} to unlock`}
              >
                <IconComponent className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate flex-1">{item.name}</span>
                <Lock className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              </Link>
            )
          }

          if (hasChildren) {
            return (
              <div key={item.href}>
                <button
                  onClick={() => toggleMenu(item.name)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                    active || hasActiveChild(item)
                      ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                      : 'text-sidebar-foreground hover:bg-secondary/50'
                  )}
                >
                  <IconComponent className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors',
                    active || hasActiveChild(item) ? 'text-neon-lime' : ''
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
                      const childHasChildren = child.children && child.children.length > 0
                      const childExpanded = isExpanded(child.name)

                      // If child has its own children (e.g., Social Impact subsections)
                      if (childHasChildren) {
                        return (
                          <div key={child.href} className="mt-1">
                            <button
                              onClick={() => toggleMenu(child.name)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                                childActive || hasActiveChild(child)
                                  ? 'bg-secondary/50 text-foreground font-medium'
                                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                              )}
                            >
                              <ChildIcon className={cn(
                                'h-3.5 w-3.5 flex-shrink-0',
                                childActive || hasActiveChild(child) ? 'text-neon-lime' : ''
                              )} />
                              <span className="truncate flex-1 text-left">{child.name}</span>
                              {childExpanded ? (
                                <ChevronDown className="h-3 w-3 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 flex-shrink-0" />
                              )}
                            </button>

                            {childExpanded && (
                              <div className="ml-6 mt-1 space-y-1">
                                {child.children?.map((grandchild) => {
                                  const GrandchildIcon = grandchild.icon
                                  const grandchildActive = isActive(grandchild.href)

                                  return (
                                    <Link
                                      key={grandchild.href}
                                      href={grandchild.href}
                                      className={cn(
                                        'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-xs transition-all',
                                        grandchildActive
                                          ? 'bg-secondary text-foreground font-medium'
                                          : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                                      )}
                                    >
                                      <GrandchildIcon className={cn(
                                        'h-3 w-3 flex-shrink-0',
                                        grandchildActive ? 'text-neon-lime' : ''
                                      )} />
                                      <span className="truncate">{grandchild.name}</span>
                                    </Link>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      }

                      // Regular child without nested children
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
              {...(item.href === '/rosa/' ? { 'data-guide': 'rosa-link' } : {})}
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
            {isAlkateraAdmin && (
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
                </Link>

                <Link
                  href="/admin/suppliers/"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                    isActive('/admin/suppliers/')
                      ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                      : 'text-sidebar-foreground hover:bg-secondary/50'
                  )}
                >
                  <Handshake className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors',
                    isActive('/admin/suppliers/') ? 'text-neon-lime' : ''
                  )} />
                  <span className="truncate">Platform Suppliers</span>
                </Link>

                <Link
                  href="/admin/blog/"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                    isActive('/admin/blog/')
                      ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                      : 'text-sidebar-foreground hover:bg-secondary/50'
                  )}
                >
                  <FileEdit className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors',
                    isActive('/admin/blog/') ? 'text-neon-lime' : ''
                  )} />
                  <span className="truncate">Blog CMS</span>
                </Link>

                <Link
                  href="/admin/feedback/"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                    isActive('/admin/feedback/')
                      ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                      : 'text-sidebar-foreground hover:bg-secondary/50'
                  )}
                >
                  <MessageSquare className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors',
                    isActive('/admin/feedback/') ? 'text-neon-lime' : ''
                  )} />
                  <span className="truncate">User Feedback</span>
                </Link>

                <Link
                  href="/admin/rosa/"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                    isActive('/admin/rosa/')
                      ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                      : 'text-sidebar-foreground hover:bg-secondary/50'
                  )}
                >
                  <Dog className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors',
                    isActive('/admin/rosa/') ? 'text-neon-lime' : ''
                  )} />
                  <span className="truncate">Rosa Admin</span>
                </Link>

                <Link
                  href="/admin/factors/"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all relative',
                    isActive('/admin/factors/')
                      ? 'bg-secondary text-foreground border-l-4 border-neon-lime'
                      : 'text-sidebar-foreground hover:bg-secondary/50'
                  )}
                >
                  <Database className={cn(
                    'h-4 w-4 flex-shrink-0 transition-colors',
                    isActive('/admin/factors/') ? 'text-neon-lime' : ''
                  )} />
                  <span className="truncate">Emission Factors</span>
                </Link>
              </>
            )}
          </div>
        )}

        {/* Development Section - Admin or Dev Mode */}
        {isAlkateraAdmin && (
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
        )}
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
