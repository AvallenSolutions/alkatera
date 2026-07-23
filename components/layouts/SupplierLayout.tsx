'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { LogOut } from 'lucide-react';

const logoUrl = '/logo.svg';

const supplierNav = [
  { name: 'Dashboard', href: '/supplier-portal' },
  { name: 'My Profile', href: '/supplier-portal/profile' },
  { name: 'Data Requests', href: '/supplier-portal/requests' },
  { name: 'Products', href: '/supplier-portal/products' },
  { name: 'ESG Assessment', href: '/supplier-portal/esg-assessment' },
];

export function SupplierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div
      className="min-h-screen bg-background"
      style={{
        // The supplier portal's room accent is forest.
        ['--room-rgb' as string]: '32 94 64',
        ['--room-accent-rgb' as string]: '32 94 64',
        ['--room-on-rgb' as string]: '242 241 234',
      } as React.CSSProperties}
    >
      {/* Header: cream band on paper, hairline below */}
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/supplier-portal" className="flex items-center gap-2">
              <img src={logoUrl} alt="alkatera" className="h-7 w-auto" />
            </Link>

            {/* Desktop nav: mono caps tabs, forest rule under the active one */}
            <nav className="hidden md:flex items-center gap-6 self-stretch">
              {supplierNav.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/supplier-portal' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center border-b-[3px] px-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                      isActive
                        ? 'border-studio-forest text-studio-forest'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-forest">
              Supplier
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-5 px-6 pb-2 overflow-x-auto">
          {supplierNav.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/supplier-portal' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`whitespace-nowrap border-b-[3px] pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors ${
                  isActive
                    ? 'border-studio-forest text-studio-forest'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
