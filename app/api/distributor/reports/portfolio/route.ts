import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { buildPortfolioCsv, type PortfolioSkuRow } from '@/lib/distributor/exports/portfolio-csv';
import type { FieldKey } from '@/lib/distributor/scraping/field-definitions';

/**
 * GET /api/distributor/reports/portfolio
 *
 * Returns a CSV of every active SKU in the caller's portfolio, with
 * brand-level sustainability fields denormalised across each SKU row.
 *
 * Viewers see only the SKUs whose brand falls within their brand_scope /
 * category_scope.
 */
export async function GET() {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  // Brands in scope.
  let brandsQuery = auth.supabase
    .from('brand_profiles')
    .select(
      'id, name, category, country_of_origin, completeness_score, alkatera_tier, outreach_sent_at, last_submission_at',
    )
    .eq('distributor_org_id', auth.organization.id);
  if (auth.member.role === 'viewer') {
    if (Array.isArray(auth.member.brand_scope) && auth.member.brand_scope.length > 0) {
      brandsQuery = brandsQuery.in('id', auth.member.brand_scope);
    }
    if (Array.isArray(auth.member.category_scope) && auth.member.category_scope.length > 0) {
      brandsQuery = brandsQuery.in('category', auth.member.category_scope);
    }
  }
  const { data: brands } = await brandsQuery;
  type BrandRow = {
    id: string;
    name: string;
    category: string | null;
    country_of_origin: string | null;
    completeness_score: number | null;
    alkatera_tier: number;
    outreach_sent_at: string | null;
    last_submission_at: string | null;
  };
  const brandRows = (brands ?? []) as BrandRow[];
  if (brandRows.length === 0) {
    const empty = buildPortfolioCsv({
      distributorName: auth.organization.name,
      generated_at: new Date(),
      rows: [],
    });
    return csvResponse(empty, 'portfolio-export.csv');
  }

  const brandIds = brandRows.map((b) => b.id);
  const brandById = new Map(brandRows.map((b) => [b.id, b]));

  // All active SKUs across those brands.
  const { data: skus } = await auth.supabase
    .from('brand_skus')
    .select('brand_profile_id, sku_code, product_name, category, country_of_origin')
    .in('brand_profile_id', brandIds)
    .eq('listing_status', 'active')
    .order('product_name');

  // Active scraped_brand_data for every brand — collect the latest value
  // per field per brand.
  const { data: data } = await auth.supabase
    .from('scraped_brand_data')
    .select('brand_profile_id, field_key, field_value, field_value_numeric, confidence, scraped_at')
    .in('brand_profile_id', brandIds)
    .is('superseded_by', null);

  type FieldRow = {
    brand_profile_id: string;
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
    confidence: number;
    scraped_at: string;
  };
  const byBrand = new Map<string, Map<FieldKey, FieldRow>>();
  for (const row of (data ?? []) as FieldRow[]) {
    const slot = byBrand.get(row.brand_profile_id) ?? new Map<FieldKey, FieldRow>();
    const existing = slot.get(row.field_key as FieldKey);
    // Keep highest confidence; tie-break by recency.
    if (
      !existing ||
      row.confidence > existing.confidence ||
      (row.confidence === existing.confidence && row.scraped_at > existing.scraped_at)
    ) {
      slot.set(row.field_key as FieldKey, row);
    }
    byBrand.set(row.brand_profile_id, slot);
  }

  const rows: PortfolioSkuRow[] = ((skus ?? []) as Array<{
    brand_profile_id: string;
    sku_code: string | null;
    product_name: string;
    category: string | null;
    country_of_origin: string | null;
  }>).map((sku) => {
    const brand = brandById.get(sku.brand_profile_id);
    const fieldMap = byBrand.get(sku.brand_profile_id);
    const brandFields: Partial<Record<FieldKey, string>> = {};
    if (fieldMap) {
      for (const [key, row] of Array.from(fieldMap.entries())) {
        brandFields[key] = row.field_value ?? '';
      }
    }
    return {
      sku_code: sku.sku_code,
      product_name: sku.product_name,
      brand_name: brand?.name ?? '',
      category: sku.category ?? brand?.category ?? null,
      country_of_origin: sku.country_of_origin ?? brand?.country_of_origin ?? null,
      brand_fields: brandFields,
      data_completeness_pct: brand?.completeness_score ?? null,
      alkatera_tier: brand?.alkatera_tier ?? 1,
      outreach_status: brand?.last_submission_at
        ? 'responded'
        : brand?.outreach_sent_at
          ? 'sent'
          : 'not_sent',
    };
  });

  const csv = buildPortfolioCsv({
    distributorName: auth.organization.name,
    generated_at: new Date(),
    rows,
  });

  return csvResponse(csv, 'portfolio-export.csv');
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
