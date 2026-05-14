import { NextResponse } from 'next/server';
import { requireBrandMember } from '@/lib/distributor/integration/brand-auth';

export type SharingState = 'shared' | 'blocked' | 'custom';

export interface BrandDistributorListing {
  distributor_org_id: string;
  distributor_name: string;
  distributor_logo_url: string | null;
  /** brand_profiles.id for this distributor's listing of the brand. */
  brand_profile_id: string;
  listing_status: 'active' | 'delisted';
  listing_created_at: string;
  sku_count: number;
  /** Existing brand_distributor_links row, if the brand has confirmed the connection. */
  link: {
    id: string;
    sharing_active: boolean;
    confirmed_by_brand: boolean;
    match_method: string;
    confirmed_at: string | null;
    created_at: string;
  } | null;
  /** Effective sharing state for this distributor. */
  sharing_state: SharingState;
  /** Per-field preferences keyed by field_key. Excludes the '__all__' sentinel row. */
  blocked_fields: string[];
}

/**
 * GET /api/brand/distributors/listings
 *
 * Returns every distributor that lists the brand (queries
 * brand_profiles by brand_directory_id), enriched with the brand's
 * current sharing state per distributor. Unlike /api/brand/distributors
 * — which only returns confirmed-link distributors — this is the
 * canonical view a brand uses to manage privacy across their entire
 * presence on the platform.
 *
 * The "sharing_state" field collapses the underlying preference table
 * into one of:
 *   - 'blocked' — block_all_fields row exists for this distributor
 *     (or globally for this org)
 *   - 'custom'  — at least one per-field preference exists (some fields
 *     turned off)
 *   - 'shared'  — no relevant preferences; the brand shares everything
 */
export async function GET() {
  const auth = await requireBrandMember();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  // The brand's directory entry — created by the Phase 1 trigger on
  // organizations insert/update. If no entry exists yet (e.g. brand
  // just signed up and the trigger hasn't fired) return an empty list.
  const { data: directory } = await auth.supabase
    .from('brand_directory')
    .select('id')
    .eq('alkatera_org_id', auth.organization_id)
    .maybeSingle();
  if (!directory) {
    return NextResponse.json({ listings: [] });
  }
  const directoryId = (directory as { id: string }).id;

  // Every distributor's listing of the brand.
  const { data: profiles, error: profilesError } = await auth.supabase
    .from('brand_profiles')
    .select('id, distributor_org_id, listing_status, created_at')
    .eq('brand_directory_id', directoryId)
    .order('created_at', { ascending: true });
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }
  const profileRows = (profiles ?? []) as Array<{
    id: string;
    distributor_org_id: string;
    listing_status: 'active' | 'delisted';
    created_at: string;
  }>;
  if (profileRows.length === 0) {
    return NextResponse.json({ listings: [] });
  }

  const distributorIds = Array.from(new Set(profileRows.map((p) => p.distributor_org_id)));
  const profileIds = profileRows.map((p) => p.id);

  // Display names + logos.
  const { data: orgs } = await auth.supabase
    .from('distributor_organizations')
    .select('id, name, logo_url')
    .in('id', distributorIds);
  const orgById = new Map<string, { name: string; logo_url: string | null }>(
    ((orgs ?? []) as Array<{ id: string; name: string; logo_url: string | null }>).map((o) => [
      o.id,
      { name: o.name, logo_url: o.logo_url },
    ]),
  );

  // SKU counts per listing.
  const { data: skus } = await auth.supabase
    .from('brand_skus')
    .select('brand_profile_id')
    .in('brand_profile_id', profileIds);
  const skuCountByProfile = new Map<string, number>();
  for (const row of (skus ?? []) as Array<{ brand_profile_id: string }>) {
    skuCountByProfile.set(
      row.brand_profile_id,
      (skuCountByProfile.get(row.brand_profile_id) ?? 0) + 1,
    );
  }

  // Confirmed-link state (optional per row).
  const { data: links } = await auth.supabase
    .from('brand_distributor_links')
    .select('id, distributor_org_id, sharing_active, confirmed_by_brand, match_method, confirmed_at, created_at')
    .eq('alkatera_org_id', auth.organization_id)
    .in('distributor_org_id', distributorIds);
  const linkByDistributor = new Map<
    string,
    {
      id: string;
      sharing_active: boolean;
      confirmed_by_brand: boolean;
      match_method: string;
      confirmed_at: string | null;
      created_at: string;
    }
  >();
  for (const row of (links ?? []) as Array<{
    id: string;
    distributor_org_id: string;
    sharing_active: boolean;
    confirmed_by_brand: boolean;
    match_method: string;
    confirmed_at: string | null;
    created_at: string;
  }>) {
    linkByDistributor.set(row.distributor_org_id, row);
  }

  // Sharing preferences for this brand. We collapse per row into a
  // single sharing_state value. Block-all rows (field_key='__all__')
  // win immediately; otherwise we collect blocked fields.
  const { data: prefs } = await auth.supabase
    .from('brand_sharing_preferences')
    .select('distributor_org_id, field_key, sharing_enabled, block_all_fields')
    .eq('alkatera_org_id', auth.organization_id);
  type PrefRow = {
    distributor_org_id: string | null;
    field_key: string;
    sharing_enabled: boolean;
    block_all_fields: boolean;
  };
  const prefRows = (prefs ?? []) as PrefRow[];

  function resolveSharing(distributorOrgId: string): {
    state: SharingState;
    blocked_fields: string[];
  } {
    // A distributor is "blocked" if EITHER a global default
    // (distributor_org_id IS NULL) OR a per-distributor row has
    // block_all_fields=true.
    const blockAll = prefRows.some(
      (r) =>
        r.block_all_fields &&
        (r.distributor_org_id === null || r.distributor_org_id === distributorOrgId),
    );
    if (blockAll) {
      return { state: 'blocked', blocked_fields: [] };
    }
    const blockedFields = prefRows
      .filter(
        (r) =>
          !r.block_all_fields &&
          r.sharing_enabled === false &&
          (r.distributor_org_id === null || r.distributor_org_id === distributorOrgId),
      )
      .map((r) => r.field_key);
    if (blockedFields.length > 0) {
      return { state: 'custom', blocked_fields: Array.from(new Set(blockedFields)) };
    }
    return { state: 'shared', blocked_fields: [] };
  }

  const listings: BrandDistributorListing[] = profileRows.map((p) => {
    const org = orgById.get(p.distributor_org_id);
    const link = linkByDistributor.get(p.distributor_org_id) ?? null;
    const { state, blocked_fields } = resolveSharing(p.distributor_org_id);
    return {
      distributor_org_id: p.distributor_org_id,
      distributor_name: org?.name ?? 'Unknown distributor',
      distributor_logo_url: org?.logo_url ?? null,
      brand_profile_id: p.id,
      listing_status: p.listing_status,
      listing_created_at: p.created_at,
      sku_count: skuCountByProfile.get(p.id) ?? 0,
      link,
      sharing_state: state,
      blocked_fields,
    };
  });

  return NextResponse.json({ listings });
}
