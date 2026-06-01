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
  type LucideIcon,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useProcurement } from '@/lib/procurement/context';
import { AlkaTeraIcon, AlkaTeraWordmark } from '@/components/lca-report/Logo';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

function buildNav(slug: string): NavSection[] {
  return [
    {
      label: 'Overview',
      items: [{ name: 'Dashboard', href: `/procurement/${slug}/dashboard`, icon: LayoutDashboard }],
    },
    {
      label: 'Portfolio',
      items: [
        { name: 'Brands', href: `/procurement/${slug}/brands`, icon: Building2 },
        { name: 'SKU lists', href: `/procurement/${slug}/sku-lists`, icon: Upload },
      ],
    },
    {
      label: 'Engage',
      items: [{ name: 'Outreach', href: `/procurement/${slug}/outreach`, icon: Mail }],
    },
    {
      label: 'Prove',
      items: [{ name: 'Reports', href: `/procurement/${slug}/reports`, icon: BarChart3 }],
    },
    {
      label: 'Workspace',
      items: [
        { name: 'Settings', href: `/procurement/${slug}/settings`, icon: Settings, disabled: true },
      ],
    },
  ];
}

const roleLabel: Record<string, string> = {
  owner: 'Owner',
  viewer: 'Viewer',
};

export function ProcurementSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { organization, member } = useProcurement();
  const supabase = getSupabaseBrowserClient();

  const NAV_SECTIONS = buildNav(organization.slug);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push(`/procurement/${organization.slug}/login`);
  }

  const displayName = organization.display_name ?? organization.name;
  const dashboardHref = `/procurement/${organization.slug}/dashboard`;

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 border-r border-border bg-white">
      <Link
        href={dashboardHref}
        className="block px-6 pt-7 pb-6 border-b border-border/70 transition-colors hover:bg-muted/40"
      >
        {organization.logo_url ? (
          <img
            src={organization.logo_url}
            alt={displayName}
            className="h-10 max-w-[180px] object-contain"
          />
        ) : (
          <div className="text-lg font-semibold text-foreground truncate">{displayName}</div>
        )}
        {organization.parent_company ? (
          <p className="mt-3 text-[11px] text-muted-foreground truncate">
            {organization.parent_company}
          </p>
        ) : null}
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 px-2 py-0.5">
          <span className="h-1 w-1 rounded-full bg-brand-primary" />
          <span className="text-[9px] uppercase tracking-[0.18em] text-brand-primary font-semibold">
            Procurement portal
          </span>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-7">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="space-y-1">
            <div className="px-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold mb-2">
              {section.label}
            </div>
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== dashboardHref && pathname?.startsWith(item.href));
              const Icon = item.icon;

              if (item.disabled) {
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground/50 cursor-not-allowed"
                    title="Coming soon"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                    <span className="ml-auto text-[9px] uppercase tracking-[0.18em] font-semibold">
                      Soon
                    </span>
                  </div>
                );
              }

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
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-border/70 space-y-3">
        <div className="px-2 text-[11px] text-muted-foreground">
          Signed in as <span className="text-foreground font-medium">{roleLabel[member.role] ?? member.role}</span>
        </div>
        <button
          onClick={handleSignOut}
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
