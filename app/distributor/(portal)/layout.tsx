import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { DistributorProvider } from '@/lib/distributor/context';
import { DistributorSidebar } from '@/components/distributor/layout/sidebar';
import { DistributorHeader } from '@/components/distributor/layout/header';
import type { DistributorMember, DistributorOrganization } from '@/types/distributor';

export const dynamic = 'force-dynamic';

export default async function DistributorLayout({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/distributor/login');
  }

  const { data: row } = await (supabase as unknown as SupabaseClient)
    .from('distributor_members')
    .select(
      `id, distributor_org_id, user_id, role, brand_scope, category_scope, invited_by, joined_at,
       distributor_organizations:distributor_org_id (
         id, name, slug, logo_url, website, primary_market, subscription_tier, created_at, updated_at
       )`,
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (!row || !row.distributor_organizations) {
    redirect('/distributor/login');
  }

  const organization = (
    Array.isArray(row.distributor_organizations)
      ? row.distributor_organizations[0]
      : row.distributor_organizations
  ) as DistributorOrganization;

  const member: DistributorMember = {
    id: row.id,
    distributor_org_id: row.distributor_org_id,
    user_id: row.user_id,
    role: row.role,
    brand_scope: row.brand_scope,
    category_scope: row.category_scope,
    invited_by: row.invited_by,
    joined_at: row.joined_at,
  };

  return (
    <DistributorProvider organization={organization} member={member}>
      <div className="min-h-screen bg-background">
        <DistributorSidebar />
        <DistributorHeader />
        <main className="md:pl-64 px-6 py-8 max-w-6xl mx-auto md:mx-0">
          {children}
        </main>
      </div>
    </DistributorProvider>
  );
}
