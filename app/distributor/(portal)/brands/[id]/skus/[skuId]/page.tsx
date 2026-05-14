import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChevronLeft, Package, FileText } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkuDataTable, type SkuDataRow } from '@/components/distributor/brand-detail/sku-data-table';
import type { FieldKey } from '@/lib/distributor/scraping/field-definitions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string; skuId: string };
}

const DOC_LABELS: Record<string, string> = {
  lca_report: 'LCA report',
  carbon_report: 'Carbon footprint report',
  water_usage: 'Water usage data',
  sustainability_report: 'Sustainability report',
  packaging_data: 'Packaging data',
  certification: 'Certification',
  esg_report: 'ESG report',
  other: 'Other',
};

/**
 * Per-SKU detail page. Sits under the brand-detail layout so the tabs
 * persist while the user drills in. Shows the SKU's own metadata plus
 * a merged data view: SKU-specific findings take precedence over the
 * brand-level "inherited" findings for the same field, but both are
 * displayed so the distributor can see provenance.
 */
export default async function SkuDetailPage({ params }: PageProps) {
  const supabase = getSupabaseServerClient() as unknown as SupabaseClient;
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return null;

  const { data: member } = await supabase
    .from('distributor_members')
    .select('distributor_org_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return null;

  // Verify both the brand and the SKU belong to the caller's org.
  const { data: sku } = await supabase
    .from('brand_skus')
    .select(
      'id, brand_profile_id, sku_code, product_name, category, country_of_origin, listing_status, created_at, updated_at',
    )
    .eq('id', params.skuId)
    .eq('brand_profile_id', params.id)
    .eq('distributor_org_id', member.distributor_org_id)
    .maybeSingle();
  if (!sku) return null;

  // Pull both SKU-specific and brand-level active findings in one round
  // trip, then collapse them into one row per field with SKU-specific
  // winning if both exist.
  const { data: findingRows } = await supabase
    .from('scraped_brand_data')
    .select(
      'field_key, field_value, field_value_numeric, source_name, confidence, scraped_at, brand_sku_id',
    )
    .eq('brand_profile_id', params.id)
    .is('superseded_by', null)
    .or(`brand_sku_id.eq.${params.skuId},brand_sku_id.is.null`);

  type Raw = {
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
    source_name: string;
    confidence: number;
    scraped_at: string;
    brand_sku_id: string | null;
  };
  const raw = (findingRows ?? []) as Raw[];

  // For each field, prefer SKU-specific; within a scope, prefer highest
  // confidence.
  const byField = new Map<FieldKey, SkuDataRow>();
  for (const row of raw) {
    const existing = byField.get(row.field_key as FieldKey);
    const candidate: SkuDataRow = {
      field_key: row.field_key as FieldKey,
      value: row.field_value,
      numeric: row.field_value_numeric,
      source: row.source_name,
      confidence: row.confidence,
      updated_at: row.scraped_at,
      is_sku_specific: row.brand_sku_id === params.skuId,
    };
    if (!existing) {
      byField.set(row.field_key as FieldKey, candidate);
      continue;
    }
    // SKU-specific beats inherited.
    if (candidate.is_sku_specific && !existing.is_sku_specific) {
      byField.set(row.field_key as FieldKey, candidate);
      continue;
    }
    if (!candidate.is_sku_specific && existing.is_sku_specific) continue;
    // Same scope — keep the higher-confidence one.
    if ((candidate.confidence ?? 0) > (existing.confidence ?? 0)) {
      byField.set(row.field_key as FieldKey, candidate);
    }
  }

  // Documents tagged with this SKU.
  const { data: docRows } = await supabase
    .from('brand_document_submissions')
    .select(
      'id, file_name, document_type, file_size_bytes, vintage_year, batch_reference, submitter_name, processing_status, created_at, brand_sku_ids',
    )
    .eq('brand_profile_id', params.id)
    .contains('brand_sku_ids', [params.skuId])
    .order('created_at', { ascending: false });

  type DocRow = {
    id: string;
    file_name: string;
    document_type: string;
    file_size_bytes: number | null;
    vintage_year: number | null;
    batch_reference: string | null;
    submitter_name: string | null;
    processing_status: string;
    created_at: string;
  };
  const docs = (docRows ?? []) as DocRow[];

  const skuSpecificCount = Array.from(byField.values()).filter((r) => r.is_sku_specific).length;
  const inheritedCount = Array.from(byField.values()).filter((r) => !r.is_sku_specific).length;

  return (
    <div className="space-y-6">
      <Link
        href={`/distributor/brands/${params.id}/products`}
        className="text-sm text-muted-foreground hover:text-sky-300 inline-flex items-center gap-1"
      >
        <ChevronLeft className="h-4 w-4" /> Back to products
      </Link>

      <div>
        <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Package className="h-5 w-5 text-sky-400" />
          {sku.product_name}
        </h2>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {sku.sku_code && (
            <Badge variant="outline" className="text-muted-foreground">
              {sku.sku_code}
            </Badge>
          )}
          {sku.category && (
            <Badge variant="outline" className="text-muted-foreground">
              {sku.category}
            </Badge>
          )}
          {sku.country_of_origin && (
            <Badge variant="outline" className="text-muted-foreground">
              {sku.country_of_origin}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={
              sku.listing_status === 'active'
                ? 'text-emerald-300 border-emerald-500/30'
                : 'text-muted-foreground border-muted'
            }
          >
            {sku.listing_status}
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="py-4 px-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{skuSpecificCount}</span> finding
            {skuSpecificCount === 1 ? '' : 's'} specific to this product
          </span>
          <span>
            <span className="font-medium text-foreground">{inheritedCount}</span> inherited from
            brand
          </span>
          <span>
            <span className="font-medium text-foreground">{docs.length}</span> document
            {docs.length === 1 ? '' : 's'} tagged with this product
          </span>
        </CardContent>
      </Card>

      <SkuDataTable rows={Array.from(byField.values())} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-sky-400" />
            Documents for this product
          </CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No documents have been tagged with this specific product yet. When the brand uploads a
              file via their portal, they can pick which products it applies to — those documents
              will appear here.
            </div>
          ) : (
            <ul className="space-y-3">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-start gap-3 border border-border rounded-md p-3 bg-background/40"
                >
                  <FileText className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{doc.file_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {DOC_LABELS[doc.document_type] ?? doc.document_type}
                      {doc.vintage_year && ` · ${doc.vintage_year}`}
                      {doc.batch_reference && ` · ${doc.batch_reference}`}
                      {' · '}
                      <span className="capitalize">{doc.processing_status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Submitted by {doc.submitter_name ?? 'unknown'} ·{' '}
                      {new Date(doc.created_at).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
