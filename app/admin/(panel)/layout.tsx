import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { AdminSidebar } from '@/components/admin/layout/admin-sidebar';
import { AlkaTeraIcon } from '@/components/lca-report/Logo';

/**
 * Admin panel layout. Reserves access to alka**tera** staff with
 * `profiles.is_alkatera_admin = true` (or membership in the alka**tera**
 * platform org with `is_platform_admin` per the existing RPC).
 *
 * Server-side gate: a non-admin user is bounced to alka**tera** login
 * via redirect. Distributor users who happen to be logged in see a
 * clean forbidden card so they understand why they're locked out.
 */
export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect('/login');
  }

  const { data: isAdmin } = await supabase.rpc('is_alkatera_admin');
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-border/60 bg-card/40 p-8 text-center space-y-4">
          <AlkaTeraIcon className="h-12 w-12 text-neon-lime mx-auto" />
          <h1 className="text-xl font-semibold">Admin access only</h1>
          <p className="text-sm text-muted-foreground">
            You're signed in as <span className="text-foreground/80">{user.email}</span>, but this
            area is reserved for alka<strong>tera</strong> staff. If you think you should have
            access, ask an admin to flip your{' '}
            <code className="text-[12px] bg-muted/50 px-1.5 py-0.5 rounded">is_alkatera_admin</code>{' '}
            flag.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminSidebar adminEmail={user.email ?? null} />
      <main className="md:pl-64">
        <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
