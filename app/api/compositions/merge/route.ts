import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';

export const dynamic = 'force-dynamic';

/**
 * Merge compositions the user has decided are the same: two liquids holding
 * one recipe, or two pack formats holding one specification.
 *
 * Only ever runs when a person asks for it. The platform detects identical
 * liquids and proposes; this is the accept. That split is decision 2 of
 * tasks/liquid-and-pack-plan.md, and it is why there is no automatic
 * deduplication anywhere in the liquid code.
 *
 * The merge is a repoint, not a rewrite: products move to the surviving
 * liquid and the emptied liquids are deleted. No product_materials row is
 * touched, so no footprint moves and nothing needs recalculating. The recipes
 * were identical, which is the whole premise of the proposal.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const survivorId: string | undefined = body?.survivorId;
  const mergedIds: string[] = Array.isArray(body?.mergedIds) ? body.mergedIds : [];
  const kind: 'liquid' | 'pack' = body?.kind === 'pack' ? 'pack' : 'liquid';
  const { table, linkColumn } =
    kind === 'pack'
      ? { table: 'pack_formats', linkColumn: 'pack_format_id' }
      : { table: 'liquids', linkColumn: 'liquid_id' };

  if (!survivorId || mergedIds.length === 0) {
    return NextResponse.json(
      { error: 'A survivor and at least one composition to merge are required' },
      { status: 400 }
    );
  }
  if (mergedIds.includes(survivorId)) {
    return NextResponse.json(
      { error: 'The survivor cannot also be one of the merged ones' },
      { status: 400 }
    );
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
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const organizationId = await resolveAccessibleOrg(admin, user);
  if (!organizationId) return NextResponse.json({ error: 'Not authorised' }, { status: 403 });

  const denied = await denyReadOnlyAdvisor(admin, user, organizationId);
  if (denied) return denied;

  // The service-role client bypasses RLS, so every composition named here is
  // checked against the caller's organisation rather than assumed.
  const allIds = [survivorId, ...mergedIds];
  const { data: liquids, error: loadError } = await admin
    .from(table)
    .select('id, organization_id, name')
    .in('id', allIds);

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }
  if (!liquids || liquids.length !== allIds.length) {
    return NextResponse.json({ error: 'One or more were not found' }, { status: 404 });
  }
  if (liquids.some((l) => l.organization_id !== organizationId)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 });
  }

  // Repoint first. If this fails nothing has been destroyed and the user can
  // try again; deleting first would strand products on a missing liquid.
  const { data: moved, error: repointError } = await admin
    .from('products')
    .update({ [linkColumn]: survivorId })
    .in(linkColumn, mergedIds)
    .select('id');

  if (repointError) {
    return NextResponse.json({ error: repointError.message }, { status: 500 });
  }

  const { error: deleteError } = await admin.from(table).delete().in('id', mergedIds);
  if (deleteError) {
    // The products are already safely on the survivor, so this is untidy
    // rather than harmful: the merged liquids simply linger with no products.
    return NextResponse.json(
      {
        merged: true,
        productsMoved: moved?.length ?? 0,
        warning: 'The products were moved but the empty records could not be removed.',
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    merged: true,
    productsMoved: moved?.length ?? 0,
    survivorId,
  });
}
