'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Package,
  Users,
  Activity,
  Database,
  ShieldCheck,
  Sparkles,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { AlkaTeraIcon, AlkaTeraWordmark } from '@/components/lca-report/Logo';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [{ name: 'Dashboard', href: '/admin', icon: LayoutDashboard }],
  },
  {
    label: 'Directory',
    items: [
      { name: 'Add brands', href: '/admin/directory/intake', icon: Sparkles },
      { name: 'Review queue', href: '/admin/directory/review', icon: ShieldCheck },
      { name: 'Brands', href: '/admin/directory/brands', icon: Building2 },
      { name: 'Products', href: '/admin/directory/products', icon: Package },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: 'Distributors', href: '/admin/distributors', icon: Users },
      { name: 'Activity', href: '/admin/activity', icon: Activity },
      { name: 'Sync health', href: '/admin/sync', icon: Database },
    ],
  },
];

export function AdminSidebar({ adminEmail }: { adminEmail: string | null }) {
  const pathname = usePathname();
  const supabase = getSupabaseBrowserClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 border-r border-border/60 bg-background/80 backdrop-blur-md">
      <div className="px-5 pt-5 pb-4 border-b border-border/60 bg-gradient-to-b from-neon-lime/5 to-transparent">
        <Link href="/admin" className="block group">
          <div className="flex items-center gap-3">
            <AlkaTeraIcon className="h-9 w-9 text-neon-lime shrink-0" />
            <AlkaTeraWordmark className="text-2xl text-foreground" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Industry directory admin</p>
        </Link>
      </div>

      <div className="px-5 py-4 border-b border-border/60">
        <div className="inline-flex items-center gap-1.5 mb-2 rounded-full bg-neon-lime/10 border border-neon-lime/30 px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-neon-lime shadow-[0_0_6px_rgba(204,255,0,0.8)]" />
          <span className="text-[10px] uppercase tracking-wider text-neon-lime font-semibold">
            alkatera staff
          </span>
        </div>
        {adminEmail && (
          <div className="text-sm font-semibold truncate">{adminEmail}</div>
        )}
        <div className="text-[11px] text-muted-foreground">Platform admin</div>
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
                (item.href !== '/admin' && pathname?.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-neon-lime/10 text-foreground font-semibold border-l-4 border-neon-lime -ml-px shadow-[inset_0_0_24px_-12px_rgba(204,255,0,0.4)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 border-l-4 border-transparent -ml-px'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-neon-lime' : ''}`} />
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
