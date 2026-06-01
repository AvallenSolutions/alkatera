import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePortalServerClient } from '@/lib/supabase/portal-server-client';
import { ProcurementProvider } from '@/lib/procurement/context';
import { brandThemeCss } from '@/lib/procurement/branding';
import { ProcurementSidebar } from '@/components/procurement/layout/sidebar';
import { ProcurementHeader } from '@/components/procurement/layout/header';
import type { ProcurementMember, ProcurementOrganization } from '@/types/procurement';

export const dynamic = 'force-dynamic';

const ORG_COLUMNS = `
  id, name, slug, display_name, parent_company, website, primary_market,
  subscription_tier, trial_started_at, trial_ends_at, logo_url, primary_color,
  accent_color, email_logo_url, email_sender_name, email_sender_email,
  email_footer_text, pdf_footer_text, created_at, updated_at
`;

export default async function ProcurementPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const slug = params.slug;
  const supabase = getSupabasePortalServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/procurement/${slug}/login`);
  }

  const sb = supabase as unknown as SupabaseClient;

  const { data: orgRow } = await sb
    .from('procurement_organizations')
    .select(ORG_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();

  if (!orgRow) {
    redirect(`/procurement/${slug}/login?error=org-not-found`);
  }

  const organization = orgRow as unknown as ProcurementOrganization;

  const { data: memberRow } = await sb
    .from('procurement_members')
    .select('id, procurement_org_id, user_id, role, invited_by, joined_at')
    .eq('user_id', user.id)
    .eq('procurement_org_id', organization.id)
    .maybeSingle();

  if (!memberRow) {
    redirect(`/procurement/${slug}/login?error=not-a-member`);
  }

  const member = memberRow as unknown as ProcurementMember;
  const themeCss = brandThemeCss(organization);

  return (
    <ProcurementProvider organization={organization} member={member}>
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
      {themeCss ? (
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      ) : null}
      <div className="procurement-light min-h-screen">
        <ProcurementSidebar />
        <ProcurementHeader />
        <div className="md:pl-64">
          <main className="px-6 sm:px-10 lg:px-14 py-10 max-w-[1400px] mx-auto">
            {children}
          </main>
        </div>
      </div>
    </ProcurementProvider>
  );
}
