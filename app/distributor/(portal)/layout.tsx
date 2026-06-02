import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { DistributorProvider } from '@/lib/distributor/context';
import { DistributorSidebar } from '@/components/distributor/layout/sidebar';
import { DistributorHeader } from '@/components/distributor/layout/header';
import { UpgradeBanner } from '@/components/distributor/upgrade/upgrade-banner';
import { brandThemeCss } from '@/lib/procurement/branding';
import type {
  DistributorMember,
  DistributorOrganization,
  PartnerProcurementBranding,
} from '@/types/distributor';

export const dynamic = 'force-dynamic';

export default async function DistributorLayout({ children }: { children: React.ReactNode }) {
  const supabase = getSupabasePortalServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/distributor/login');
  }

  const sb = supabase as unknown as SupabaseClient;

  const { data: row } = await sb
    .from('distributor_members')
    .select(
      `id, distributor_org_id, user_id, role, brand_scope, category_scope, invited_by, joined_at,
       distributor_organizations:distributor_org_id (
         id, name, slug, logo_url, website, primary_market, subscription_tier,
         is_procurement_partner, procurement_partner_since, created_at, updated_at
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

  // If this distributor is a procurement partner, look up the
  // procurement client they're operating on behalf of. The portal will
  // wear that client's brand: logo, primary colour, copy. We pick the
  // earliest active link as the "primary" procurement client — for the
  // trial each distributor has exactly one (Foodbuy). When a second
  // procurement client signs we may need a tenant switcher.
  let partnerProcurement: PartnerProcurementBranding | null = null;
  if (organization.is_procurement_partner) {
    const { data: linkRow } = await sb
      .from('procurement_distributor_links')
      .select(
        `procurement_org_id,
         procurement_organizations:procurement_org_id (
           id, name, display_name, parent_company, logo_url, primary_color, accent_color
         )`,
      )
      .eq('distributor_org_id', organization.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (linkRow?.procurement_organizations) {
      const procRaw = Array.isArray(linkRow.procurement_organizations)
        ? linkRow.procurement_organizations[0]
        : linkRow.procurement_organizations;
      partnerProcurement = procRaw as PartnerProcurementBranding;
    }
  }

  const themeCss = partnerProcurement
    ? brandThemeCss({
        logo_url: partnerProcurement.logo_url,
        primary_color: partnerProcurement.primary_color,
        accent_color: partnerProcurement.accent_color,
        email_logo_url: null,
        email_sender_name: null,
        email_sender_email: null,
        email_footer_text: null,
        pdf_footer_text: null,
      })
    : '';

  return (
    <DistributorProvider
      organization={organization}
      member={member}
      partnerProcurement={partnerProcurement}
    >
      {partnerProcurement ? (
        <>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                body {
                  background: #f7f8fa !important;
                  background-color: #f7f8fa !important;
                }
              `,
            }}
          />
          {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
          <div className="procurement-light min-h-screen">
            <DistributorSidebar />
            <DistributorHeader />
            <div className="md:pl-64">
              <main className="px-6 sm:px-10 lg:px-14 py-10 max-w-[1400px] mx-auto">
                <UpgradeBanner />
                {children}
              </main>
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-screen bg-background">
          <DistributorSidebar />
          <DistributorHeader />
          <div className="md:pl-64">
            <main className="px-6 sm:px-10 lg:px-12 py-8 max-w-[1600px] mx-auto">
              <UpgradeBanner />
              {children}
            </main>
          </div>
        </div>
      )}
    </DistributorProvider>
  );
}
