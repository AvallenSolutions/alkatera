import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { validateUploadToken } from '@/lib/distributor/outreach/token-validator';
import { consumeRateLimit, rateLimitKeyFromRequest } from '@/lib/distributor/outreach/rate-limit';
import {
  pickActivePerField,
  type MergedFieldRow,
} from '@/lib/distributor/integration/data-merger';
import type { FieldKey } from '@/lib/distributor/scraping/field-definitions';

interface RawScrapedRow {
  field_key: string;
  field_value: string | null;
  field_value_numeric: number | null;
  source_name: string;
  confidence: number;
  scraped_at: string;
  brand_sku_id: string | null;
  verified_by_name: string | null;
  verified_by_email: string | null;
  verification_method: string | null;
}

export interface BrandUploadFieldState {
  field_key: FieldKey;
  brand_sku_id: string | null;
  field_value: string | null;
  field_value_numeric: number | null;
  source_name: string;
  confidence: number;
  scraped_at: string;
  verified_by_name: string | null;
  verified_at: string | null;
  verification_method: string | null;
}

/**
 * GET /api/brand-upload/[token]
 *
 * Public endpoint, no authentication. Validates the token against
 * brand_profiles.upload_token and returns the data the brand-facing
 * review portal needs:
 *
 *   - brand + distributor display info
 *   - active SKUs in the distributor's portfolio
 *   - one merged "active value" per (field_key, brand_sku_id) covering
 *     brand-level and per-SKU findings — so the page can render every
 *     field with its current value, who provided it, and whether the
 *     brand has already verified it.
 *
 * The token is never exposed inline to the page HTML beyond what's
 * needed for the form submission URL (which the brand already has).
 */
export async function GET(request: Request, { params }: { params: { token: string } }) {
  const limit = consumeRateLimit(`brand-upload-details:${rateLimitKeyFromRequest(request)}`);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdminClient() as SupabaseClient;
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const result = await validateUploadToken(supabase, params.token);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: result.reason === 'expired' ? 410 : 404 },
    );
  }
  const brand = result.brand;

  const { data: distributor } = await supabase
    .from('distributor_organizations')
    .select('name, logo_url')
    .eq('id', brand.distributor_org_id)
    .maybeSingle();
  if (!distributor) {
    return NextResponse.json({ error: 'distributor_not_found' }, { status: 404 });
  }

  // Procurement co-brand: when the outreach was dispatched on behalf
  // of a procurement org (Foodbuy in the trial), surface the
  // procurement identity here so the brand-upload page can render a
  // co-branded header. Defensive try/catch — schema may not exist on
  // older environments.
  type ProcurementCoBrand = {
    name: string;
    display_name: string | null;
    parent_company: string | null;
    logo_url: string | null;
    primary_color: string | null;
  };
  let procurement: ProcurementCoBrand | null = null;
  if (brand.procurement_origin_org_id) {
    try {
      const { data: procRow } = await supabase
        .from('procurement_organizations')
        .select('name, display_name, parent_company, logo_url, primary_color')
        .eq('id', brand.procurement_origin_org_id)
        .maybeSingle();
      if (procRow) {
        procurement = procRow as unknown as ProcurementCoBrand;
      }
    } catch {
      // procurement schema not applied — fall through to alkatera default
    }
  }

  const { data: skus } = await supabase
    .from('brand_skus')
    .select('id, product_name, sku_code, category, country_of_origin')
    .eq('brand_profile_id', brand.id)
    .eq('listing_status', 'active')
    .order('product_name', { ascending: true })
    .limit(50);

  const { data: rawRows } = await supabase
    .from('scraped_brand_data')
    .select(
      'field_key, field_value, field_value_numeric, source_name, confidence, scraped_at, brand_sku_id, verified_by_name, verified_by_email, verification_method',
    )
    .eq('brand_directory_id', brand.brand_directory_id)
    .is('superseded_by', null);

  const fieldStates = collapseFieldRows((rawRows ?? []) as RawScrapedRow[]);

  // Phase 3: count every distributor that lists this brand. Verified
  // data flows to all of them by default, so we surface this on the
  // public review page as a transparency note.
  const { count: listingCount } = await supabase
    .from('brand_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('brand_directory_id', brand.brand_directory_id);

  return NextResponse.json({
    brand: {
      name: brand.name,
      category: brand.category,
      country_of_origin: brand.country_of_origin,
    },
    distributor: {
      name: distributor.name,
      logo_url: distributor.logo_url,
    },
    procurement: procurement
      ? {
          name: procurement.display_name ?? procurement.name,
          parent_company: procurement.parent_company,
          logo_url: procurement.logo_url,
          primary_color: procurement.primary_color,
        }
      : null,
    listing_count: listingCount ?? 1,
    skus: skus ?? [],
    field_states: fieldStates,
    expires_at: brand.upload_token_expires_at,
  });
}

/**
 * Group raw scraped_brand_data rows by (field_key, brand_sku_id) and
 * pick the active row per group. Returns the flat list the UI iterates
 * over.
 *
 * brand_sku_id=null is the brand-level scope; non-null is the SKU
 * scope. The page renders both — one row in the main pillar groups,
 * another in the per-SKU section.
 */
function collapseFieldRows(rows: RawScrapedRow[]): BrandUploadFieldState[] {
  const buckets = new Map<string, RawScrapedRow[]>();
  for (const r of rows) {
    const key = `${r.brand_sku_id ?? 'brand'}::${r.field_key}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(r);
    buckets.set(key, bucket);
  }

  const out: BrandUploadFieldState[] = [];
  for (const bucket of Array.from(buckets.values())) {
    const merged: MergedFieldRow[] = bucket.map((r) => ({
      field_key: r.field_key as FieldKey,
      field_value: r.field_value,
      field_value_numeric: r.field_value_numeric,
      source: r.source_name,
      confidence: r.confidence,
      scraped_at: r.scraped_at,
    }));
    const winner = Array.from(pickActivePerField(merged).values())[0];
    if (!winner) continue;
    const winningRaw =
      bucket.find(
        (r) => r.source_name === winner.source && r.field_value === winner.field_value,
      ) ?? bucket[0];
    out.push({
      field_key: winner.field_key,
      brand_sku_id: winningRaw.brand_sku_id,
      field_value: winner.field_value,
      field_value_numeric: winner.field_value_numeric,
      source_name: winner.source,
      confidence: winner.confidence,
      scraped_at: winner.scraped_at,
      verified_by_name: winningRaw.verified_by_name,
      verified_at: winningRaw.source_name === 'brand_verified' ? winningRaw.scraped_at : null,
      verification_method: winningRaw.verification_method,
    });
  }
  return out;
}
