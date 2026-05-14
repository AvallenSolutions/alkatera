import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { buildBrandSheetPdf, type BrandSheetField } from '@/lib/distributor/exports/brand-sheet-pdf';
import type { FieldKey } from '@/lib/distributor/scraping/field-definitions';

/**
 * GET /api/distributor/reports/brand-sheet?brand_profile_id=...
 *
 * Streams a generated PDF data sheet for the given brand. Scoped to the
 * caller's distributor org via RLS + an explicit eq() check.
 */
export async function GET(request: Request) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const url = new URL(request.url);
  const brandProfileId = url.searchParams.get('brand_profile_id');
  if (!brandProfileId) {
    return NextResponse.json({ error: 'brand_profile_id_required' }, { status: 400 });
  }

  const { data: brand } = await auth.supabase
    .from('brand_profiles')
    .select('id, brand_directory_id, name, category, country_of_origin, alkatera_tier')
    .eq('id', brandProfileId)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const brandDirectoryId = (brand as { brand_directory_id: string }).brand_directory_id;

  const { data: directoryScores } = await auth.supabase
    .from('brand_directory')
    .select('completeness_score')
    .eq('id', brandDirectoryId)
    .maybeSingle();

  const { data: rows } = await auth.supabase
    .from('scraped_brand_data')
    .select('field_key, field_value, field_value_numeric, source_name, confidence, scraped_at')
    .eq('brand_directory_id', brandDirectoryId)
    .is('superseded_by', null);

  const fields: BrandSheetField[] = ((rows ?? []) as Array<{
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
    source_name: string;
    confidence: number;
    scraped_at: string;
  }>).map((r) => ({
    field_key: r.field_key as FieldKey,
    value: r.field_value,
    numeric: r.field_value_numeric,
    source: r.source_name,
    confidence: r.confidence,
    updated_at: r.scraped_at,
  }));

  const pdf = buildBrandSheetPdf({
    brandName: (brand as { name: string }).name,
    distributorName: auth.organization.name,
    category: (brand as { category: string | null }).category,
    country_of_origin: (brand as { country_of_origin: string | null }).country_of_origin,
    alkatera_tier: (brand as { alkatera_tier: number }).alkatera_tier,
    completeness_score: (directoryScores as { completeness_score: number | null } | null)?.completeness_score ?? null,
    fields,
    generated_at: new Date(),
  });

  const filename = `${(brand as { name: string }).name
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()}-data-sheet.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
