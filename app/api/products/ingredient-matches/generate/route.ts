import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { userHasOrgAccess } from '@/lib/supabase/verify-org-access';
import { generateSuggestions } from '@/lib/suppliers/ingredient-match-generate';

/**
 * POST /api/products/ingredient-matches/generate  { organization_id }
 *
 * Brand-initiated "Find supplier matches". Authenticates via cookie, verifies
 * org membership, then runs generation with a service-role client (the
 * supplier-product candidate pool is RLS-locked to suppliers' own orgs).
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const orgId: string | undefined = body.organization_id;
  if (!orgId) return NextResponse.json({ error: 'organization_id required' }, { status: 400 });

  const cookieStore = cookies();
  const authed = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }); } catch {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }); } catch {} },
      },
    },
  );
  const { data: userData } = await authed.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  if (!(await userHasOrgAccess(service, userData.user.id, orgId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await generateSuggestions(service, orgId);
  return NextResponse.json({ ok: true, ...result });
}
