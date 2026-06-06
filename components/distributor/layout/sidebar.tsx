'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Upload,
  Mail,
  BarChart3,
  Settings,
  LogOut,
  Search,
  Lock,
  GitMerge,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { getSupabasePortalBrowserClient } from '@/lib/supabase/portal-browser-client';
import { useDistributor } from '@/lib/distributor/context';
import { distributorCan } from '@/lib/distributor/capabilities';
import { NotificationBell } from '@/components/distributor/notifications/notification-bell';
import { AlkaTeraIcon, AlkaTeraWordmark } from '@/components/lca-report/Logo';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
  gated?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS_DEFAULT: NavSection[] = [
  {
    label: 'Work',
    items: [{ name: 'Dashboard', href: '/distributor/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Portfolio',
    items: [
      { name: 'Brands', href: '/distributor/brands', icon: Building2 },
      { name: 'Discover', href: '/distributor/discover', icon: Search },
      { name: 'Product Lists', href: '/distributor/sku-lists', icon: Upload },
    ],
  },
  {
    label: 'Engage',
    items: [
      { name: 'Outreach', href: '/distributor/outreach', icon: Mail },
      { name: 'Submissions', href: '/distributor/submissions', icon: Inbox },
      { name: 'Data conflicts', href: '/distributor/conflicts', icon: GitMerge },
    ],
  },
  {
    label: 'Prove',
    items: [{ name: 'Reports', href: '/distributor/reports', icon: BarChart3 }],
  },
  {
    label: 'Workspace',
    items: [
      { name: 'Settings', href: '/distributor/settings', icon: Settings, disabled: true },
    ],
  },
];

const roleLabel: Record<string, string> = {
  owner: 'Owner',
  data_manager: 'Data manager',
  viewer: 'Viewer',
};

export function DistributorSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { organization, member, partnerProcurement } = useDistributor();
  const supabase = getSupabasePortalBrowserClient();
  const isPartnerMode = !!partnerProcurement;

  // Flag Discover + Reports as gated when in procurement-partner mode,
  // so the sidebar shows the lock icon without removing the entry.
  const navSections: NavSection[] = NAV_SECTIONS_DEFAULT.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (!isPartnerMode) return item;
      if (item.href === '/distributor/discover' && !distributorCan(organization, 'browse_discover')) {
        return { ...item, gated: true };
      }
      if (item.href === '/distributor/reports' && !distributorCan(organization, 'export_portfolio_reports')) {
        return { ...item, gated: true };
      }
      return item;
    }),
  }));

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/distributor/login');
  }

  if (isPartnerMode && partnerProcurement) {
    return (
      <PartnerSidebar
        partnerProcurement={partnerProcurement}
        distributorName={organization.name}
        memberRole={member.role}
        navSections={navSections}
        pathname={pathname}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <DefaultSidebar
      organizationName={organization.name}
      memberRole={member.role}
      navSections={navSections}
      pathname={pathname}
      onSignOut={handleSignOut}
    />
  );
}

/** Procurement-partner variant: wears the procurement client's brand. */
function PartnerSidebar({
  partnerProcurement,
  distributorName,
  memberRole,
  navSections,
  pathname,
  onSignOut,
}: {
  partnerProcurement: NonNullable<ReturnType<typeof useDistributor>['partnerProcurement']>;
  distributorName: string;
  memberRole: string;
  navSections: NavSection[];
  pathname: string | null;
  onSignOut: () => void | Promise<void>;
}) {
  const partnerDisplay = partnerProcurement.display_name ?? partnerProcurement.name;
  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 border-r border-border bg-white">
      <Link
        href="/distributor/dashboard"
        className="block px-6 pt-7 pb-6 border-b border-border/70 transition-colors hover:bg-muted/40"
      >
        {partnerProcurement.logo_url ? (
          <img
            src={partnerProcurement.logo_url}
            alt={partnerDisplay}
            className="h-10 max-w-[180px] object-contain"
          />
        ) : (
          <div className="text-lg font-semibold text-foreground truncate">{partnerDisplay}</div>
        )}
        {partnerProcurement.parent_company ? (
          <p className="mt-3 text-[11px] text-muted-foreground truncate">
            {partnerProcurement.parent_company}
          </p>
        ) : null}
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 px-2 py-0.5">
          <span className="h-1 w-1 rounded-full bg-brand-primary" />
          <span className="text-[9px] uppercase tracking-[0.18em] text-brand-primary font-semibold">
            Sustainability programme
          </span>
        </div>
      </Link>

      <div className="px-6 pt-4 pb-3 border-b border-border/70">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          Supplying as
        </div>
        <div className="text-sm font-semibold text-foreground truncate mt-0.5">
          {distributorName}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-7">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-1">
            <div className="px-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold mb-2">
              {section.label}
            </div>
            {section.items.map((item) =>
              renderNavItem(item, pathname, '/distributor/dashboard', /* partner */ true),
            )}
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-border/70 space-y-3">
        <div className="px-2 text-[11px] text-muted-foreground">
          Signed in as{' '}
          <span className="text-foreground font-medium">{roleLabel[memberRole] ?? memberRole}</span>
        </div>
        <button
          onClick={() => onSignOut()}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="h-4 w-4 text-foreground/50" />
          <span>Sign out</span>
        </button>
        <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-muted-foreground/80">
          <span>Powered by</span>
          <AlkaTeraIcon className="h-3 w-3 text-neon-emerald" />
          <span className="text-xs font-light text-foreground tracking-tight lowercase">
            alka<strong className="font-semibold">tera</strong>
          </span>
        </div>
      </div>
    </aside>
  );
}

/** Default alka**tera** distributor portal sidebar (paying customers). */
function DefaultSidebar({
  organizationName,
  memberRole,
  navSections,
  pathname,
  onSignOut,
}: {
  organizationName: string;
  memberRole: string;
  navSections: NavSection[];
  pathname: string | null;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 border-r border-border/60 bg-background/80 backdrop-blur-md">
      <div className="px-5 pt-5 pb-4 border-b border-border/60 bg-gradient-to-b from-sky-500/5 to-transparent">
        <Link href="/distributor/dashboard" className="block group">
          <div className="flex items-center gap-3">
            <AlkaTeraIcon className="h-9 w-9 text-neon-lime shrink-0" />
            <AlkaTeraWordmark className="text-2xl text-foreground" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Sustainability, Distilled</p>
        </Link>
      </div>

      <div className="px-5 py-4 border-b border-border/60">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 mb-2 rounded-full bg-sky-500/10 border border-sky-400/30 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              <span className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold">
                Distributor Portal
              </span>
            </div>
            <div className="text-sm font-semibold truncate">{organizationName}</div>
            <div className="text-[11px] text-muted-foreground">
              {roleLabel[memberRole] ?? memberRole}
            </div>
          </div>
          <NotificationBell />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-1">
            <div className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1.5">
              {section.label}
            </div>
            {section.items.map((item) =>
              renderNavItem(item, pathname, '/distributor/dashboard', /* partner */ false),
            )}
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-border/60">
        <button
          onClick={() => onSignOut()}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

function renderNavItem(
  item: NavItem,
  pathname: string | null,
  dashboardHref: string,
  partnerMode: boolean,
) {
  const Icon = item.icon;
  const isActive =
    pathname === item.href ||
    (item.href !== dashboardHref && pathname?.startsWith(item.href));

  if (item.disabled) {
    return (
      <div
        key={item.name}
        className={`flex items-center gap-${partnerMode ? '3' : '2.5'} px-3 py-2 rounded-lg text-sm ${
          partnerMode ? 'text-muted-foreground/50' : 'text-muted-foreground/60'
        } cursor-not-allowed`}
        title="Coming soon"
      >
        <Icon className="h-4 w-4" />
        <span>{item.name}</span>
        <span className="ml-auto text-[9px] uppercase tracking-[0.18em] font-semibold">Soon</span>
      </div>
    );
  }

  if (partnerMode) {
    return (
      <Link
        key={item.name}
        href={item.href}
        className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
          isActive
            ? 'bg-brand-primary/10 text-brand-primary font-semibold'
            : 'text-foreground/70 hover:text-foreground hover:bg-muted'
        }`}
      >
        {isActive ? (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand-primary" />
        ) : null}
        <Icon
          className={`h-4 w-4 ${
            isActive ? 'text-brand-primary' : 'text-foreground/50 group-hover:text-foreground/80'
          }`}
        />
        <span>{item.name}</span>
        {item.gated ? (
          <Lock className="h-3 w-3 ml-auto text-muted-foreground/60" />
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      key={item.name}
      href={item.href}
      className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
        isActive
          ? 'bg-sky-500/10 text-sky-200 font-semibold border-l-4 border-sky-400 -ml-px shadow-[inset_0_0_24px_-12px_rgba(56,189,248,0.4)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 border-l-4 border-transparent -ml-px'
      }`}
    >
      <Icon className={`h-4 w-4 ${isActive ? 'text-sky-300' : ''}`} />
      <span>{item.name}</span>
    </Link>
  );
}
