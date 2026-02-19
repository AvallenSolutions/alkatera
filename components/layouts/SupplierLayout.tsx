'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Package,
  LogOut,
  Leaf,
} from 'lucide-react';

const logoUrl = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';

const supplierNav = [
  { name: 'Dashboard', href: '/supplier-portal', icon: LayoutDashboard },
  { name: 'My Profile', href: '/supplier-portal/profile', icon: Building2 },
  { name: 'Data Requests', href: '/supplier-portal/requests', icon: ClipboardList },
  { name: 'Products', href: '/supplier-portal/products', icon: Package },
];

export function SupplierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/supplier-portal" className="flex items-center gap-2">
              <img src={logoUrl} alt="alkatera" className="h-7 w-auto" />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {supplierNav.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/supplier-portal' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-[#ccff00]/10 text-[#ccff00] font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/20">
              <Leaf className="h-3 w-3 text-[#ccff00]" />
              <span className="text-xs font-medium text-[#ccff00]">Supplier</span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
          {supplierNav.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/supplier-portal' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#ccff00]/10 text-[#ccff00] font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
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
