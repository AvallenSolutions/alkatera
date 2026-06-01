import { getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { brandThemeCss } from '@/lib/procurement/branding';
import type { ProcurementBranding } from '@/types/procurement';

export const dynamic = 'force-dynamic';

interface AuthBrandingRow extends ProcurementBranding {
  name: string;
  display_name: string | null;
}

async function loadBranding(slug: string): Promise<AuthBrandingRow | null> {
  try {
    const sb = getSupabaseAdminClient();
    const { data } = await sb
      .from('procurement_organizations')
      .select(
        'name, display_name, logo_url, primary_color, accent_color, email_logo_url, email_sender_name, email_sender_email, email_footer_text, pdf_footer_text',
      )
      .eq('slug', slug)
      .maybeSingle();
    return (data as AuthBrandingRow | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Auth shell for the procurement portal. White-mode by default
 * (procurement tenants like Foodbuy use a light brand identity), with
 * the tenant's logo rendered above the auth card. Brand colours are
 * injected as CSS variables so the auth card + button pick them up
 * automatically.
 */
export default async function ProcurementAuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const branding = await loadBranding(params.slug);
  const themeCss = branding ? brandThemeCss(branding) : '';
  const logoUrl = branding?.logo_url ?? null;
  const displayName = branding?.display_name ?? branding?.name ?? null;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body {
              background: #ffffff !important;
              background-color: #ffffff !important;
            }
          `,
        }}
      />
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <div className="procurement-light min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-brand-primary/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[280px] h-[140px] rounded-full bg-brand-primary/10 blur-3xl" />
        </div>
        <div className="w-full max-w-md relative space-y-8">
          {logoUrl ? (
            <div className="flex justify-center">
              <img
                src={logoUrl}
                alt={displayName ?? 'Procurement portal'}
                className="h-16 max-w-[260px] object-contain"
              />
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </>
  );
}
