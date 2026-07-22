import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';
import { dispatchRecalcIfNeeded } from '@/lib/lca/dispatch-recalc';

export const dynamic = 'force-dynamic';

/**
 * Ask for a product's footprint to be recalculated.
 *
 * Exists for the liquid fan-out: editing a shared liquid rewrites the material
 * rows of every product that bottles it, and leaving those products showing a
 * footprint computed from the old recipe would be worse than not fanning out
 * at all. `dispatchRecalcIfNeeded` already carried this logic but was reachable
 * only from the dossier's ask handlers.
 *
 * Best effort, like the dispatcher it wraps: the recipe rows are already
 * written by the time this is called, so a failure here means a stale number,
 * not lost work. The dossier's Recalculate button remains the backstop.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const productId = Number(params.id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
  }

  const cookieStore = cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {}
        },
      },
    }
  );

  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const organizationId = await resolveAccessibleOrg(admin, user);
  if (!organizationId) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 });
  }

  const denied = await denyReadOnlyAdvisor(admin, user, organizationId);
  if (denied) return denied;

  // The service-role client bypasses RLS, so the product's ownership is
  // checked here rather than assumed from the caller's session.
  const { data: product } = await admin
    .from('products')
    .select('id, organization_id')
    .eq('id', productId)
    .maybeSingle();

  if (!product || product.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin || null;

  const result = await dispatchRecalcIfNeeded(
    admin,
    organizationId,
    user.id,
    { recalc_product_id: productId },
    baseUrl,
    'manual'
  );

  return NextResponse.json(result);
}
