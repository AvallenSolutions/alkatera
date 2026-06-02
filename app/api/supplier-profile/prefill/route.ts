import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { normalizeBrandName } from '@/lib/distributor/brand-normalizer';

// Generic mailbox providers — never match a supplier to a brand by these.
const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk',
  'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com',
  'proton.me', 'live.com', 'msn.com', 'gmx.com',
]);

function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Confidently match a supplier to a canonical brand_directory entry, by EXACT
 * normalised name or EXACT website/email domain (no fuzzy matching, to keep
 * false positives near zero). Returns the directory row or null.
 */
async function findBrandDirectoryMatch(
  supabase: SupabaseClient,
  args: { name: string; website: string | null; email: string },
): Promise<{ id: string; website: string | null; country_of_origin: string | null; description: string | null } | null> {
  const select = 'id, website, country_of_origin, description';

  // 1. Exact normalised-name match.
  const norm = normalizeBrandName(args.name);
  if (norm) {
    const { data } = await supabase
      .from('brand_directory')
      .select(select)
      .eq('normalized_name', norm)
      .limit(1)
      .maybeSingle();
    if (data) return data as any;
  }

  // 2. Exact domain match (from the supplier's website, or a non-generic email domain).
  const emailDomain = args.email.includes('@') ? args.email.split('@')[1]?.toLowerCase() : null;
  const domain =
    extractDomain(args.website) ??
    (emailDomain && !GENERIC_EMAIL_DOMAINS.has(emailDomain) ? emailDomain : null);
  if (domain) {
    const { data: candidates } = await supabase
      .from('brand_directory')
      .select(select)
      .ilike('website', `%${domain}%`)
      .limit(5);
    const exact = (candidates ?? []).find((c: any) => extractDomain(c.website) === domain);
    if (exact) return exact as any;
  }

  return null;
}

/** Latest scraped values for a brand (superseded rows excluded), by field_key. */
async function fetchScrapedFields(
  supabase: SupabaseClient,
  brandDirectoryId: string,
  fields: string[],
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from('scraped_brand_data')
    .select('field_key, field_value, confidence')
    .eq('brand_directory_id', brandDirectoryId)
    .is('superseded_by', null)
    .in('field_key', fields)
    .order('confidence', { ascending: false });
  const out: Record<string, string> = {};
  for (const row of (data ?? []) as Array<{ field_key: string; field_value: string; confidence: number }>) {
    if (!row.field_value) continue;
    // Keep the highest-confidence value per field.
    const existing = out[row.field_key];
    if (existing === undefined) out[row.field_key] = row.field_value;
  }
  return out;
}

/**
 * GET /api/supplier-profile/prefill
 *
 * Returns the best-known profile values for the signed-in supplier so the
 * "About your business" step can be a confirm-and-fill-gaps form rather than a
 * blank one. We never ask for data we already hold: values are merged across the
 * supplier's own org-scoped rows (one per buyer they've joined), the shared
 * platform directory entry, the invitation, and their signup name. Supplier-
 * entered data wins (most recently updated first).
 */
function firstNonEmpty(...vals: unknown[]): any {
  for (const v of vals) {
    if (v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return null;
}

function looksLikeEmail(s: unknown): boolean {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export async function GET() {
  const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // All of this supplier's org-scoped rows, most recently updated first.
  const { data: rows } = await supabase
    .from('suppliers')
    .select(
      'name, contact_name, contact_email, description, industry_sector, country, country_code, city, address, lat, lng, website, logo_url, updated_at',
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  const supplierRows = (rows ?? []) as Array<Record<string, any>>;

  const email = user.email ?? '';

  const { data: platform } = email
    ? await supabase
        .from('platform_suppliers')
        .select('name, contact_name, contact_email, description, industry_sector, country, website, logo_url')
        .ilike('contact_email', email)
        .maybeSingle()
    : { data: null as any };

  const { data: invite } = email
    ? await supabase
        .from('supplier_invitations')
        .select('supplier_name, contact_person_name')
        .ilike('supplier_email', email)
        .order('invited_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null as any };

  const fullName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null;

  const fromRows = (field: string) => firstNonEmpty(...supplierRows.map((r) => r[field]));

  const merged = {
    name: firstNonEmpty(fromRows('name'), platform?.name, invite?.supplier_name),
    contact_name: firstNonEmpty(
      fromRows('contact_name'),
      platform?.contact_name,
      invite?.contact_person_name,
      fullName,
    ),
    contact_email: firstNonEmpty(fromRows('contact_email'), platform?.contact_email, email),
    description: firstNonEmpty(fromRows('description'), platform?.description),
    industry_sector: firstNonEmpty(fromRows('industry_sector'), platform?.industry_sector),
    country: firstNonEmpty(fromRows('country'), platform?.country),
    country_code: fromRows('country_code'),
    city: fromRows('city'),
    address: fromRows('address'),
    lat: fromRows('lat'),
    lng: fromRows('lng'),
    website: firstNonEmpty(fromRows('website'), platform?.website),
    logo_url: firstNonEmpty(fromRows('logo_url'), platform?.logo_url),
  };

  // Enrich STILL-EMPTY fields from the canonical brand directory + scraped data we
  // already hold, but only on a confident (exact name/domain) match. Best-effort:
  // never let this break the prefill, and never override data we already have.
  try {
    const needsEnrichment =
      !merged.website || !merged.country || !merged.description || !merged.logo_url;
    const matchName = typeof merged.name === 'string' ? merged.name : '';
    if (needsEnrichment && matchName && !looksLikeEmail(matchName)) {
      const match = await findBrandDirectoryMatch(supabase, {
        name: matchName,
        website: typeof merged.website === 'string' ? merged.website : null,
        email,
      });
      if (match) {
        if (!merged.website) merged.website = match.website ?? merged.website;
        if (!merged.country) merged.country = match.country_of_origin ?? merged.country;
        if (!merged.description) merged.description = match.description ?? merged.description;
        if (!merged.website || !merged.country || !merged.description || !merged.logo_url) {
          const scraped = await fetchScrapedFields(supabase, match.id, [
            'website',
            'country_of_origin',
            'description',
            'logo_url',
          ]);
          if (!merged.website) merged.website = scraped.website ?? merged.website;
          if (!merged.country) merged.country = scraped.country_of_origin ?? merged.country;
          if (!merged.description) merged.description = scraped.description ?? merged.description;
          if (!merged.logo_url) merged.logo_url = scraped.logo_url ?? merged.logo_url;
        }
      }
    }
  } catch (e) {
    console.error('brand-directory enrichment failed (non-fatal):', e);
  }

  // The required basics are present (and the name isn't just an email placeholder).
  const complete = !!(
    merged.name &&
    !looksLikeEmail(merged.name) &&
    merged.description &&
    merged.industry_sector &&
    merged.country
  );

  return NextResponse.json({ ...merged, complete });
}
