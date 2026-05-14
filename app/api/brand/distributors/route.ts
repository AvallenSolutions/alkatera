import { NextResponse } from 'next/server';
import { requireBrandMember } from '@/lib/distributor/integration/brand-auth';

/**
 * GET /api/brand/distributors
 *
 * Returns the list of distributors currently linked to the caller's
 * alkatera organisation, with link state (confirmed, sharing_active,
 * match method, dates).
 */
export async function GET() {
  const auth = await requireBrandMember();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const { data, error } = await auth.supabase
    .from('brand_distributor_links')
    .select(
      'id, distributor_org_id, brand_profile_id, match_method, match_confidence, confirmed_by_brand, confirmed_at, sharing_active, deactivated_at, created_at',
    )
    .eq('alkatera_org_id', auth.organization_id)
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve distributor display names so the UI doesn't need a second round-trip.
  const distributorIds = Array.from(
    new Set(
      ((data ?? []) as Array<{ distributor_org_id: string }>).map((r) => r.distributor_org_id),
    ),
  );
  let nameById = new Map<string, string>();
  if (distributorIds.length > 0) {
    const { data: orgs } = await auth.supabase
      .from('distributor_organizations')
      .select('id, name')
      .in('id', distributorIds);
    nameById = new Map(
      ((orgs ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]),
    );
  }

  const links = ((data ?? []) as Array<{ distributor_org_id: string }>).map((row) => ({
    ...row,
    distributor_name: nameById.get(row.distributor_org_id) ?? 'Unknown distributor',
  }));

  return NextResponse.json({ links });
}
