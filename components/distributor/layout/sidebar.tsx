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
  type LucideIcon,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { useDistributor } from '@/lib/distributor/context';
import { NotificationBell } from '@/components/distributor/notifications/notification-bell';
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

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Work',
    items: [
      { name: 'Dashboard', href: '/distributor/dashboard', icon: LayoutDashboard },
    ],
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
    items: [{ name: 'Outreach', href: '/distributor/outreach', icon: Mail }],
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
  const { organization, member } = useDistributor();
  const supabase = getSupabaseBrowserClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/distributor/login');
  }

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
            <div className="text-sm font-semibold truncate">{organization.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {roleLabel[member.role] ?? member.role}
            </div>
          </div>
          <NotificationBell />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="space-y-1">
            <div className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-1.5">
              {section.label}
            </div>
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/distributor/dashboard' && pathname?.startsWith(item.href));
              const Icon = item.icon;

              if (item.disabled) {
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground/60 cursor-not-allowed"
                    title="Coming soon"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wider">Soon</span>
                  </div>
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
            })}
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-border/60">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
