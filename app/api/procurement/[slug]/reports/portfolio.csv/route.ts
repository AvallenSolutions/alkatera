import { NextResponse } from 'next/server';
import { requireProcurement } from '@/lib/procurement/auth';

/**
 * GET /api/procurement/[slug]/reports/portfolio.csv
 *
 * Flat CSV of every active procurement SKU joined with the
 * brand_directory's headline sustainability fields. Used by Foodbuy
 * when they want to slice the data themselves outside the portal.
 */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireProcurement(params.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const { data: skuRows } = await auth.supabase
    .from('procurement_skus')
    .select(
      `id, product_name, sku_code, channel_label, source_distributor_org_id,
       vintage, volume_per_year_liters, list_price_gbp, category, country_of_origin,
       brand_directory:brand_directory_id (
         id, name, category, country_of_origin, sustainability_score,
         completeness_score, score_tier, alkatera_org_id, website
       )`,
    )
    .eq('procurement_org_id', auth.organization.id)
    .eq('listing_status', 'active');

  type Row = {
    id: string;
    product_name: string;
    sku_code: string | null;
    channel_label: string;
    source_distributor_org_id: string;
    vintage: number | null;
    volume_per_year_liters: number | null;
    list_price_gbp: number | null;
    category: string | null;
    country_of_origin: string | null;
    brand_directory:
      | {
          id: string;
          name: string;
          category: string | null;
          country_of_origin: string | null;
          sustainability_score: number | null;
          completeness_score: number | null;
          score_tier: string | null;
          alkatera_org_id: string | null;
          website: string | null;
        }
      | {
          id: string;
          name: string;
          category: string | null;
          country_of_origin: string | null;
          sustainability_score: number | null;
          completeness_score: number | null;
          score_tier: string | null;
          alkatera_org_id: string | null;
          website: string | null;
        }[]
      | null;
  };

  // Distributor names for the channel column.
  const dIds = Array.from(
    new Set(((skuRows ?? []) as Row[]).map((r) => r.source_distributor_org_id)),
  );
  const dNames = new Map<string, string>();
  if (dIds.length > 0) {
    const { data: dRows } = await auth.supabase
      .from('distributor_organizations')
      .select('id, name')
      .in('id', dIds);
    for (const d of (dRows ?? []) as Array<{ id: string; name: string }>) {
      dNames.set(d.id, d.name);
    }
  }

  const header = [
    'brand_name',
    'product_name',
    'sku_code',
    'channel',
    'category',
    'country_of_origin',
    'vintage',
    'volume_per_year_liters',
    'list_price_gbp',
    'sustainability_score',
    'completeness_score',
    'score_tier',
    'alkatera_customer',
    'brand_website',
  ];

  const escape = (v: string | number | null | undefined): string => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [header.join(',')];
  for (const row of (skuRows ?? []) as Row[]) {
    const dir = Array.isArray(row.brand_directory) ? row.brand_directory[0] : row.brand_directory;
    lines.push(
      [
        escape(dir?.name),
        escape(row.product_name),
        escape(row.sku_code),
        escape(dNames.get(row.source_distributor_org_id) ?? row.channel_label),
        escape(row.category ?? dir?.category ?? null),
        escape(row.country_of_origin ?? dir?.country_of_origin ?? null),
        escape(row.vintage),
        escape(row.volume_per_year_liters),
        escape(row.list_price_gbp),
        escape(dir?.sustainability_score),
        escape(dir?.completeness_score),
        escape(dir?.score_tier),
        escape(dir?.alkatera_org_id ? 'yes' : 'no'),
        escape(dir?.website),
      ].join(','),
    );
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${auth.organization.slug}-portfolio-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
